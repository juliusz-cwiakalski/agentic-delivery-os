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
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const ROOT = process.cwd();

mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });

/** The owner CLI binary names the credential strategies may never really run. */
const OWNER_CLI_BINARIES = new Set(["gh", "opencode", "claude", "claude-code"]);

const basenameOf = (program: unknown): string => {
  if (typeof program !== "string") return "";
  const segments = program.split(/[\\/]/);
  return segments[segments.length - 1] ?? "";
};

const HERMETICITY_GUARD = "hermeticity-guard";

const guardMessage = (surface: string, program: unknown): string =>
  `${HERMETICITY_GUARD}: a test attempted a real ${surface} of owner CLI binary ` +
  `"${basenameOf(program)}" — credential strategies run only through the ` +
  `injected child-runner seam; inject a recorded seam instead`;

const guarded = (surface: string, original: unknown) =>
  function guardedSpawn(this: unknown, ...args: unknown[]): unknown {
    const program = args[0];
    if (OWNER_CLI_BINARIES.has(basenameOf(program))) {
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
