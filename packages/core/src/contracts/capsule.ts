/**
 * The change-capsule contract (GH-240 F-1, F-4, F-5, F-6, F-8, F-9, F-11, F-12).
 *
 * Runtime-neutral by construction: types plus `as const` data only. The capsule
 * is the existing change folder; it adds an append-only `events.jsonl` and a
 * `candidates/` directory in place. Every vocabulary that the specification
 * pins is declared here exactly once and consumed everywhere else.
 */

/** The machine schema identifier of one capsule event line (EVT-1, DM-1). */
export const CAPSULE_SCHEMA_ID = "delivery.capsule.event.v1" as const;

/** The capsule contract version carried by the opening event (F-1). */
export const CAPSULE_CONTRACT_VERSION = "delivery.capsule.v1" as const;

/** The append-only event file name inside the change folder (F-1). */
export const CAPSULE_EVENTS_FILE = "events.jsonl" as const;

/** The one-file-per-candidate directory inside the change folder (F-1). */
export const CAPSULE_CANDIDATES_DIRECTORY = "candidates" as const;

/** The exact envelope key set of one capsule event line (DM-1, TC-CAP-002). */
export const CAPSULE_ENVELOPE_KEYS = [
  "schemaId",
  "sequence",
  "eventKey",
  "workItemRef",
  "runId",
  "kind",
  "writer",
  "occurredAt",
  "payload",
] as const;

/** The closed eleven-kind event vocabulary (Appendix C). */
export const CAPSULE_EVENT_KINDS = [
  "capsule.opened",
  "phase.transition",
  "commit.landed",
  "gate.outcome",
  "review.verdict",
  "closeout.step",
  "capsule.promotion",
  "capsule.retro-coverage",
  "capsule.compaction-checkpoint",
  "capsule.backfill-gap",
  "capsule.closed",
] as const;

/** The closed four-writer vocabulary (Appendix C). */
export const CAPSULE_WRITERS = ["phase", "commit", "verify", "closeout"] as const;

/** The declared per-kind payload field sets; unknown keys are invalid (TC-CAP-002). */
export const CAPSULE_PAYLOAD_FIELDS = {
  "capsule.opened": {
    required: ["contractVersion", "workItemRef"],
    optional: [],
  },
  "phase.transition": {
    required: ["phaseId", "operation", "outcome"],
    optional: ["commitIntent", "commitSha"],
  },
  "commit.landed": {
    required: ["commitSha"],
    optional: ["parentSha", "messageSource", "changeRef"],
  },
  "gate.outcome": {
    required: ["gateSet", "headSha", "gates"],
    optional: [],
  },
  "review.verdict": {
    required: ["iteration", "verdict"],
    optional: ["artifact"],
  },
  "closeout.step": {
    required: ["stepId", "outcome"],
    optional: ["detail", "filePath", "lineHash", "markerKind", "workItemRef"],
  },
  "capsule.promotion": {
    required: ["id", "class", "decision"],
    optional: ["mode", "home", "reason", "supersedes"],
  },
  "capsule.retro-coverage": {
    required: ["level", "state"],
    optional: ["runId"],
  },
  "capsule.compaction-checkpoint": {
    required: [
      "sessions",
      "sessionCount",
      "workingStateFlushed",
      "eventLogFlushed",
      "unresolvedQuestions",
      "lastVerifiedCommit",
    ],
    optional: ["sessionTruncation", "gap"],
  },
  "capsule.backfill-gap": {
    required: ["state"],
    optional: ["detail"],
  },
  "capsule.closed": {
    required: ["decisionCounts", "eventCount", "digest"],
    optional: [],
  },
} as const;

/** The capsule caps (NFR-2, D-2). Values live here once; tests read them. */
export const CAPSULE_MAX_EVENTS = 2_000 as const;
export const CAPSULE_MAX_BYTES = 2 * 1024 * 1024;
export const CAPSULE_MAX_EVENT_PAYLOAD_BYTES = 4 * 1024;
export const CAPSULE_MAX_CANDIDATES = 100;
export const CAPSULE_MAX_CANDIDATE_BYTES = 8 * 1024;
export const CAPSULE_MAX_INDEX_LINES = 200;
export const CAPSULE_MAX_RESIDUE_ITEMS = 50;
export const CAPSULE_MAX_DIFF_BYTES = 1024 * 1024;
export const CAPSULE_MAX_DIFF_FILES = 500;
export const CAPSULE_MAX_DIFF_HITS = 200;
export const CAPSULE_MAX_HUMAN_THREADS = 100;
export const CAPSULE_MAX_SESSIONS = 64;
export const CAPSULE_MAX_SESSION_ID_BYTES = 200;
export const CAPSULE_MAX_RESIDUE_FIELD_BYTES = 512;

/** The closed candidate class vocabulary (Appendix C). */
export const CAPSULE_CANDIDATE_CLASSES = [
  "fact",
  "decision",
  "lesson",
  "tacit",
  "preference",
  "workflow",
  "norm",
  "fleet",
] as const;

/** The closed candidate scope vocabulary (F-4). */
export const CAPSULE_CANDIDATE_SCOPES = ["change", "component", "repo", "fleet"] as const;

/** The three candidate status values (Appendix C). */
export const CAPSULE_CANDIDATE_STATUSES = ["candidate", "authoritative", "superseded"] as const;

/** The closed trust vocabulary (F-4). */
export const CAPSULE_CANDIDATE_TRUST = ["T0", "T1", "T2", "T3", "T4", "T5"] as const;

/** The five capture-bar bases (Appendix C). */
export const CAPSULE_CAPTURE_BAR_BASES = [
  "repeat-occurrence",
  "review-catch",
  "human-correction",
  "verified-outcome",
  "repeated-workflow",
] as const;

/** The five evidence-link prefixes (Appendix C). */
export const CAPSULE_EVIDENCE_PREFIXES = [
  "review-verdict:",
  "ci-verdict:",
  "human-correction:",
  "merged-pr:",
  "test:",
] as const;

/** The candidate required keys (F-4, DM-2). */
export const CAPSULE_CANDIDATE_REQUIRED_KEYS = [
  "id",
  "class",
  "scope",
  "statement",
  "evidence",
  "basis",
  "source",
  "trust",
  "status",
  "created_by",
  "created",
] as const;

/** The candidate optional keys (F-4, DM-2). */
export const CAPSULE_CANDIDATE_OPTIONAL_KEYS = [
  "rationale",
  "applies_when",
  "supersedes",
  "contradicts",
  "hint",
] as const;

/** The stable slug shape an id or record name must satisfy (F-4, §21). */
export const CAPSULE_SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{2,63}$" as const;

/** The closed eight-reason rejection vocabulary (Appendix C). */
export const CAPSULE_REJECTION_REASONS = [
  "capture-bar-unmet",
  "evidence-missing",
  "duplicate:<existing-id>",
  "contradiction-requires-supersession",
  "supersedes-unknown",
  "home-not-implemented",
  "owner-approval-required",
  "index-budget-exceeded",
] as const;

/** The closed eight-kind residue vocabulary in declared order (Appendix C). */
export const CAPSULE_RESIDUE_KINDS = [
  "unresolved-human-thread",
  "ambiguous-flip-hit",
  "capsule-event-gap",
  "review-verdict-unreadable",
  "retro-coverage-unavailable",
  "worktree-retained",
  "session-attribution-gap",
  "capsule-cap-reached",
] as const;

/** The four merged-diff marker kinds (Appendix C). */
export const CAPSULE_DIFF_MARKER_KINDS = [
  "todo-marker",
  "when-merges-note",
  "feature-flag",
  "class-string",
] as const;

/** The four closed merged-diff action tokens (Appendix C). */
export const CAPSULE_DIFF_ACTIONS = [
  "remove-guard",
  "retire-flag",
  "rename-class",
  "close-todo",
] as const;

/** The fixed marker-kind to action mapping (Appendix C). */
export const CAPSULE_MARKER_ACTION_BY_KIND = {
  "todo-marker": "close-todo",
  "when-merges-note": "remove-guard",
  "feature-flag": "retire-flag",
  "class-string": "rename-class",
} as const;

/**
 * The declared merged-diff marker data (D-4, DM-6, OQ-1).
 *
 * Patterns are delivery-bound reviewed data: adding or changing one is a
 * contract-data change with tests, never a test-only widening. Each entry
 * declares the action token its kind carries.
 */
export const CLOSEOUT_DIFF_MARKERS = [
  {
    kind: "todo-marker",
    action: "close-todo",
    pattern: "(?:TODO|FIXME)[^\\n]*",
    attribution: "work-item-ref",
  },
  {
    kind: "when-merges-note",
    action: "remove-guard",
    pattern: "when[^\\n]*merges[^\\n]*",
    attribution: "work-item-ref",
  },
  {
    kind: "feature-flag",
    action: "retire-flag",
    pattern: "feature[_-]?flag[^\\n]*",
    attribution: "work-item-ref",
  },
  {
    kind: "class-string",
    action: "rename-class",
    pattern: "class[_-]?string[^\\n]*",
    attribution: "work-item-ref",
  },
] as const;

/** The capsule lock bounds (NFR-11, D-2). */
export const CAPSULE_LOCK_MAX_ATTEMPTS = 8 as const;
export const CAPSULE_LOCK_RETRY_MS = 25 as const;

/** A capsule event kind. */
export type CapsuleEventKind = (typeof CAPSULE_EVENT_KINDS)[number];

/** A capsule writer identity. */
export type CapsuleWriter = (typeof CAPSULE_WRITERS)[number];

/** A candidate class. */
export type CapsuleCandidateClass = (typeof CAPSULE_CANDIDATE_CLASSES)[number];

/** A candidate scope. */
export type CapsuleCandidateScope = (typeof CAPSULE_CANDIDATE_SCOPES)[number];

/** A candidate status. */
export type CapsuleCandidateStatus = (typeof CAPSULE_CANDIDATE_STATUSES)[number];

/** A candidate trust level. */
export type CapsuleCandidateTrust = (typeof CAPSULE_CANDIDATE_TRUST)[number];

/** A capture-bar basis. */
export type CapsuleCaptureBasis = (typeof CAPSULE_CAPTURE_BAR_BASES)[number];

/** A residue kind. */
export type CapsuleResidueKind = (typeof CAPSULE_RESIDUE_KINDS)[number];

/** A merged-diff marker kind. */
export type CapsuleDiffMarkerKind = (typeof CAPSULE_DIFF_MARKER_KINDS)[number];

/** A merged-diff action token. */
export type CapsuleDiffAction = (typeof CAPSULE_DIFF_ACTIONS)[number];

/** One bounded capsule payload; key sets are declared in CAPSULE_PAYLOAD_FIELDS. */
export type CapsulePayload = Readonly<Record<string, unknown>>;

/** One parsed capsule event line (DM-1, EVT-1). */
export type CapsuleEvent = {
  readonly schemaId: typeof CAPSULE_SCHEMA_ID;
  readonly sequence: number;
  readonly eventKey: string;
  readonly workItemRef: string;
  readonly runId: string;
  readonly kind: CapsuleEventKind;
  readonly writer: CapsuleWriter;
  readonly occurredAt: string;
  readonly payload: CapsulePayload;
};

/** The opening event payload (F-1). */
export type CapsuleOpenedPayload = {
  readonly contractVersion: string;
  readonly workItemRef: string;
};

/** The phase-transition event payload (F-2). */
export type CapsulePhaseTransitionPayload = {
  readonly phaseId: string;
  readonly operation: string;
  readonly outcome: string;
  readonly commitIntent?: string;
  readonly commitSha?: string;
};

/** The landed-commit event payload (F-2, NFR-9). */
export type CapsuleCommitPayload = {
  readonly commitSha: string;
  readonly parentSha?: string;
  readonly messageSource?: string;
  readonly changeRef?: string;
};

/** The gate-outcome event payload (F-2). */
export type CapsuleGatePayload = {
  readonly gateSet: string;
  readonly headSha: string;
  readonly gates: readonly Readonly<Record<string, unknown>>[];
};

/** The review-verdict event payload (F-3). */
export type CapsuleReviewPayload = {
  readonly iteration: number;
  readonly verdict: string;
  readonly artifact?: string;
};

/** The durable promotion-decision payload (EVT-2, DM-3). */
export type CapsulePromotionPayload = {
  readonly id: string;
  readonly class: CapsuleCandidateClass;
  readonly decision: "promoted" | "rejected";
  readonly mode?: "home-write" | "handoff";
  readonly home?: string;
  readonly reason?: string;
  readonly supersedes?: readonly string[];
};

/** The applied `capsule.candidates[]` output projection (DM-5). */
export type CapsuleCandidateProjection = {
  readonly id: string;
  readonly decision: "promoted" | "rejected";
  readonly home?: string;
  readonly reason?: string;
};

/** The retro-coverage payload (EVT-4, DM-9). */
export type CapsuleRetroCoveragePayload = {
  readonly level: "change";
  readonly state: "collected" | "pending";
  readonly runId?: string;
};

/** The compaction-checkpoint payload (EVT-3, DM-8). */
export type CapsuleCompactionPayload = {
  readonly sessions: readonly string[];
  readonly sessionCount: number;
  readonly workingStateFlushed: boolean;
  readonly eventLogFlushed: boolean;
  readonly unresolvedQuestions: number;
  readonly lastVerifiedCommit: string;
  readonly sessionTruncation?: { readonly truncated: boolean; readonly omitted: number };
  readonly gap?: string;
};

/** The terminal close payload (F-3). */
export type CapsuleClosedPayload = {
  readonly decisionCounts: {
    readonly promoted: number;
    readonly rejected: number;
  };
  readonly eventCount: number;
  readonly digest: string;
};

/** The parsed candidate model (F-4, DM-2). */
export type CapsuleCandidate = {
  readonly id: string;
  readonly class: CapsuleCandidateClass;
  readonly scope: CapsuleCandidateScope;
  readonly statement: string;
  readonly evidence: string;
  readonly basis: CapsuleCaptureBasis;
  readonly source: string;
  readonly trust: CapsuleCandidateTrust;
  readonly status: CapsuleCandidateStatus;
  readonly created_by: string;
  readonly created: string;
  readonly rationale?: string;
  readonly applies_when?: string;
  readonly supersedes?: readonly string[];
  readonly contradicts?: readonly string[];
  readonly hint?: string;
};

/** One candidate document read at the edge (F-4). */
export type CapsuleCandidateDocument = {
  readonly file: string;
  readonly value: unknown;
};

/** One existing lesson/tacit record observed under the memory root (F-4). */
export type CapsuleMemoryRecord = {
  readonly id: string;
  readonly class: "lesson" | "tacit";
  readonly statement: string;
  readonly status: string;
  readonly path: string;
};

/** The memory facts the promotion evaluator consumes (F-4, NFR-2). */
export type CapsuleMemoryFacts = {
  readonly records: readonly CapsuleMemoryRecord[];
  readonly indexLines: number;
};

/** One home write the promotion stage must apply (F-4, DEC-6). */
export type CapsulePromotionWrite = {
  readonly candidateId: string;
  readonly class: "lesson" | "tacit";
  readonly recordId: string;
  readonly path: string;
  readonly content: string;
  readonly indexRow: string;
  readonly supersedes?: readonly string[];
};

/** One durable promotion decision (EVT-2, DM-3). */
export type CapsuleCandidateDecision =
  | {
      readonly id: string;
      readonly class: CapsuleCandidateClass;
      readonly decision: "promoted";
      readonly mode: "home-write" | "handoff";
      readonly home: string;
      readonly supersedes?: readonly string[];
    }
  | {
      readonly id: string;
      readonly class: CapsuleCandidateClass;
      readonly decision: "rejected";
      readonly reason: string;
    };

/** The pure promotion evaluation result (F-4). */
export type CapsuleCandidateEvaluation = {
  readonly decisions: readonly CapsuleCandidateDecision[];
  readonly schemaFailures: readonly { readonly id: string; readonly detail: string }[];
  readonly writes: readonly CapsulePromotionWrite[];
};

/** The injected promotion runtime (edge I/O; the evaluator stays pure). */
export type CloseoutPromotionRuntime = {
  readonly candidates: readonly CapsuleCandidateDocument[];
  readonly memory: CapsuleMemoryFacts;
  readonly write: (
    write: CapsulePromotionWrite,
  ) =>
    | { readonly ok: true; readonly wrote: boolean }
    | { readonly ok: false; readonly code: string; readonly detail: string };
  /** Resolve-only confinement check used by plan mode (no writes). */
  readonly preflight?: (
    writes: readonly CapsulePromotionWrite[],
  ) =>
    | { readonly ok: true }
    | { readonly ok: false; readonly code: string; readonly detail: string };
};

/** The applied capsule output object (DM-5). */
export type CloseoutCapsuleData = {
  readonly closed: boolean;
  readonly events: number;
  readonly candidates: readonly CapsuleCandidateProjection[];
};

/** One merged-diff hit classification (F-5, DM-6). */
export type CloseoutDiffHit = {
  readonly kind: CapsuleDiffMarkerKind;
  readonly action: string;
  readonly filePath: string;
  readonly line: number;
  readonly text: string;
  /** Lowercase SHA-256 of the trimmed added line content (content identity). */
  readonly contentHash: string;
  readonly resolved: boolean;
  readonly reason?: string;
};

/** The bounded merged-diff sweep result (F-5, NFR-3). */
export type CloseoutDiffSweepResult = {
  readonly status: "scanned" | "unavailable";
  readonly reason?: "merged-diff-unavailable";
  readonly hits: readonly CloseoutDiffHit[];
  readonly bytes: number;
  readonly files: number;
  readonly truncated: boolean;
  readonly omitted: number;
};

/** The bounded diff read the sweep consumes (F-5). */
export type CloseoutDiffRead = {
  readonly text: string;
  readonly files: number;
  readonly squashSha: string;
  readonly parentSha: string;
};

/** One unresolved thread's authorship fact (F-6, DEC-9). */
export type CloseoutThreadAuthorKind = "human" | "non-human" | "unknown";

/** One unresolved thread fact read from the provider (F-6). */
export type CloseoutThreadAuthorFact = {
  readonly threadId: string;
  readonly authorPrincipal: string;
  readonly authorKind: CloseoutThreadAuthorKind;
};

/** The bounded thread policy result (F-6, NFR-4). */
export type CloseoutThreadPolicyResult = {
  readonly resolved: readonly string[];
  readonly residue: readonly CloseoutResidueItem[];
  readonly omitted: number;
};

/** One bounded judgment-residue item (F-11, DM-4). */
export type CloseoutResidueItem = {
  readonly item: string;
  readonly kind: CapsuleResidueKind;
  readonly location: string;
};

/** The declared capsule refusal codes returned by the file runtime. */
export type CapsuleRefusalCode =
  | "capsule.folder-absent"
  | "capsule.folder-ambiguous"
  | "capsule.torn-tail"
  | "capsule.malformed-line"
  | "capsule.sequence-gap"
  | "capsule.duplicate-key"
  | "capsule.post-close"
  | "capsule.event-cap"
  | "capsule.byte-cap"
  | "capsule.payload-cap"
  | "capsule.invalid-vocabulary"
  | "capsule.candidate-invalid"
  | "capsule.candidate-cap"
  | "capsule.write-failed"
  | "capsule.lock-not-acquired"
  | "capsule.already-closed"
  | "state.lock.busy";

/** The outcome of resolving the unique change folder (F-1, DEC-1). */
export type CapsuleLocation =
  | {
      readonly ok: true;
      readonly folder: string;
      readonly month: string;
      readonly name: string;
    }
  | {
      readonly ok: false;
      readonly code: "capsule.folder-absent" | "capsule.folder-ambiguous";
      readonly detail: string;
    };

/** The outcome of reading and validating `events.jsonl` (F-1, AC-F1-2). */
export type CapsuleReadResult =
  | {
      readonly ok: true;
      readonly events: readonly CapsuleEvent[];
      readonly bytes: number;
    }
  | {
      readonly ok: false;
      readonly code: CapsuleRefusalCode;
      readonly detail: string;
      readonly line?: number;
    };

/** The outcome of one append (F-1, AC-F1-1, NFR-6). */
export type CapsuleAppendResult =
  | {
      readonly ok: true;
      readonly appended: boolean;
      readonly sequence: number;
      readonly eventKey: string;
      readonly reason?: "duplicate" | "already-closed";
    }
  | {
      readonly ok: false;
      readonly code: CapsuleRefusalCode;
      readonly detail: string;
      readonly cap?: number;
      readonly refused?: number;
      readonly retryable?: boolean;
    };

/** The injected filesystem seam the capsule file runtime consumes (F-1). */
export type CapsuleFileSystemFacts = {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly appendFile: (path: string, text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
  readonly ensureDirectory: (path: string) => void;
  readonly listDirectory: (path: string) => readonly string[];
  readonly statSize: (path: string) => number;
  readonly removeFile?: (path: string) => void;
  /** Atomically create a file; returns false when it already exists. */
  readonly createExclusive?: (path: string) => boolean;
};

/** The injected lock scheduler the capsule runtime consumes (NFR-11). */
export type CapsuleLockScheduler = {
  readonly sleep: (milliseconds: number) => void;
  readonly maxAttempts: number;
  readonly retryMs: number;
};

/**
 * The pure capsule rules injected into the file runtime.
 *
 * Adapters consume core contracts only, so the domain-tier validation is
 * supplied by the runtime-aware edge (and by tests) through this seam.
 */
export type CapsuleRules = {
  readonly parse: (text: string) => CapsuleReadResult;
  readonly serialize: (event: CapsuleEvent) => string;
  readonly payloadFieldViolations: (kind: CapsuleEventKind, payload: unknown) => readonly string[];
  readonly deriveEventKey: (parts: readonly (string | number | undefined)[]) => string;
};

/** One candidate file observed under `candidates/` (F-1, NFR-2). */
export type CapsuleCandidateFile = {
  readonly name: string;
  readonly bytes: number;
};

/** The outcome of reading the candidate directory (F-1, NFR-2). */
export type CapsuleCandidatesReadResult =
  | { readonly ok: true; readonly candidates: readonly CapsuleCandidateFile[] }
  | {
      readonly ok: false;
      readonly code: CapsuleRefusalCode;
      readonly detail: string;
      readonly cap?: number;
      readonly refused?: number;
    };

/** One review-verdict artifact observed under `code-review/` (F-3). */
export type CapsuleReviewArtifact = {
  readonly name: string;
  readonly text: string;
  readonly readable: boolean;
};

/** One candidate file read at the edge, parsed when possible (F-4). */
export type CapsuleCandidateDocumentRead = {
  readonly file: string;
  readonly value: unknown;
  readonly parseError?: string;
};

/** The outcome of reading the candidate directory documents (F-4). */
export type CapsuleCandidateDocumentsReadResult =
  | { readonly ok: true; readonly documents: readonly CapsuleCandidateDocumentRead[] }
  | { readonly ok: false; readonly code: CapsuleRefusalCode; readonly detail: string };

/** The outcome of reading the review-verdict artifacts (F-3). */
export type CapsuleReviewArtifactsReadResult =
  | { readonly ok: true; readonly artifacts: readonly CapsuleReviewArtifact[] }
  | {
      readonly ok: false;
      readonly code: CapsuleRefusalCode;
      readonly detail: string;
    };

/** The one append request against one change ref's capsule (F-2, F-3). */
export type CapsuleAppendRequest = {
  readonly changeRef: string;
  readonly workspaceChangesDirectory: string;
  readonly writer: CapsuleWriter;
  readonly kind: CapsuleEventKind;
  readonly eventKey: string;
  readonly payload: CapsulePayload;
  readonly runId: string;
  readonly occurredAt?: string;
  readonly requireExisting?: boolean;
};

/** One non-gating capsule append requested by an owning command (F-2). */
export type CapsuleProducerRequest = {
  readonly changeRef: string;
  readonly writer: CapsuleWriter;
  readonly kind: CapsuleEventKind;
  readonly eventKey: string;
  readonly payload: CapsulePayload;
  readonly runId?: string;
  readonly occurredAt?: string;
};

/** The bounded disclosure a producer returns without changing its outcome (F-2). */
export type CapsuleDisclosure = {
  readonly appended: boolean;
  readonly eventKey: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly detail?: string;
};

/** The injected capsule producer port the phase/commit/verify edges consume. */
export type CapsuleProducerPort = {
  readonly append: (request: CapsuleProducerRequest) => CapsuleAppendResult;
};

/** The capsule file runtime capability set the appenders and closeout consume. */
export type CapsuleFileRuntime = {
  readonly resolve: (changeRef: string) => CapsuleLocation;
  readonly read: (changeRef: string) => CapsuleReadResult;
  readonly append: (request: CapsuleAppendRequest) => CapsuleAppendResult;
  readonly close: (
    request: Omit<CapsuleAppendRequest, "kind"> & { readonly payload: CapsulePayload },
  ) => CapsuleAppendResult;
  readonly ensureCandidates: (changeRef: string) => CapsuleLocation;
  readonly readCandidates: (changeRef: string) => CapsuleCandidatesReadResult;
  readonly listReviewArtifacts: (changeRef: string) => CapsuleReviewArtifactsReadResult;
  readonly readCandidateDocuments: (changeRef: string) => CapsuleCandidateDocumentsReadResult;
};
