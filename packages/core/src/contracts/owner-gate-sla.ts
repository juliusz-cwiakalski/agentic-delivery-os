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

import type { ActionAgingState } from "./action.js";
import type { STATUS_FACTS_SCHEMA_VERSION } from "./status.js";

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

/* ------------------------- full-board vocabulary ------------------------- */

/** The closed repository-scope vocabulary (DM-7, AC-F3-5). */
export const BOARD_SCOPES = ["repository", "unbound"] as const;
export type BoardScope = (typeof BOARD_SCOPES)[number];

/** The closed selection vocabulary (DM-7, DEC-3, DEC-14). */
export const BOARD_SELECTIONS = ["current", "project", "all"] as const;
export type BoardSelection = (typeof BOARD_SELECTIONS)[number];

/** The active-lane population: these two delivered lane states only (DEC-7). */
export const BOARD_LANE_STATES = ["delivering", "failed"] as const;
export type BoardLaneState = (typeof BOARD_LANE_STATES)[number];

/** The total, closed lane phase-absence vocabulary (DM-4, DEC-15). */
export const BOARD_LANE_PHASE_UNKNOWN_REASONS = ["phase-unrecorded", "phases-complete"] as const;
export type BoardLanePhaseUnknownReason = (typeof BOARD_LANE_PHASE_UNKNOWN_REASONS)[number];

/** The closed row-owner provenance vocabulary (DM-10). */
export const BOARD_OWNER_SOURCES = [
  "lane-lease-holder",
  "gate-waiver-authorizer",
  "gate-audience",
  "ask-audience",
  "park-control",
] as const;
export type BoardOwnerSource = (typeof BOARD_OWNER_SOURCES)[number];

/** The closed drawn-default state vocabulary (DM-5, DEC-16). */
export const BOARD_ASK_DEFAULT_STATES = ["none", "pending", "applied"] as const;
export type BoardAskDefaultState = (typeof BOARD_ASK_DEFAULT_STATES)[number];

/** The closed parked-row cause set; `provider-quota` is not a lane park (DEC-18). */
export const BOARD_PARKED_REASONS = ["peak-window", "owner-hold"] as const;
export type BoardParkedReason = (typeof BOARD_PARKED_REASONS)[number];

/** The classified absence token for an owner-hold park's `until` (DM-6). */
export const BOARD_OWNER_HOLD_NO_EXPIRY = "owner-hold-no-expiry" as const;

/** The included-repository cap, distinct from the host index's 2 000 (DEC-13). */
export const BOARD_MAX_REPOSITORIES = 128 as const;
/** Per-repository lane cap (DM-11). */
export const BOARD_MAX_LANES = 20 as const;
/** Per-repository ask cap (DM-11). */
export const BOARD_MAX_ASKS = 8 as const;
/** Per-repository parked cap (DM-11). */
export const BOARD_MAX_PARKED = 8 as const;
/** Per-field display caps beyond the delivered gate caps (DM-11). */
export const BOARD_MAX_OWNER_CHARS = 120 as const;
export const BOARD_MAX_KIND_CHARS = 120 as const;
export const BOARD_MAX_QUESTION_CHARS = 160 as const;
export const BOARD_MAX_REASON_CHARS = 120 as const;
export const BOARD_MAX_PHASE_CHARS = 60 as const;
export const BOARD_MAX_UNTIL_CHARS = 40 as const;
/** The human per-line byte bound (DEC-9). */
export const BOARD_MAX_HUMAN_LINE_BYTES = 400 as const;
/** The human per-section row allocation (DEC-9, AMB-TP-1; GH-287 adds actions). */
export const BOARD_HUMAN_SECTION_CAPS = {
  lanes: 6,
  gates: 6,
  asks: 4,
  actions: 6,
  parked: 3,
} as const;

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

/** The extended gate row: the delivered record plus its board provenance (DM-3). */
export type BoardGateRow = BoardGateRecord & {
  readonly repository: string;
  readonly condition: string;
  readonly owner: string | null;
  readonly ownerSource: BoardOwnerSource;
};

/** One active-lane row (DM-4, DM-9, DEC-7, DEC-15). */
export type BoardLaneRow = {
  readonly repository: string;
  readonly ref: string;
  readonly laneId: string;
  readonly state: BoardLaneState;
  readonly phase: string | null;
  readonly phaseUnknownReason?: BoardLanePhaseUnknownReason;
  readonly holder: string | null;
  readonly leaseId?: string;
  readonly reason?: string;
  readonly owner: string | null;
  readonly ownerSource: BoardOwnerSource;
};

/** One owner-ask row with its drawn default (DM-5, DEC-4, DEC-16, DEC-19). */
export type BoardAskRow = {
  readonly repository: string;
  readonly id: string;
  readonly type: string;
  readonly ref: string | null;
  readonly lane: string;
  readonly question: string;
  readonly askedAt: string;
  readonly age: number;
  readonly status: "open";
  readonly owner: string | null;
  readonly ownerSource: BoardOwnerSource;
  readonly drawnDefault: OwnerGateSlaDefault | null;
  readonly defaultState: BoardAskDefaultState;
};

/** One parked-work row from the open lane park episodes (DM-6, DEC-18). */
export type BoardParkedRow = {
  readonly repository: string;
  readonly ref: string;
  readonly reason: BoardParkedReason;
  readonly until: string | null;
  readonly untilReason?: typeof BOARD_OWNER_HOLD_NO_EXPIRY;
  readonly preservation?: "preserved" | "session-state-not-preserved";
  readonly providerProfile?: string;
  readonly owner: string | null;
  readonly ownerSource: BoardOwnerSource;
};

/** The host-wide owner-hold fact carried once on the board (DM-7). */
export type BoardOwnerHold =
  | { readonly active: false }
  | {
      readonly active: true;
      readonly source: "env" | "marker";
      readonly reason?: string;
    };

/** The six-section omission counters (DM-11, NFR-4; GH-287 adds actions). */
export type BoardOmittedBySection = {
  readonly repositories: number;
  readonly lanes: number;
  readonly gates: number;
  readonly asks: number;
  readonly actions: number;
  readonly parked: number;
};

/**
 * One open retro action as a board row fact (GH-287 F-6, DM-4). The edge reads
 * the repository's action registry once and attaches the window count/limit
 * disclosure; no value is inferred.
 */
export type BoardActionFact = {
  readonly actionId: string;
  readonly owner: string;
  readonly level: string;
  readonly age: number;
  readonly agingState: ActionAgingState;
  readonly window: string;
  readonly windowOpenCount: number;
  readonly windowLimit: number;
};

/** One action row on the board payload (DM-4). */
export type BoardActionRow = BoardActionFact & {
  readonly repository: string;
};

/** Per-repository collector evidence on a rendered board (DM-7). */
export type BoardRepositoryEvidence = {
  readonly collector: string;
  readonly outcome: "available" | "unavailable";
  readonly repository: string;
};

/** Per-collector availability evidence on a rendered board (DM-1). */
export type BoardCollectorEvidence = {
  readonly collector: string;
  readonly outcome: "available" | "unavailable";
};

/** One lane fact the edge resolves from the delivered lane/phase fold (DM-4). */
export type BoardLaneFact = {
  readonly ref: string;
  readonly laneId: string;
  readonly state: BoardLaneState;
  readonly holder: string | null;
  readonly leaseId?: string;
  readonly reason?: string;
  readonly phase: string | null;
  readonly phaseUnknownReason?: BoardLanePhaseUnknownReason;
};

/** One owner-ask fact projected through the delivered open-question view (DM-5). */
export type BoardAskFact = {
  readonly id: string;
  readonly type: string;
  /** The delivered question audience; only `owner` asks reach the board (DEC-4). */
  readonly audience?: OwnerGateSlaAudience;
  readonly ref: string | null;
  readonly lane: string;
  readonly question: string;
  readonly askedAt: string;
  readonly age: number;
  readonly owner: string | null;
};

/** One parked fact from the open lane park episodes (DM-6). */
export type BoardParkedFact = {
  readonly ref: string;
  readonly reason: BoardParkedReason;
  readonly until: string | null;
  readonly untilReason?: typeof BOARD_OWNER_HOLD_NO_EXPIRY;
  readonly preservation?: "preserved" | "session-state-not-preserved";
  readonly providerProfile?: string;
  readonly owner: string | null;
};

/** One repository's facts for the pure four-section projection (DM-2, DM-7). */
export type BoardRepositoryFacts = {
  readonly key: string;
  readonly lanes: readonly BoardLaneFact[];
  /** Lanes dropped by the edge-side per-repository cap before the projection. */
  readonly omittedLanes?: number;
  readonly gates: readonly OwnerGateFact[];
  readonly asks: readonly BoardAskFact[];
  readonly parks: readonly BoardParkedFact[];
  readonly decisions: readonly OwnerGateSlaDecisionRecord[];
  /** The open actions read from the repository's own registry (GH-287). */
  readonly actions?: readonly BoardActionFact[];
  /** The classified action-registry read state, disclosed on render. */
  readonly actionsSource?: "available" | "unavailable";
};

/** Everything the pure four-section projection consumes (DM-2). */
export type BoardProjectionInput = {
  readonly audience: OwnerGateSlaAudience;
  readonly scope: BoardScope;
  readonly selection: BoardSelection;
  readonly repositories: readonly BoardRepositoryFacts[];
  readonly omittedRepositories: number;
  readonly ownerHold: BoardOwnerHold;
  readonly policy: OwnerGateSlaPolicy;
  readonly nowMs: number;
  readonly nowIso: string;
};

/** The projection: the bounded payload plus the decisions the edge must append. */
export type BoardProjection = {
  readonly data: BoardData;
  readonly decisionsToApply: Readonly<Record<string, readonly OwnerGateSlaDecisionRecord[]>>;
};

/** The bounded board `data` payload (DM-1, DM-2, F-7). */
export type BoardData = {
  readonly schemaVersion: typeof BOARD_SCHEMA_VERSION;
  readonly audience: OwnerGateSlaAudience;
  readonly scope: BoardScope;
  readonly selection: BoardSelection;
  readonly repositories: readonly string[];
  readonly lanes: readonly BoardLaneRow[];
  readonly gates: readonly BoardGateRow[];
  readonly asks: readonly BoardAskRow[];
  readonly actions: readonly BoardActionRow[];
  readonly parked: readonly BoardParkedRow[];
  readonly collectors: readonly BoardRepositoryEvidence[];
  readonly ownerHold: BoardOwnerHold;
  /** The one shared state-source identity (DEC-3, DM-1). */
  readonly stateSource: typeof STATUS_FACTS_SCHEMA_VERSION;
  readonly truncated: boolean;
  readonly omitted: number;
  readonly omittedBySection: BoardOmittedBySection;
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
