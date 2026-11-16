/**
 * The shared typed message record and the `steer` family vocabulary (GH-298
 * F-1..F-10, DM-1..DM-8).
 *
 * Runtime-neutral by construction: types and `as const` data only. The shared
 * record schema is declared exactly once here, together with the four shared
 * closed vocabularies, the S5 filing subset as a declaration over them, the
 * `<positive-integer><unit>` ttl grammar, every declared bound, the one payload
 * identity, and the three steer error-code literals. No clock, randomness,
 * environment, filesystem, or network access exists in this module.
 */
import {
  BOARD_MAX_ASKS,
  type BoardAskDefaultState,
  type OwnerGateSlaDefault,
} from "./owner-gate-sla.js";
import {
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_MACHINE_BYTES,
} from "./status.js";

/* ------------------------------- vocabularies ------------------------------ */

/** The shared closed scope vocabulary in declared order (DM-1). */
export const STEER_SCOPES = ["session", "change", "repo", "fleet"] as const;
export type SteerScope = (typeof STEER_SCOPES)[number];

/** The shared closed message-kind vocabulary in declared order (DM-1). */
export const STEER_KINDS = [
  "ask",
  "answer",
  "notify",
  "request",
  "escalate",
  "report",
  "heartbeat",
] as const;
export type SteerKind = (typeof STEER_KINDS)[number];

/** The shared closed priority vocabulary in declared order (DM-1, DM-5). */
export const STEER_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type SteerPriority = (typeof STEER_PRIORITIES)[number];

/** The S5 filing subset of kinds: a declared restriction, not a second schema (DEC-2). */
export const STEER_FILING_KINDS = ["request", "escalate"] as const;
export type SteerFilingKind = (typeof STEER_FILING_KINDS)[number];

/** The S5 filing scope (DEC-2). */
export const STEER_FILING_SCOPE = "repo" as const;
/** The S5 filing sender principal (DEC-2). */
export const STEER_FILING_FROM = "owner" as const;
/** The S5 receiving role (DEC-2). */
export const STEER_FILING_TO = "delivery" as const;

/** The declared S5 filing subset as a selection over the shared sets (DEC-2). */
export const STEER_FILING_SUBSET = {
  kinds: STEER_FILING_KINDS,
  scope: STEER_FILING_SCOPE,
  from: STEER_FILING_FROM,
  to: STEER_FILING_TO,
} as const;

/** The derived lifecycle vocabulary, computed at read time, never stored (DM-2). */
export const STEER_LIFECYCLES = ["queued", "landed", "expired", "completed"] as const;
export type SteerLifecycle = (typeof STEER_LIFECYCLES)[number];

/** The boundary-closed per-note pending reason (DM-3, DEC-5). */
export const STEER_PHASE_IN_PROGRESS_REASON = "phase-in-progress" as const;

/** The phase-unknown reason carried when no phase record exists (DEC-5). */
export const STEER_PHASE_UNKNOWN_REASONS = ["phase-unrecorded"] as const;
export type SteerPhaseUnknownReason = (typeof STEER_PHASE_UNKNOWN_REASONS)[number];

/** The classified ttl-elapsed expiry reason (DM-3, DEC-7). */
export const STEER_EXPIRY_REASON = "ttl-elapsed" as const;
export type SteerExpiryReason = typeof STEER_EXPIRY_REASON;

/** The two recorded read-outcome kinds (DM-2). */
export const STEER_OUTCOME_KINDS = ["applied", "expired"] as const;
export type SteerOutcomeKind = (typeof STEER_OUTCOME_KINDS)[number];

/* -------------------------------- ttl grammar ------------------------------ */

/** The four declared ttl duration units (spec section 8.3). */
export const STEER_TTL_UNITS = ["s", "m", "h", "d"] as const;
export type SteerTtlUnit = (typeof STEER_TTL_UNITS)[number];

/** One unit's duration in milliseconds. */
export const STEER_TTL_UNIT_MS: Readonly<Record<SteerTtlUnit, number>> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

/** The declared maximum ttl in seconds (`30d`, DM-1/DM-8). */
export const STEER_MAX_TTL_SECONDS = 2_592_000 as const;
/** The declared maximum ttl in milliseconds (`30d`, DM-1/DM-8). */
export const STEER_MAX_TTL_MS = 2_592_000_000 as const;
/** The drawn default ttl spelling (`24h`, DEC-6). */
export const STEER_DEFAULT_TTL = "24h" as const;
/** The drawn default ttl in milliseconds (`24h`, DEC-6). */
export const STEER_DEFAULT_TTL_MS = 86_400_000 as const;

/* --------------------------------- bounds --------------------------------- */

/** The note-text cap in characters (DM-8). */
export const STEER_MAX_TEXT_CHARS = 160 as const;
/** The artifact-reference cap in characters (DM-8). */
export const STEER_MAX_REF_CHARS = 160 as const;
/** The list rows per lifecycle group (DM-8). */
export const STEER_MAX_LIST_ROWS_PER_GROUP = 8 as const;
/** The read payload's listed note cap; a display bound only (DM-8, AC-F3-4). */
export const STEER_MAX_READ_PAYLOAD_NOTES = 20 as const;
/** The serialized `data` byte cap, reused by reference from the digest (DM-8). */
export const STEER_MAX_MACHINE_BYTES = STATUS_MAX_MACHINE_BYTES;
/** The human render line cap, reused by reference from the digest (DM-8). */
export const STEER_MAX_HUMAN_LINES = STATUS_MAX_HUMAN_LINES;
/** The human render byte cap, reused by reference from the digest (DM-8). */
export const STEER_MAX_HUMAN_BYTES = STATUS_MAX_HUMAN_BYTES;
/** The delivered asks cap, reused by reference from the board contract (DM-6/DM-8). */
export const STEER_MAX_ASKS = BOARD_MAX_ASKS;

/* ------------------------------- rank and aging ---------------------------- */

/** The priority class map: lower sorts first (DM-5). */
export const STEER_PRIORITY_CLASS_BY_PRIORITY: Readonly<Record<SteerPriority, 1 | 2 | 3 | 4>> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
} as const;

/** The declared rank key, stated once for the comparator and its tests (DM-5). */
export const STEER_RANK_KEY = "priority-class,created,id" as const;

/* ------------------------- schema, records, identities --------------------- */

/** The one machine payload identity across all four subcommands (DEC-3). */
export const STEER_SCHEMA_VERSION = "delivery.steer.v1" as const;

/** The three additive append-only record kinds (DM-2). */
export const STEER_MESSAGE_RECORD_KIND = "steering.message" as const;
export const STEER_OUTCOME_RECORD_KIND = "steering.outcome" as const;
export const STEER_COMPLETION_RECORD_KIND = "steering.completion" as const;
export const STEER_RECORD_KINDS = [
  STEER_MESSAGE_RECORD_KIND,
  STEER_OUTCOME_RECORD_KIND,
  STEER_COMPLETION_RECORD_KIND,
] as const;

/** The stored payload schemas for the three record kinds (DM-2). */
export const STEER_MESSAGE_PAYLOAD_SCHEMA = "delivery.steering.message.v1" as const;
export const STEER_OUTCOME_PAYLOAD_SCHEMA = "delivery.steering.outcome.v1" as const;
export const STEER_COMPLETION_PAYLOAD_SCHEMA = "delivery.steering.completion.v1" as const;

/** The declared message-id prefix (DM-1). */
export const STEER_MESSAGE_ID_PREFIX = "msg-" as const;

/** The three steer error identities as data (their rows land with registration). */
export const STEER_UNKNOWN_ID_CODE = "steer.unknown-id" as const;
export const STEER_CREDENTIAL_VALUE_REJECTED_CODE = "steer.credential-value-rejected" as const;
export const STEER_QUEUE_UNAVAILABLE_CODE = "steer.queue-unavailable" as const;
export const STEER_ERROR_CODES = [
  STEER_UNKNOWN_ID_CODE,
  STEER_CREDENTIAL_VALUE_REJECTED_CODE,
  STEER_QUEUE_UNAVAILABLE_CODE,
] as const;
export type SteerErrorCode = (typeof STEER_ERROR_CODES)[number];

/** One declared field of the shared record schema (DM-1). */
export type SteerRecordFieldType = "string" | "number" | "object" | "string-or-null";

/** The shared record schema: exactly eleven fields, no owner-specific field (DM-1). */
export const STEER_RECORD_FIELDS = [
  { name: "id", type: "string" },
  { name: "from", type: "string" },
  { name: "to", type: "string" },
  { name: "scope", type: "string" },
  { name: "kind", type: "string" },
  { name: "subject", type: "string" },
  { name: "ref", type: "string-or-null" },
  { name: "origin", type: "object" },
  { name: "priority", type: "string" },
  { name: "created", type: "string" },
  { name: "ttl", type: "number" },
] as const satisfies readonly {
  readonly name: string;
  readonly type: SteerRecordFieldType;
}[];

/** The origin triple every message carries (DM-1). */
export type SteerOrigin = {
  readonly change: string | null;
  readonly repo: string;
  readonly agent: string;
};

/** The append-only shared message record, exactly the eleven declared keys (DM-1). */
export type SteerMessageRecord = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly scope: SteerScope;
  readonly kind: SteerKind;
  readonly subject: string;
  readonly ref: string | null;
  readonly origin: SteerOrigin;
  readonly priority: SteerPriority;
  readonly created: string;
  readonly ttl: number;
};

/** The record projection every filing answer carries (adds derived values only). */
export type SteerRecordProjection = SteerMessageRecord & {
  readonly expiresAt: string;
  readonly age: number;
};

/** The non-null read receipt of a landed note (DM-3, SC-M2-S5-01). */
export type SteerReceipt = {
  readonly origin: SteerOrigin;
  readonly readReceipt: {
    readonly at: string;
    readonly boundary: string;
  };
  readonly ttl: number;
  readonly expiresAt: string;
};

/** The classified expiry block of an expired note (DM-3, DEC-7). */
export type SteerExpiry = {
  readonly reason: SteerExpiryReason;
  readonly recordedAt: string;
};

/** One applied outcome record (a receipt), append-only (DM-2). */
export type SteerOutcomeRecord = {
  readonly schemaId: typeof STEER_OUTCOME_PAYLOAD_SCHEMA;
  readonly id: string;
  readonly outcome: "applied";
  readonly recordedAt: string;
  readonly receipt: SteerReceipt;
};

/** One expired outcome record, append-only (DM-2). */
export type SteerExpiredOutcomeRecord = {
  readonly schemaId: typeof STEER_OUTCOME_PAYLOAD_SCHEMA;
  readonly id: string;
  readonly outcome: "expired";
  readonly recordedAt: string;
  readonly reason: SteerExpiryReason;
};

/** Either recorded outcome (exactly one per note). */
export type SteerOutcome = SteerOutcomeRecord | SteerExpiredOutcomeRecord;

/** One artifact-ref completion record, append-only (DM-2, F-6). */
export type SteerCompletionRecord = {
  readonly schemaId: typeof STEER_COMPLETION_PAYLOAD_SCHEMA;
  readonly id: string;
  readonly completedAt: string;
  readonly artifact: string;
};

/* ------------------------------- payloads ---------------------------------- */

/** The boundary block of the read payload (spec section 8.3). */
export type SteerBoundaryBlock = {
  readonly open: boolean;
  readonly phase: string | null;
  readonly phaseUnknownReason?: SteerPhaseUnknownReason;
};

/** One note row of the read payload (DM-3, spec section 8.3). */
export type SteerReadNote = {
  readonly id: string;
  readonly kind: SteerKind;
  readonly priority: SteerPriority;
  readonly subject: string;
  readonly ref: string | null;
  readonly origin: SteerOrigin;
  readonly created: string;
  readonly ttl: number;
  readonly expiresAt: string;
  readonly age: number;
  readonly rank: number;
  readonly lifecycle: "landed" | "expired" | "queued";
  readonly applied: boolean;
  readonly receipt?: SteerReceipt;
  readonly expiry?: SteerExpiry;
  readonly pendingReason?: typeof STEER_PHASE_IN_PROGRESS_REASON;
};

/** One ask row composed from the delivered open-question view (DM-6). */
export type SteerAskRow = {
  readonly id: string;
  readonly type: string;
  readonly ref: string | null;
  readonly lane: string;
  readonly question: string;
  readonly askedAt: string;
  readonly age: number;
  readonly drawnDefault: OwnerGateSlaDefault | null;
  readonly defaultState: BoardAskDefaultState;
  readonly rank: number;
};

/** One queue-view row; landed rows carry the receipt and `completedWith` (DM-4). */
export type SteerListRow = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly scope: SteerScope;
  readonly kind: SteerKind;
  readonly subject: string;
  readonly ref: string | null;
  readonly origin: SteerOrigin;
  readonly priority: SteerPriority;
  readonly created: string;
  readonly ttl: number;
  readonly expiresAt: string;
  readonly age: number;
  readonly rank: number;
  readonly lifecycle: "queued" | "landed" | "expired" | "completed";
  readonly receipt?: SteerReceipt;
  readonly completedWith?: string | null;
  readonly expiry?: SteerExpiry;
};

/** The `steer send` machine payload (spec section 8.3). */
export type SteerSendData = {
  readonly schemaVersion: typeof STEER_SCHEMA_VERSION;
  readonly record: SteerRecordProjection;
  readonly lifecycle: "queued";
};

/** The `steer read` machine payload (spec section 8.3). */
export type SteerReadData = {
  readonly schemaVersion: typeof STEER_SCHEMA_VERSION;
  readonly boundary: SteerBoundaryBlock;
  readonly applied: boolean;
  readonly expiry?: { readonly reason: SteerExpiryReason };
  readonly notes: readonly SteerReadNote[];
  readonly asks: readonly SteerAskRow[];
  readonly omitted: number;
  readonly truncated: boolean;
};

/** The `steer list` machine payload (spec section 8.3). */
export type SteerListData = {
  readonly schemaVersion: typeof STEER_SCHEMA_VERSION;
  readonly queued: readonly SteerListRow[];
  readonly landed: readonly SteerListRow[];
  readonly expired: readonly SteerListRow[];
  readonly omitted: number;
  readonly truncated: boolean;
};

/** The `steer complete` machine payload (spec section 8.3). */
export type SteerCompleteData = {
  readonly schemaVersion: typeof STEER_SCHEMA_VERSION;
  readonly record: {
    readonly id: string;
    readonly lifecycle: "completed";
    readonly completedAt: string;
    readonly artifact: string;
  };
};

/* ------------------------------ domain inputs ------------------------------ */

/** The filing request validated by the pure domain (F-1, section 8.3). */
export type SteerSendInput = {
  readonly text: string;
  readonly kind?: string;
  readonly priority?: string;
  readonly ttl?: string;
  readonly ref?: string | null;
};

/** The completion request validated by the pure domain (F-6). */
export type SteerCompleteInput = {
  readonly id: string;
  readonly ref?: string;
};

/** One phase-fold entry the boundary derivation reads (DEC-5). */
export type SteerPhaseFoldEntry = {
  readonly phaseId: string;
  readonly started: string;
  readonly completed: string | null;
};

/** The delivered phase fold projected for the boundary derivation (DEC-5). */
export type SteerPhaseFoldView = {
  readonly present: boolean;
  readonly entries: readonly SteerPhaseFoldEntry[];
};

/** The recorded steering history folded by the derived lifecycle (DM-2). */
export type SteerRecordSet = {
  readonly messages: readonly SteerMessageRecord[];
  readonly outcomes: readonly SteerOutcome[];
  readonly completions: readonly SteerCompletionRecord[];
};

/** The defaultable-ref map and the applied-ref set the join composes (DM-6). */
export type SteerAskJoinFacts = {
  readonly defaultableRefs: Readonly<Record<string, OwnerGateSlaDefault>>;
  readonly appliedRefs: readonly string[];
};

/** One row of the delivered open-question view, as the read point receives it (DM-6). */
export type SteerAskFact = {
  readonly id: string;
  readonly type: string;
  readonly audience: string;
  readonly lane: string;
  readonly ref: string | null;
  readonly question: string;
  readonly askedAt: string;
  readonly age: number;
  readonly rank: number;
};

/** The delivered asks view plus the PDR-0003 join facts (DM-6, NG-8). */
export type SteerAskSource = {
  readonly facts: readonly SteerAskFact[];
  readonly join: SteerAskJoinFacts;
};

/** One planned read-point transition: the outcome record the edge appends. */
export type SteerReadTransition = SteerOutcome;

/** The pure read plan: every transition plus the full derived row set. */
export type SteerReadPlan = {
  readonly boundary: SteerBoundaryBlock;
  readonly applied: boolean;
  readonly transitions: readonly SteerReadTransition[];
  readonly rows: readonly SteerReadNote[];
};

/** The completed note view the list projection consumes. */
export type SteerCompletedNote = {
  readonly id: string;
  readonly artifact: string;
  readonly completedAt: string;
};
