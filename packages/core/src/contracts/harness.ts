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
  readonly capabilities: HarnessCapabilityDeclaration;
};

/** The declared non-secret environment variable entry (name only). */
export type HarnessEnvironmentVariable = {
  readonly kind: "variable";
  readonly name: string;
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

/** The shared classifier's output: the outcome and its delivery-result token. */
export type HarnessClassification = {
  readonly outcome: HarnessOutcome;
  readonly token: DeliveryResultToken;
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

/** The neutral liveness report: one entry per closed kind, in closed order. */
export type HarnessLivenessReport = {
  readonly readings: readonly HarnessLivenessReading[];
};

/** A session handle: identity and attribution only (no token, no raw payload). */
export type HarnessSessionHandle = {
  readonly harnessKind: HarnessKind;
  readonly sessionId: string;
  readonly treeRoot: string;
  readonly workItemRef: string;
};

/** The spawn input carried by the port (F-2, F-5). */
export type HarnessSpawnInput = {
  readonly workItemRef: string;
  readonly prompt: string;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
};

/** A resume/steer input: the existing handle plus the steering payload as data. */
export type HarnessResumeInput = {
  readonly handle: HarnessSessionHandle;
  readonly prompt: string;
  readonly descriptor?: HarnessExecutionEnvironmentDescriptor;
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
] as const;

export type HarnessFailureCode = (typeof HARNESS_FAILURE_CODES)[number];

/**
 * A classified harness failure.
 *
 * `config.credential.missing` is the credential port's delivered identity; it
 * is carried unchanged (never duplicated) and names the declared reference.
 */
export type HarnessFailure = {
  readonly kind: "harness" | "config";
  readonly code: HarnessFailureCode | "config.credential.missing" | "config.value.invalid";
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
 * The injected spawn-environment builder seam.
 *
 * Composition binds the descriptor-only function over the injected parent
 * environment and credential port, so construction stays in the core domain
 * tier and adapters never read ambient environment.
 */
export type HarnessEnvironmentBuilder = (
  descriptor: HarnessExecutionEnvironmentDescriptor,
) => HarnessResult<Readonly<Record<string, string>>>;

/** The injected shared classifier reference. */
export type HarnessClassifier = (evidence: HarnessEvidence) => HarnessClassification;

/** The injected neutral liveness assembler. */
export type HarnessLivenessAssembler = (input: {
  readonly sourced: readonly HarnessLivenessSourcedReading[];
  readonly absenceReasons?: Partial<Record<HarnessLivenessKind, HarnessLivenessAbsenceReason>>;
}) => HarnessLivenessReport;

/**
 * The harness session lifecycle port (F-2).
 *
 * One shape for every adapter. `classify` is bound to the shared classifier by
 * composition; adapters normalize facts and never classify with their own
 * logic.
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
};
