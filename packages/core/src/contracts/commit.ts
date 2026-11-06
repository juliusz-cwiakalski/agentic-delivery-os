/**
 * Commit primitive vocabulary (GH-227 F-1..F-8, DM-1..DM-4).
 *
 * Runtime-neutral by construction: types and `as const` data only. Everything
 * verifiable (ref, type, scope, staging set, exclusions, safety classes) is
 * computed by the pure domain tier; only the language part of the message is
 * generated behind the transport seam. No clock, randomness, environment,
 * filesystem, or network access is declared here.
 */
import type { StateJsonValue } from "./state.js";

/** The two durable commit intents a completion record can carry (DEC-7). */
export const COMMIT_INTENTS = ["atomic", "record-only"] as const;
export type CommitIntent = (typeof COMMIT_INTENTS)[number];

/** The closed record-only basis vocabulary; identical to the envelope strings. */
export const COMMIT_INTENT_BASES = [
  "opt-out-flag",
  "config-disabled",
  "skipped-no-pending-work",
] as const;
export type CommitIntentBasis = (typeof COMMIT_INTENT_BASES)[number];

/** The message provenance reported in the envelope and the telemetry event. */
export const COMMIT_MESSAGE_SOURCES = ["model", "template"] as const;
export type CommitMessageSource = (typeof COMMIT_MESSAGE_SOURCES)[number];

/** The closed transport vocabulary reported in the event (DEC-3). */
export const COMMIT_TRANSPORTS = ["core-inference", "harness-one-shot", "none"] as const;
export type CommitTransport = (typeof COMMIT_TRANSPORTS)[number];

/** The additive state-layer record kind and payload schema (EVT-1, DM-1). */
export const COMMIT_TELEMETRY_RECORD_KIND = "commit.telemetry" as const;
export const COMMIT_TELEMETRY_SCHEMA_ID = "delivery.commit.telemetry.v1" as const;

/** The additive `commit` domain kind and its exact failure identity set (DM-4). */
export const COMMIT_ERROR_CODES = [
  "commit.staging-blocked-untracked",
  "commit.commitlint-failed",
  "commit.safety.secret-suspected",
  "commit.safety.scan-unavailable",
  "commit.atomic-abort",
  "commit.session.context-refused",
] as const;
export type CommitErrorCode = (typeof COMMIT_ERROR_CODES)[number];

/** Conventional types the deterministic validation admits (DEC-4). */
export const COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "chore",
  "test",
  "refactor",
  "perf",
  "build",
  "ci",
  "style",
  "revert",
] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];

/** The documented phase→type defaults across the canonical lifecycle set (DEC-11). */
export const COMMIT_PHASE_TYPES: Readonly<Record<string, CommitType>> = {
  clarify_scope: "docs",
  specification: "docs",
  test_planning: "docs",
  delivery_planning: "docs",
  dor_check: "chore",
  delivery: "feat",
  system_spec_update: "docs",
  review_fix: "fix",
  quality_gates: "chore",
  dod_check: "chore",
  pr_creation: "chore",
};

/** The documented default for a phase absent from the table (never invented). */
export const COMMIT_DEFAULT_TYPE = "chore" as const;

/** Constrained-output defaults (DEC-2, NFR-2). */
export const COMMIT_MAX_SUBJECT_CHARS = 72;
export const COMMIT_MAX_BODY_CHARS = 1200;
export const COMMIT_MAX_OUTPUT_TOKENS = 512;
export const COMMIT_TEMPERATURE = 0.1;

/** Shipped diff-budget defaults — tunable data, not code constants (DEC-12). */
export const COMMIT_TOTAL_INPUT_BUDGET = 8000;
export const COMMIT_DIFF_PER_FILE_CAP = 1200;
export const COMMIT_DIFF_TOP_FILES = 8;

/** Deterministic generated-noise path classes stripped before any model sees them. */
export const COMMIT_NOISE_PATH_PATTERNS = [
  "(^|/)pnpm-lock\\.yaml$",
  "(^|/)package-lock\\.json$",
  "(^|/)yarn\\.lock$",
  "(^|/)bun\\.lockb?$",
  "(^|/)Cargo\\.lock$",
  "(^|/)composer\\.lock$",
  "(^|/)\\.min\\.(js|css)$",
  "(^|/)dist/",
  "(^|/)vendor/",
  "(^|/)node_modules/",
] as const;

/** Forbidden-path exclusions: never staged, always disclosed (spec 21). */
export const COMMIT_FORBIDDEN_PATH_PATTERNS = [
  "^tmp/",
  "^\\.ai/local/",
  "(^|/)\\.env(\\.|$)",
  "(^|/)id_rsa$",
  "(^|/)id_ed25519$",
] as const;

/** Oversized binaries are excluded from staging and disclosed (spec 21). */
export const COMMIT_MAX_BINARY_BYTES = 1_048_576;

/** The closed exclusion classes disclosed in the envelope (DM-2). */
export const COMMIT_EXCLUSION_KINDS = [
  "forbidden-path",
  "stray",
  "noise",
  "oversized-binary",
] as const;
export type CommitExclusionKind = (typeof COMMIT_EXCLUSION_KINDS)[number];

/** The closed safety finding classes; classes never carry material (spec 21). */
export const COMMIT_SAFETY_FINDING_CLASSES = [
  "secret-content",
  "secret-filename",
  "forbidden-path",
  "oversized-binary",
  "noise",
] as const;
export type CommitSafetyFindingClass = (typeof COMMIT_SAFETY_FINDING_CLASSES)[number];

/** The closed ref-resolution sources disclosed in evidence (F-2). */
export const COMMIT_REF_SOURCES = ["argument", "branch", "change-folder"] as const;
export type CommitRefSource = (typeof COMMIT_REF_SOURCES)[number];

/** The tracked/untracked status of a working-tree candidate. */
export const COMMIT_FILE_STATUSES = [
  "modified",
  "added",
  "deleted",
  "renamed",
  "untracked",
] as const;
export type CommitFileStatus = (typeof COMMIT_FILE_STATUSES)[number];

/** The declared staging scopes: plan phase, union of phases, or absent plan. */
export const COMMIT_SCOPE_SOURCES = ["plan-phase", "plan-union", "plan-absent"] as const;
export type CommitScopeSource = (typeof COMMIT_SCOPE_SOURCES)[number];

/** A computed plan-phase declaration used by the skeleton and staging scope. */
export type CommitPlanPhaseContext = {
  readonly phaseId: string;
  readonly title: string;
  readonly summary?: string;
  readonly declaredScopePaths: readonly string[];
};

/** The deterministic message skeleton: every verifiable part (F-2). */
export type CommitSkeleton = {
  readonly ref: string;
  readonly refSource: CommitRefSource;
  readonly type: CommitType;
  readonly scope: string;
  readonly breaking: boolean;
  readonly phaseId?: string;
};

/** The language part produced by exactly one constrained call (DEC-2). */
export type CommitMessageDraft = {
  readonly subject: string;
  readonly body?: string;
  readonly breaking: boolean;
};

/** One working-tree candidate as the git seam reports it. */
export type CommitCandidateFile = {
  readonly path: string;
  readonly status: CommitFileStatus;
  readonly tracked: boolean;
  readonly binary: boolean;
  readonly sizeBytes: number;
  /** Budget-capped unified diff text; absent for binary or over-cap files. */
  readonly diffText?: string;
  /** Name-status metadata fallback for an over-cap file. */
  readonly overCap: boolean;
};

/** One repository fact bundle: the tree plus tone context. */
export type CommitTreeFacts = {
  readonly branch: string;
  readonly files: readonly CommitCandidateFile[];
  readonly lastCommitSubjects: readonly string[];
  readonly head: string;
  readonly commitCount: number;
};

/** One exclusion disclosed in the envelope (DM-2). */
export type CommitExcludedEntry = {
  readonly path: string;
  readonly kind: CommitExclusionKind;
  readonly detail?: string;
};

/** The computed staging set and its disclosures (DEC-15, F-5). */
export type CommitStagingPlan = {
  readonly include: readonly { readonly path: string; readonly tracked: boolean }[];
  readonly excluded: readonly CommitExcludedEntry[];
  /** Tracked paths outside every declared scope: staged, drift disclosed. */
  readonly scopeDrift: readonly string[];
  /** Untracked paths outside every declared scope: never staged. */
  readonly untrackedNotStaged: readonly string[];
  readonly scopeSource: CommitScopeSource;
  readonly scopeDegraded: boolean;
};

/** One bundle file the model may see (noise stripped, budget capped). */
export type CommitBundleFile = {
  readonly path: string;
  readonly status: CommitFileStatus;
  readonly binary: boolean;
  readonly overCap: boolean;
  readonly diffText?: string;
};

/** The complete deterministic input bundle for the one constrained call. */
export type CommitBundle = {
  readonly skeleton: CommitSkeleton;
  readonly planSummary?: string;
  readonly files: readonly CommitBundleFile[];
  readonly lastCommitSubjects: readonly string[];
  readonly totalInputChars: number;
  readonly trimmed: boolean;
};

/** A classified safety finding: class and path only, never material. */
export type CommitSafetyFinding = {
  readonly class: CommitSafetyFindingClass;
  readonly path: string;
  readonly detail?: string;
};

/** The safety scan outcome; a failure is fail-closed (NFR-7). */
export type CommitSafetyOutcome =
  | { readonly ok: true; readonly findings: readonly CommitSafetyFinding[] }
  | {
      readonly ok: false;
      readonly code: "commit.safety.scan-unavailable";
      readonly detail: string;
    };

/** The commitlint observation for one candidate message (GAP-4). */
export type CommitlintOutcome =
  | { readonly status: "valid"; readonly errors: readonly string[] }
  | { readonly status: "invalid"; readonly errors: readonly string[] }
  | { readonly status: "absent"; readonly errors: readonly string[] };

/** One transport's injected availability fact (DEC-3, F-4). */
export type CommitTransportAvailability = {
  readonly coreInference: {
    readonly available: boolean;
    readonly reason?: string;
    readonly parkedUntil?: string;
  };
  readonly harnessOneShot: { readonly available: boolean; readonly reason?: string };
};

/** The constrained request handed to the selected transport. */
export type CommitTransportRequest = {
  readonly skeleton: CommitSkeleton;
  readonly bundle: CommitBundle;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly schemaId: "delivery.commit.message.v1";
  /** Validation errors fed back into the single retry (DEC-4). */
  readonly validationErrors?: readonly string[];
};

/** Token spend for the generation call; zero for template (DM-1). */
export type CommitTokenSpend = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/** One generation attempt's outcome (a classified failure never throws). */
export type CommitTransportOutcome =
  | {
      readonly ok: true;
      readonly message: CommitMessageDraft;
      readonly transport: Exclude<CommitTransport, "none">;
      readonly tokenSpend: CommitTokenSpend;
    }
  | {
      readonly ok: false;
      readonly transport: Exclude<CommitTransport, "none">;
      readonly code: string;
      readonly detail?: string;
    };

/** The transport port: ordered selection happens in the pure domain tier. */
export type CommitTransportPort = {
  readonly generate: (request: CommitTransportRequest) => Promise<CommitTransportOutcome>;
};

/** The git port the atomic act drives (local only, fixed argv, no network). */
export type CommitGitPort = {
  readonly readTree: () => Promise<CommitTreeFacts>;
  readonly stage: (paths: readonly string[]) => Promise<boolean>;
  readonly commit: (message: CommitMessageDraft) => Promise<{ readonly ok: true; sha: string } | { readonly ok: false; readonly detail: string }>;
  readonly head: () => Promise<string | undefined>;
  readonly resetTo: (sha: string) => Promise<boolean>;
};

/** The safety port; unavailable is a classified fail-closed result. */
export type CommitSafetyPort = {
  readonly scan: (files: readonly { readonly path: string; readonly content?: string }[]) => Promise<CommitSafetyOutcome>;
};

/** The commitlint port (repository rules win; absent degrades). */
export type CommitlintPort = {
  readonly check: (message: CommitMessageDraft) => Promise<CommitlintOutcome>;
};

/** The delivery-session facts injected at the runtime edge (DEC-6). */
export type CommitSessionFacts = {
  readonly insideDeliverySession: boolean;
  readonly sessionId?: string;
};

/** The telemetry record payload (EVT-1, DM-1): metadata only, never material. */
export type CommitTelemetryRecord = {
  readonly schemaId: typeof COMMIT_TELEMETRY_SCHEMA_ID;
  readonly changeRef: string;
  readonly phaseId?: string;
  readonly commitSha: string;
  readonly messageSource: CommitMessageSource;
  readonly transport: CommitTransport;
  readonly tokenSpend: CommitTokenSpend;
  readonly landedAt: string;
  readonly transitionId?: string;
};

/** The telemetry ledger key prefix (one history per change ref). */
export const COMMIT_TELEMETRY_RECORD_KEY_PREFIX = "commit.telemetry:" as const;

/** A verifiable telemetry read: the events plus the state layer's evidence. */
export type CommitTelemetryRead = {
  readonly changeRef: string;
  readonly records: readonly CommitTelemetryRecord[];
  readonly verifiedEmpty: boolean;
};

/** The envelope success data for the `commit` surface (DM-2). */
export type CommitEnvelopeData = {
  readonly changeRef: string;
  readonly subject: string;
  readonly body?: string;
  readonly stagedFiles: readonly string[];
  readonly excluded: {
    readonly forbiddenPaths: readonly string[];
    readonly oversizedBinaries: readonly string[];
    readonly untrackedNotStaged: readonly string[];
    readonly noiseStripped: readonly string[];
    readonly scopeDrift: readonly string[];
  };
  readonly commitSha?: string;
  readonly messageSource: CommitMessageSource;
  readonly transport: CommitTransport;
  readonly atomic: boolean;
  readonly ledgerTransition?: StateJsonValue;
  readonly dryRun?: boolean;
  readonly safety: { readonly completed: boolean; readonly findings: readonly string[] };
  readonly telemetry: { readonly emitted: boolean; readonly detail?: string };
  readonly degradedScope?: "plan-absent";
};

/** The `phase complete` commit extension (DM-3). */
export type PhaseCommitData = {
  readonly commitSha?: string;
  readonly atomic: boolean;
  /** `no-op` is envelope-only and never written to a durable record. */
  readonly commitSkipped?:
    | CommitIntentBasis
    | "no-op"
    | "interrupted-atomic-no-pending-work";
  readonly reconciliation?: {
    readonly completed:
      | "commit"
      | "transition"
      | "intentional-no-op"
      | "existing-completion";
    readonly basis?: CommitIntentBasis;
    readonly detail?: string;
  };
  readonly commit?: {
    readonly subject: string;
    readonly stagedFiles: readonly string[];
    readonly excluded: CommitEnvelopeData["excluded"];
    readonly messageSource: CommitMessageSource;
    readonly transport: CommitTransport;
    readonly safety: CommitEnvelopeData["safety"];
    readonly telemetry: CommitEnvelopeData["telemetry"];
  };
};

/** The convergence classification over durable evidence (DEC-7, F-7). */
export const COMMIT_DELTA_STATES = [
  "neither",
  "record-atomic-without-commit",
  "record-record-only",
  "commit-without-record",
  "both",
] as const;
export type CommitDeltaState = (typeof COMMIT_DELTA_STATES)[number];

/** The durable evidence the convergence delta reads; never a stale projection. */
export type CommitDurableEvidence = {
  readonly recordPresent: boolean;
  readonly recordIntent?: CommitIntent;
  readonly recordBasis?: CommitIntentBasis;
  readonly recordTransitionId?: string;
  readonly commitPresent: boolean;
  readonly commitSha?: string;
};

/** The four-state convergence classification (total over the evidence). */
export type CommitDelta =
  | { readonly state: "neither" }
  | {
      readonly state: "record-atomic-without-commit";
      readonly transitionId?: string;
    }
  | {
      readonly state: "record-record-only";
      readonly basis?: CommitIntentBasis;
      readonly transitionId?: string;
    }
  | { readonly state: "commit-without-record"; readonly commitSha: string }
  | {
      readonly state: "both";
      readonly commitSha?: string;
      readonly transitionId?: string;
    };
