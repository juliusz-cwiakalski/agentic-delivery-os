/**
 * The dispatch command-family language (GH-239 F-1..F-12, DM-1..DM-8).
 *
 * Runtime-neutral by construction: types and `as const` data only. The three
 * additive record kinds, their payload schemas and key prefixes, the derived
 * authority view, the declared comparison record, the closed evidence-class
 * union, the handover gate vocabulary, the corroboration sufficiency map, and
 * the bounded constants live here as the single typed home. The eleven result
 * tokens are imported from the delivered taxonomy; this module declares no
 * second token list.
 */

import type { DeliveryResultToken } from "./delivery-result.js";
import type {
  HarnessKind,
  HarnessMode,
  HarnessModeOrigin,
  HarnessOutcome,
  HarnessSeatBinding,
  HarnessSessionHandle,
  HarnessVersionVerdict,
} from "./harness.js";
import type { CommandResultError } from "./result.js";

/** The result-token alias; keeps the payload field types readable and bounded. */
export type DispatchToken = DeliveryResultToken;

/** The attempt record kind and its self-describing payload schema (EVT-1). */
export const DISPATCH_ATTEMPT_RECORD_KIND = "dispatch.attempt" as const;
export const DISPATCH_ATTEMPT_PAYLOAD_SCHEMA = "delivery.dispatch.attempt.v1" as const;
export const DISPATCH_ATTEMPT_KEY_PREFIX = "dispatch.attempt." as const;

/** The divergence record kind and its payload schema (EVT-2). */
export const DISPATCH_DIVERGENCE_RECORD_KIND = "dispatch.divergence" as const;
export const DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA = "delivery.dispatch.divergence.v1" as const;
export const DISPATCH_DIVERGENCE_KEY_PREFIX = "dispatch.divergence." as const;

/** The handover record kind and its payload schema (EVT-3). */
export const DISPATCH_HANDOVER_RECORD_KIND = "dispatch.handover" as const;
export const DISPATCH_HANDOVER_PAYLOAD_SCHEMA = "delivery.dispatch.handover.v1" as const;
export const DISPATCH_HANDOVER_KEY_PREFIX = "dispatch.handover." as const;

/** The derived per-repository authority view (DM-4); rebuildable, not an event. */
export const DISPATCH_AUTHORITY_SCHEMA = "delivery.dispatch.authority.v1" as const;
export const DISPATCH_AUTHORITY_DOCUMENT_NAME = "dispatch-authority.json" as const;

/**
 * The checkout-scoped first-use identity marker file name (DEC-13, TDR-0015
 * §6): created once inside the checkout's `<git-common-dir>`.
 */
export const DISPATCH_IDENTITY_MARKER_NAME = "dispatch-identity.json" as const;

/** The declared record-key builders: one store-scoped key per record. */
export const dispatchAttemptRecordKey = (attemptId: string): string =>
  `${DISPATCH_ATTEMPT_KEY_PREFIX}${attemptId}`;

export const dispatchDivergenceRecordKey = (divergenceId: string): string =>
  `${DISPATCH_DIVERGENCE_KEY_PREFIX}${divergenceId}`;

export const dispatchHandoverRecordKey = (repository: string): string =>
  `${DISPATCH_HANDOVER_KEY_PREFIX}${repository}`;

/** The closed evidence-class union (TDR-0015 §2). */
export const DISPATCH_EVIDENCE_CLASSES = ["pilot", "controlled-proof", "smoke", "fixture"] as const;

export type DispatchEvidenceClass = (typeof DISPATCH_EVIDENCE_CLASSES)[number];

/** The documented configuration default for a production dispatch composition. */
export const DISPATCH_DEFAULT_EVIDENCE_CLASS: DispatchEvidenceClass = "pilot" as const;

/** The closed comparison classes (TDR-0015 §5). */
export const DISPATCH_COMPARISON_CLASSES = [
  "verify-change",
  "tracker-truth",
  "not-applicable",
] as const;

export type DispatchComparisonClass = (typeof DISPATCH_COMPARISON_CLASSES)[number];

/** The closed comparison outcomes; `not-applicable` iff the class is. */
export const DISPATCH_COMPARISON_OUTCOMES = ["match", "mismatch", "not-applicable"] as const;

export type DispatchComparisonOutcome = (typeof DISPATCH_COMPARISON_OUTCOMES)[number];

/** The two declared comparison reasons. */
export const DISPATCH_COMPARISON_REASONS = [
  "dispatch-session-family",
  "comparison-source-unavailable",
] as const;

export type DispatchComparisonReason = (typeof DISPATCH_COMPARISON_REASONS)[number];

/**
 * The one declared per-attempt comparison record (DM-1, AC-F4-6).
 *
 * `token` is null iff the class is `not-applicable`, and the outcome is
 * `not-applicable` iff the class is. `urlResolved` is present for tracker
 * facts; URL resolution is an attribute, never part of the comparison.
 */
export type DispatchComparisonRecord = {
  readonly class: DispatchComparisonClass;
  readonly token: DispatchToken | null;
  readonly outcome: DispatchComparisonOutcome;
  readonly reason?: DispatchComparisonReason;
  readonly urlResolved?: boolean;
};

/** The closed handover authority values (DM-4). */
export const DISPATCH_HANDOVER_STATES = ["dual-run", "authoritative"] as const;

export type DispatchHandoverState = (typeof DISPATCH_HANDOVER_STATES)[number];

/** The closed handover record operations (EVT-3). */
export const DISPATCH_HANDOVER_OPERATIONS = ["authoritative", "dual-run"] as const;

export type DispatchHandoverOperation = (typeof DISPATCH_HANDOVER_OPERATIONS)[number];

/** The tri-state corroboration vocabulary (DM-8, NFR-10). */
export const DISPATCH_CORROBORATION_STATES = [
  "satisfied",
  "unsatisfied",
  "not-applicable",
] as const;

export type DispatchCorroborationState = (typeof DISPATCH_CORROBORATION_STATES)[number];

/** The three independent corroboration sources. */
export const DISPATCH_CORROBORATION_SOURCES = ["pm-notes", "tracker", "ci"] as const;

export type DispatchCorroborationSource = (typeof DISPATCH_CORROBORATION_SOURCES)[number];

/** One attempt's corroboration record: a state per declared source, always present. */
export type DispatchCorroborationRecord = {
  readonly pmNotes: DispatchCorroborationState;
  readonly tracker: DispatchCorroborationState;
  readonly ci: DispatchCorroborationState;
};

/**
 * The declared corroboration sufficiency map (DM-8, Appendix B.4).
 *
 * A success-claimed token requires the listed sources; a non-success token
 * requires none and satisfies corroboration vacuously. `pm-notes` covers the
 * completed-phase ledger, including the ledger/queue fact that no work remains.
 */
export const DISPATCH_CORROBORATION_SUFFICIENCY = {
  merged: ["pm-notes", "tracker", "ci"],
  "pr-open": ["tracker"],
  "pr-open-unverified": ["tracker"],
  blocked: ["tracker"],
  finished: ["pm-notes"],
  "noop-lane-nothing-to-do": ["pm-notes"],
  failed: [],
  partial: [],
  "max-restarts": [],
  "state-unverified": [],
  "noop-lane-permission": [],
} as const satisfies Readonly<Record<DeliveryResultToken, readonly DispatchCorroborationSource[]>>;

/**
 * The closed corroboration-arm vocabulary (GH-347 DM-4, TDR-0048; AC-F8-1,
 * AC-F8-4). Exactly the two arms whose required evidence source changed: a
 * tracker-done `merged` and a nothing-to-do result are corroborated by the
 * tracker fact alone. Every other token keeps its token-keyed requirement.
 */
export const DISPATCH_CORROBORATION_ARMS = ["tracker-done-merged", "nothing-to-do"] as const;

export type DispatchCorroborationArm = (typeof DISPATCH_CORROBORATION_ARMS)[number];

/** The arm-keyed sufficiency entries; the only additions to the token map. */
export const DISPATCH_CORROBORATION_ARM_SUFFICIENCY = {
  "tracker-done-merged": ["tracker"],
  "nothing-to-do": ["tracker"],
} as const satisfies Readonly<
  Record<DispatchCorroborationArm, readonly DispatchCorroborationSource[]>
>;

/** The four handover conditions, in evaluation order (DM-7). */
export const DISPATCH_HANDOVER_CONDITIONS = [
  "truth",
  "coverage",
  "floor",
  "corroboration",
] as const;

export type DispatchHandoverCondition = (typeof DISPATCH_HANDOVER_CONDITIONS)[number];

/**
 * The closed condition-status pair (TDR-0031 D2, DM-3).
 *
 * `unverifiable` is a window-level verdict, never a condition status: a
 * truncated read reports `verdict: "unverifiable"` plus `truncation`, and the
 * statuses stay explicitly "over the visible window".
 */
export const DISPATCH_CONDITION_STATES = ["met", "open"] as const;

export type DispatchConditionState = (typeof DISPATCH_CONDITION_STATES)[number];

/**
 * One condition's status in the declared order (TDR-0031 D2, DM-3).
 *
 * Exactly `{condition, status}` — no `detail`. The detail text stays where it
 * already lives (`unmetConditions` on the handover surface, the typed summary
 * fields), so the shared shape carries no second detail vocabulary.
 */
export type DispatchConditionStatus = {
  readonly condition: DispatchHandoverCondition;
  readonly status: DispatchConditionState;
};

/** The closed window-start reasons (DM-6, DEC-10). */
export const DISPATCH_WINDOW_START_REASONS = [
  "first-counted-dispatch",
  "false-success-incident-reset",
  "no-counted-dispatch",
] as const;

export type DispatchWindowStartReason = (typeof DISPATCH_WINDOW_START_REASONS)[number];

/** The closed gate verdicts (DM-6, DM-7). */
export const DISPATCH_GATE_VERDICTS = ["eligible", "ineligible", "unverifiable"] as const;

export type DispatchGateVerdict = (typeof DISPATCH_GATE_VERDICTS)[number];

/** The closed resume modes (F-3). */
export const DISPATCH_RESUME_MODES = ["attach-continue", "resume-prompt-reentry"] as const;

export type DispatchResumeMode = (typeof DISPATCH_RESUME_MODES)[number];

/** The closed increment variants carried on the phase ledger (the plan variants). */
export const DISPATCH_LEDGER_VARIANTS = ["full", "lite", "unknown"] as const;

export type DispatchLedgerVariant = (typeof DISPATCH_LEDGER_VARIANTS)[number];

/** One bounded evidence reference; identifiers only, never content. */
export type DispatchEvidenceReference = string;

/** The durable per-dispatch attempt record payload (EVT-1, DM-1). */
export type DispatchAttemptRecord = {
  readonly schema: typeof DISPATCH_ATTEMPT_PAYLOAD_SCHEMA;
  readonly attemptId: string;
  /** Normalized `host/owner/name` identity; never a checkout-path digest. */
  readonly repository: string;
  readonly ref: string;
  readonly harness: HarnessKind;
  readonly evidenceClass: DispatchEvidenceClass;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly handoverState: DispatchHandoverState;
  readonly outcome: HarnessOutcome;
  readonly token: DispatchToken;
  readonly comparison: DispatchComparisonRecord;
  readonly divergenceRef?: string;
  readonly falseSuccess: boolean;
  readonly corroboration: DispatchCorroborationRecord;
  readonly resumeMode?: DispatchResumeMode;
  readonly prefillCostAcknowledged?: boolean;
  /** The nominated provider profile recorded at admission (GH-294 DM-1); classified absence on pre-change records. */
  readonly providerProfile?: string;
  /**
   * The session identities this attempt held — one per spawn/resume (GH-335
   * DM-8). Absent on a pre-change record and on an attempt that held none; an
   * attempt with no identity is disclosed as a counted unattributed attempt by
   * the capture, never inferred.
   */
  readonly sessionIds?: readonly string[];
  /**
   * The single-seat binding the composition resolved for this attempt's spawn
   * (GH-335 DM-4, TDR-0040 decision 4). Absent on a pre-change record and on a
   * role-less run; capture cites it rather than re-deriving a seat from the
   * current profile.
   */
  readonly binding?: HarnessSeatBinding;
  /**
   * The normalized observed harness version this attempt ran on (GH-335 F-1;
   * TDR-0041 decision 4). Absent on a pre-change record; never fabricated.
   */
  readonly harnessVersion?: string | null;
  /** The window verdict the attempt ran under. */
  readonly versionVerdict?: HarnessVersionVerdict;
  /** The selected integration mode, and its origin (DEC-2, TDR-0042). */
  readonly mode?: HarnessMode;
  readonly modeOrigin?: HarnessModeOrigin;
  readonly evidenceRefs: readonly DispatchEvidenceReference[];
  readonly recordedAt: string;
};

/** The durable divergence record payload (EVT-2, DM-2). */
export type DispatchDivergenceRecord = {
  readonly schema: typeof DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA;
  readonly divergenceId: string;
  readonly repository: string;
  readonly ref: string;
  readonly attemptId: string;
  readonly state: "open" | "resolved";
  readonly comparisonClass: DispatchComparisonClass;
  readonly engineToken: DeliveryResultToken;
  readonly comparisonToken: DeliveryResultToken | null;
  readonly note?: string;
  readonly principal?: string;
  readonly resolvedAt?: string;
  readonly evidenceRefs: readonly DispatchEvidenceReference[];
  readonly recordedAt: string;
};

/** The conditions snapshot carried on the handover record (EVT-3, DM-3). */
export type DispatchHandoverConditionsSnapshot = {
  readonly verdict: DispatchGateVerdict;
  readonly windowStart: string;
  readonly windowStartReason: DispatchWindowStartReason;
  readonly countedDeliveries: number;
  readonly coveragePresent: readonly DeliveryResultToken[];
  readonly coverageMissing: readonly DeliveryResultToken[];
  readonly incidents: number;
  readonly unresolvedDivergences: number;
  readonly floorMet: boolean;
  readonly corroborationSatisfied: number;
};

/** The durable handover/reversal record payload (EVT-3, DM-3). */
export type DispatchHandoverRecord = {
  readonly schema: typeof DISPATCH_HANDOVER_PAYLOAD_SCHEMA;
  readonly repository: string;
  readonly operation: DispatchHandoverOperation;
  readonly conditions: DispatchHandoverConditionsSnapshot;
  readonly evidenceRefs: readonly DispatchEvidenceReference[];
  readonly principal: string;
  readonly recordedAt: string;
};

/** The derived per-repository authority view (DM-4). */
export type DispatchAuthorityView = {
  readonly schema: typeof DISPATCH_AUTHORITY_SCHEMA;
  readonly repository: string;
  readonly authority: DispatchHandoverState;
  readonly handoverRef?: string;
  readonly recordedAt: string;
  readonly reversalAvailable: boolean;
};

/** The injected authority-read port: absent, unreadable, or malformed is dual-run. */
export type DispatchAuthorityReadPort = (input: {
  readonly repository: string;
}) => DispatchAuthorityView;

/** The phase-ledger projection carried on an envelope (DM-5). */
export type DispatchPhaseLedger = {
  readonly completed: number;
  readonly total: number;
  readonly variant: DispatchLedgerVariant;
};

/**
 * The dispatch envelope error (DM-3, DEC-4): the delivered `CommandResultError`
 * plus an additive bounded detail carrying the underlying harness failure
 * identity. The detail is optional because non-spawn dispatch error rows do not
 * carry one; on the pre-session spawn path it is always present.
 */
export type DispatchEnvelopeError = CommandResultError & {
  readonly detail?: {
    readonly kind: "harness" | "config";
    readonly code: string;
    readonly field?: string;
  };
};

/** The declared dispatch envelope `data` (DM-5). */
export type DispatchEnvelopeData = {
  readonly result: DeliveryResultToken;
  readonly prUrl: string;
  readonly phaseLedger: DispatchPhaseLedger;
  readonly restarts: number;
  readonly resumeAmplification: string;
  readonly harness: HarnessKind;
  readonly handoverState: DispatchHandoverState;
  readonly outcome: HarnessOutcome;
  /** Present only for an attempt-stage classified failure, never for success. */
  readonly error?: DispatchEnvelopeError;
  /** Bounded, single-line, redacted summary; also feeds text `last_message=`. */
  readonly lastMessage: string;
  /** Present only when a bounded field was truncated. */
  readonly truncation?: {
    readonly field: string;
    readonly omittedChars: number;
  };
};

/**
 * The one shared repository-scoped divergence block (GH-289 F-5, F-7; DEC-15).
 *
 * `unresolved` is the exact folded open count for the reported repository,
 * `unresolvedIds` is its declared at-most-20 list, and `idsTruncated` is true
 * exactly when identifiers were omitted. No surface derives the count from the
 * list's length.
 */
export type DispatchDivergenceBlock = {
  readonly reported: number;
  readonly resolved: number;
  readonly unresolved: number;
  readonly unresolvedIds: readonly string[];
  readonly idsTruncated: boolean;
};

/**
 * The dual-run resolve success data (GH-289 F-5, DM-3): the five delivered keys
 * keep their names and order, followed by the additive mode, subject repository
 * and the shared divergence block.
 */
export type DispatchResolveData = {
  readonly divergenceId: string;
  readonly state: "open" | "resolved";
  readonly resolved: boolean;
  readonly note?: string;
  readonly principal?: string;
  readonly mode: "local-evidence";
  readonly repository: string;
  readonly divergences: DispatchDivergenceBlock;
};

/** One unmet gate condition with its declared detail. */
export type DispatchUnmetCondition = {
  readonly condition: DispatchHandoverCondition;
  readonly detail: string;
};

/** One reported excluded evidence class with its count (DM-6). */
export type DispatchExcludedEvidenceClass = {
  readonly evidenceClass: DispatchEvidenceClass;
  readonly count: number;
};

/** The dual-run summary `data` (DM-6). */
export type DispatchSummaryData = {
  readonly repository: string;
  readonly windowStart: string;
  readonly windowStartReason: DispatchWindowStartReason;
  readonly windowEnd: string;
  readonly dayCount: number;
  readonly countedDeliveries: number;
  readonly countedEvidenceClass: DispatchEvidenceClass;
  readonly excludedEvidenceClasses: readonly DispatchExcludedEvidenceClass[];
  readonly incidents: number;
  readonly divergences: DispatchDivergenceBlock;
  readonly coverage: {
    readonly present: readonly DeliveryResultToken[];
    readonly missing: readonly DeliveryResultToken[];
  };
  readonly corroboration: {
    readonly satisfied: number;
    readonly unsatisfied: number;
    readonly unsatisfiedRefs: readonly string[];
  };
  readonly eligibility: boolean;
  readonly verdict: DispatchGateVerdict;
  readonly unmetConditions: readonly DispatchUnmetCondition[];
  /** The corroborated counted attempts; declared identical to `corroboration.satisfied`. */
  readonly cleanDispatches: number;
  /** The trailing run of clean counted attempts ending at the window's last one. */
  readonly consecutiveCleanDispatches: number;
  /** The four ordered condition statuses (TDR-0031 D2); `open` equals `unmetConditions`. */
  readonly conditions: readonly DispatchConditionStatus[];
  readonly floor: {
    readonly met: boolean;
    readonly countedDeliveries: number;
    readonly consecutiveDates: number;
    readonly onlyFloor: true;
  };
  readonly truncation?: {
    readonly bound: number;
    readonly omittedRecords: number;
  };
};

/**
 * The attempts read-side reference source (GH-289 F-2): `flag` when the caller
 * supplied `--ref`, `active-change` when it resolved from the local context.
 */
export type AttemptsRefSource = "flag" | "active-change";

/**
 * One projected attempt (GH-289 F-2, DM-2, Appendix D).
 *
 * Exactly sixteen consumer fields: the attempt's identity, its result, its
 * comparison, its corroboration triple, its single divergence reference, its
 * timing, and its bounded citations. `endedAt` is the consumer name for the
 * record's finish timestamp; `divergenceRef` is singular or explicit `null`.
 */
export type DispatchAttemptView = {
  readonly attemptId: string;
  readonly repository: string;
  readonly ref: string;
  readonly harness: HarnessKind;
  readonly evidenceClass: DispatchEvidenceClass;
  readonly outcome: HarnessOutcome;
  readonly token: DispatchToken;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly divergenceRef: string | null;
  readonly corroboration: DispatchCorroborationRecord;
  readonly falseSuccess: boolean;
  readonly comparison: {
    readonly class: DispatchComparisonClass;
    readonly token: DispatchToken | null;
    readonly outcome: DispatchComparisonOutcome;
  };
  readonly resumeMode: DispatchResumeMode | null;
  /** The nominated provider profile, or null classified absence for pre-change records (GH-294 DM-1). */
  readonly providerProfile: string | null;
  readonly evidenceRefs: readonly DispatchEvidenceReference[];
  readonly recordedAt: string;
};

/** The single declared truncation object (GH-289 DM-5); ledger scope wins. */
export type DispatchAttemptsTruncation = {
  readonly scope: "ledger" | "page";
  readonly bound: number;
  readonly omittedRecords: number;
};

/**
 * The `attempts.v1` read-side data (GH-289 F-2, DM-1, Appendix D).
 *
 * Eight always-present keys plus `truncation` only when a bound binds and one
 * declared `excluded.foreignRepository` count over the retained ledger window.
 */
export type DispatchAttemptsData = {
  readonly repository: string;
  readonly ref: string;
  readonly refSource: AttemptsRefSource;
  readonly limit: number;
  readonly matched: number;
  readonly hasMore: boolean;
  readonly attempts: readonly DispatchAttemptView[];
  readonly excluded: { readonly foreignRepository: number };
  readonly truncation?: DispatchAttemptsTruncation;
};

/** The attempts-only page bounds (GH-289 DM-4); the byte/line budgets are shared. */
export const ATTEMPTS_DEFAULT_LIMIT = 20 as const;
export const ATTEMPTS_MIN_LIMIT = 1 as const;
export const ATTEMPTS_MAX_LIMIT = 100 as const;
export const ATTEMPTS_HUMAN_ROW_BUDGET = 37 as const;
/** The canonical decimal limit form: no sign, no whitespace, no leading zero. */
export const ATTEMPTS_LIMIT_PATTERN = "[1-9][0-9]*" as const;

/** Bounded read and output constants (NFR-4). */
export const DISPATCH_MAX_ATTEMPT_RECORDS = 5000 as const;
export const DISPATCH_MAX_MACHINE_BYTES = 65536 as const;
export const DISPATCH_MAX_HUMAN_LINES = 40 as const;
export const DISPATCH_MAX_HUMAN_BYTES = 8192 as const;
export const DISPATCH_MAX_LAST_MESSAGE_CHARS = 512 as const;
/** The additive error-detail bound (NFR-6): single-line identifiers only. */
export const DISPATCH_MAX_ERROR_DETAIL_CHARS = 256 as const;
export const DISPATCH_MAX_EVIDENCE_REFS = 16 as const;
export const DISPATCH_MAX_NOTE_CHARS = 240 as const;
export const DISPATCH_MAX_DIVERGENCE_IDS = 20 as const;

/** The exposure floor constants (DM-7, DEC-12). */
export const DISPATCH_FLOOR_DISPATCHES = 20 as const;
export const DISPATCH_FLOOR_CONSECUTIVE_DATES = 7 as const;

/** The default liveness cadence name; the value comes from configuration. */
export const DISPATCH_LIVENESS_INTERVAL_KEY = "lane.liveness-interval" as const;
export const DISPATCH_RESTART_BUDGET_KEY = "lane.restart-budget" as const;

/* ------------------------------------------------------------------------- */
/* GH-347 — the dispatch-owned durable lane record, the fresh-spawn title     */
/* fact, and the injected delay vocabulary. Data and types only.              */
/* ------------------------------------------------------------------------- */

/** The dispatch-owned durable lane record kind and its payload schema (DM-1). */
export const DISPATCH_LANE_RECORD_KIND = "dispatch.lane" as const;
export const DISPATCH_LANE_PAYLOAD_SCHEMA = "delivery.dispatch.lane.v1" as const;
export const DISPATCH_LANE_KEY_PREFIX = "dispatch.lanes:" as const;

/** The closed lane states: one active record per acquisition, one terminal per classification. */
export const DISPATCH_LANE_STATES = ["active", "terminal"] as const;

export type DispatchLaneState = (typeof DISPATCH_LANE_STATES)[number];

/** The advisory owner facts carried on a lane record; never an exclusion mechanism. */
export type DispatchLaneOwner = {
  readonly processId: number;
  readonly startedAt: string;
};

/**
 * One durable dispatch lane record (DM-1, TDR-0044).
 *
 * Append-only; the latest record for a ref is the lane. `lastToken` and
 * `lastOutcome` are present only on a terminal record. No prompt, transcript,
 * diff, credential, or provider payload is carried.
 */
export type DispatchLaneRecord = {
  readonly schema: typeof DISPATCH_LANE_PAYLOAD_SCHEMA;
  readonly ref: string;
  readonly repository: string;
  readonly attemptId: string;
  readonly sessionId: string;
  readonly harnessKind: HarnessKind;
  readonly owner: DispatchLaneOwner;
  readonly iterationOrdinal: number;
  readonly restartsConsumed: number;
  readonly state: DispatchLaneState;
  readonly lastToken?: DispatchToken;
  readonly lastOutcome?: HarnessOutcome;
  readonly recordedAt: string;
};

/** The per-ref lane record key; one key per ref, appended per state change. */
export const dispatchLaneRecordKey = (ref: string): string => `${DISPATCH_LANE_KEY_PREFIX}${ref}`;

/** The fresh-spawn title fact (DM-6, TDR-0049): `ticket-<REF>`, one short token. */
export const DISPATCH_SPAWN_TITLE_PREFIX = "ticket-" as const;
export const DISPATCH_MAX_SPAWN_TITLE_CHARS = 64 as const;
/** Anchored grammar: the prefix plus the work-item reference grammar. */
export const DISPATCH_SPAWN_TITLE_PATTERN = "^ticket-[A-Z][A-Z0-9]*-[0-9]+$" as const;

/**
 * The one injected delay fact (AC-F9-2, NFR-11).
 *
 * Production binds a real timer; the offline battery injects a recorder that
 * advances a virtual clock. The closed reasons are the only call sites: the
 * admission fence wait, the tracker retry ladder, and the terminate grace.
 */
export const DISPATCH_DELAY_REASONS = ["claim-fence", "tracker-ladder", "terminate-grace"] as const;

export type DispatchDelayReason = (typeof DISPATCH_DELAY_REASONS)[number];

export type DispatchDelay = (ms: number, reason: DispatchDelayReason) => Promise<void>;

/**
 * The delivered lane facts a resume admits against (GH-347 API-3, DM-1).
 *
 * Relocated here from the CLI edge because the resolver lives in core and core
 * cannot import CLI; the CLI re-exports this one definition (no second shape).
 * `restartCount` is the persisted restart total, never a charge.
 */
export type DispatchLaneFacts = {
  readonly handle: HarnessSessionHandle;
  readonly completedPhases: readonly string[];
  readonly adapterSupportsResumeInjection: boolean;
  readonly restartCount: number;
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
};
