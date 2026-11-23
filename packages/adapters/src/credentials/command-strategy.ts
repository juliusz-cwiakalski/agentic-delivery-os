/**
 * The `command` credential strategy (F-2, DM-4) and the bounded child seam.
 *
 * A matched allowlist declaration executes directly through the injected child
 * runner: no shell, no interpolation, closed stdin, stdout captured to the
 * fixed bound, stderr reduced to size and exit status, a reduced child
 * environment, and a per-execution cap. Material is one line: trailing line
 * endings stripped; an interior newline or empty output after stripping is a
 * refused shape, never material.
 *
 * This module is the only place command execution mechanics live; the
 * credential-material boundary (NFR-7) keeps everything here inside the
 * credentials directory.
 */
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import type {
  CredentialFailureReason,
  CredentialResolution,
  CredentialResolutionFailure,
  CredentialSourceKey,
} from "@delivery-os/core/contracts";
import {
  type AllowlistEntry,
  COMMAND_STDOUT_MAX_BYTES,
  COMMAND_TIMEOUT_DEFAULT_MS,
  COMMAND_TIMEOUT_MAX_MS,
  constructArgv,
  matchCommandDeclaration,
  remedyText,
} from "#credentials/allowlist";

/** An injected environment record; production passes the process environment. */
export type CredentialEnvironment = Readonly<Record<string, string | undefined>>;

/** One bounded child execution request. Stdin is always closed. */
export type ChildRunRequest = {
  readonly argv: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs: number;
  readonly stdoutMaxBytes: number;
};

/** One bounded child execution outcome. Stderr is size and exit status only. */
export type ChildRunOutcome =
  | {
      readonly ok: true;
      readonly exitCode: number;
      readonly stdout: string;
      readonly stdoutTruncated: boolean;
      readonly stderrBytes: number;
    }
  | { readonly ok: false; readonly reason: "timeout" | "program-unavailable" };

/** The injected child runner seam: every execution goes through it. */
export type ChildRunner = (request: ChildRunRequest) => ChildRunOutcome;

/** The parent variables the reduced child environment forwards. */
const FORWARDED_PARENT_VARIABLES = [
  "PATH",
  "HOME",
  "DBUS_SESSION_BUS_ADDRESS",
  "XDG_RUNTIME_DIR",
] as const;

/**
 * The reduced child environment: exactly path, home, and the session-bus
 * facts where the child's own keyring access requires them, each only when
 * present in the parent record — never any other parent variable.
 */
export const reducedChildEnvironment = (parent: CredentialEnvironment): Record<string, string> => {
  const reduced: Record<string, string> = {};
  for (const name of FORWARDED_PARENT_VARIABLES) {
    const value = parent[name];
    if (typeof value === "string") reduced[name] = value;
  }
  return reduced;
};

/** The production child runner: direct spawnSync, no shell. */
export const createSpawnChildRunner = (): ChildRunner => {
  return (request: ChildRunRequest): ChildRunOutcome => {
    const program = request.argv[0];
    if (program === undefined) return { ok: false, reason: "program-unavailable" };
    const result = spawnSync(program, request.argv.slice(1), {
      shell: false,
      input: Buffer.alloc(0),
      env: { ...request.environment },
      timeout: request.timeoutMs,
      maxBuffer: request.stdoutMaxBytes,
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error !== undefined) {
      const err = result.error;
      if ("code" in err) {
        const code: unknown = err.code;
        if (code === "ETIMEDOUT") return { ok: false, reason: "timeout" };
        if (code === "ENOBUFS") {
          return {
            ok: true,
            exitCode: result.status ?? 1,
            stdout: typeof result.stdout === "string" ? result.stdout : "",
            stdoutTruncated: true,
            stderrBytes: Buffer.byteLength(result.stderr ?? "", "utf8"),
          };
        }
      }
      return { ok: false, reason: "program-unavailable" };
    }
    return {
      ok: true,
      exitCode: result.status ?? 1,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stdoutTruncated: false,
      stderrBytes: Buffer.byteLength(result.stderr ?? "", "utf8"),
    };
  };
};

/** The inputs a `command` resolution consumes, over the injected seams. */
export type CommandSourceInput = {
  readonly runChild: ChildRunner;
  readonly parentEnvironment: CredentialEnvironment;
  readonly registerSecret: (value: string) => void;
};

const failure = (
  source: string,
  reason: CredentialFailureReason,
  remedy: string,
): CredentialResolutionFailure => ({
  ok: false,
  code: "config.credential.missing",
  domainKind: "config",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  projectionClass: "user-validation",
  source,
  reason,
  remedy,
});

/** Strip trailing line endings; the remaining text must be one line. */
const oneLineMaterial = (
  stdout: string,
): { ok: true; value: string } | { ok: false; reason: "empty-output" | "shape-drift" } => {
  const stripped = stdout.replace(/[\r\n]+$/, "");
  if (stripped.length === 0) return { ok: false, reason: "empty-output" };
  if (stripped.includes("\n") || stripped.includes("\r"))
    return { ok: false, reason: "shape-drift" };
  return { ok: true, value: stripped };
};

/**
 * Resolve a `command` source through the injected seams: allowlist match,
 * symlink resolution to a regular executable target, one bounded execution,
 * and the one-line material rule. Every refusal carries its source, reason,
 * and the fixed per-entry remedy.
 */
export const resolveCommandSource = (
  sourceKey: Extract<CredentialSourceKey, { style: "command" }>,
  input: CommandSourceInput,
): CredentialResolution => {
  const source = `command:${sourceKey.program}`;
  const match = matchCommandDeclaration(sourceKey);
  if (!match.ok) {
    return failure(source, "source-not-supported", remedyText("source-not-supported", "command"));
  }
  const entry: AllowlistEntry = match.entry;
  const resolveTarget = programTargetResolvable(sourceKey.program);
  if (!resolveTarget) {
    return failure(
      source,
      "program-unavailable",
      remedyText("program-unavailable", "command", entry),
    );
  }
  const requestedTimeout = sourceKey.timeoutMs ?? COMMAND_TIMEOUT_DEFAULT_MS;
  const timeoutMs = Math.min(requestedTimeout, COMMAND_TIMEOUT_MAX_MS);
  const run = input.runChild({
    argv: constructArgv(entry, match.parsed),
    environment: reducedChildEnvironment(input.parentEnvironment),
    timeoutMs,
    stdoutMaxBytes: COMMAND_STDOUT_MAX_BYTES,
  });
  if (!run.ok) {
    return failure(source, run.reason, remedyText(run.reason, "command", entry));
  }
  if (run.exitCode !== 0) {
    return failure(source, "non-zero-exit", remedyText("non-zero-exit", "command", entry));
  }
  if (run.stdoutTruncated) {
    return failure(source, "shape-drift", remedyText("shape-drift", "command", entry));
  }
  const material = oneLineMaterial(run.stdout);
  if (!material.ok) {
    return failure(source, material.reason, remedyText(material.reason, "command", entry));
  }
  input.registerSecret(material.value);
  return { ok: true, material: { value: material.value } };
};

/** Resolve the program path through every symlink; require a regular executable target. */
const programTargetResolvable = (programPath: string): boolean => {
  try {
    const resolved = realpathSync(programPath);
    const stat = statSync(resolved);
    return stat.isFile() && (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
};

/** One raw harness export run: bounded capture, no material rule applied. */
export type HarnessExportRun =
  | {
      readonly ok: true;
      readonly stdout: string;
      readonly stdoutTruncated: boolean;
      readonly stderrBytes: number;
    }
  | { readonly ok: false; readonly reason: "timeout" | "non-zero-exit" | "program-unavailable" };

/**
 * Run the allowlisted harness export for one declared integration through the
 * injected child runner. The raw stdout returns to the store-facts consumer
 * unmodified; the one-line material rule is a `command`-style rule and is not
 * applied here.
 */
export const runHarnessExport = (input: {
  readonly programPath: string;
  readonly integrationId: string;
  readonly standalone: boolean;
  readonly runChild: ChildRunner;
  readonly parentEnvironment: CredentialEnvironment;
  readonly timeoutMs?: number;
}): HarnessExportRun => {
  const sourceKey: Extract<CredentialSourceKey, { style: "command" }> = {
    style: "command",
    program: input.programPath,
    args: ["auth", "export", ...(input.standalone ? ["--standalone"] : []), input.integrationId],
  };
  const match = matchCommandDeclaration(sourceKey);
  if (!match.ok) return { ok: false, reason: "program-unavailable" };
  if (!programTargetResolvable(input.programPath)) {
    return { ok: false, reason: "program-unavailable" };
  }
  const requestedTimeout = input.timeoutMs ?? COMMAND_TIMEOUT_DEFAULT_MS;
  const run = input.runChild({
    argv: constructArgv(match.entry, match.parsed),
    environment: reducedChildEnvironment(input.parentEnvironment),
    timeoutMs: Math.min(requestedTimeout, COMMAND_TIMEOUT_MAX_MS),
    stdoutMaxBytes: COMMAND_STDOUT_MAX_BYTES,
  });
  if (!run.ok) return { ok: false, reason: run.reason };
  if (run.exitCode !== 0) return { ok: false, reason: "non-zero-exit" };
  return {
    ok: true,
    stdout: run.stdout,
    stdoutTruncated: run.stdoutTruncated,
    stderrBytes: run.stderrBytes,
  };
};
