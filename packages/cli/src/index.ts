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
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  COMMAND_FAILURE_HARNESS_VERSION_MAX_CHARS,
  type CommandFailureHarnessDetail,
  type CommandResult,
  type CommandResultDetail,
  type CommandResultError,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
  HARNESS_KINDS,
  HARNESS_MODES,
  HARNESS_VERSION_VERDICTS,
  type ProjectionClass,
  RESULT_SCHEMA_VERSION,
  VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS,
  VERIFY_SUITE_ID_PATTERN,
  VERIFY_SUITE_MAX_BREADTH,
  VERIFY_SUITE_MAX_ID_CHARS,
} from "@delivery-os/core/contracts";
import { classifyThrown, resolveAppErrorCode } from "./classify.js";
import { type CliStreams, redact, serializeStreamLine, writeOutput } from "./output/serialize.js";
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

/**
 * The optional human-text context (DM-4): the parsed `--verbose` fact. Omitted
 * context means non-verbose. Additive on the published human-text seam.
 */
export type HumanTextContext = { readonly verbose: boolean };

/** One synthetic command definition: handler plus argument-shape metadata. */
export type CommandDefinition = {
  readonly handler: CommandHandler;
  readonly flags?: readonly string[];
  readonly requiresValue?: readonly string[];
  readonly conflicts?: readonly (readonly [string, string])[];
  readonly positionals?: { readonly max: number };
  /**
   * Admit any `--flag` for a definition whose handler refuses before it reads
   * anything, so the refusal identity (not the parser) answers the invocation.
   * The classified scope-refusal program is the only user of this.
   */
  readonly acceptsAnyFlag?: boolean;
  readonly humanSuccess?: boolean;
  readonly humanText?: (
    data: unknown,
    brand: BrandIdentity,
    context?: HumanTextContext,
  ) => string | undefined;
  /**
   * Render a failure-path human report from the raw handler error value. The
   * value is never copied into the envelope; only the rendered text reaches the
   * human stream, alongside the standard diagnostic.
   */
  readonly humanFailureText?: (error: unknown, brand: BrandIdentity) => string | undefined;
  /**
   * Project a successful handler's verdict data onto an exit class. A negative
   * verdict is still a success envelope (data present); only the exit number
   * comes from this projection. Handlers never choose an exit literal.
   */
  readonly exitProjection?: (data: unknown, brand: BrandIdentity) => ProjectionClass;
  /**
   * An additive line stream drained after the one envelope (GH-238 F-13). Every
   * line passes the single serialization/redaction chokepoint.
   */
  readonly stream?: (invocation: CommandInvocation) => AsyncIterable<string>;
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
      readonly value?: unknown;
      /** The record-shaped envelope detail (TDR-0027); projected only when declared. */
      readonly detail?: CommandResultDetail;
      /** The one bounded identifier-only cause payload (GH-300 DEC-16). */
      readonly cause?: string;
      /** Safe structured notices; emitted once each on stderr in every mode. */
      readonly warnings?: readonly string[];
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

const explicitRemediationHint = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const hint = value.remediationHint;
  return typeof hint === "string" && hint.length > 0 ? hint : undefined;
};

/**
 * The record-shaped failure-envelope `detail` member (TDR-0027 DP-3): read
 * explicitly from the command's returned failure, the same pattern as
 * `summary` and `remediationHint`. Only the declared bounded member is
 * honoured — `holder`, single line, within the declared character cap — and a
 * malformed or over-bound value is never projected. A string-valued app-layer
 * `detail` (lease-conflict evidence prose) is not record-shaped and never
 * reaches the envelope.
 */
const SUITE_ID = new RegExp(VERIFY_SUITE_ID_PATTERN);

/** The Unicode format-control class (bidi and zero-width controls, Appendix A row 26). */
const FORMAT_CONTROL = /\p{Cf}/u;

/**
 * The single-line printable class shared with the suite-map resolver: C0,
 * DEL/C1, U+2028, U+2029, and Unicode format controls (Appendix A row 26).
 * `suiteBreadth` and the `cause:` payload are governed by this class.
 */
const hasSingleLineControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) return true;
    if (point === 0x2028 || point === 0x2029) return true;
    if (FORMAT_CONTROL.test(character)) return true;
  }
  return false;
};

/**
 * The delivered `holder` predicate (DM-6): CR, LF, and C1 controls only. The
 * detail projection is unchanged, so a holder value the delivered surface
 * accepted still projects.
 */
const HOLDER_CONTROL = /[\r\n\u0080-\u009f]/;
const hasHolderControlCharacter = (value: string): boolean => HOLDER_CONTROL.test(value);

/** Read the explicitly declared bounded `detail.suiteBreadth` member. */
const explicitSuiteBreadth = (value: unknown): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0 || value.length > VERIFY_SUITE_MAX_BREADTH) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return undefined;
    if (entry.length === 0 || entry.length > VERIFY_SUITE_MAX_ID_CHARS) return undefined;
    if (!SUITE_ID.test(entry) || hasSingleLineControlCharacter(entry) || seen.has(entry)) {
      return undefined;
    }
    seen.add(entry);
    result.push(entry);
  }
  return result;
};

/** The normalized bare-semantic-version shape the evidence member may carry. */
const NORMALIZED_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * Project the declared `detail.harness` evidence member (TDR-0041).
 *
 * Closed-key, member-by-member: a member that is out of vocabulary, over its
 * bound, or inconsistent with the version verdict drops the whole member — it is
 * never coerced, clipped, or defaulted. The failure's identity, exit, summary,
 * and remediation hint are unchanged by the member's presence.
 */
const explicitHarnessDetail = (value: unknown): CommandFailureHarnessDetail | undefined => {
  if (!isRecord(value)) return undefined;
  const allowed = new Set(["kind", "observedVersion", "versionVerdict", "mode"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return undefined;
  const kind = value.kind;
  if (typeof kind !== "string" || !(HARNESS_KINDS as readonly string[]).includes(kind)) {
    return undefined;
  }
  const versionVerdict = value.versionVerdict;
  if (
    typeof versionVerdict !== "string" ||
    !(HARNESS_VERSION_VERDICTS as readonly string[]).includes(versionVerdict)
  ) {
    return undefined;
  }
  const observedVersion = value.observedVersion;
  if (observedVersion === undefined) return undefined;
  if (observedVersion === null) {
    if (versionVerdict !== "indeterminate") return undefined;
  } else {
    if (
      typeof observedVersion !== "string" ||
      observedVersion.length === 0 ||
      observedVersion.length > COMMAND_FAILURE_HARNESS_VERSION_MAX_CHARS ||
      !NORMALIZED_VERSION.test(observedVersion) ||
      versionVerdict === "indeterminate"
    ) {
      return undefined;
    }
  }
  const mode = value.mode;
  if (mode !== undefined) {
    if (
      typeof mode !== "string" ||
      !(HARNESS_MODES as readonly string[]).includes(mode) ||
      versionVerdict !== "inside"
    ) {
      return undefined;
    }
  }
  return {
    kind: kind as CommandFailureHarnessDetail["kind"],
    observedVersion,
    versionVerdict: versionVerdict as CommandFailureHarnessDetail["versionVerdict"],
    ...(mode === undefined
      ? {}
      : { mode: mode as NonNullable<CommandFailureHarnessDetail["mode"]> }),
  };
};

const explicitDetail = (value: unknown): CommandResultDetail | undefined => {
  if (!isRecord(value) || !isRecord(value.detail)) return undefined;
  const raw = value.detail;
  const detail: {
    holder?: string;
    suiteBreadth?: readonly string[];
    harness?: CommandFailureHarnessDetail;
  } = {};
  const holder = raw.holder;
  if (typeof holder === "string" && holder.length > 0) {
    if (holder.length <= COMMAND_FAILURE_DETAIL_MAX_CHARS && !hasHolderControlCharacter(holder)) {
      detail.holder = holder;
    }
  }
  const suiteBreadth = explicitSuiteBreadth(raw.suiteBreadth);
  if (suiteBreadth !== undefined) detail.suiteBreadth = suiteBreadth;
  const harness = explicitHarnessDetail(raw.harness);
  if (harness !== undefined) detail.harness = harness;
  return Object.keys(detail).length === 0 ? undefined : detail;
};

/** The derived bounds of the one bounded cause line (GH-300 DEC-16). */
const CAUSE_MIRROR_MAX_CHARS = 14 + VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS;
const CAUSE_BREADTH_MAX_CHARS = 15 + 8 * VERIFY_SUITE_MAX_ID_CHARS + 7 + 9 + 2;

const explicitCausePayload = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const cause = value.cause;
  if (typeof cause !== "string" || cause.length === 0 || hasSingleLineControlCharacter(cause)) {
    return undefined;
  }
  const line = `cause: ${cause}`;
  if (cause.startsWith("mirror=")) {
    const job = cause.slice("mirror=".length);
    if (job.length === 0 || job.length > VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS) return undefined;
    if (job.trim() !== job) return undefined;
    return line.length <= CAUSE_MIRROR_MAX_CHARS ? cause : undefined;
  }
  if (cause.startsWith("breadth=")) {
    const body = cause.slice("breadth=".length);
    const omitted = / omitted=(\d+)$/.exec(body);
    const list = omitted === null ? body : body.slice(0, omitted.index);
    const identifiers = list.split(",");
    if (identifiers.length === 0 || identifiers.length > 8) return undefined;
    for (const identifier of identifiers) {
      if (identifier.length === 0 || identifier.length > VERIFY_SUITE_MAX_ID_CHARS)
        return undefined;
      if (!SUITE_ID.test(identifier)) return undefined;
    }
    if (omitted !== null) {
      const count = Number.parseInt(omitted[1] ?? "", 10);
      if (!Number.isInteger(count) || count < 1 || count > VERIFY_SUITE_MAX_BREADTH - 8) {
        return undefined;
      }
    }
    return line.length <= CAUSE_BREADTH_MAX_CHARS ? cause : undefined;
  }
  return undefined;
};

/**
 * The narrow trusted-refusal marker the dispatch engine sets on its bounded
 * credential refusal. It is honoured only for `config.credential.missing`; any
 * other config-shaped failure stays suppressed.
 */
const trustedCredentialRefusal = (value: unknown): boolean =>
  isRecord(value) && value.trustedRefusal === true && value.code === "config.credential.missing";

const failureOutcome = (entry: ErrorTableEntry, value?: unknown): Outcome => {
  // No untrusted config summary, even when the discriminator was malformed and
  // classification contained it as fallback.internal. The one exception is the
  // engine's marked credential refusal, whose prose is identifier-only.
  const configShaped =
    isRecord(value) &&
    (value.kind === "config" ||
      (typeof value.code === "string" && value.code.startsWith("config.")));
  const suppressed =
    (configShaped || entry.domainKind === "config") && !trustedCredentialRefusal(value);
  const summary = suppressed ? undefined : explicitSummary(value);
  const hint = suppressed ? undefined : explicitRemediationHint(value);
  const resolved = hint === undefined ? entry : { ...entry, remediationHint: hint };
  const detail = explicitDetail(value);
  const cause = resolved.code === "config.value.invalid" ? explicitCausePayload(value) : undefined;
  return {
    type: "failure",
    entry: resolved,
    ...(summary === undefined ? {} : { summary }),
    ...(detail === undefined ? {} : { detail }),
    ...(cause === undefined ? {} : { cause }),
    ...(value === undefined ? {} : { value }),
  };
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
    const failureWarnings = Array.isArray(result.warnings)
      ? result.warnings.filter((warning): warning is string => typeof warning === "string")
      : [];
    const outcome = failureOutcome(classifyThrown(failure), failure);
    return failureWarnings.length === 0 ? outcome : { ...outcome, warnings: failureWarnings };
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

/**
 * The migration's declared command-audit exception (GH-365 DM-7, API-1).
 *
 * Keyed PRE-PARSE on the invocation tokens, so every migration mode — an
 * applying run, a dry run, and a pre-parse refusal such as `install migrate
 * --force` — is covered. The audit dependency stays composed and recording; the
 * recorder observes zero writes, which distinguishes suppression from an absent
 * seam.
 */
const isMigrationInvocation = (argv: readonly string[]): boolean => {
  const tokens = argv.filter((token) => !GLOBAL_FLAGS.has(token));
  return tokens[0] === "install" && (tokens[1] === "migrate" || tokens.includes("--migrate"));
};

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
    if (!definition.acceptsAnyFlag && !allowedFlags.has(token)) {
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
    // TDR-0027 DP-3: the record-shaped detail is copied onto the envelope after
    // the error object is built; `toErrorObject` is untouched.
    ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
  };
};

const diagnosticFor = (outcome: Outcome, brand: BrandIdentity): string | undefined => {
  if (outcome.type === "success") return undefined;
  const lines = [`${brand.binaryName}: ${outcome.message ?? outcome.entry.code}`];
  if (outcome.cause !== undefined) lines.push(`cause: ${outcome.cause}`);
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
  let stream: AsyncIterable<string> | undefined;

  try {
    const parsed = parseInvocation(argv, deps.program);
    if (!parsed.ok) {
      outcome = invocationFailure(parsed.reason);
    } else {
      const definition = deps.program.commands[parsed.command];
      if (definition === undefined) throw new Error("command definition disappeared");
      humanSuccess = definition.humanSuccess === true;
      try {
        const invocation: CommandInvocation = {
          command: parsed.command,
          flags: parsed.flags,
          argv: parsed.tokens,
          positionals: parsed.positionals,
          brand: deps.brand,
        };
        const result = await definition.handler(invocation);
        outcome = outcomeFromResult(result);
        if (outcome.type === "success") {
          successProjection =
            definition.exitProjection === undefined
              ? "success"
              : definition.exitProjection(outcome.data, deps.brand);
          if (definition.humanText !== undefined && !emitEnvelope) {
            humanText = definition.humanText(outcome.data, deps.brand, { verbose });
          }
          if (definition.stream !== undefined) {
            stream = definition.stream(invocation);
          }
        }
      } catch (thrown) {
        outcome = failureOutcome(classifyThrown(thrown), thrown);
      }
      if (
        outcome.type === "failure" &&
        definition.humanFailureText !== undefined &&
        !emitEnvelope
      ) {
        humanText = definition.humanFailureText(outcome.value, deps.brand);
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
    // The migration is the one declared audit exception (DM-7): zero records of
    // any kind in every mode, so the delivered pair is never composed for it.
    if (isMigrationInvocation(argv)) return undefined;
    const identity = audit.identity;
    const facts: AuditInvocationFacts = {
      runId,
      command: redact(commandToken(argv), deps.secrets),
      arguments: redact([...argv], deps.secrets),
      exitCode: envelope.exitCode,
      timing,
      resultSchemaVersion: envelope.schemaVersion,
      outcomeClass: outcomeClass === "attention" ? "user-validation" : outcomeClass,
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
        ...(outcome.warnings !== undefined ? { warnings: outcome.warnings } : {}),
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

  if (exitCode === 0 && outcome.type === "success" && stream !== undefined) {
    try {
      for await (const line of stream) {
        const serialized = serializeStreamLine(line, deps.secrets);
        if (serialized !== undefined) streams.stdout.write(serialized);
      }
    } catch (thrown) {
      const classified = classifyThrown(thrown);
      streams.stderr.write(`${deps.brand.binaryName}: ${classified.code}\n`);
    }
  }
  return exitCode;
}
