/**
 * `runCli(argv, streams, deps)` — the deterministic, in-process command surface
 * (F-5, F-6).
 *
 * Arguments in, injected streams out, numeric exit code returned. Machine
 * envelopes are written only under `--json`; human diagnostics go to the error
 * stream. Top-level containment guarantees exactly one valid envelope per run,
 * including broken invocations and hostile handler bodies.
 */
import {
  type BrandIdentity,
  type CommandResult,
  type CommandResultError,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
  RESULT_SCHEMA_VERSION,
} from "@delivery-os/core/contracts";
import { classifyThrown, resolveAppErrorCode } from "./classify";
import { type CliStreams, writeOutput } from "./output/serialize";
import { projectExitCode } from "./projection";

export type { CliSink, CliStreams } from "./output/serialize";

/** Flags parsed for a command invocation. */
export type CommandFlags = Readonly<Record<string, string | true>>;

/** Input handed to an injected command handler. */
export type CommandInvocation = {
  readonly command: string;
  readonly flags: CommandFlags;
  readonly argv: readonly string[];
  readonly brand: BrandIdentity;
};

/** A pure command handler injected by the caller (A-T8: no registry ships). */
export type CommandHandler = (invocation: CommandInvocation) => unknown | Promise<unknown>;

/** One synthetic command definition: handler plus argument-shape metadata. */
export type CommandDefinition = {
  readonly handler: CommandHandler;
  readonly flags?: readonly string[];
  readonly requiresValue?: readonly string[];
  readonly conflicts?: readonly (readonly [string, string])[];
};

/** The injected command program. */
export type CommandProgram = {
  readonly commands: Readonly<Record<string, CommandDefinition>>;
};

/** Injected clock facts (A-T3). */
export type CliClock = { readonly now: () => number };

/** Everything dynamic the surface needs, injected at the edge. */
export type CliDependencies = {
  readonly brand: BrandIdentity;
  readonly clock: CliClock;
  readonly newRunId: () => string;
  readonly secrets: readonly string[];
  readonly program: CommandProgram;
};

type Outcome =
  | { readonly type: "success"; readonly data: unknown }
  | {
      readonly type: "failure";
      readonly entry: ErrorTableEntry;
      readonly summary?: string;
      readonly message?: string;
    };

type ParsedInvocation =
  | {
      readonly ok: true;
      readonly command: string;
      readonly flags: Record<string, string | true>;
      readonly tokens: readonly string[];
    }
  | { readonly ok: false; readonly reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const entryFor = (code: string): ErrorTableEntry => {
  const resolution = resolveAppErrorCode(code);
  if (!resolution.ok) throw new Error(`${code} is not declared`);
  return resolution.entry;
};

const explicitSummary = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const summary = value.summary;
  return typeof summary === "string" && summary.length > 0 ? summary : undefined;
};

const failureOutcome = (entry: ErrorTableEntry, value?: unknown): Outcome => {
  const summary = explicitSummary(value);
  return summary === undefined ? { type: "failure", entry } : { type: "failure", entry, summary };
};

const invocationFailure = (reason: string): Outcome => ({
  type: "failure",
  entry: entryFor(FALLBACK_INVOCATION_CODE),
  message: reason,
});

const internalFailure = (summary?: string): Outcome =>
  summary === undefined
    ? failureOutcome(entryFor(FALLBACK_INTERNAL_CODE))
    : { type: "failure", entry: entryFor(FALLBACK_INTERNAL_CODE), summary };

const outcomeFromResult = (result: unknown): Outcome => {
  if (!isRecord(result)) return failureOutcome(entryFor(FALLBACK_INTERNAL_CODE));
  const hasData = Object.hasOwn(result, "data");
  const hasError = Object.hasOwn(result, "error");
  if (hasData === hasError) {
    return failureOutcome(entryFor(FALLBACK_INTERNAL_CODE), result);
  }
  if (hasError) {
    const failure = result.error;
    return failureOutcome(classifyThrown(failure), failure);
  }
  return { type: "success", data: result.data === undefined ? {} : result.data };
};

const parseInvocation = (argv: readonly string[], program: CommandProgram): ParsedInvocation => {
  const tokens = argv.filter((token) => token !== "--json");
  const command = tokens[0];
  if (command === undefined || command.startsWith("-")) {
    return { ok: false, reason: "no command supplied" };
  }
  const definition = program.commands[command];
  if (definition === undefined) {
    return { ok: false, reason: `unknown command "${command}"` };
  }
  const allowedFlags = new Set([
    ...(definition.flags ?? []),
    ...(definition.requiresValue ?? []),
    ...(definition.conflicts ?? []).flat(),
  ]);
  const flags: Record<string, string | true> = {};
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] as string;
    if (!token.startsWith("--")) {
      return { ok: false, reason: `unexpected argument "${token}"` };
    }
    if (!allowedFlags.has(token)) {
      return { ok: false, reason: `unknown flag "${token}"` };
    }
    if ((definition.requiresValue ?? []).includes(token)) {
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, reason: `missing value for "${token}"` };
      }
      flags[token] = value;
      index += 1;
    } else {
      flags[token] = true;
    }
  }
  for (const [first, second] of definition.conflicts ?? []) {
    if (Object.hasOwn(flags, first) && Object.hasOwn(flags, second)) {
      return { ok: false, reason: `conflicting flags "${first}" and "${second}"` };
    }
  }
  return { ok: true, command, flags, tokens };
};

const toErrorObject = (entry: ErrorTableEntry, summary: string | undefined): CommandResultError => {
  const effectiveSummary = summary ?? entry.summary;
  const error: CommandResultError = {
    code: entry.code,
    category: entry.category,
    retryable: entry.retryable,
    consequence: entry.consequence,
    remediationHint: entry.remediationHint,
  };
  return effectiveSummary === undefined ? error : { ...error, summary: effectiveSummary };
};

const buildEnvelope = (
  outcome: Outcome,
  runId: string,
  timing: { readonly totalMs: number },
): CommandResult => {
  if (outcome.type === "success") {
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      runId,
      exitCode: projectExitCode("success"),
      timing,
      data: outcome.data,
    };
  }
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    runId,
    exitCode: projectExitCode(outcome.entry.projectionClass),
    timing,
    error: toErrorObject(outcome.entry, outcome.summary),
  };
};

const diagnosticFor = (outcome: Outcome, brand: BrandIdentity): string | undefined => {
  if (outcome.type === "success") return undefined;
  const lines = [`${brand.binaryName}: ${outcome.message ?? outcome.entry.code}`];
  if (outcome.summary !== undefined) lines.push(`summary: ${outcome.summary}`);
  return `${lines.join("\n")}\n`;
};

/**
 * Execute one command invocation entirely in process.
 *
 * Never spawns a process, never calls `process.exit`, and never writes to the
 * real process streams; the numeric exit code is the returned contract.
 */
export async function runCli(
  argv: readonly string[],
  streams: CliStreams,
  deps: CliDependencies,
): Promise<number> {
  const emitEnvelope = argv.includes("--json");
  const startedAt = deps.clock.now();
  const runId = deps.newRunId();
  let outcome: Outcome;

  try {
    const parsed = parseInvocation(argv, deps.program);
    if (!parsed.ok) {
      outcome = invocationFailure(parsed.reason);
    } else {
      const definition = deps.program.commands[parsed.command];
      if (definition === undefined) throw new Error("command definition disappeared");
      try {
        const result = await definition.handler({
          command: parsed.command,
          flags: parsed.flags,
          argv: parsed.tokens,
          brand: deps.brand,
        });
        outcome = outcomeFromResult(result);
      } catch (thrown) {
        outcome = failureOutcome(classifyThrown(thrown), thrown);
      }
    }
  } catch (thrown) {
    outcome = failureOutcome(classifyThrown(thrown), thrown);
  }

  const finishedAt = deps.clock.now();
  const timing = { totalMs: Math.max(0, Math.trunc(finishedAt - startedAt)) };
  const envelope = buildEnvelope(outcome, runId, timing);
  const diagnostic = diagnosticFor(outcome, deps.brand);
  let exitCode = envelope.exitCode;

  try {
    writeOutput(streams, envelope, diagnostic, deps.secrets, emitEnvelope);
  } catch {
    const fallback = buildEnvelope(internalFailure("Output serialization failed."), runId, timing);
    writeOutput(
      streams,
      fallback,
      `${deps.brand.binaryName}: ${FALLBACK_INTERNAL_CODE}\n`,
      deps.secrets,
      true,
    );
    exitCode = fallback.exitCode;
  }

  return exitCode;
}
