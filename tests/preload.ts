/**
 * The test preload: the scratch-root guarantee plus the hermeticity guard.
 *
 * 1. `tmp/` is git-ignored, so a fresh checkout has no `tmp/tmpdir`, yet
 *    several suites `mkdtemp` beneath that path. Creating it here —
 *    idempotently, once per test process, before any suite loads — means no
 *    suite depends on another suite having run first.
 *
 * 2. The hermeticity guard (TC-HERM-001, GH-394 F-8/NFR-4): behaviour-based,
 *    not environment-absence-based — CI runners may ship a real `gh`, so the
 *    guard must hold regardless. Every child-process spawn surface is wrapped
 *    at preload: an attempt to execute an owner CLI binary by name (the two
 *    allowlisted programs and the declared harness binaries) fails the suite
 *    and names the offending invocation. Reaching a real store or keyring goes
 *    through those same binaries (the export or the token read), so the spawn
 *    interception is the behavioural control; suites construct every strategy
 *    over the four injected construction-input seams and never take this path.
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";

const ROOT = process.cwd();

mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });

/** The owner CLI binary names the credential strategies may never really run. */
const OWNER_CLI_BINARIES = new Set(["gh", "opencode", "claude", "claude-code"]);

const basenameOf = (program: unknown): string => {
  if (typeof program !== "string") return "";
  const segments = program.split(/[\\/]/);
  return segments[segments.length - 1] ?? "";
};

/** The repo-local scratch root every spawn fixture builds its stub binaries under. */
const STUB_ROOT = join(ROOT, "tmp", "tmpdir");

/** True when a resolved program path lies inside the fixture stub root. */
const underStubRoot = (candidate: string): boolean =>
  candidate === STUB_ROOT || candidate.startsWith(`${STUB_ROOT}${sep}`);

/** The options bag of a spawn call, if one was passed (never the argv array or a callback). */
const optionsOf = (args: readonly unknown[]): Record<string, unknown> | undefined => {
  for (const arg of args.slice(1)) {
    if (arg !== null && typeof arg === "object" && !Array.isArray(arg)) {
      return arg as Record<string, unknown>;
    }
  }
  return undefined;
};

/** Resolve a bare command name along a PATH list the way the OS would: first hit wins. */
const resolveAlongPath = (name: string, pathValue: string): string | undefined => {
  for (const directory of pathValue.split(":")) {
    if (directory.length === 0) continue;
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
};

const HERMETICITY_GUARD = "hermeticity-guard";

const guardMessage = (surface: string, program: unknown): string =>
  `${HERMETICITY_GUARD}: a test attempted a real ${surface} of owner CLI binary ` +
  `"${basenameOf(program)}" — credential strategies run only through the ` +
  `injected child-runner seam; inject a recorded seam instead`;

/**
 * The fixture-root exemption (GH-394 review iter-2 F-6): pre-existing spawn
 * suites (TC-CLI-014/015, TC-HDA-010..035) drive the real process edge against
 * stub owner-CLI binaries built under tmp/tmpdir, declared FIRST on the
 * child's own PATH — exactly what the OS would resolve. An owner-CLI name is
 * exempt only when the invocation's declared env.PATH resolves it inside the
 * stub root, or (bare name, declared PATH) when it resolves nowhere at all so
 * the spawn fails with its natural ENOENT; an explicit program path is exempt
 * only when it resolves inside the stub root. A bare name over the ambient
 * PATH — TC-HERM-001's teeth pass no options — is always intercepted, as is
 * any resolution to a real binary outside the stub root, so the guard's
 * behavioral control for real binaries on real PATHs is intact.
 */
const isFixtureStubSpawn = (program: string, args: readonly unknown[]): boolean => {
  if (program.includes("/") || program.includes("\\")) {
    return underStubRoot(resolve(program));
  }
  const options = optionsOf(args);
  const env = options?.env;
  const declaredPath =
    env !== null &&
    typeof env === "object" &&
    typeof (env as Record<string, unknown>).PATH === "string"
      ? ((env as Record<string, unknown>).PATH as string)
      : undefined;
  if (declaredPath === undefined) return false;
  const resolved = resolveAlongPath(program, declaredPath);
  return resolved === undefined || underStubRoot(resolved);
};

const guarded = (surface: string, original: unknown) =>
  function guardedSpawn(this: unknown, ...args: unknown[]): unknown {
    const program = args[0];
    if (
      typeof program === "string" &&
      OWNER_CLI_BINARIES.has(basenameOf(program)) &&
      !isFixtureStubSpawn(program, args)
    ) {
      throw new Error(guardMessage(surface, program));
    }
    return (original as (...innerArgs: unknown[]) => unknown).apply(this, args);
  };

type MutableChildProcess = Record<string, unknown>;

const installGuard = (): void => {
  try {
    // node:child_process is a CJS module whose exports object the compiled
    // interop reads at call time, so wrapping the REQUIRED exports object
    // intercepts every already-imported binding too. (The ESM namespace for
    // builtins is frozen; the CJS exports object is the mutation point.)
    const require = createRequire(import.meta.url);
    const childProcess = require("node:child_process") as unknown as MutableChildProcess;
    for (const surface of ["spawnSync", "spawn", "execFile", "exec"]) {
      const original = childProcess[surface];
      if (typeof original !== "function") continue;
      Object.defineProperty(childProcess, surface, {
        value: guarded(surface, original),
        writable: true,
        configurable: true,
      });
    }
    const bunGlobal = (globalThis as { Bun?: Record<string, unknown> }).Bun;
    if (bunGlobal !== undefined) {
      for (const surface of ["spawn", "spawnSync"]) {
        const original = bunGlobal[surface];
        if (typeof original !== "function") continue;
        bunGlobal[surface] = guarded(`Bun.${surface}`, original);
      }
    }
  } catch {
    // See the guard-installation note above: never break the run.
  }
};

installGuard();
