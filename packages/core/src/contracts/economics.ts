/**
 * `delivery.economics.v1` — the session lifecycle economics contract (GH-235
 * D-1..D-8, DEC-1..DEC-9).
 *
 * Runtime-neutral by construction: types and `as const` data only. Sourcing,
 * classification, folding, formatting, and durable record I/O live in the
 * domain, state, adapter, and surface tiers. The delivered harness liveness-kind
 * vocabulary is untouched (DEC-8): heartbeat age and token delta are sourced
 * signal kinds under the additive closed vocabulary declared here, carried
 * beside the exact-three `HARNESS_LIVENESS_KINDS`.
 */
import type { StateSafeLocation } from "./state.js";

/** The additive closed sourced-signal-kind vocabulary (D-3, DEC-8). */
export const ECONOMICS_SOURCED_SIGNAL_KINDS = ["heartbeat-age", "token-delta"] as const;

export type EconomicsSourcedSignalKind = (typeof ECONOMICS_SOURCED_SIGNAL_KINDS)[number];

/** The closed absence-reason vocabulary for a sourced signal with no source. */
export const ECONOMICS_SOURCED_SIGNAL_ABSENCE_REASONS = [
  "harness-unsupported",
  "not-observed",
] as const;

export type EconomicsSourcedSignalAbsenceReason =
  (typeof ECONOMICS_SOURCED_SIGNAL_ABSENCE_REASONS)[number];

/** One sourced signal observation: the injected value and observation time. */
export type EconomicsSourcedSignalSourcedReading = {
  readonly kind: EconomicsSourcedSignalKind;
  readonly status: "sourced";
  readonly value: number;
  readonly observedAt: string;
};

/** One explicit absence: a closed reason, never a zero or an invented time. */
export type EconomicsSourcedSignalAbsentReading = {
  readonly kind: EconomicsSourcedSignalKind;
  readonly status: "absent";
  readonly reason: EconomicsSourcedSignalAbsenceReason;
};

export type EconomicsSourcedSignalReading =
  | EconomicsSourcedSignalSourcedReading
  | EconomicsSourcedSignalAbsentReading;

/** The closed restart-reason vocabulary (D-5). */
export const ECONOMICS_RESTART_REASONS = ["watchdog.liveness-stalled", "session-interrupted"] as const;

export type EconomicsRestartReason = (typeof ECONOMICS_RESTART_REASONS)[number];

/** The restart-event record kind and payload schema (D-4). */
export const ECONOMICS_RESTART_RECORD_KIND = "economics.restart" as const;

export const ECONOMICS_RESTART_SCHEMA_ID = "delivery.economics.restart.v1" as const;

/** The terminal budget-exhaustion record kind and payload schema (D-4). */
export const ECONOMICS_EXHAUSTION_RECORD_KIND = "economics.budget-exhaustion" as const;

export const ECONOMICS_EXHAUSTION_SCHEMA_ID = "delivery.economics.exhaustion.v1" as const;

/** The per-delivery store-scoped key prefix (D-4, OQ-T6). */
export const ECONOMICS_RECORD_KEY_PREFIX = "economics/" as const;

/** The declared economics view field names (D-6; `restarts`/`resumeAmplification` pinned). */
export const ECONOMICS_VIEW_FIELDS = [
  "restarts",
  "resumeAmplification",
  "restartHistory",
  "amplificationFlag",
  "warnings",
] as const;

export type EconomicsViewField = (typeof ECONOMICS_VIEW_FIELDS)[number];

/** The declared restart-history entry fields, ordered by ordinal (D-6). */
export const ECONOMICS_RESTART_HISTORY_FIELDS = [
  "ordinal",
  "reason",
  "repayTokens",
  "sessionId",
  "recordedAt",
] as const;

export type EconomicsRestartHistoryField = (typeof ECONOMICS_RESTART_HISTORY_FIELDS)[number];

/** The healthy resume-amplification baseline (D-6). */
export const RESUME_AMPLIFICATION_BASELINE = 1 as const;

/** The declared restart-loop amplification flag (D-6). */
export const RESUME_AMPLIFICATION_LOOP_FLAG = "restart-loop" as const;

/** The closed amplification-flag vocabulary (one declaration drives the union). */
export const ECONOMICS_AMPLIFICATION_FLAGS = [RESUME_AMPLIFICATION_LOOP_FLAG] as const;

export type EconomicsAmplificationFlag = (typeof ECONOMICS_AMPLIFICATION_FLAGS)[number];

/** The closed degradation-warning vocabulary (D-6, §10). */
export const ECONOMICS_WARNING_KINDS = ["missing-unique-progress", "missing-repay-tokens"] as const;

export type EconomicsWarningKind = (typeof ECONOMICS_WARNING_KINDS)[number];

/** One degradation warning naming the missing field and the record ordinal. */
export type EconomicsWarning = {
  readonly kind: EconomicsWarningKind;
  readonly field: string;
  readonly ordinal: number;
};

/** The bounded refusal-evidence corpus byte ceiling (D-7). */
export const ECONOMICS_EVIDENCE_MAX_BYTES = 512 as const;

/** The declared key order per refusal class (D-7). */
export const ECONOMICS_EVIDENCE_STALL_KEYS = [
  "reason",
  "heartbeatAgeMs",
  "tokenDelta",
  "traffic",
  "stallBoundMs",
] as const;

export const ECONOMICS_EVIDENCE_BUDGET_KEYS = ["reason", "restarts", "historyRef"] as const;

export const ECONOMICS_EVIDENCE_UNECONOMICAL_KEYS = [
  "reason",
  "repayTokens",
  "economicsRef",
] as const;

/** The separator between corpus entries; values never contain free-form prose. */
export const ECONOMICS_EVIDENCE_SEPARATOR = "; " as const;

/** The reference spelling that resolves to one delivery's durable records (D-7). */
export const ECONOMICS_REFERENCE_PREFIX = "economics/" as const;

/** The seed SC-M1-15 option pair, carried as data for M1-S16 (D-8). */
export const ECONOMICS_EXHAUSTION_OPTIONS = ["requeue-fresh-budget", "park-owner-review"] as const;

export type EconomicsExhaustionOption = (typeof ECONOMICS_EXHAUSTION_OPTIONS)[number];

/** The two configuration key paths this change owns (DM-6). */
export const ECONOMICS_CONFIG_KEYS = {
  livenessInterval: "lane.liveness-interval",
  restartBudget: "lane.restart-budget",
} as const;

export type EconomicsConfigKey = (typeof ECONOMICS_CONFIG_KEYS)[keyof typeof ECONOMICS_CONFIG_KEYS];

/** The declared outcome vocabulary of the §8.1 matrix (TC-ECON-005). */
export const ECONOMICS_OUTCOMES = [
  "progressing",
  "stalled",
  "sources-absent",
  "restart-within-budget",
  "restart-past-budget",
  "resume-uneconomical",
] as const;

export type EconomicsOutcome = (typeof ECONOMICS_OUTCOMES)[number];

/** The declared matrix projection classes: success, refusal, or a recorded event. */
export const ECONOMICS_OUTCOME_PROJECTIONS = ["success", "refusal", "record"] as const;

export type EconomicsOutcomeProjection = (typeof ECONOMICS_OUTCOME_PROJECTIONS)[number];

/**
 * One declared outcome/identity/exit row (spec §8.1).
 *
 * `identity` is the single classified failure identity, `exitCode` the single
 * exit digit (both `null` where the outcome owns neither), and `projection`
 * names the projection class. Data only; consumers project identically.
 */
export type EconomicsOutcomeMatrixRow = {
  readonly outcome: EconomicsOutcome;
  readonly identity: string | null;
  readonly exitCode: number | null;
  readonly projection: EconomicsOutcomeProjection;
};

export const ECONOMICS_OUTCOME_MATRIX = [
  { outcome: "progressing", identity: null, exitCode: 0, projection: "success" },
  { outcome: "stalled", identity: "watchdog.liveness-stalled", exitCode: 1, projection: "refusal" },
  {
    outcome: "sources-absent",
    identity: "watchdog.signals-absent",
    exitCode: 2,
    projection: "refusal",
  },
  {
    outcome: "restart-within-budget",
    identity: null,
    exitCode: null,
    projection: "record",
  },
  {
    outcome: "restart-past-budget",
    identity: "dispatch.restart-budget-exceeded",
    exitCode: 1,
    projection: "refusal",
  },
  {
    outcome: "resume-uneconomical",
    identity: "dispatch.resume-uneconomical",
    exitCode: 1,
    projection: "refusal",
  },
] as const satisfies readonly EconomicsOutcomeMatrixRow[];

/** One token-class spend figure; counts only, never prompt content. */
export type EconomicsTokenSpend = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

/**
 * One restart-event record payload (DM-2, D-4).
 *
 * `repayTokens` and `observedUniqueProgressTokens` are exact-optional: an
 * unobserved figure is absent (never a fabricated zero). `null` records the
 * observed-but-unavailable unique-progress datum explicitly.
 */
export type EconomicsRestartRecord = {
  readonly schemaId: typeof ECONOMICS_RESTART_SCHEMA_ID;
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly ordinal: number;
  readonly reason: EconomicsRestartReason;
  readonly repayTokens?: EconomicsTokenSpend;
  readonly observedUniqueProgressTokens?: number | null;
  readonly recordedAt: string;
};

/**
 * The terminal budget-exhaustion record payload carrying the consumer-field
 * contract (DM-3, D-8, OQ-T8): work item, run, reason, restart count, the
 * resolvable history reference, the terminal marker, the declared options, and
 * the timestamp.
 */
export type EconomicsExhaustionRecord = {
  readonly schemaId: typeof ECONOMICS_EXHAUSTION_SCHEMA_ID;
  readonly workItemRef: string;
  readonly runId: string;
  readonly reason: "dispatch.restart-budget-exceeded";
  readonly restarts: number;
  readonly historyRef: string;
  readonly terminal: true;
  readonly options: readonly EconomicsExhaustionOption[];
  readonly recordedAt: string;
};

/** The existing state identities an unevaluable economics record set reuses (D-9). */
export const ECONOMICS_RECORD_FAILURE_CODES = [
  "state.store.torn",
  "state.store.unknown",
  "state.schema.mismatch",
  "state.permission.denied",
  "state.keys.missing",
] as const;

export type EconomicsRecordFailureCode = (typeof ECONOMICS_RECORD_FAILURE_CODES)[number];

/** A verified per-delivery record read, or a classified failure (DM-2, DM-3). */
export type EconomicsRecordsRead =
  | {
      readonly ok: true;
      readonly workItemRef: string;
      readonly restarts: readonly EconomicsRestartRecord[];
      readonly terminal?: EconomicsExhaustionRecord;
      readonly verifiedEmpty: boolean;
    }
  | {
      readonly ok: false;
      readonly code: EconomicsRecordFailureCode;
      readonly location?: StateSafeLocation;
    };

/** A restart-event append outcome: appended, replayed (no duplicate), or failed. */
export type EconomicsRestartAppendOutcome =
  | {
      readonly ok: true;
      readonly appended: boolean;
      readonly record: EconomicsRestartRecord;
      readonly sequence?: number;
    }
  | {
      readonly ok: false;
      readonly code: EconomicsRecordFailureCode | "state.write.failed";
      readonly location?: StateSafeLocation;
    };

/** A terminal-record append outcome: appended once, or the existing terminal truth. */
export type EconomicsExhaustionAppendOutcome =
  | {
      readonly ok: true;
      readonly appended: boolean;
      readonly record: EconomicsExhaustionRecord;
      readonly sequence?: number;
    }
  | {
      readonly ok: false;
      readonly code: EconomicsRecordFailureCode | "state.write.failed";
      readonly location?: StateSafeLocation;
    };

/**
 * The injected resume/economics store port (D-1, D-13).
 *
 * Data-only shape; implementations live in the state tier. It exposes no spawn,
 * kill, steer, restart-execution, or supervision capability (NG-6).
 */
export type EconomicsResumeStorePort = {
  readonly readDeliveryRecords: (workItemRef: string) => EconomicsRecordsRead;
  readonly appendRestartEvent: (record: EconomicsRestartRecord) => EconomicsRestartAppendOutcome;
  readonly ensureExhaustionRecord: (
    record: EconomicsExhaustionRecord,
  ) => EconomicsExhaustionAppendOutcome;
};

/** The injected budget-policy port: the resolved bound, read at evaluation time (D-11). */
export type EconomicsBudgetPolicyPort = {
  readonly readRestartBudget: (workItemRef: string) => number;
};

/** The restart budget gate decision (D-11, DEC-3, DEC-5). */
export type RestartBudgetDecision =
  | {
      readonly outcome: "admit";
      readonly count: number;
      readonly nextOrdinal: number;
      readonly bound: number;
      readonly historyRef: string;
    }
  | {
      readonly outcome: "refuse-budget";
      readonly code: "dispatch.restart-budget-exceeded";
      readonly exitCode: 1;
      readonly count: number;
      readonly historyRef: string;
      readonly corpus: string;
    }
  | {
      readonly outcome: "unevaluable";
      readonly code: EconomicsRecordFailureCode;
      readonly exitCode: 1 | 2;
      readonly corpus: string;
    };

/** The closed resume mode vocabulary (DEC-7). */
export const ECONOMICS_RESUME_MODES = ["attach-continue", "prompt-reentry"] as const;

export type EconomicsResumeMode = (typeof ECONOMICS_RESUME_MODES)[number];

/**
 * The adapter-declared resume capability (fail-closed).
 *
 * An absent declaration is unsupported. `attachGap` records a declared
 * capability that is a gap at use time; the resume path then refuses naming it.
 */
export type EconomicsResumeCapabilityDeclaration = {
  readonly modes: readonly EconomicsResumeMode[];
  readonly attachGap?: string;
};

/** One session's economics evidence facts (injected, counts only). */
export type EconomicsSessionEvidence = {
  readonly sessionId: string;
  readonly treeRoot: string;
  readonly repayTokens?: EconomicsTokenSpend;
  readonly observedUniqueProgressTokens?: number | null;
  readonly tokensReadable?: boolean;
  readonly costReadable?: boolean;
};

/** The refusal identities the resume path may emit (existing rows reused). */
export const ECONOMICS_RESUME_REFUSAL_CODES = [
  "dispatch.restart-budget-exceeded",
  "dispatch.resume-uneconomical",
  "harness.capability.gap",
  "harness.telemetry.extraction-failed",
] as const;

export type EconomicsResumeRefusalCode = (typeof ECONOMICS_RESUME_REFUSAL_CODES)[number];

/** The one resume decision (DEC-7 precedence; exactly one identity per attempt). */
export type EconomicsResumeDecision =
  | {
      readonly outcome: "attach-continue";
      readonly mode: "attach-continue";
      readonly sessionId: string;
      readonly treeRoot: string;
      readonly ordinalConsumed: false;
      readonly evidence: string;
    }
  | {
      readonly outcome: "admit-restart";
      readonly record: EconomicsRestartRecord;
      readonly evidence: string;
    }
  | {
      readonly outcome: "refuse";
      readonly code: EconomicsResumeRefusalCode;
      readonly exitCode: 1;
      readonly reason: string;
      readonly corpus: string;
    }
  | {
      readonly outcome: "unevaluable";
      readonly code: EconomicsRecordFailureCode | "state.write.failed";
      readonly exitCode: 1 | 2;
      readonly reason: string;
      readonly corpus: string;
    };

/** The two composition shapes: supervised-style and one-shot-style (AC-F4-3). */
export const ECONOMICS_RESUME_COMPOSITION_MODES = ["supervised", "one-shot"] as const;

export type EconomicsResumeCompositionMode =
  (typeof ECONOMICS_RESUME_COMPOSITION_MODES)[number];

/** One production composition: its mode plus the attempt entry point. */
export type EconomicsResumeComposition = {
  readonly mode: EconomicsResumeCompositionMode;
  readonly attempt: (input: EconomicsResumeInput) => EconomicsResumeDecision;
};

/** One resume attempt's injected input (no execution, no ambient fact). */
export type EconomicsResumeInput = {
  readonly workItemRef: string;
  readonly runId: string;
  readonly reason: EconomicsRestartReason;
  readonly evidence: EconomicsSessionEvidence;
};

/** The rebuildable per-delivery economics view (DM-4, D-6). */
export type EconomicsRestartHistoryEntry = {
  readonly ordinal: number;
  readonly reason: EconomicsRestartReason;
  readonly repayTokens?: EconomicsTokenSpend;
  readonly sessionId: string;
  readonly recordedAt: string;
};

export type EconomicsView = {
  readonly restarts: number;
  readonly resumeAmplification: number | null;
  readonly restartHistory: readonly EconomicsRestartHistoryEntry[];
  readonly amplificationFlag: EconomicsAmplificationFlag | null;
  readonly warnings: readonly EconomicsWarning[];
  readonly terminal?: EconomicsExhaustionRecord;
};
