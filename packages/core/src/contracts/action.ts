/**
 * The retro action-registry vocabulary (GH-287 F-1..F-7; DEC-3..DEC-11).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The module is
 * the single home of the five-field filing contract plus its verification
 * artifact, the verifiable-verb and owner vocabularies, the record kinds and
 * payload schemas of the registry's own validated boundary, the aging basis and
 * thresholds, the WIP limit, the closure routes and their two planes, the three
 * additive refusal identities, the free-text bounds, the command grammar, and
 * the board actions-row member set. No clock, randomness, environment,
 * filesystem, or network access lives here.
 */
import type { Result } from "./index.js";
import type { RetroLevelName } from "./retro.js";
import type { StateArtifactBoundaryDeclaration, StateFailureCode } from "./state.js";

/* -------------------------------- owner ----------------------------------- */

/**
 * The closed owner-kind vocabulary: an action is owned by one agent role or one
 * human, never by a team (NG-8, Appendix C).
 */
export const ACTION_OWNER_KINDS = ["agent-role", "human"] as const;

export type ActionOwnerKind = (typeof ACTION_OWNER_KINDS)[number];

/** The owner kinds the filing gate refuses by name (team-owned/ownerless). */
export const ACTION_REFUSED_OWNER_KINDS = ["team"] as const;

/* -------------------------------- verbs ----------------------------------- */

/** The closed verifiable-verb vocabulary in declared order (Appendix C). */
export const ACTION_VERBS = ["add", "remove", "change", "test", "deploy"] as const;

export type ActionVerb = (typeof ACTION_VERBS)[number];

/** The named unverifiable verbs the filing gate refuses (Appendix C). */
export const ACTION_REFUSED_VERBS = ["review", "improve"] as const;

/* ------------------------------- fields ----------------------------------- */

/**
 * The contract members a filing must satisfy, in declaration order. The first
 * eight are the five-field contract plus the verification artifact, the outcome
 * verifier window, and the rollback condition (F-1, F-2, DM-1).
 */
export const ACTION_CONTRACT_FIELDS = [
  "owner",
  "verb",
  "measurableOutcome",
  "trackerEntry",
  "dueDate",
  "verificationArtifact",
  "outcomeVerifier",
  "rollbackCondition",
] as const;

export type ActionContractField = (typeof ACTION_CONTRACT_FIELDS)[number];

/** The five concept fields, a subset of the contract member set (Appendix C). */
export const ACTION_FIVE_FIELDS = [
  "owner",
  "verb",
  "measurableOutcome",
  "trackerEntry",
  "dueDate",
] as const;

/** The declared free-text fields and their bounds (NFR-2, §20). */
export const ACTION_FREE_TEXT_BOUNDS = {
  measurableOutcome: 400,
  rollbackCondition: 400,
  closureReason: 400,
} as const;

/** The declared reference/identity field bounds. */
export const ACTION_MAX_OWNER_CHARS = 120 as const;
export const ACTION_MAX_REF_CHARS = 200 as const;
export const ACTION_MAX_WINDOW_CHARS = 120 as const;

/* ---------------------------- record kinds -------------------------------- */

/** The action record kind (DM-1, DEC-7). */
export const RETRO_ACTION_RECORD_KIND = "retro.action" as const;

/** The closure record kind (DM-3, DEC-7). */
export const RETRO_ACTION_CLOSURE_RECORD_KIND = "retro.action-closure" as const;

/** The action record payload schema (plan-level pinned naming). */
export const RETRO_ACTION_PAYLOAD_SCHEMA = "delivery.retro.action.v1" as const;

/** The closure record payload schema (plan-level pinned naming). */
export const RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA = "delivery.retro.action-closure.v1" as const;

/** The action records' store-scoped key prefix. */
export const RETRO_ACTION_RECORD_KEY_PREFIX = "retro.actions" as const;

/** The closure records' store-scoped key prefix. */
export const RETRO_ACTION_CLOSURE_RECORD_KEY_PREFIX = "retro.action-closures" as const;

/**
 * The boundary scope both prefixes share. The delivered retro-registry
 * boundary is untouched: its exactly-three declaration covers a different
 * scope.
 */
export const RETRO_ACTION_REGISTRY_RECORD_KEY_PREFIX = "retro.action" as const;

/** The records' identity fields. */
export const RETRO_ACTION_IDENTITY_FIELD = "actionId" as const;
export const RETRO_ACTION_CLOSURE_IDENTITY_FIELD = "closureId" as const;

/** The fence namespace the action registry composes (NFR-5). */
export const RETRO_ACTION_REGISTRY_FENCE_NAMESPACE = "retro-action-registry" as const;

/** The closed tracker-corroboration vocabulary (spec §8.4). */
export const ACTION_TRACKER_CORROBORATION_STATES = [
  "confirmed",
  "unreachable",
  "unverified",
] as const;

export type ActionTrackerCorroboration = (typeof ACTION_TRACKER_CORROBORATION_STATES)[number];

/* -------------------------------- aging ----------------------------------- */

/**
 * The one declared aging basis (DEC-9): elapsed time from the action's recorded
 * filing timestamp. Due dates never feed the day thresholds.
 */
export const ACTION_AGING_BASIS = "time-open-since-filing" as const;

/** The recorded field the aging basis reads. */
export const ACTION_AGING_BASIS_FIELD = "filedAt" as const;

/** The nudge threshold: 14 days of time open since filing (F-3, NFR-3). */
export const ACTION_AGING_NUDGE_DAYS = 14 as const;

/** The escalation threshold: 30 days of time open since filing (F-3, NFR-3). */
export const ACTION_AGING_ESCALATE_DAYS = 30 as const;

/** The one day length used by the aging arithmetic. */
export const ACTION_AGING_DAY_MS = 86_400_000 as const;

/** The closed derived aging-state vocabulary (DM-2). */
export const ACTION_AGING_STATES = ["current", "nudged", "escalated"] as const;

export type ActionAgingState = (typeof ACTION_AGING_STATES)[number];

/** The closed escalation-reason vocabulary (second miss is independent, DEC-9). */
export const ACTION_ESCALATION_REASONS = ["threshold-days", "second-miss"] as const;

export type ActionEscalationReason = (typeof ACTION_ESCALATION_REASONS)[number];

/** The second-miss rule: two recorded due-date lapse events escalate (DEC-9). */
export const ACTION_SECOND_MISS_LAPSES = 2 as const;

/* --------------------------------- wip ------------------------------------ */

/**
 * The improvement WIP limit: one fixed contract-data value within the concept's
 * 1-3 range, enforced as a filing refusal (DEC-6).
 */
export const ACTION_WIP_LIMIT = 3 as const;

/* ------------------------------- closure ---------------------------------- */

/** The closed closure-route vocabulary (F-4, Appendix C). */
export const ACTION_CLOSURE_ROUTES = ["done", "deprioritized", "superseded"] as const;

export type ActionClosureRoute = (typeof ACTION_CLOSURE_ROUTES)[number];

/** The two closure planes of one action (SC-M2-S10-02, DM-3). */
export const ACTION_CLOSURE_PLANES = ["artifact", "outcome"] as const;

export type ActionClosurePlane = (typeof ACTION_CLOSURE_PLANES)[number];

/** The closed closure-plane state vocabulary (the pinned literals, SC-M2-S10-02). */
export const ACTION_CLOSURE_PLANE_STATES = ["open", "closed"] as const;

export type ActionClosurePlaneState = (typeof ACTION_CLOSURE_PLANE_STATES)[number];

/**
 * The verification-window state vocabulary. `mooted` is the recorded
 * consequence of the one both-plane decision on the deprioritized and
 * superseded routes (DEC-11).
 */
export const ACTION_VERIFICATION_WINDOW_STATES = ["open", "elapsed", "mooted"] as const;

export type ActionVerificationWindowState = (typeof ACTION_VERIFICATION_WINDOW_STATES)[number];

/** The payload member names of the two planes (the pinned literals). */
export const ACTION_CLOSURE_PLANE_FIELDS = {
  artifact: "artifactClosure",
  outcome: "outcomeClosure",
} as const;

/** The justification member each route requires (F-4, DEC-11). */
export const ACTION_CLOSURE_JUSTIFICATION_FIELDS = {
  done: "artifact",
  deprioritized: "reason",
  superseded: "successor",
} as const;

/** The explicit decision reference every closure carries (F-4, §10). */
export const ACTION_CLOSURE_DECISION_FIELD = "decision" as const;

/** The evidence-citation member an explicit outcome decision must carry (DEC-4). */
export const ACTION_OUTCOME_EVIDENCE_FIELD = "evidence" as const;

/* ------------------------------- refusals --------------------------------- */

/**
 * The three additive exact two-segment refusal identities under the delivered
 * `retro` domain kind (DEC-5, DEC-8, DEC-11). No family or pattern widening.
 */
export const RETRO_ACTION_ERROR_CODES = [
  "retro.action-incomplete",
  "retro.closure-incomplete",
  "retro.wip-limit-exceeded",
] as const;

export type RetroActionErrorCode = (typeof RETRO_ACTION_ERROR_CODES)[number];

/* ------------------------------ command grammar ---------------------------- */

/** The additive verb group inside the delivered `retro` command family (DEC-7). */
export const RETRO_ACTION_VERBS = ["file", "close", "list"] as const;

export type RetroActionVerb = (typeof RETRO_ACTION_VERBS)[number];

/**
 * The flag shapes the `retro action` verb group accepts. The grammar is pinned
 * once here; no suite re-derives a literal.
 */
export const ACTION_FLAGS = {
  owner: "--owner",
  ownerKind: "--owner-kind",
  verb: "--verb",
  measurableOutcome: "--outcome",
  trackerEntry: "--tracker",
  dueDate: "--due",
  verificationArtifact: "--artifact",
  outcomeEvidence: "--outcome-evidence",
  outcomeWindow: "--outcome-window",
  rollbackCondition: "--rollback",
  level: "--level",
  window: "--window",
  action: "--action",
  route: "--route",
  decision: "--decision",
  reason: "--reason",
  successor: "--successor",
  evidence: "--evidence",
  plane: "--plane",
} as const;

/** The `data.actions` list key (GAP-4 plan-level refinement). */
export const ACTION_LIST_DATA_KEY = "actions" as const;

/* -------------------------------- board ----------------------------------- */

/** The board's fifth section label, rendered immediately after `ASKS` (F-6). */
export const BOARD_ACTIONS_LABEL = "ACTIONS" as const;

/** The per-repository actions cap (DM-4, NFR-2). */
export const BOARD_MAX_ACTIONS = 8 as const;

/** The declared section render order under the kept payload identity. */
export const BOARD_SECTION_ORDER = ["lanes", "gates", "asks", "actions", "parked"] as const;

/** The declared byte-guard drop order; every drop is counted (NFR-2). */
export const BOARD_SECTION_DROP_ORDER = ["parked", "asks", "actions", "lanes", "gates"] as const;

/* -------------------------------- types ----------------------------------- */

/** The outcome verifier: a delayed metric window plus the evidence it names. */
export type RetroOutcomeVerifier = {
  readonly evidence: string;
  readonly windowStart: string;
  readonly windowEnd: string;
};

/** One filing attempt: every member optional so an omission is falsifiable. */
export type RetroActionDraft = {
  readonly owner?: string;
  readonly ownerKind?: string;
  readonly verb?: string;
  readonly measurableOutcome?: string;
  readonly trackerEntry?: string;
  readonly dueDate?: string;
  readonly verificationArtifact?: string;
  readonly outcomeVerifier?: RetroOutcomeVerifier;
  readonly rollbackCondition?: string;
  readonly level?: RetroLevelName;
  readonly window?: string;
  /** The tracker corroboration state the injected read disclosed at filing. */
  readonly trackerCorroboration?: ActionTrackerCorroboration;
  /** The recorded due-date lapse events; two escalate (DEC-9). */
  readonly dueDateLapses?: readonly string[];
};

/** One validated action record (DM-1). */
export type RetroActionRecord = {
  readonly schemaId: typeof RETRO_ACTION_PAYLOAD_SCHEMA;
  readonly actionId: string;
  readonly owner: string;
  readonly ownerKind: ActionOwnerKind;
  readonly verb: ActionVerb;
  readonly measurableOutcome: string;
  readonly trackerEntry: string;
  readonly trackerCorroboration: ActionTrackerCorroboration;
  readonly dueDate: string;
  readonly dueDateLapses: readonly string[];
  readonly verificationArtifact: string;
  readonly outcomeVerifier: RetroOutcomeVerifier;
  readonly rollbackCondition: string;
  readonly level: RetroLevelName;
  readonly window: string;
  readonly filedAt: number;
};

/** The justification a closure route carries (F-4, DEC-11). */
export type RetroClosureJustification = {
  readonly artifact?: string;
  readonly reason?: string;
  readonly successor?: string;
};

/** One explicit closure decision record (DM-3). */
export type RetroActionClosureRecord = {
  readonly schemaId: typeof RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA;
  readonly closureId: string;
  readonly actionId: string;
  readonly route: ActionClosureRoute;
  readonly plane: ActionClosurePlane;
  readonly decision: string;
  readonly justification: RetroClosureJustification;
  readonly artifactClosure: ActionClosurePlaneState;
  readonly outcomeClosure: ActionClosurePlaneState;
  readonly windowState: ActionVerificationWindowState;
  readonly decidedAt: number;
};

/** One explicit closure attempt; every member optional so omission is falsifiable. */
export type RetroActionCloseRequest = {
  readonly actionId?: string;
  readonly route?: string;
  readonly plane?: string;
  readonly decision?: string;
  readonly artifact?: string;
  readonly reason?: string;
  readonly successor?: string;
  readonly evidence?: string;
};

/** The two closure planes plus the verification-window state of one action. */
export type RetroActionPlanes = {
  readonly artifactClosure: ActionClosurePlaneState;
  readonly outcomeClosure: ActionClosurePlaneState;
  readonly windowState: ActionVerificationWindowState;
  readonly closures: readonly RetroActionClosureRecord[];
};

/** The derived aging projection of one open action (DM-2). */
export type RetroActionAging = {
  readonly basis: typeof ACTION_AGING_BASIS;
  readonly ageMs: number;
  readonly openDays: number;
  readonly state: ActionAgingState;
  readonly escalationReason?: ActionEscalationReason;
};

/** One row of the list surface (GAP-4 plan-level refinement). */
export type RetroActionListEntry = {
  readonly actionId: string;
  readonly owner: string;
  readonly ownerKind: ActionOwnerKind;
  readonly verb: ActionVerb;
  readonly level: RetroLevelName;
  readonly window: string;
  readonly measurableOutcome: string;
  readonly trackerEntry: string;
  readonly trackerCorroboration: ActionTrackerCorroboration;
  readonly dueDate: string;
  readonly dueDateLapses: number;
  readonly verificationArtifact: string;
  readonly outcomeVerifier: RetroOutcomeVerifier;
  readonly rollbackCondition: string;
  readonly filedAt: number;
  readonly age: number;
  readonly agingState: ActionAgingState;
  readonly artifactClosure: ActionClosurePlaneState;
  readonly outcomeClosure: ActionClosurePlaneState;
  readonly verificationWindowState: ActionVerificationWindowState;
};

/** One improvement window's WIP disclosure (DM-5). */
export type RetroActionWindowDisclosure = {
  readonly window: string;
  readonly openCount: number;
  readonly limit: number;
};

/** The list surface's bounded `data` payload. */
export type RetroActionListData = {
  readonly actions: readonly RetroActionListEntry[];
  readonly windows: readonly RetroActionWindowDisclosure[];
};

/** The filing surface's bounded `data` payload. */
export type RetroActionFileData = {
  readonly actionId: string;
  readonly action: RetroActionListEntry;
};

/** The closure surface's bounded `data` payload (the pinned plane literals). */
export type RetroActionCloseData = {
  readonly actionId: string;
  readonly route: ActionClosureRoute;
  readonly plane: ActionClosurePlane;
  readonly decision: string;
  readonly artifactClosure: ActionClosurePlaneState;
  readonly outcomeClosure: ActionClosurePlaneState;
  readonly windowState: ActionVerificationWindowState;
  readonly verificationWindow: RetroOutcomeVerifier;
};

export type RetroActionCommandData =
  | RetroActionFileData
  | RetroActionCloseData
  | RetroActionListData;

/* ------------------------------- failures --------------------------------- */

/**
 * A safe refusal location: the offending field, the closure plane and its
 * existing closure, or the window disclosure facts — never free text echo.
 */
export type RetroActionFailureLocation = {
  readonly field?: string;
  readonly plane?: string;
  readonly existingClosure?: string;
  readonly window?: string;
  readonly openCount?: number;
  readonly limit?: number;
  readonly path?: string;
};

/** The classified failure union the action surfaces return. */
export type RetroActionFailure =
  | {
      readonly kind: "retro";
      readonly code: RetroActionErrorCode;
      readonly consequence: "not_landed";
      readonly location?: RetroActionFailureLocation;
      readonly summary?: string;
    }
  | {
      readonly kind: "state";
      readonly code: StateFailureCode;
      readonly consequence: "not_landed";
      readonly location: { readonly path: string };
    }
  | {
      readonly kind: "input";
      readonly code: "input.value.rejected";
      readonly consequence: "not_landed";
      readonly summary?: string;
    };

export type RetroActionResult<T> = Result<T, RetroActionFailure>;

/** The action command outcome the CLI edge consumes. */
export type RetroActionCommandOutcome =
  | { readonly ok: true; readonly data: RetroActionCommandData }
  | {
      readonly ok: false;
      readonly error: RetroActionFailure;
      readonly partial?: string;
    };

/** The data-only command runtime the CLI edge composes. */
export type RetroActionCommandRuntime = {
  file(input: RetroActionDraft): RetroActionCommandOutcome | Promise<RetroActionCommandOutcome>;
  close(
    input: RetroActionCloseRequest,
  ): RetroActionCommandOutcome | Promise<RetroActionCommandOutcome>;
  list(input: {
    readonly window?: string;
  }): RetroActionCommandOutcome | Promise<RetroActionCommandOutcome>;
};

/* ------------------------------- boundary --------------------------------- */

/**
 * The action registry's own validated boundary: exactly the two additive record
 * kinds under the shared `retro.action` scope (DM-1, DM-3; DEC-7). The delivered
 * retro-registry boundary's exactly-three declaration is unchanged.
 */
export const RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: RETRO_ACTION_REGISTRY_RECORD_KEY_PREFIX,
  kinds: [
    {
      kind: RETRO_ACTION_RECORD_KIND,
      payloadSchema: RETRO_ACTION_PAYLOAD_SCHEMA,
      identityField: RETRO_ACTION_IDENTITY_FIELD,
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "actionId", type: "string", required: true },
        { name: "owner", type: "string", required: true },
        { name: "ownerKind", type: "string", required: true },
        { name: "verb", type: "string", required: true },
        { name: "measurableOutcome", type: "string", required: true },
        { name: "trackerEntry", type: "string", required: true },
        { name: "trackerCorroboration", type: "string", required: true },
        { name: "dueDate", type: "string", required: true },
        { name: "dueDateLapses", type: "array", required: true },
        { name: "verificationArtifact", type: "string", required: true },
        { name: "outcomeVerifier", type: "object", required: true },
        { name: "rollbackCondition", type: "string", required: true },
        { name: "level", type: "string", required: true },
        { name: "window", type: "string", required: true },
        { name: "filedAt", type: "number", required: true },
      ],
      vocabularies: [
        { field: "ownerKind", values: ACTION_OWNER_KINDS },
        { field: "verb", values: ACTION_VERBS },
        { field: "trackerCorroboration", values: ACTION_TRACKER_CORROBORATION_STATES },
      ],
    },
    {
      kind: RETRO_ACTION_CLOSURE_RECORD_KIND,
      payloadSchema: RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
      identityField: RETRO_ACTION_CLOSURE_IDENTITY_FIELD,
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "closureId", type: "string", required: true },
        { name: "actionId", type: "string", required: true },
        { name: "route", type: "string", required: true },
        { name: "plane", type: "string", required: true },
        { name: "decision", type: "string", required: true },
        { name: "justification", type: "object", required: true },
        { name: "artifactClosure", type: "string", required: true },
        { name: "outcomeClosure", type: "string", required: true },
        { name: "windowState", type: "string", required: true },
        { name: "decidedAt", type: "number", required: true },
      ],
      vocabularies: [
        { field: "route", values: ACTION_CLOSURE_ROUTES },
        { field: "plane", values: ACTION_CLOSURE_PLANES },
        { field: "artifactClosure", values: ACTION_CLOSURE_PLANE_STATES },
        { field: "outcomeClosure", values: ACTION_CLOSURE_PLANE_STATES },
        { field: "windowState", values: ACTION_VERIFICATION_WINDOW_STATES },
      ],
    },
  ],
};

/** The record key of one action under its declared prefix. */
export const retroActionRecordKey = (actionId: string): string =>
  `${RETRO_ACTION_RECORD_KEY_PREFIX}:${encodeURIComponent(actionId)}`;

/** The record key of one closure under its declared prefix. */
export const retroActionClosureRecordKey = (closureId: string): string =>
  `${RETRO_ACTION_CLOSURE_RECORD_KEY_PREFIX}:${encodeURIComponent(closureId)}`;
