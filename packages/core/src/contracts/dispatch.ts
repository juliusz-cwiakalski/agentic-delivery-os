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
import type { HarnessKind, HarnessOutcome } from "./harness.js";
import type { DeliveryResultToken } from "./delivery-result.js";
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

/** The four handover conditions, in evaluation order (DM-7). */
export const DISPATCH_HANDOVER_CONDITIONS = [
  "truth",
  "coverage",
  "floor",
  "corroboration",
] as const;

export type DispatchHandoverCondition = (typeof DISPATCH_HANDOVER_CONDITIONS)[number];

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
  readonly error?: CommandResultError;
  /** Bounded, single-line, redacted summary; also feeds text `last_message=`. */
  readonly lastMessage: string;
  /** Present only when a bounded field was truncated. */
  readonly truncation?: {
    readonly field: string;
    readonly omittedChars: number;
  };
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
  readonly divergences: {
    readonly reported: number;
    readonly resolved: number;
    readonly unresolved: number;
    readonly unresolvedIds: readonly string[];
  };
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

/** Bounded read and output constants (NFR-4). */
export const DISPATCH_MAX_ATTEMPT_RECORDS = 5000 as const;
export const DISPATCH_MAX_MACHINE_BYTES = 65536 as const;
export const DISPATCH_MAX_HUMAN_LINES = 40 as const;
export const DISPATCH_MAX_HUMAN_BYTES = 8192 as const;
export const DISPATCH_MAX_LAST_MESSAGE_CHARS = 512 as const;
export const DISPATCH_MAX_EVIDENCE_REFS = 16 as const;
export const DISPATCH_MAX_NOTE_CHARS = 240 as const;
export const DISPATCH_MAX_DIVERGENCE_IDS = 20 as const;

/** The exposure floor constants (DM-7, DEC-12). */
export const DISPATCH_FLOOR_DISPATCHES = 20 as const;
export const DISPATCH_FLOOR_CONSECUTIVE_DATES = 7 as const;

/** The default liveness cadence name; the value comes from configuration. */
export const DISPATCH_LIVENESS_INTERVAL_KEY = "lane.liveness-interval" as const;
export const DISPATCH_RESTART_BUDGET_KEY = "lane.restart-budget" as const;
