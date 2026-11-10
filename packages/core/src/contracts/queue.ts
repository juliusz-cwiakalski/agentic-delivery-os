/**
 * The scheduling-engine vocabulary (GH-237 F-1..F-12, DM-1..DM-14, EVT-1..EVT-6,
 * Appendix C/D/E/F).
 *
 * Runtime-neutral by construction: types and `as const` data only. The closed
 * lease, weight, rank, park, incident, lane, and precedence vocabularies are
 * declared once here together with the five additive record kinds, one derived
 * document, the five `queue` error identities, and the envelope data shapes.
 * The delivered `delivery.queue-ready.v1` condition ids, tri-state, and reason
 * vocabulary are imported from `./queue-ready.js` rather than redefined.
 *
 * No clock, randomness, environment, filesystem, network, or call expression
 * exists in this module.
 */

import type { CallerPrincipal } from "./principal.js";
import type { OwnerHoldSource } from "./owner-hold.js";
import type { QueueReadyCondition, QueueReadyConditionId } from "./queue-ready.js";
import type { StateJsonValue } from "./state.js";

/* ------------------------------- leases ---------------------------------- */

/** The closed lease-scope set: one implemented value and one declared-only. */
export const QUEUE_LEASE_SCOPES = ["repo-exclusive", "worktree"] as const;
export type QueueLeaseScope = (typeof QUEUE_LEASE_SCOPES)[number];

/** The single scope any delivered path may acquire (F-3, DEC-1). */
export const QUEUE_IMPLEMENTED_LEASE_SCOPES = ["repo-exclusive"] as const;
export type QueueImplementedLeaseScope = (typeof QUEUE_IMPLEMENTED_LEASE_SCOPES)[number];

/** The closed lease lifecycle operations (EVT-3). */
export const QUEUE_LEASE_OPERATIONS = ["acquired", "renewed", "released", "taken-over"] as const;
export type QueueLeaseOperation = (typeof QUEUE_LEASE_OPERATIONS)[number];

/** The shipped lease TTL: heartbeat age at or beyond it is stale (Appendix E). */
export const QUEUE_DEFAULT_LEASE_TTL_MS = 90_000 as const;

/** Minimum derived renewal cadence (one third of the TTL, at least one second). */
export const QUEUE_MIN_RENEWAL_MS = 1_000 as const;

/** The one declarative lease record shape (payload `delivery.queue.lease.v1`). */
export type QueueLeaseRecord = {
  readonly schema: typeof QUEUE_LEASE_SCHEMA;
  readonly leaseId: string;
  readonly scope: QueueLeaseScope;
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: QueueWeightClass;
  readonly operation: QueueLeaseOperation;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly ttlMs: number;
  readonly recordedAt: string;
  readonly takeover?: QueueTakeoverEvidence;
};

/** The always-recorded takeover evidence (NFR-4). */
export type QueueTakeoverEvidence = {
  readonly previousHolder: string;
  readonly leaseId: string;
  readonly heartbeatAgeMs: number;
  readonly lastHeartbeatAt: string;
  readonly takenOverAt: string;
};

/** The derived active-lease view consumed by readiness and the lane fold. */
export type QueueActiveLease = {
  readonly leaseId: string;
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: QueueWeightClass;
  readonly scope: QueueLeaseScope;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly ttlMs: number;
  readonly heartbeatAgeMs: number;
  readonly takeover?: QueueTakeoverEvidence;
};

/* -------------------------------- weight --------------------------------- */

/** The closed weight-class set (DM-7, DEC-10). */
export const QUEUE_WEIGHT_CLASSES = ["standard", "heavy"] as const;
export type QueueWeightClass = (typeof QUEUE_WEIGHT_CLASSES)[number];

/** The closed weight-class provenance set (DM-7, C-5). */
export const QUEUE_WEIGHT_CLASS_SOURCES = [
  "declared",
  "absent",
  "plan-unreadable",
  "plan-absent",
] as const;
export type QueueWeightClassSource = (typeof QUEUE_WEIGHT_CLASS_SOURCES)[number];

/* --------------------------------- rank ---------------------------------- */

/** The closed rank-class order; index 0 ranks first (DM-8). */
export const QUEUE_RANK_CLASSES = [
  "merge-ready",
  "in-review",
  "resume-parked",
  "new-start",
] as const;
export type QueueRankClass = (typeof QUEUE_RANK_CLASSES)[number];

/* --------------------------------- parks --------------------------------- */

/** The closed condition-type set a pass re-evaluates (DM-5). */
export const QUEUE_PARK_CONDITION_TYPES = [
  "provider-window",
  "provider-quota",
  "preemption",
] as const;
export type QueueParkConditionType = (typeof QUEUE_PARK_CONDITION_TYPES)[number];

/** The closed cause set explaining why a lease was released (DM-5). */
export const QUEUE_PARK_CAUSES = [
  "provider-window",
  "provider-quota",
  "preempted-for-close-item",
] as const;
export type QueueParkCause = (typeof QUEUE_PARK_CAUSES)[number];

/** The declared one-to-one cause <-> condition-type pairing (DM-5). */
export const QUEUE_PARK_CAUSE_CONDITION_PAIRS = [
  { cause: "provider-window", conditionType: "provider-window" },
  { cause: "provider-quota", conditionType: "provider-quota" },
  { cause: "preempted-for-close-item", conditionType: "preemption" },
] as const satisfies readonly {
  readonly cause: QueueParkCause;
  readonly conditionType: QueueParkConditionType;
}[];

/**
 * The closed recovery-state set (DM-5, C-3).
 *
 * `released` is the withdrawn-park marker: the release+park path appends the
 * park first and, if the lease-release append fails, appends a `released`
 * record for the same park so the fold observes no active park while the lease
 * remains held. It is never a fabricated terminal state.
 */
export const QUEUE_PARK_RECOVERY_STATES = [
  "parked",
  "clear-observed",
  "recovered",
  "released",
] as const;
export type QueueParkRecoveryState = (typeof QUEUE_PARK_RECOVERY_STATES)[number];

/** The default per-condition-type recheck intervals (Appendix E). */
export const QUEUE_PARK_RECHECK_DEFAULTS = {
  "provider-window": 60_000,
  "provider-quota": 300_000,
  preemption: 60_000,
} as const satisfies Readonly<Record<QueueParkConditionType, number>>;

/** The typed evaluable condition; only the window supplies an absolute expiry. */
export type QueueParkCondition =
  | { readonly type: "provider-window"; readonly expiresAt: string }
  | { readonly type: "provider-quota" }
  | { readonly type: "preemption" };

/** The declarative park record shape (payload `delivery.queue.park.v1`). */
export type QueueParkRecord = {
  readonly schema: typeof QUEUE_PARK_SCHEMA;
  readonly ref: string;
  readonly repository?: string;
  readonly cause: QueueParkCause;
  readonly conditionType: QueueParkConditionType;
  readonly condition: QueueParkCondition;
  readonly recheckMs: number;
  readonly evaluatedAt: string;
  readonly clearObservedAt?: string;
  readonly clearedAt?: string;
  readonly recoveredAt?: string;
  readonly observationGapMs?: number;
  readonly recoveryState: QueueParkRecoveryState;
  readonly recordedAt: string;
};

/* ------------------------------- incidents ------------------------------- */

/** The closed incident-type set (DM-6, EVT-5). */
export const QUEUE_INCIDENT_TYPES = ["park-auto-recovery", "lease-stale-takeover"] as const;
export type QueueIncidentType = (typeof QUEUE_INCIDENT_TYPES)[number];

/** One bounded typed evidence field; never free-form prose (NFR-12). */
export type QueueIncidentEvidence = {
  readonly key: string;
  readonly value: string;
};

/** The declarative incident record shape (payload `delivery.queue.incident.v1`). */
export type QueueIncidentRecord = {
  readonly schema: typeof QUEUE_INCIDENT_SCHEMA;
  readonly type: QueueIncidentType;
  readonly ref?: string;
  readonly repository?: string;
  readonly evidence: readonly QueueIncidentEvidence[];
  readonly recordedAt: string;
};

/* --------------------------------- lanes --------------------------------- */

/** The closed six-value lane-state set (F-11, DM-11). */
export const QUEUE_LANE_STATES = [
  "delivering",
  "idle-with-reason",
  "parked",
  "merge-ready",
  "in-review",
  "failed",
] as const;
export type QueueLaneState = (typeof QUEUE_LANE_STATES)[number];

/**
 * The closed idle/hold reason set (OQ-T8 delivery pin). A parked lane carries
 * `parked:<cause>`; the template is handled by the resolver, not stored here.
 */
export const QUEUE_LANE_IDLE_REASONS = [
  "lease-held",
  "repo-claimed-in-pass",
  "weight-class",
  "close-first",
  "producer-first",
  "new-start",
  "resume-parked",
  "outranked",
  "no-eligible-action",
  "park-condition-stuck",
  "restart-budget-exhausted",
  "not-ready",
  "dependency-open",
  "dependency-unobserved",
  "producer-not-landed",
  "deploy-unverified",
  "owner-gate",
  "tier-unknown",
  "ci-failed",
  "ci-pending",
  "ci-canceled",
  "ci-none",
  "ci-unknown",
  "provider-chain-parked",
  "provider-no-enabled-entry",
  "provider-all-entries-parked",
  "provider-unknown",
  "owner-hold",
] as const;
export type QueueLaneIdleReason = (typeof QUEUE_LANE_IDLE_REASONS)[number];

/** A parked reason is the template over the closed cause set. */
export type QueueParkedReason = `parked:${QueueParkCause}`;

/** A blocking reason names a scheduler hold, a gate reason, or a condition id. */
export const QUEUE_BLOCKING_REASONS = [
  ...QUEUE_LANE_IDLE_REASONS,
  "deps-satisfied",
  "repo-free",
  "tier-known",
  "no-owner-gate",
  "ci-healthy",
  "provider-available",
] as const;
export type QueueBlockingReason = (typeof QUEUE_BLOCKING_REASONS)[number];

/* ------------------------------ precedence ------------------------------- */

/** The declared Appendix B precedence step ids. */
export const QUEUE_PRECEDENCE_STEP_IDS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const;

/* ------------------------------ vocabulary ------------------------------- */

/** The declared default priority for an undeclared entry priority. */
export const QUEUE_DEFAULT_PRIORITY = 100 as const;

/** The canonical work-item-ref grammar (reused from the delivered contract). */
export { QUEUE_READY_WORK_ITEM_REF_PATTERN as QUEUE_REF_PATTERN } from "./queue-ready.js";

/** The reuse marker: the six condition ids and their order come from ready. */
export type QueueCondition = QueueReadyCondition;
export type QueueConditionId = QueueReadyConditionId;

/* -------------------------------- records -------------------------------- */

/** The five additive record kinds (Appendix D, DM-5, EVT-1..EVT-5). */
export const QUEUE_ENTRY_RECORD_KIND = "queue.entry" as const;
export const QUEUE_DEPENDENCY_RECORD_KIND = "queue.dependency" as const;
export const QUEUE_LEASE_RECORD_KIND = "queue.lease" as const;
export const QUEUE_PARK_RECORD_KIND = "queue.park" as const;
export const QUEUE_INCIDENT_RECORD_KIND = "queue.incident" as const;

/** The five payload schema identifiers, verbatim from Appendix D. */
export const QUEUE_ENTRY_SCHEMA = "delivery.queue.entry.v1" as const;
export const QUEUE_DEPENDENCY_SCHEMA = "delivery.queue.dependency.v1" as const;
export const QUEUE_LEASE_SCHEMA = "delivery.queue.lease.v1" as const;
export const QUEUE_PARK_SCHEMA = "delivery.queue.park.v1" as const;
export const QUEUE_INCIDENT_SCHEMA = "delivery.queue.incident.v1" as const;

/** The five store-scoped key prefixes, verbatim from Appendix D. */
export const QUEUE_ENTRY_KEY_PREFIX = "queue.entries:" as const;
export const QUEUE_DEPENDENCY_KEY_PREFIX = "queue.deps:" as const;
export const QUEUE_LEASE_KEY_PREFIX = "queue.leases:" as const;
export const QUEUE_PARK_KEY_PREFIX = "queue.parks:" as const;
export const QUEUE_INCIDENT_KEY_PREFIX = "queue.incidents:" as const;

/** The rebuildable derived graph document (DM-13, Appendix D). */
export const QUEUE_GRAPH_SCHEMA = "delivery.queue.graph.v1" as const;
export const QUEUE_GRAPH_DOCUMENT_NAME = "queue-graph.json" as const;

/** The entry record shape (payload `delivery.queue.entry.v1`). */
export type QueueEntryRecord = {
  readonly schema: typeof QUEUE_ENTRY_SCHEMA;
  readonly ref: string;
  readonly repository?: string;
  /**
   * The declaring checkout's absolute repository root. Internal only: it exists
   * solely for producer deploy-expectation discovery (DM-1, DM-12) and is never
   * serialized into an envelope, finding, incident, golden, log, or telemetry.
   */
  readonly repositoryRoot?: string;
  readonly priority: number;
  readonly recordedAt: string;
  /** Additive optional caller principal (C-2); historical records omit it. */
  readonly callerPrincipal?: CallerPrincipal;
};

/** The dependency record shape carrying the folded edges originating at ref. */
export type QueueDependencyRecord = {
  readonly schema: typeof QUEUE_DEPENDENCY_SCHEMA;
  readonly ref: string;
  readonly edges: readonly string[];
  readonly recordedAt: string;
  /** Additive optional caller principal (C-2); historical records omit it. */
  readonly callerPrincipal?: CallerPrincipal;
};

/** The rebuilt graph entry projection (the derived document folds no root). */
export type QueueGraphEntry = {
  readonly ref: string;
  readonly repository?: string;
  readonly priority: number;
  readonly edges: readonly string[];
  readonly weightClass: QueueWeightClass;
  readonly rankClass: QueueRankClass;
  readonly recordedAt: string;
};

/** The derived graph document (payload `delivery.queue.graph.v1`). */
export type QueueGraphDocument = {
  readonly schema: typeof QUEUE_GRAPH_SCHEMA;
  readonly entries: readonly QueueGraphEntry[];
};

/** One declaration the state ledgers consume at their validated boundary. */
export type QueueRecordDeclaration = {
  readonly kind: string;
  readonly payloadSchema: string;
  readonly keyPrefix: string;
  readonly identityField: string;
  readonly fields: readonly string[];
  readonly vocabularies?: Readonly<Record<string, readonly string[]>>;
};

/** The five new kinds plus their identity fields and closed vocabularies. */
export const QUEUE_RECORD_DECLARATIONS = [
  {
    kind: QUEUE_ENTRY_RECORD_KIND,
    payloadSchema: QUEUE_ENTRY_SCHEMA,
    keyPrefix: QUEUE_ENTRY_KEY_PREFIX,
    identityField: "ref",
    fields: [
      "schema",
      "ref",
      "repository",
      "repositoryRoot",
      "priority",
      "recordedAt",
      "callerPrincipal",
    ],
  },
  {
    kind: QUEUE_DEPENDENCY_RECORD_KIND,
    payloadSchema: QUEUE_DEPENDENCY_SCHEMA,
    keyPrefix: QUEUE_DEPENDENCY_KEY_PREFIX,
    identityField: "ref",
    fields: ["schema", "ref", "edges", "recordedAt", "callerPrincipal"],
  },
  {
    kind: QUEUE_LEASE_RECORD_KIND,
    payloadSchema: QUEUE_LEASE_SCHEMA,
    keyPrefix: QUEUE_LEASE_KEY_PREFIX,
    identityField: "repository",
    fields: [
      "schema",
      "leaseId",
      "scope",
      "repository",
      "holder",
      "ref",
      "runner",
      "weightClass",
      "operation",
      "acquiredAt",
      "heartbeatAt",
      "ttlMs",
      "recordedAt",
      "takeover",
    ],
    vocabularies: {
      scope: QUEUE_LEASE_SCOPES,
      operation: QUEUE_LEASE_OPERATIONS,
      weightClass: QUEUE_WEIGHT_CLASSES,
    },
  },
  {
    kind: QUEUE_PARK_RECORD_KIND,
    payloadSchema: QUEUE_PARK_SCHEMA,
    keyPrefix: QUEUE_PARK_KEY_PREFIX,
    identityField: "ref",
    fields: [
      "schema",
      "ref",
      "repository",
      "cause",
      "conditionType",
      "condition",
      "recheckMs",
      "evaluatedAt",
      "clearObservedAt",
      "clearedAt",
      "recoveredAt",
      "observationGapMs",
      "recoveryState",
      "recordedAt",
    ],
    vocabularies: {
      cause: QUEUE_PARK_CAUSES,
      conditionType: QUEUE_PARK_CONDITION_TYPES,
      recoveryState: QUEUE_PARK_RECOVERY_STATES,
    },
  },
  {
    kind: QUEUE_INCIDENT_RECORD_KIND,
    payloadSchema: QUEUE_INCIDENT_SCHEMA,
    keyPrefix: QUEUE_INCIDENT_KEY_PREFIX,
    identityField: "type",
    fields: ["schema", "type", "ref", "repository", "evidence", "recordedAt"],
    vocabularies: { type: QUEUE_INCIDENT_TYPES },
  },
] as const satisfies readonly QueueRecordDeclaration[];

/* -------------------------------- errors --------------------------------- */

/** The five declared `queue` error identities (Appendix F, NFR-11). */
export const QUEUE_ERROR_CODES = [
  "queue.dependency-cycle",
  "queue.lease-conflict",
  "queue.park-condition-stuck",
  "queue.entry.unobserved",
  "queue.precondition.unmet",
] as const;
export type QueueErrorCode = (typeof QUEUE_ERROR_CODES)[number];

/** The report-only stuck-park finding code (DM-14). */
export const QUEUE_STUCK_PARK_FINDING_CODE = "queue.park-condition-stuck" as const;

/* ------------------------------ configuration ---------------------------- */

/** The typed `queue` configuration keys (Appendix E). */
export const QUEUE_CONFIG_KEY_LEASE_TTL = "queue.lease-ttl" as const;
export const QUEUE_CONFIG_KEY_PARK_RECHECK = "queue.park-recheck" as const;
export const QUEUE_CONFIG_BRANCH = "queue" as const;

/* --------------------------------- bounds -------------------------------- */

/** Entries per folded read (NFR-9). */
export const QUEUE_MAX_ENTRIES = 500 as const;
/** Edges per entry (NFR-9). */
export const QUEUE_MAX_EDGES_PER_ENTRY = 32 as const;
/** Next-action cap (NFR-9). */
export const QUEUE_MAX_NEXT_ACTIONS = 20 as const;
/** Default `--next` (NFR-9). */
export const QUEUE_DEFAULT_NEXT_ACTIONS = 3 as const;
/** Lane cap (NFR-9). */
export const QUEUE_MAX_LANES = 200 as const;
/** Findings cap (NFR-9). */
export const QUEUE_MAX_FINDINGS = 20 as const;
/** Top-level reasons cap (NFR-9). */
export const QUEUE_MAX_REASONS = 8 as const;
/** Serialized `data` UTF-8 byte cap (NFR-9). */
export const QUEUE_MAX_MACHINE_BYTES = 65_536 as const;
/** Human line cap (NFR-9). */
export const QUEUE_MAX_HUMAN_LINES = 40 as const;
/** Human byte cap (NFR-9). */
export const QUEUE_MAX_HUMAN_BYTES = 8_192 as const;
/** Expensive readiness reads per pass (NFR-6). */
export const QUEUE_MAX_EVALUATED_CANDIDATES = 32 as const;
/** Deploy verdict reads per pass (NFR-6). */
export const QUEUE_MAX_DEPLOY_READS = 3 as const;
/** Maximum canonical ref characters (reused bound). */
export const QUEUE_MAX_REF_CHARS = 64 as const;
/** Safe evidence detail character cap. */
export const QUEUE_MAX_DETAIL_CHARS = 160 as const;

/* ------------------------------- envelopes ------------------------------- */

/** The queue machine payload schema version. */
export const QUEUE_SCHEMA_VERSION = "delivery.queue.v1" as const;
/** The lanes machine payload schema version. */
export const QUEUE_LANES_SCHEMA_VERSION = "delivery.lanes.v1" as const;

/** The closed degradation reasons; a daemon-down one-shot is still truthful. */
export const QUEUE_DEGRADATION_REASONS = ["daemon-unreachable"] as const;
export type QueueDegradationReason = (typeof QUEUE_DEGRADATION_REASONS)[number];

/** The entry state projection on the read surfaces. */
export const QUEUE_ENTRY_STATES = ["ready", "held", "parked", "stuck", "not-ready"] as const;
export type QueueEntryState = (typeof QUEUE_ENTRY_STATES)[number];

/** One bounded blocking reason plus optional safe detail. */
export type QueueBlocking = {
  readonly reason: QueueBlockingReason | QueueParkedReason;
  readonly detail?: string;
};

/** The lease status projected on an action or entry. */
export type QueueLeaseStatus =
  | { readonly state: "free" }
  | {
      readonly state: "held";
      readonly holder: string;
      readonly leaseId: string;
      readonly heartbeatAgeMs: number;
    };

/** Bounded deploy evidence carried by a dependent action. */
export type QueueDeployEvidence = {
  readonly verdict: "verified" | "unknown" | "failed" | "not-declared";
  readonly reason?: string;
  readonly code?: string;
};

/** The preemption block on a computed action (DM-10). */
export type QueuePreemptionBlock = {
  readonly targetRef: string;
  readonly repository: string;
  readonly holder: string;
  readonly parkCause: "preempted-for-close-item";
  readonly conditionType: "preemption";
  readonly closeRef: string;
};

/** One entry projection on `queue list` / `queue plan`. */
export type QueueEntryProjection = {
  readonly ref: string;
  readonly repository?: string;
  readonly state: QueueEntryState;
  readonly rankClass: QueueRankClass;
  readonly priority: number;
  readonly weightClass: QueueWeightClass;
  readonly weightClassSource: QueueWeightClassSource;
  readonly deps: readonly string[];
  readonly blocking: readonly QueueBlocking[];
};

/** One active lease projection. */
export type QueueLeaseProjection = {
  readonly repository: string;
  readonly holder: string;
  readonly leaseId: string;
  readonly scope: QueueLeaseScope;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: QueueWeightClass;
  readonly heartbeatAgeMs: number;
  readonly takeover?: QueueTakeoverEvidence;
};

/** One runner weight-load projection. */
export type QueueWeightProjection = {
  readonly runner: string;
  readonly class: QueueWeightClass;
  readonly active: number;
  readonly refs: readonly string[];
};

/** One park projection. */
export type QueueParkProjection = {
  readonly ref: string;
  readonly cause: QueueParkCause;
  readonly conditionType: QueueParkConditionType;
  readonly recheckMs: number;
  readonly expiresAt?: string;
  readonly lastEvaluatedAt: string;
  readonly clearObservedAt?: string;
  readonly recoveryState: QueueParkRecoveryState;
  readonly clearedAt?: string;
};

/** One bounded finding (report-only on reads). */
export type QueueFinding = {
  readonly code: typeof QUEUE_STUCK_PARK_FINDING_CODE;
  readonly severity: "warning" | "error";
  readonly ref?: string;
  readonly repository?: string;
  readonly detail?: string;
};

/** One computed next action (DM-9). */
export type QueueNextAction = {
  readonly ref: string;
  readonly repository?: string;
  readonly rankClass: QueueRankClass;
  readonly reason: QueueBlockingReason | QueueParkedReason;
  readonly priority: number;
  readonly weightClass: QueueWeightClass;
  readonly weightClassSource: QueueWeightClassSource;
  readonly lease: QueueLeaseStatus;
  readonly blocking: readonly QueueBlocking[];
  readonly deploy?: QueueDeployEvidence;
  readonly preemption?: QueuePreemptionBlock;
};

/** The shared read collections on list and plan. */
export type QueueReadData = {
  readonly schemaVersion: typeof QUEUE_SCHEMA_VERSION;
  readonly entries: readonly QueueEntryProjection[];
  readonly leases: readonly QueueLeaseProjection[];
  readonly weights: readonly QueueWeightProjection[];
  readonly parks: readonly QueueParkProjection[];
  readonly findings: readonly QueueFinding[];
  readonly degraded: readonly QueueDegradationReason[];
  readonly truncated: boolean;
  /** The named reason when `truncated` is set by a bound other than a cap. */
  readonly truncationReason?: string;
  /** The active owner hold, projected only when active (D17: no member when inactive). */
  readonly ownerHold?: {
    readonly source: OwnerHoldSource;
    readonly reason?: string;
  };
  readonly counts: {
    readonly entries: number;
    readonly ready: number;
    readonly held: number;
    readonly parked: number;
    readonly leases: number;
    readonly parks: number;
  };
};

/** The `queue list` payload (Appendix C). */
export type QueueListData = QueueReadData;

/** The `queue plan` payload adds the ordered actions (Appendix C). */
export type QueuePlanData = QueueReadData & {
  readonly nextActions: readonly QueueNextAction[];
};

/** The mutation result vocabulary (Appendix C). */
export const QUEUE_MUTATION_RESULTS = ["added", "updated", "noop"] as const;
export type QueueMutationResult = (typeof QUEUE_MUTATION_RESULTS)[number];

/** The `queue add | prioritize | dep` payload (Appendix C). */
export type QueueMutationData = {
  readonly ref: string;
  readonly entry: QueueEntryProjection;
  readonly edges: readonly string[];
  readonly result: QueueMutationResult;
  readonly degraded: readonly QueueDegradationReason[];
};

/** The claim result vocabulary (Appendix C). */
export const QUEUE_CLAIM_RESULTS = ["claimed", "renewed", "taken-over"] as const;
export type QueueClaimResult = (typeof QUEUE_CLAIM_RESULTS)[number];

/** One bounded lease projection on claim. */
export type QueueClaimLease = {
  readonly leaseId: string;
  readonly scope: QueueLeaseScope;
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: QueueWeightClass;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly ttlMs: number;
  readonly takeoverOf?: string;
};

/** The `queue claim` payload (Appendix C). */
export type QueueClaimData = {
  readonly result: QueueClaimResult;
  readonly selectedRef: string;
  readonly lease: QueueClaimLease;
  readonly action: QueueNextAction;
  readonly degraded: readonly QueueDegradationReason[];
};

/** The release result vocabulary (Appendix C). */
export const QUEUE_RELEASE_RESULTS = ["released", "parked", "noop"] as const;
export type QueueReleaseResult = (typeof QUEUE_RELEASE_RESULTS)[number];

/** The `queue release` payload (Appendix C). */
export type QueueReleaseData = {
  readonly result: QueueReleaseResult;
  readonly lease?: QueueClaimLease;
  readonly park?: QueueParkProjection;
  readonly degraded: readonly QueueDegradationReason[];
};

/** One lane projection (DM-11, Appendix C). */
export type QueueLane = {
  readonly id: string;
  readonly ref: string;
  readonly state: QueueLaneState;
  readonly reason?: QueueLaneIdleReason | QueueParkedReason;
  readonly lease?: string;
  readonly leaseScope?: QueueLeaseScope;
  readonly restarts: number | null;
  readonly amplification: number | null;
  readonly amplificationWarning?: string;
  readonly weightClass: QueueWeightClass;
};

/** The `lanes list | show <ref>` payload (Appendix C). */
export type QueueLanesData = {
  readonly schemaVersion: typeof QUEUE_LANES_SCHEMA_VERSION;
  readonly lanes: readonly QueueLane[];
  readonly findings: readonly QueueFinding[];
  readonly degraded: readonly QueueDegradationReason[];
  readonly truncated: boolean;
  /** The named reason when `truncated` is set by a bound other than a cap. */
  readonly truncationReason?: string;
  readonly counts: {
    readonly lanes: number;
    readonly delivering: number;
    readonly idle: number;
    readonly parked: number;
    readonly failed: number;
  };
};

/** The record payload type union (one JSON value per declared kind). */
export type QueueRecordPayload =
  | QueueEntryRecord
  | QueueDependencyRecord
  | QueueLeaseRecord
  | QueueParkRecord
  | QueueIncidentRecord;

/** A JSON-safe projection used when an append payload is built. */
export type QueueJsonPayload = StateJsonValue;
