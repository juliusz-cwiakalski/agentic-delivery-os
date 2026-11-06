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
  type AuditAgentIdentity,
  type AuditInvocationFacts,
  type BrandIdentity,
  type CommandResult,
  type CommandResultError,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
  type ProjectionClass,
  RESULT_SCHEMA_VERSION,
} from "@delivery-os/core/contracts";
import { classifyThrown, resolveAppErrorCode } from "./classify.js";
import { type CliStreams, redact, writeOutput } from "./output/serialize.js";
import { projectExitCode } from "./projection.js";

export type { CliSink, CliStreams } from "./output/serialize.js";

/** Flags parsed for a command invocation. */
export type CommandFlags = Readonly<Record<string, string | true>>;

/** Input handed to an injected command handler. */
export type CommandInvocation = {
  readonly command: string;
  readonly flags: CommandFlags;
  readonly argv: readonly string[];
  readonly positionals: readonly string[];
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
  readonly positionals?: { readonly max: number };
  readonly humanSuccess?: boolean;
  readonly humanText?: (data: unknown, brand: BrandIdentity) => string | undefined;
  /**
   * Project a successful handler's verdict data onto an exit class. A negative
   * verdict is still a success envelope (data present); only the exit number
   * comes from this projection. Handlers never choose an exit literal.
   */
  readonly exitProjection?: (data: unknown, brand: BrandIdentity) => ProjectionClass;
};

/** The injected command program. */
export type CommandProgram = {
  readonly commands: Readonly<Record<string, CommandDefinition>>;
};

/** Injected clock facts (A-T3). */
export type CliClock = { readonly now: () => number };

/** The machine-output mode fact, injected at the runtime-aware edge (DEC-2). */
export type CliMode = "interactive" | "scripted";

/** One audit write result: success, or an existing state identity on failure. */
export type CliAuditWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string };

/**
 * The injected audit seam: the store-backed writer plus the invocation scope,
 * optional repository target, and the claimed identity resolved at the edge.
 */
export type CliAuditDependencies = {
  readonly scope: string;
  readonly repo?: string;
  readonly identity?: AuditAgentIdentity;
  readonly record: (facts: AuditInvocationFacts) => CliAuditWriteResult;
};

/** Everything dynamic the surface needs, injected at the edge. */
export type CliDependencies = {
  readonly brand: BrandIdentity;
  readonly clock: CliClock;
  readonly newRunId: () => string;
  readonly secrets: readonly string[];
  readonly program: CommandProgram;
  /** Injected mode fact; the historical default stays interactive. */
  readonly mode?: CliMode;
  /** Injected audit writer; when absent the run is not audited. */
  readonly audit?: CliAuditDependencies;
};

type Outcome =
  | {
      readonly type: "success";
      readonly data: unknown;
      readonly warnings?: readonly string[];
    }
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
      readonly positionals: readonly string[];
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
  // No untrusted config summary, even when the discriminator was malformed and
  // classification contained it as fallback.internal.
  const configShaped =
    isRecord(value) &&
    (value.kind === "config" ||
      (typeof value.code === "string" && value.code.startsWith("config.")));
  const summary =
    configShaped || entry.domainKind === "config" ? undefined : explicitSummary(value);
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
    return failureOutcome(entryFor(FALLBACK_INTERNAL_CODE));
  }
  if (hasError) {
    const failure = result.error;
    return failureOutcome(classifyThrown(failure), failure);
  }
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  return {
    type: "success",
    data: result.data === undefined ? {} : result.data,
    ...(warnings.length === 0 ? {} : { warnings }),
  };
};

const GLOBAL_FLAGS: ReadonlySet<string> = new Set(["--json", "--verbose", "--pretty"]);

const commandToken = (argv: readonly string[]): string =>
  argv.find((token) => !GLOBAL_FLAGS.has(token)) ?? "";

const parseInvocation = (argv: readonly string[], program: CommandProgram): ParsedInvocation => {
  const tokens = argv.filter((token) => !GLOBAL_FLAGS.has(token));
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
  const positionals: string[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      if (
        definition.positionals === undefined ||
        positionals.length >= definition.positionals.max
      ) {
        return { ok: false, reason: `unexpected argument "${token}"` };
      }
      positionals.push(token);
      continue;
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
  return { ok: true, command, flags, positionals, tokens };
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
  successProjection: ProjectionClass,
): CommandResult => {
  if (outcome.type === "success") {
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      runId,
      exitCode: projectExitCode(successProjection),
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
  const verbose = argv.includes("--verbose");
  const pretty = argv.includes("--pretty");
  const mode: CliMode = deps.mode ?? "interactive";
  const startedAt = deps.clock.now();
  const runId = deps.newRunId();
  let outcome: Outcome;
  let humanSuccess = false;
  let humanText: string | undefined;
  let successProjection: ProjectionClass = "success";

  try {
    const parsed = parseInvocation(argv, deps.program);
    if (!parsed.ok) {
      outcome = invocationFailure(parsed.reason);
    } else {
      const definition = deps.program.commands[parsed.command];
      if (definition === undefined) throw new Error("command definition disappeared");
      humanSuccess = definition.humanSuccess === true;
      try {
        const result = await definition.handler({
          command: parsed.command,
          flags: parsed.flags,
          argv: parsed.tokens,
          positionals: parsed.positionals,
          brand: deps.brand,
        });
        outcome = outcomeFromResult(result);
        if (outcome.type === "success") {
          successProjection =
            definition.exitProjection === undefined
              ? "success"
              : definition.exitProjection(outcome.data, deps.brand);
          if (definition.humanText !== undefined && !emitEnvelope) {
            humanText = definition.humanText(outcome.data, deps.brand);
          }
        }
      } catch (thrown) {
        outcome = failureOutcome(classifyThrown(thrown), thrown);
      }
    }
  } catch (thrown) {
    outcome = failureOutcome(classifyThrown(thrown), thrown);
  }

  const finishedAt = deps.clock.now();
  const timing = { totalMs: Math.max(0, Math.trunc(finishedAt - startedAt)) };
  const envelope = buildEnvelope(outcome, runId, timing, successProjection);
  const outcomeClass: ProjectionClass =
    outcome.type === "success" ? successProjection : outcome.entry.projectionClass;

  // The command outcome is computed FIRST; the audit write is best-effort and
  // never changes the outcome or exit code (DEC-8).
  const auditDiagnostic = (() => {
    const audit = deps.audit;
    if (audit === undefined) return undefined;
    const identity = audit.identity;
    const facts: AuditInvocationFacts = {
      runId,
      command: redact(commandToken(argv), deps.secrets),
      arguments: redact([...argv], deps.secrets),
      exitCode: envelope.exitCode,
      timing,
      resultSchemaVersion: envelope.schemaVersion,
      outcomeClass,
      scope: audit.scope,
      ...(audit.repo === undefined ? {} : { repo: audit.repo }),
      startedAt,
      ...(identity === undefined
        ? {}
        : {
            agentIdentity: {
              kind: identity.kind,
              value: redact(identity.value, deps.secrets),
            },
          }),
    };
    try {
      const result = audit.record(facts);
      return result.ok ? undefined : `${deps.brand.binaryName}: ${result.code}\n`;
    } catch {
      return `${deps.brand.binaryName}: state.write.failed\n`;
    }
  })();

  const diagnostic = [diagnosticFor(outcome, deps.brand), auditDiagnostic]
    .filter((entry): entry is string => entry !== undefined)
    .join("");
  let exitCode = envelope.exitCode;

  try {
    writeOutput(
      streams,
      envelope,
      diagnostic.length === 0 ? undefined : diagnostic,
      deps.secrets,
      emitEnvelope,
      {
        mode,
        verbose,
        pretty,
        ...(humanSuccess && outcome.type === "success" ? { humanJson: outcome.data } : {}),
        ...(humanText === undefined ? {} : { humanText }),
        ...(outcome.type === "success" && outcome.warnings !== undefined
          ? { warnings: outcome.warnings }
          : {}),
      },
    );
  } catch {
    const fallback = buildEnvelope(
      internalFailure("Output serialization failed."),
      runId,
      timing,
      "success",
    );
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
