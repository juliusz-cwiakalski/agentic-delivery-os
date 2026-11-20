/**
 * The harness primitive port vocabulary (GH-233 F-1, F-2, F-5, DM-2, DM-4).
 *
 * Runtime-neutral by construction: types plus `as const` data only. Harness
 * kinds, operations, lifecycle capabilities, and liveness signal kinds are
 * closed sets; absence of a capability is a declared gap, never implied parity.
 * The execution-environment descriptor carries declared variable names and
 * credential references only; resolved material never enters this module.
 */

import type { CredentialReference } from "./credentials.js";
import type { DeliveryResultDerivationClass, DeliveryResultToken } from "./delivery-result.js";
import type {
  EconomicsSourcedSignalAbsenceReason,
  EconomicsSourcedSignalKind,
  EconomicsSourcedSignalReading,
} from "./economics.js";
import type { HarnessTruncation } from "./harness-telemetry.js";
import type { Result } from "./index.js";

/** The closed harness-kind vocabulary (F-1, DM-4). */
export const HARNESS_KINDS = ["opencode", "claude-code"] as const;

export type HarnessKind = (typeof HARNESS_KINDS)[number];

/** The closed execution-environment kind vocabulary (F-5, DM-2; host only). */
export const HARNESS_EXECUTION_KINDS = ["host"] as const;

export type HarnessExecutionKind = (typeof HARNESS_EXECUTION_KINDS)[number];

/** The closed session-operation vocabulary (F-2). */
export const HARNESS_OPERATIONS = [
  "spawn",
  "deliver",
  "resume",
  "steer",
  "collect",
  "session-list",
  "terminate",
] as const;

export type HarnessOperation = (typeof HARNESS_OPERATIONS)[number];

/** The closed lifecycle-capability vocabulary (F-1, F-2). */
export const HARNESS_LIFECYCLE_CAPABILITIES = [
  "headless-spawn",
  "resume-steer-injection",
  "session-introspection",
  "telemetry-extraction",
] as const;

export type HarnessLifecycleCapability = (typeof HARNESS_LIFECYCLE_CAPABILITIES)[number];

/** The closed liveness signal-kind vocabulary (F-2, DEC-9). */
export const HARNESS_LIVENESS_KINDS = ["session-traffic", "worktree-activity", "process"] as const;

export type HarnessLivenessKind = (typeof HARNESS_LIVENESS_KINDS)[number];

/** The closed gap-reason vocabulary (F-1, DM-4; ADR-0008 C-2). */
export const HARNESS_GAP_REASONS = [
  "provider-unsupported",
  "adapter-not-implemented",
  "plan-restriction",
  "headless-mode-limitation",
] as const;

export type HarnessGapReason = (typeof HARNESS_GAP_REASONS)[number];

/** Any capability a harness can support or declare as a gap. */
export type HarnessCapability = HarnessOperation | HarnessLifecycleCapability | HarnessLivenessKind;

/** An explicit gap record: the capability plus a closed reason. */
export type HarnessCapabilityGap = {
  readonly capability: HarnessCapability;
  readonly reason: HarnessGapReason;
};

/**
 * A harness capability declaration (F-1, DM-4).
 *
 * `supportedOperations`, `lifecycleCapabilities`, and `livenessSources` are
 * authoritative: anything unlisted is unsupported and must also appear in
 * `declaredGaps` with a reason. Decorations are data; no derived parity claim
 * can be carried.
 */
export type HarnessCapabilityDeclaration = {
  readonly supportedOperations: readonly HarnessOperation[];
  readonly lifecycleCapabilities: readonly HarnessLifecycleCapability[];
  readonly livenessSources: readonly HarnessLivenessKind[];
  readonly declaredGaps: readonly HarnessCapabilityGap[];
  /** Additive sourced-signal sources (GH-235 D-3, DEC-8); the liveness kinds are untouched. */
  readonly sourcedSignalSources?: readonly EconomicsSourcedSignalKind[];
  /** Declared gaps for a sourced signal kind (GH-235 NG-7); declared gaps stay gaps. */
  readonly sourcedSignalGaps?: readonly HarnessSourcedSignalGap[];
};

/** One declared sourced-signal gap: the sourced kind plus a closed reason. */
export type HarnessSourcedSignalGap = {
  readonly capability: EconomicsSourcedSignalKind;
  readonly reason: HarnessGapReason;
};

/** The closed version-probe warning vocabulary. */
export const HARNESS_VERSION_WARNINGS = ["version-probe-failed"] as const;

export type HarnessVersionWarning = (typeof HARNESS_VERSION_WARNINGS)[number];

/**
 * A configured harness instance (F-1).
 *
 * `observedVersion` is injected data. `null` is the explicit unknown value and
 * always rides a warning; no version is fabricated.
 */
export type HarnessInstance = {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionWarning?: HarnessVersionWarning;
  /**
   * Additive supported-window verdict (GH-335 F-1, DEC-1). Evaluated once at
   * harness resolution; every consumer reads this one verdict.
   */
  readonly versionVerdict?: HarnessVersionVerdict;
  /** Additive resolved integration mode (GH-335 F-2, DEC-2, TDR-0042). */
  readonly mode?: HarnessMode;
  /** Additive mode origin: the delivered default or a declared value (DEC-2). */
  readonly modeOrigin?: HarnessModeOrigin;
  readonly capabilities: HarnessCapabilityDeclaration;
};

/**
 * The declared non-secret environment variable entry (name only, plus the
 * additive optional marker).
 *
 * Absence of `optional` (or `optional: false`) means required: an absent value
 * fails the spawn closed. `optional: true` means an absent value is omitted
 * while a present value is forwarded. The marker is variable-only.
 */
export type HarnessEnvironmentVariable = {
  readonly kind: "variable";
  readonly name: string;
  readonly optional?: boolean;
};

/** The declared credential reference entry (name plus reference). */
export type HarnessEnvironmentCredential = {
  readonly kind: "credential";
  readonly name: string;
  readonly reference: CredentialReference;
};

/** One deny-by-default allowlist entry (DM-2). */
export type HarnessEnvironmentEntry = HarnessEnvironmentVariable | HarnessEnvironmentCredential;

/**
 * The execution-environment descriptor (F-5, DM-2).
 *
 * The child environment is built from `environment` alone: variable entries
 * take their value from the injected parent environment, credential entries
 * resolve through the credential port at use time, and every undeclared parent
 * variable is absent.
 */
export type HarnessExecutionEnvironmentDescriptor = {
  readonly kind: HarnessExecutionKind;
  readonly workDirectory: string;
  readonly environment: readonly HarnessEnvironmentEntry[];
};

/** The closed session-outcome vocabulary (F-2, DEC-10). */
export const HARNESS_OUTCOMES = [
  "completed",
  "premature-end",
  "failed",
  "refused",
  "timed-out",
] as const;

export type HarnessOutcome = (typeof HARNESS_OUTCOMES)[number];

/**
 * The declared outcome-to-token projection (F-2, DEC-10).
 *
 * The classifier consumes this mapping; it carries no token literal of its own.
 * Completion with a tool-level failure projects `partial`, and premature end
 * projects `partial` as well (the artifact is incomplete); a refusal and a
 * timeout use the taxonomy's dispatch-session tokens.
 */
export const HARNESS_CLASSIFICATION_TOKENS = {
  completed: "finished",
  "completed-with-tool-failure": "partial",
  "premature-end": "partial",
  failed: "failed",
  refused: "noop-lane-permission",
  "timed-out": "max-restarts",
} as const satisfies Readonly<Record<string, DeliveryResultToken>>;

export type HarnessClassificationKey = keyof typeof HARNESS_CLASSIFICATION_TOKENS;

/**
 * The adapter-normalized neutral evidence shape (F-2, DEC-10).
 *
 * Adapters fill this shape from harness facts; the one shared classifier reads
 * nothing else. No field carries a harness name, a verdict, or a result token.
 */
export type HarnessEvidenceWarning = "optional-field-absent";

export type HarnessEvidence = {
  readonly completionMarker: boolean;
  readonly exitStatus: number | null;
  readonly timedOut: boolean;
  readonly spawnRefused: boolean;
  readonly failureReported: boolean;
  readonly toolFailure: boolean;
  /** Optional degradation markers; the classifier never reads them. */
  readonly warnings?: readonly HarnessEvidenceWarning[];
};

/** A short alias for the delivery-result token a classification carries. */
type ResultToken = DeliveryResultToken;

/** The shared classifier's output: the outcome and its delivery-result token. */
export type HarnessClassification = {
  readonly outcome: HarnessOutcome;
  readonly token: ResultToken;
  readonly derivationClass: DeliveryResultDerivationClass;
};

/** The closed liveness absence-reason vocabulary (DEC-9). */
export const HARNESS_LIVENESS_ABSENCE_REASONS = ["harness-unsupported", "not-observed"] as const;

export type HarnessLivenessAbsenceReason = (typeof HARNESS_LIVENESS_ABSENCE_REASONS)[number];

/** One sourced liveness observation, carrying the injected observation time. */
export type HarnessLivenessSourcedReading = {
  readonly kind: HarnessLivenessKind;
  readonly status: "sourced";
  readonly value: number;
  readonly observedAt: string;
};

/** One explicit absent liveness entry; never zero, false, or an invented time. */
export type HarnessLivenessAbsentReading = {
  readonly kind: HarnessLivenessKind;
  readonly status: "absent";
  readonly reason: HarnessLivenessAbsenceReason;
};

export type HarnessLivenessReading = HarnessLivenessSourcedReading | HarnessLivenessAbsentReading;

/**
 * The adapter-sourced liveness facts seam (GH-235 D-3): the delivered liveness
 * readings plus the additive sourced-signal facts, both read-only.
 */
export type HarnessLivenessFacts = {
  readonly readings: readonly HarnessLivenessSourcedReading[];
  readonly sourcedSignals?: readonly EconomicsSourcedSignalReading[];
};

/** The neutral liveness report: one entry per closed kind, in closed order. */
export type HarnessLivenessReport = {
  readonly readings: readonly HarnessLivenessReading[];
  /**
   * Additive sourced signals carried beside the unchanged exact-three readings
   * (GH-235 D-3, DEC-8): one entry per sourced-signal kind, never a re-typed
   * delivered kind and never a zero/false/empty value.
   */
  readonly sourcedSignals?: readonly EconomicsSourcedSignalReading[];
};

/** A session handle: identity and attribution only (no token, no raw payload). */
export type HarnessSessionHandle = {
  readonly harnessKind: HarnessKind;
  readonly sessionId: string;
  readonly treeRoot: string;
  readonly workItemRef: string;
  /**
   * The additive OPTIONAL process id of the session the handle leads
   * (GH-348 DM-3). An adapter that can report the started child fills it; an
   * adapter that cannot leaves it ABSENT — never fabricated and never `0`. No
   * capability name is added, and an existing double that constructs a handle
   * without the member stays valid.
   */
  readonly pid?: number;
};

/**
 * The spawn input carried by the port (F-2, F-5).
 *
 * `agent` and `binding` are the two additive optional per-spawn members
 * (GH-335 DEC-16, DEC-17, TDR-0040 A-4): `agent` is the CALLER-supplied agent
 * identity the pure resolution function is called with, and `binding` is that
 * resolution's single-seat OUTPUT, supplied by the composition as per-spawn
 * data. `agent`'s ABSENCE is the `no-agent` state; a present empty or
 * whitespace-only value is invalid input and is refused before any session. The
 * shipped generic `dispatch` sets neither (DEC-15).
 */
export type HarnessSpawnInput = {
  readonly workItemRef: string;
  readonly prompt: string;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly agent?: string;
  readonly binding?: HarnessSeatBinding;
  /**
   * The additive optional fresh-spawn title (GH-347 DM-6, TDR-0054): one
   * deterministic `ticket-<REF>` token the adapter renders as a single
   * `--title` argument. A resume carries none.
   */
  readonly title?: string;
};

/** A resume/steer input: the existing handle plus the steering payload as data. */
export type HarnessResumeInput = {
  readonly handle: HarnessSessionHandle;
  readonly prompt: string;
  readonly descriptor?: HarnessExecutionEnvironmentDescriptor;
  /** The caller-supplied agent identity (DEC-16); absence is `no-agent`. */
  readonly agent?: string;
  /** The resolved single-seat binding for this invocation (TDR-0040 A-4). */
  readonly binding?: HarnessSeatBinding;
};

/** The session-log listing input (F-3 session listing). */
export type HarnessListInput = {
  readonly workItemRef: string;
  readonly descriptor?: HarnessExecutionEnvironmentDescriptor;
};

/** The bounded session-listing result with an explicit truncation mark. */
export type HarnessSessionList = {
  readonly handles: readonly HarnessSessionHandle[];
  readonly truncation?: HarnessTruncation;
};

/** The closed harness failure-code vocabulary used by the adapters. */
export const HARNESS_FAILURE_CODES = [
  "harness.spawn.invalid-output",
  "harness.spawn.refused",
  "harness.spawn.variable-missing",
  "harness.session.unknown",
  "harness.capability.gap",
  "harness.listing.invalid-output",
  "harness.telemetry.unattributable",
  "harness.telemetry.invalid-identity",
  "harness.telemetry.extraction-failed",
  // GH-335: the four new pre-session refusals. There is no telemetry-absence
  // code and no code for the unassigned named agent (it reuses the delivered
  // `provider.profile.invalid`).
  "harness.version.unsupported",
  "harness.version.unknown",
  "harness.mode.unavailable",
  "harness.profile.model-unrepresentable",
] as const;

export type HarnessFailureCode = (typeof HARNESS_FAILURE_CODES)[number];

/**
 * A classified harness failure.
 *
 * `config.credential.missing` is the credential port's delivered identity; it
 * is carried unchanged (never duplicated) and names the declared reference.
 */
export type HarnessFailure = {
  /**
   * `provider` is the delivered profile-selection domain: an agent the resolved
   * profile assigns no seat refuses through `provider.profile.invalid` (GH-335
   * AC-F3-4, TDR-0040 A-2), never through a new harness identity.
   */
  readonly kind: "harness" | "config" | "provider";
  readonly code:
    | HarnessFailureCode
    | "config.credential.missing"
    | "config.value.invalid"
    | "provider.profile.invalid";
  readonly summary?: string;
  readonly field?: string;
  readonly reference?: string;
  readonly status?: number;
  readonly cause?: "config.credential.missing";
};

export type HarnessResult<T> = Result<T, HarnessFailure>;

/** One bounded harness invocation result; a non-zero exit is data. */
export type HarnessSpawnRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/** The injected child-process seam shared by both delivery adapters. */
export type HarnessSpawnRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    readonly timeout: number;
    readonly stdin?: string;
  },
) => Promise<HarnessSpawnRunnerResult>;

/**
 * The streaming spawn starter's per-invocation options (GH-275 Appendix B).
 *
 * `handleTimeoutMs` bounds only the wait for the first identified session line;
 * `sessionTimeoutMs` is an optional whole-session bound where absent or `0`
 * means unbounded.
 */
export type HarnessSpawnStreamOptions = {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly handleTimeoutMs: number;
  readonly sessionTimeoutMs?: number;
};

/**
 * One streaming child-process invocation (GH-275 Appendix B, DEC-1).
 *
 * `lines` yields stdout as newline-delimited strings; `completion` resolves on
 * close or error and never rejects; `acquired` cancels the handle bound;
 * `kill` is idempotent.
 */
export type HarnessSpawnStream = {
  readonly lines: AsyncIterable<string>;
  readonly completion: Promise<HarnessSpawnRunnerResult>;
  readonly acquired: () => void;
  readonly kill: () => void;
  /**
   * The additive OPTIONAL started-child process id (GH-348 DM-3), so the
   * adapter can carry the live process identity onto the handle it constructs.
   * Absent stays absent: a stream double that declares nothing keeps the
   * delivered behaviour and the loop records `null`.
   */
  readonly pid?: number;
};

/**
 * The injected streaming spawn seam (GH-275 DEC-1).
 *
 * Additive beside the unchanged one-shot {@link HarnessSpawnRunner}: it exposes
 * the handle-acquisition signal the completion-gated runner cannot express.
 */
export type HarnessSpawnStarter = (
  file: string,
  args: readonly string[],
  options: HarnessSpawnStreamOptions,
) => HarnessSpawnStream;

/**
 * The injected spawn-environment builder seam.
 *
 * Composition binds the descriptor-only function over the injected parent
 * environment and credential port, so construction stays in the core domain
 * tier and adapters never read ambient environment. The additive optional
 * context carries the per-spawn declared record map (GH-335 F-3): a record
 * value wins for a declared name, and an undeclared record name changes
 * nothing.
 */
export type HarnessEnvironmentBuilder = (
  descriptor: HarnessExecutionEnvironmentDescriptor,
  context?: HarnessEnvironmentContext,
) => HarnessResult<Readonly<Record<string, string>>>;

/** The additive per-spawn environment context (GH-335 F-3, TDR-0040). */
export type HarnessEnvironmentContext = {
  readonly record?: Readonly<Record<string, string>>;
};

/** The injected shared classifier reference. */
export type HarnessClassifier = (evidence: HarnessEvidence) => HarnessClassification;

/** The injected neutral liveness assembler. */
export type HarnessLivenessAssembler = (input: {
  readonly sourced: readonly HarnessLivenessSourcedReading[];
  readonly absenceReasons?: Partial<Record<HarnessLivenessKind, HarnessLivenessAbsenceReason>>;
  /** Additive sourced-signal facts; absent kinds get an explicit closed absence. */
  readonly sourcedSignalFacts?: readonly EconomicsSourcedSignalReading[];
  readonly sourcedSignalAbsenceReasons?: Partial<
    Record<EconomicsSourcedSignalKind, EconomicsSourcedSignalAbsenceReason>
  >;
}) => HarnessLivenessReport;

/**
 * The harness session lifecycle port (F-2).
 *
 * One shape for every adapter. `classify` is bound to the shared classifier by
 * composition; adapters normalize facts and never classify with their own
 * logic. `terminate` is the additive OPTIONAL member (GH-347 API-5, TDR-0051):
 * a port double without it stays valid, and an adapter that declares no
 * capability is never asked.
 */
export type HarnessSessionPort = {
  readonly spawn: (input: HarnessSpawnInput) => Promise<HarnessResult<HarnessSessionHandle>>;
  readonly deliver: (input: HarnessResumeInput) => Promise<HarnessResult<HarnessSessionHandle>>;
  readonly resume: (input: HarnessResumeInput) => Promise<HarnessResult<HarnessSessionHandle>>;
  readonly collect: (input: {
    readonly handle: HarnessSessionHandle;
  }) => Promise<HarnessResult<HarnessEvidence>>;
  readonly classify: (evidence: HarnessEvidence) => HarnessClassification;
  readonly liveness: (input: {
    readonly handle: HarnessSessionHandle;
  }) => Promise<HarnessResult<HarnessLivenessReport>>;
  readonly listSessions: (input: HarnessListInput) => Promise<HarnessResult<HarnessSessionList>>;
  /**
   * The adapter's own capability declaration (GH-347 F-5, DM-5, AC-F5-4).
   *
   * The dispatch engine's terminate gate reads this member: an absent
   * `terminate` operation in the declaration means the operation is
   * unsupported, so a stalled session is never restarted on that adapter. The
   * member is OPTIONAL for source compatibility with declared doubles, and an
   * absent declaration keeps the delivered fail-open default (an undeclared
   * port is treated as capable). Every production adapter declares, and the
   * production composition never mounts a port without a declaration; the
   * dispatch-composition and adapter-port suites hold that obligation.
   */
  readonly capabilities?: HarnessCapabilityDeclaration;
  /** The additive optional capability-gated termination (GH-347 API-5, TDR-0051). */
  readonly terminate?: (
    input: HarnessTerminateInput,
  ) => Promise<HarnessResult<HarnessTerminateResult>>;
};

/**
 * The terminate input (GH-347 API-5, DM-5): the session handle plus the
 * declared grace in milliseconds (`coordinator.kill-grace`, reused not added).
 */
export type HarnessTerminateInput = {
  readonly handle: HarnessSessionHandle;
  readonly graceMs: number;
};

/**
 * The terminate report (GH-347 API-5, DM-5): whether the tree was signalled,
 * whether the escalation ran, and whether this lane's escaped runtime's exact
 * identity was matched. `reaped` reports the exact-identity match, not an OS
 * reap act.
 */
export type HarnessTerminateResult = {
  readonly terminated: boolean;
  readonly escalated: boolean;
  /** An exact-identity target was MATCHED in this lane's runtime table. */
  readonly reaped: boolean;
};

/* ------------------------------------------------------------------------- */
/* GH-335 — the supported-version window, the probe seam, the integration     */
/* mode, and the single-seat binding contract. Data and types only.           */
/* ------------------------------------------------------------------------- */

/**
 * The pinned supported-version window (GH-335 F-1, DM-1, DEC-1, DEC-16).
 *
 * `rule` is the contract; `minors` is its value at delivery. Rule: the current
 * minor line at delivery time plus one previous minor. Applied to the installed
 * `opencode v2.3.2` the value is `2.3` plus `2.2`; the same rule read `2.2` plus
 * `2.1` at intake from `opencode v2.2.5`. Re-evaluate when the harness minor
 * advances. There is no configuration key that widens or narrows it.
 */
export const HARNESS_SUPPORTED_VERSION_WINDOW = {
  rule: "current-minor-at-delivery-plus-one-previous-minor",
  minors: ["2.3", "2.2"],
} as const;

/** The window rule in prose, beside its value (DEC-1). */
export const HARNESS_VERSION_WINDOW_RULE =
  "the current minor line at delivery time plus one previous minor" as const;

/** The longest accepted normalized version stamp (TDR-0041's version bound). */
export const HARNESS_VERSION_MAX_CHARS = 32 as const;

/**
 * The stored-stamp grammar: the bare semantic version a session record's own
 * `version` column carries, with an optional `v` prefix (GH-335 DM-10, F-7).
 *
 * This is the single authored home of the stored-stamp grammar; the probe-output
 * grammar above is the single home for probe lines. They are different inputs and
 * neither is a copy of the other.
 */
export const HARNESS_STORED_VERSION_PATTERN = /^v?([0-9]+)\.([0-9]+)\.([0-9]+)$/;

/**
 * Normalize one stored harness version stamp (GH-335 F-7, review F-5).
 *
 * Returns the bare semantic version, or `null` when the value is not a stored
 * stamp or exceeds `HARNESS_VERSION_MAX_CHARS`. `null` is the caller's declared
 * absence path — a version is never fabricated, truncated, or clipped into
 * shape.
 */
export const normalizeStoredHarnessVersion = (raw: string): string | null => {
  const text = raw.trim();
  if (text.length === 0 || text.length > HARNESS_VERSION_MAX_CHARS) return null;
  const match = HARNESS_STORED_VERSION_PATTERN.exec(text);
  if (match === null) return null;
  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (major === undefined || minor === undefined || patch === undefined) return null;
  const normalized = `${major}.${minor}.${patch}`;
  return normalized.length > HARNESS_VERSION_MAX_CHARS ? null : normalized;
};

/**
 * The accepted probe-output grammar (GH-335 F-1, DEC-11, AC-F1-5).
 *
 * A product token, an optional `v`, and a three-part semantic version, matched
 * end to end against ONE line (a single trailing line terminator is stripped
 * before the match). Internal groups are the three version segments.
 */
export const HARNESS_VERSION_PROBE_PATTERN =
  /^(?:[A-Za-z][A-Za-z0-9._-]*) v?([0-9]+)\.([0-9]+)\.([0-9]+)$/;

/** The closed version-verdict vocabulary (DM-2, TDR-0041). */
export const HARNESS_VERSION_VERDICTS = ["inside", "outside", "indeterminate"] as const;

export type HarnessVersionVerdict = (typeof HARNESS_VERSION_VERDICTS)[number];

/** The single home of the probe bound (NFR-2, §4.4a, OQ-10). */
export const HARNESS_VERSION_PROBE_TIMEOUT_MS = 5_000 as const;

/** The pinned probe outcome: one answered stdout, or the bound was reached. */
export type HarnessVersionProbeOutcome =
  | { readonly status: "answered"; readonly stdout: string }
  | { readonly status: "timed-out" };

/**
 * The pinned probe seam (OQ-10, §4.4a).
 *
 * Called exactly once per harness resolution with the declared deadline and the
 * injected clock by reference. `timed-out`, and a rejection of the returned
 * promise, both yield an indeterminate version. There is no retry.
 */
export type HarnessVersionProbe = (input: {
  readonly deadlineMs: number;
  readonly now: () => number;
}) => Promise<HarnessVersionProbeOutcome>;

/**
 * The closed integration-mode vocabulary with its observed surface per member
 * (GH-335 F-2, DM-3, DEC-2, TDR-0042).
 */
export const HARNESS_MODES = [
  "per-invocation-private-server",
  "managed-background-service",
  "running-server-client",
] as const;

export type HarnessMode = (typeof HARNESS_MODES)[number];

/** The observed surface each declared mode maps onto. */
export const HARNESS_MODE_SURFACES = {
  "per-invocation-private-server": "--standalone",
  "managed-background-service": "service start|restart|status|stop",
  "running-server-client": "--server / api",
} as const satisfies Readonly<Record<HarnessMode, string>>;

/** The one delivered default mode (TDR-0042's chosen mode). */
export const DEFAULT_HARNESS_MODE = "per-invocation-private-server" as const;

/** The closed mode-origin vocabulary: omitted → defaults, present → configured. */
export const HARNESS_MODE_ORIGINS = ["defaults", "configured"] as const;

export type HarnessModeOrigin = (typeof HARNESS_MODE_ORIGINS)[number];

/**
 * One resolved seat binding (GH-335 F-3, DM-4, TDR-0040 decision 1).
 *
 * Exactly one seat: the agent identity the binding was resolved for, the seat
 * name the profile assigns that agent, and that seat's resolved model in
 * `provider/model[#variant]` form. `envName` is the declared variable name for a
 * harness that consumes variables; it is absent for a per-invocation surface.
 * There is no seat map.
 */
export type HarnessSeatBinding = {
  readonly agent: string;
  readonly seat: string;
  readonly resolvedModel: string;
  readonly envName?: string;
};

/** The closed resolution-outcome vocabulary (TDR-0040 decision 2, A-1, A-2). */
export const HARNESS_BINDING_RESOLUTION_OUTCOMES = ["binding", "no-agent", "unassigned"] as const;

export type HarnessBindingResolutionOutcome = (typeof HARNESS_BINDING_RESOLUTION_OUTCOMES)[number];

/** The adapter's declared bound for one expressible model expression (DEC-6). */
export const HARNESS_MODEL_EXPRESSION_MAX_CHARS = 200 as const;

/**
 * The mandatory telemetry field set for a session the dispatch ran (OQ-8): the
 * session identity plus at least one observable usage fact. An unstated
 * observed identity axis is not a usage fact.
 */
export const HARNESS_MANDATORY_USAGE_FACTS = ["token", "cost"] as const;

export type HarnessMandatoryUsageFact = (typeof HARNESS_MANDATORY_USAGE_FACTS)[number];
