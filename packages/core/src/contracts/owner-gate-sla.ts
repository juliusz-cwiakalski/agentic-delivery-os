/**
 * The `delivery.board.v1` and owner-gate SLA vocabulary (GH-229 F-1..F-8,
 * DM-1..DM-3, EVT-1).
 *
 * Runtime-neutral by construction: types and `as const` data only. The two-row
 * policy map is the PDR-0003 least-privilege map: `owner-review` is never-merge
 * and carries no default; `waiver` is defaultable with the single
 * `owner-review-first` default. Thresholds, comparator, states, markers,
 * audiences, caps, and collector ids are declared once here; the pure domain and
 * the command consume them. No clock, randomness, environment, filesystem, or
 * network access exists in this module.
 */

/** The declared escalation threshold: 24 hours in integer milliseconds (DEC-2). */
export const OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS = 86_400_000 as const;

/** The declared expiry threshold: 72 hours in integer milliseconds (DEC-2). */
export const OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS = 259_200_000 as const;

/** The admitted threshold comparators; delivery declares `>=` (GAP-2). */
export const OWNER_GATE_SLA_COMPARATORS = [">=", ">"] as const;
export type OwnerGateSlaComparator = (typeof OWNER_GATE_SLA_COMPARATORS)[number];

/** The declared comparator read from contract data (GAP-2). */
export const OWNER_GATE_SLA_COMPARATOR = ">=" as const satisfies OwnerGateSlaComparator;

/** The closed two-kind gate vocabulary (PDR-0003, DEC-10). */
export const OWNER_GATE_KINDS = ["owner-review", "waiver"] as const;
export type OwnerGateKind = (typeof OWNER_GATE_KINDS)[number];

/** The closed two-class vocabulary; one class per shipped kind (PDR-0003). */
export const OWNER_GATE_CLASSES = ["owner-review", "waiver"] as const;
export type OwnerGateClass = (typeof OWNER_GATE_CLASSES)[number];

/**
 * The closed per-class waiver-authorization policy (F-4, DM-5, DEC-11).
 *
 * Never-merge classes are owner-authored: only the provider-resolved owner
 * principal authorizes an override. Defaultable classes admit any resolvable
 * declared principal. The vocabulary is consumed by the merge transaction; no
 * consumer re-derives it.
 */
export const OWNER_GATE_WAIVER_AUTHORIZATIONS = ["owner-authored", "defaultable"] as const;
export type OwnerGateWaiverAuthorization = (typeof OWNER_GATE_WAIVER_AUTHORIZATIONS)[number];

/** The single shipped pre-agreed default (PDR-0003, DEC-10). */
export const OWNER_GATE_SLA_DEFAULTS = ["owner-review-first"] as const;
export type OwnerGateSlaDefault = (typeof OWNER_GATE_SLA_DEFAULTS)[number];

/** The three-value SLA-state enum (DM-1, DEC-8). */
export const OWNER_GATE_SLA_STATES = ["fresh", "escalated", "default-applied"] as const;
export type OwnerGateSlaState = (typeof OWNER_GATE_SLA_STATES)[number];

/** The two declared unknown-age markers (GAP-4, DEC-8). */
export const OWNER_GATE_UNKNOWN_AGE_REASONS = [
  "activity-timestamp-absent",
  "activity-timestamp-unparseable",
] as const;
export type OwnerGateUnknownAgeReason = (typeof OWNER_GATE_UNKNOWN_AGE_REASONS)[number];

/** The declared audience seam (F-8, DEC-4). */
export const OWNER_GATE_SLA_AUDIENCES = ["owner", "coordinator"] as const;
export type OwnerGateSlaAudience = (typeof OWNER_GATE_SLA_AUDIENCES)[number];

/** The declared rank-key severity order (GAP-6): urgent first, fresh last. */
export const OWNER_GATE_SLA_RANK_STATE_ORDER = ["escalated", "default-applied", "fresh"] as const;

/** The declared clock source carried in the decision record (DEC-1). */
export const OWNER_GATE_SLA_CLOCK_SOURCE = "activity-timestamp" as const;

/** The additive state-ledger record kind (EVT-1, DM-2). */
export const OWNER_GATE_SLA_DECISION_RECORD_KIND = "owner-gate.decision" as const;

/** The decision-record payload schema identifier (EVT-1, DM-2). */
export const OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA = "delivery.owner-gate.decision.v1" as const;

/** The board machine payload schema (DM-1). */
export const BOARD_SCHEMA_VERSION = "delivery.board.v1" as const;

/** Maximum rendered gates; every drop is marked (NFR-4). */
export const BOARD_MAX_GATES = 8 as const;
/** Machine `data` UTF-8 byte cap (NFR-4). */
export const BOARD_MAX_MACHINE_BYTES = 65_536 as const;
/** Human aging-grid line cap (NFR-4). */
export const BOARD_MAX_HUMAN_LINES = 24 as const;
/** Human aging-grid UTF-8 byte cap (NFR-4). */
export const BOARD_MAX_HUMAN_BYTES = 4_096 as const;
/** Per-field display caps; an over-cap value is marked with `+`. */
export const BOARD_MAX_ID_CHARS = 160 as const;
export const BOARD_MAX_REF_CHARS = 160 as const;
export const BOARD_MAX_WAIVED_BY_CHARS = 120 as const;

/**
 * The closed collector-id set: the board's tracker collector plus the
 * scheduling engine's lanes collector (GH-237 F-12). The family shape, resolved
 * row, and exit-2 projection are unchanged; a family code naming an id outside
 * this set stays unrecognized.
 */
export const BOARD_COLLECTOR_IDS = ["tracker", "lanes"] as const;
export type BoardCollectorId = (typeof BOARD_COLLECTOR_IDS)[number];

/** The declared collector-unavailable identity family (GAP-3, DEC-7). */
export const BOARD_COLLECTOR_ERROR_PREFIX = "status.collector." as const;
export const BOARD_COLLECTOR_ERROR_SUFFIX = ".unavailable" as const;

/** One row of the closed pre-agreed policy map (DM-3, PDR-0003). */
export type OwnerGateSlaPolicyRow = {
  readonly kind: OwnerGateKind;
  readonly class: OwnerGateClass;
  readonly neverMerge: boolean;
  readonly defaultable: boolean;
  readonly default: OwnerGateSlaDefault | null;
  readonly waiverAuthorization: OwnerGateWaiverAuthorization;
};

/** The PDR-0003 two-row map: owner-review never-merge/non-defaultable; waiver defaultable. */
export const OWNER_GATE_SLA_POLICY_ROWS = [
  {
    kind: "owner-review",
    class: "owner-review",
    neverMerge: true,
    defaultable: false,
    default: null,
    waiverAuthorization: "owner-authored",
  },
  {
    kind: "waiver",
    class: "waiver",
    neverMerge: false,
    defaultable: true,
    default: "owner-review-first",
    waiverAuthorization: "defaultable",
  },
] as const satisfies readonly OwnerGateSlaPolicyRow[];

/** The injectable policy snapshot: thresholds plus the two-row map (DM-3). */
export type OwnerGateSlaPolicy = {
  readonly comparator: OwnerGateSlaComparator;
  readonly escalationThresholdMs: number;
  readonly expiryThresholdMs: number;
  readonly rows: readonly OwnerGateSlaPolicyRow[];
};

/** The shipped policy snapshot consumed by the pure evaluator. */
export const OWNER_GATE_SLA_POLICY = {
  comparator: OWNER_GATE_SLA_COMPARATOR,
  escalationThresholdMs: OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS,
  expiryThresholdMs: OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS,
  rows: OWNER_GATE_SLA_POLICY_ROWS,
} as const satisfies OwnerGateSlaPolicy;

/** One collector-supplied gate fact; the mechanism never infers or fabricates (GAP-9). */
export type OwnerGateFact = {
  readonly id: string;
  readonly kind: string;
  readonly ref: string;
  readonly activityAt?: string | null;
  readonly waivedBy?: string;
};

/** One gate record on the board payload (DM-1). */
export type BoardGateRecord = {
  readonly id: string;
  readonly kind: string;
  readonly ref: string;
  readonly age: number | null;
  readonly ageUnknownReason?: OwnerGateUnknownAgeReason;
  readonly slaState: OwnerGateSlaState;
  readonly default: OwnerGateSlaDefault | null;
  readonly waivedBy: string | null;
};

/** Per-collector availability evidence on a rendered board (DM-1). */
export type BoardCollectorEvidence = {
  readonly collector: string;
  readonly outcome: "available" | "unavailable";
};

/** The bounded board `data` payload (DM-1, F-7). */
export type BoardData = {
  readonly schemaVersion: typeof BOARD_SCHEMA_VERSION;
  readonly audience: OwnerGateSlaAudience;
  readonly gates: readonly BoardGateRecord[];
  readonly truncated: boolean;
  readonly omitted: number;
  readonly collectors: readonly BoardCollectorEvidence[];
};

/** The append-only EVT-1 default-application decision payload (DM-2). */
export type OwnerGateSlaDecisionRecord = {
  readonly schemaId: typeof OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA;
  readonly gateId: string;
  readonly gateKind: string;
  readonly workItemRef: string;
  readonly appliedDefault: OwnerGateSlaDefault;
  readonly appliedAt: string;
  readonly thresholdCrossedMs: number;
  readonly clockSource: typeof OWNER_GATE_SLA_CLOCK_SOURCE;
};

/** Everything the pure evaluator consumes (one frozen fact bundle). */
export type OwnerGateSlaInput = {
  readonly audience: OwnerGateSlaAudience;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly policy: OwnerGateSlaPolicy;
  readonly gates: readonly OwnerGateFact[];
  readonly decisions: readonly OwnerGateSlaDecisionRecord[];
};

/** The pure evaluation: rendered gates plus the decisions the edge must append. */
export type OwnerGateSlaEvaluation = {
  readonly audience: OwnerGateSlaAudience;
  readonly gates: readonly BoardGateRecord[];
  readonly truncated: boolean;
  readonly omitted: number;
  readonly decisionsToApply: readonly OwnerGateSlaDecisionRecord[];
};

/** One collector read: available facts or a classified family failure (F-6). */
export type OwnerGateCollectorRead =
  | {
      readonly ok: true;
      readonly collector: string;
      readonly gates: readonly OwnerGateFact[];
      readonly pageItemCount: number;
    }
  | {
      readonly ok: false;
      readonly collector: string;
      readonly reason: "failed" | "credential-unavailable" | "not-configured";
      readonly code: string;
    };
