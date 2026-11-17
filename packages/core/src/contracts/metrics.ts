/**
 * The `delivery.metrics.v1` read-side vocabulary (GH-299 F-1..F-11, DM-1..DM-8).
 *
 * Runtime-neutral by construction: types and `as const` data only. The metrics
 * family folds committed sources — the measurement baseline log, telemetry
 * records, the transition history, ceremony records, committed corpus
 * documents, and the project-committed burn-rate declaration — into one
 * read-only report. Every closed vocabulary, bound, disclosure statement, and
 * ordering rule lives here so the pure domain, the command surface, and the
 * checks assert through one declaration.
 */
import type { SpendLedgerRead } from "./spend.js";
import type { StateFailure, StateSafeLocation } from "./state.js";
import type { TelemetryState } from "./telemetry.js";

/** The only home of the metrics report data schema identifier (DEC-6). */
export const METRICS_DATA_SCHEMA_ID = "delivery.metrics.v1" as const;

/** The exactly-nine `data` keys, in their declared order (DM-1 exactness). */
export const METRICS_DATA_KEYS = [
  "ref",
  "window",
  "metrics",
  "dispatch",
  "alarms",
  "alarmEvaluation",
  "comparisons",
  "omitted",
  "truncated",
] as const;

/** The closed metric-ID vocabulary in its declared report order (DM-2, DEC-6). */
export const METRIC_IDS = [
  "MET-CEREMONY-SHARE",
  "MET-CYCLE-TIME",
  "MET-CI-FAILURE-RATE",
  "escaped-defects",
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

/** The baseline-consumed members: every ID with a committed log row (F-2). */
export const BASELINE_CONSUMED_METRIC_IDS = [
  "MET-CEREMONY-SHARE",
  "MET-CYCLE-TIME",
  "MET-CI-FAILURE-RATE",
] as const;
export type BaselineConsumedMetricId = (typeof BASELINE_CONSUMED_METRIC_IDS)[number];

/** The one non-`MET-` member: the curated floor count (DEC-2). */
export const ESCAPED_DEFECTS_METRIC_ID = "escaped-defects" as const;

/** The closed alarm-kind vocabulary (DM-4, DEC-6). */
export const ALARM_KINDS = ["burn-rate"] as const;
export type AlarmKind = (typeof ALARM_KINDS)[number];

/** The closed measurement-kind vocabulary (F-3, DEC-6). */
export const MEASUREMENT_KINDS = ["native", "proxy", "curated-count"] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

/** The delivered log status semantics reused unchanged (DM-2). */
export const METRIC_STATUSES = ["MEASURED", "PARTIAL", "UNAVAILABLE"] as const;
export type MetricStatus = (typeof METRIC_STATUSES)[number];

/** The delivered closed verdict set (DM-5, DEC-6). */
export const COMPARISON_VERDICTS = [
  "improved",
  "regressed",
  "flat",
  "not-established",
  "insufficient-sample",
] as const;
export type ComparisonVerdict = (typeof COMPARISON_VERDICTS)[number];

/** The closed alarm-evaluation state vocabulary (DM-4, DEC-6). */
export const ALARM_EVALUATION_STATUSES = [
  "evaluated",
  "threshold-undeclared",
  "telemetry-absent",
] as const;
export type AlarmEvaluationStatus = (typeof ALARM_EVALUATION_STATUSES)[number];

/** The closed escaped-defect class vocabulary (F-7, DEC-2). */
export const ESCAPED_DEFECT_CLASSES = [
  "post-gate-review",
  "landed-ci-failure",
  "retro-attributed",
] as const;
export type EscapedDefectClass = (typeof ESCAPED_DEFECT_CLASSES)[number];

/** The closed basis vocabulary naming each entry's committed source (DM-2). */
export const METRIC_BASES = [
  "phase-transition-history",
  "ceremony-runner-fold",
  "committed-pm-notes-corpus",
  "committed-evidence-corpus",
] as const;
export type MetricBasis = (typeof METRIC_BASES)[number];

/** The delivered log's closed exclusion-reason set (F-2). */
export const METRICS_EXCLUSION_REASONS = [
  "unparseable_yaml",
  "date_only_or_missing_time",
  "placeholder_zero_time",
  "capture_change",
  "outside_window",
  "missing_metric_input",
  "no_ci_observation",
] as const;
export type MetricsExclusionReason = (typeof METRICS_EXCLUSION_REASONS)[number];

/** The committed comparison sample minimum (F-4, DM-5). */
export const METRICS_SAMPLE_MINIMUM = 5 as const;

/** The drawn evidence window's declared length in days (DM-8). */
export const METRICS_DRAWN_WINDOW_DAYS = 30 as const;

/** The trailing-window instant count per day. */
export const METRICS_DAY_MS = 86_400_000 as const;

/** The machine-payload byte bound (DM-8, DEC-10). */
export const METRICS_MAX_MACHINE_BYTES = 65_536 as const;

/** The human-digest line bound (DM-8, DEC-10). */
export const METRICS_MAX_HUMAN_LINES = 200 as const;

/** The human-digest byte bound (DM-8, DEC-10). */
export const METRICS_MAX_HUMAN_BYTES = 16_384 as const;

/** The `incidents[]` display cap (DM-8). */
export const METRICS_MAX_INCIDENTS = 8 as const;

/** The `perAgent[]` row cap (DM-8). */
export const METRICS_MAX_PER_AGENT = 20 as const;

/** The `comparisons[]` row cap (DM-8). */
export const METRICS_MAX_COMPARISONS = 20 as const;

/** The declared deterministic tail-first drop order (DM-8, DEC-10). */
export const METRICS_TRUNCATION_TARGETS = ["comparisons", "incidents", "perAgent"] as const;
export type MetricsTruncationTarget = (typeof METRICS_TRUNCATION_TARGETS)[number];

/** The human omission marker label (DM-8). */
export const METRICS_TRUNCATION_MARKER = "truncated" as const;

/**
 * The proxy-vs-native non-interchangeability caveat, declared once and rendered
 * verbatim on every cross-kind comparison and its owning entry (AC-F3-4, DEC-7,
 * DEC-13). It names both bases and claims no trend across them.
 */
export const METRICS_PROXY_NATIVE_CAVEAT =
  "Proxy vs native: the before value is the committed pm-notes proxy basis and the after value is measured " +
  "from the native source; the two bases are not interchangeable and no trend is claimed across them.";

/**
 * The escaped-defects floor caveat, stated verbatim in the entry (F-7, DEC-2).
 * A curated floor is never a census.
 */
export const METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT =
  "Curated floor, not a census: unrecorded incidents are invisible and only artifact-anchored incidents " +
  "in committed evidence count; tmp/**, .ai/local/**, uncommitted, and external sources are never counted.";

/** The burn-rate declaration node's schema identity (DM-6, DEC-4). */
export const METRICS_BURN_RATE_SCHEMA = "delivery.metrics.burn-rate.v1" as const;

/** The project-committed configuration key of the threshold declaration (DM-6). */
export const METRICS_BURN_RATE_CONFIG_KEY = "metrics.burn-rate" as const;

/** The closed measured-basis vocabulary (DM-6). */
export const METRICS_BURN_RATE_BASES = ["cost", "tokens"] as const;
export type MetricsBurnRateBasis = (typeof METRICS_BURN_RATE_BASES)[number];

/** The declared threshold-window day bounds, inclusive (DM-6). */
export const METRICS_BURN_RATE_MIN_WINDOW_DAYS = 1 as const;
export const METRICS_BURN_RATE_MAX_WINDOW_DAYS = 90 as const;

/** The closed `metrics.burn-rate` node member set (DM-6). */
export const METRICS_BURN_RATE_NODE_KEYS = ["threshold", "basis", "window"] as const;

/** The one declared metrics failure identity (DM-7, DEC-8). */
export const METRICS_BASELINE_UNREADABLE_CODE = "metrics.baseline-unreadable" as const;

/** The committed measurement baseline log path (F-2). */
export const METRICS_BASELINE_LOG_PATH =
  "doc/planning/oss-tooling/measurement-baseline.yaml" as const;

/** The delivered telemetry-absence condition named verbatim (DM-3, DEC-11). */
export const METRICS_TELEMETRY_ABSENT_REASON = "spend.telemetry-absent" as const;

/** The declaration/invocation grammar flag set, in the locked order (F-1). */
export const METRICS_FLAGS = ["--ref", "--from", "--through"] as const;
export const METRICS_REF_FLAG = "--ref" as const;
export const METRICS_WINDOW_FROM_FLAG = "--from" as const;
export const METRICS_WINDOW_THROUGH_FLAG = "--through" as const;

/** The canonical work-item ref grammar, case-sensitive with no folding (F-1). */
export const METRICS_WORK_ITEM_REF_PATTERN = "^[A-Z][A-Z0-9]*-[0-9]+$" as const;

/** An inclusive evidence window: canonical ISO-8601 instants (DM-8). */
export type MetricsWindow = {
  readonly from: string;
  readonly through: string;
};

/** The committed log window a comparison `before` value is scoped by (DM-5). */
export type MetricsCommittedWindow = {
  readonly start: string;
  readonly end: string;
};

/** The committed definition reference: log path plus the row's `source_commit` (DM-2). */
export type MetricsDefinitionRef = {
  readonly logPath: string;
  readonly sourceCommit: string;
};

/** One counted exclusion over the log's closed reason set (F-2). */
export type MetricsExclusion = {
  readonly reason: MetricsExclusionReason;
  readonly count: number;
};

/** The sample block: `n` plus the evidence counters the corpus defines (DM-2). */
export type MetricsSample = {
  readonly n: number;
  readonly runs?: number;
  readonly steps?: number;
  readonly phases?: number;
  readonly observed?: number;
  readonly unobserved?: number;
  readonly censored?: number;
  readonly postGateReview?: number;
  readonly landedCiFailure?: number;
  readonly retroAttributed?: number;
  readonly excludedNonEvidence?: number;
};

/** One cited escaped-defect incident (F-7, DM-2). */
export type MetricsIncident = {
  readonly artifact: string;
  readonly anchor: string;
  readonly class: EscapedDefectClass;
  readonly observedAt: string;
};

/** One metric entry keyed by the closed vocabulary (DM-2). */
export type MetricsMetricEntry = {
  readonly id: MetricId;
  /** Absent whenever the entry's status is `UNAVAILABLE`; never fabricated. */
  readonly value?: number;
  readonly status: MetricStatus;
  readonly measurementKind: MeasurementKind;
  readonly basis: MetricBasis;
  readonly unit: string;
  readonly direction: string;
  readonly sample: MetricsSample;
  readonly definitionRef?: MetricsDefinitionRef;
  readonly excluded?: readonly MetricsExclusion[];
  readonly limitation: string;
  readonly caveat?: string;
  readonly incidents?: readonly MetricsIncident[];
};

/** One breakdown row over one dimension value (DM-3). */
export type MetricsBreakdownEntry = {
  readonly value: string | null;
  readonly calls: number;
  readonly tokens: number;
  readonly cost: number | null;
};

/** One agent/model roll-up row; the delivered fold's figures (DM-3). */
export type MetricsAgentEntry = {
  readonly role: string;
  readonly model: string;
  readonly calls: number;
  readonly tokens: number;
};

/** The role/model breakdown pair; both arrays keep the null row (DM-3). */
export type MetricsBreakdowns = {
  readonly role: readonly MetricsBreakdownEntry[];
  readonly model: readonly MetricsBreakdownEntry[];
};

/** One model's cost in harness-reported units; a missing cost stays null (DM-3). */
export type MetricsModelCost = {
  readonly model: string | null;
  readonly cost: number | null;
};

/** The delivered fold's cost totals, in harness-reported units (DM-3). */
export type MetricsCostTotals = {
  readonly total: number | null;
  readonly models: readonly MetricsModelCost[];
  readonly sparse: boolean;
};

/** The per-dispatch spend block composed from the delivered spend fold (DM-3). */
export type MetricsDispatch = {
  readonly telemetryState: TelemetryState;
  readonly tokensByClass?: Readonly<Record<string, number>>;
  readonly costTotals?: MetricsCostTotals;
  readonly restarts?: number;
  readonly perAgent?: readonly MetricsAgentEntry[];
  readonly breakdowns?: MetricsBreakdowns;
  /** The delivered reconciliation disclosure cited by reference (DM-3). */
  readonly reconciliation?: { readonly basis: string; readonly verdict: string };
  /** The disclosed gap between the roll-ups and the totals (DEC-14). */
  readonly unattributable?: { readonly steps: number; readonly tokens: number };
  readonly absenceReason?: string;
};

/** One derived burn-rate alarm: the crossing, never persisted (DM-4, DEC-5). */
export type MetricsAlarm = {
  readonly kind: AlarmKind;
  readonly ref: string;
  readonly basis: MetricsBurnRateBasis;
  readonly threshold: number;
  readonly measured: number;
  readonly window: MetricsCommittedWindow;
  /** The evaluation's read instant; identical to the trailing window's `end`. */
  readonly crossedAt: string;
  readonly sparse?: boolean;
};

/** The alarm evaluation state and, over `evaluated`, its echoed declaration (DM-4). */
export type MetricsAlarmEvaluation =
  | { readonly kind: AlarmKind; readonly status: "threshold-undeclared" | "telemetry-absent" }
  | {
      readonly kind: AlarmKind;
      readonly status: "evaluated";
      readonly threshold: number;
      readonly basis: MetricsBurnRateBasis;
      readonly window: MetricsCommittedWindow;
    };

/** The committed `before` side of a comparison row (DM-5). */
export type MetricsComparisonBefore = {
  readonly value: number | null;
  readonly window: MetricsCommittedWindow;
  readonly basis: string;
  readonly measurementKind: MeasurementKind;
  readonly status: string;
};

/** The freshly measured `after` side of a comparison row (DM-5). */
export type MetricsComparisonAfter = {
  /** Absent when the live evidence yielded no measurable value. */
  readonly value?: number;
  readonly window: MetricsWindow;
  readonly measurementKind: MeasurementKind;
  readonly status: MetricStatus;
  readonly sampleSize: number;
};

/** One live comparison-view row under the committed protocol (DM-5, F-4). */
export type MetricsComparisonRow = {
  readonly metricId: BaselineConsumedMetricId;
  readonly definitionRef: MetricsDefinitionRef;
  readonly before: MetricsComparisonBefore;
  readonly after: MetricsComparisonAfter;
  readonly sampleMinimum: typeof METRICS_SAMPLE_MINIMUM;
  readonly verdict: ComparisonVerdict;
  readonly caveat?: string;
};

/** The `delivery.metrics.v1` report data carried inside the result envelope (DM-1). */
export type MetricsReport = {
  readonly ref: string;
  readonly window: MetricsWindow;
  readonly metrics: readonly MetricsMetricEntry[];
  readonly dispatch: MetricsDispatch;
  readonly alarms: readonly MetricsAlarm[];
  readonly alarmEvaluation: MetricsAlarmEvaluation;
  readonly comparisons: readonly MetricsComparisonRow[];
  readonly omitted: number;
  readonly truncated: boolean;
};

/** The resolved threshold declaration (DM-6). */
export type MetricsBurnRateDeclaration = {
  readonly threshold: number;
  readonly basis: MetricsBurnRateBasis;
  readonly windowDays: number;
};

/** The pure declaration resolution outcome (DM-6, DEC-4). */
export type MetricsBurnRateNodeRead =
  | { readonly ok: true; readonly declared: false }
  | { readonly ok: true; readonly declared: true; readonly value: MetricsBurnRateDeclaration }
  | {
      readonly ok: false;
      readonly code: "config.value.invalid";
      readonly detail?: string;
    };

/** The one bounded committed-document read of the declaration node (DM-6). */
export type MetricsConfigNodeRead =
  | { readonly ok: true; readonly state: "absent" }
  | { readonly ok: true; readonly state: "present"; readonly node: unknown }
  | {
      readonly ok: false;
      readonly state: "selected-unusable" | "unreadable" | "unparseable";
    };

/** One committed baseline row as the report consumes it (F-2, DM-2). */
export type MetricsBaselineRow = {
  readonly id: string;
  readonly status: string;
  readonly measurementKind: string;
  readonly unit: string;
  readonly direction: string;
  readonly value: number | null;
  readonly limitation: string;
  readonly excluded: readonly MetricsExclusion[];
  readonly counters: Readonly<Record<string, number>>;
};

/** The parsed committed baseline document (F-2). */
export type MetricsBaselineDocument = {
  readonly sourceCommit: string;
  readonly window: MetricsCommittedWindow;
  readonly rows: readonly MetricsBaselineRow[];
  readonly comparisonRecords: number;
};

/** The one bounded committed-log read, classified (DM-7). */
export type MetricsBaselineLogRead =
  | { readonly ok: true; readonly state: "absent" }
  | { readonly ok: true; readonly state: "present"; readonly document: MetricsBaselineDocument }
  | {
      readonly ok: false;
      readonly state: "unreadable" | "unparseable" | "invalid";
      readonly detail?: string;
    };

/** One committed pm-notes CI observation row (F-3). */
export type MetricsCiObservationRow = {
  readonly kind: "ci-observation";
  readonly path: string;
  readonly ref: string;
  readonly observed: boolean;
  readonly outcome: "green" | "red" | "mixed" | null;
  readonly observedAt: string | null;
};

/** One committed evidence row a curated count may cite (F-7). */
export type MetricsEvidenceRow = {
  readonly kind: "evidence";
  readonly path: string;
  readonly anchor: string | null;
  readonly class: EscapedDefectClass | null;
  readonly observedAt: string | null;
  readonly ref: string | null;
  /** The citation check: a readable committed artifact containing the anchor. */
  readonly citation?: "resolved" | "unresolved";
};

/** One row of the bounded committed corpus scan (NFR-7). */
export type MetricsCorpusRow = MetricsCiObservationRow | MetricsEvidenceRow;

/** The one bounded corpus scan's result (NFR-7). */
export type MetricsCorpusRead = {
  readonly rows: readonly MetricsCorpusRow[];
};

/** The verified ceremony measurement input: one run and its step set (F-3). */
export type MetricsCeremonyRun = {
  readonly runId: string;
  readonly ceremony: string;
  readonly steps: readonly {
    readonly phaseIndex: number;
    readonly startedAtMs: number;
    readonly endedAtMs: number;
    readonly durationMs: number;
  }[];
};

/** The verified read one metrics invocation composes before the pure fold. */
export type MetricsLedgerRead = {
  readonly workItemRef: string;
  readonly telemetryState: TelemetryState;
  readonly ceremony: readonly MetricsCeremonyRun[];
  readonly spend: SpendLedgerRead;
};

/** The verified state read one report consumes (F-2..F-5). */
export type MetricsStateRead = {
  readonly workItemRef: string;
  readonly telemetryState: TelemetryState;
  readonly records: readonly {
    readonly runId: string;
    /** The delivered session identity for the per-session plane selection (F-6). */
    readonly sessionId: string;
    readonly capturedAt: string;
    readonly tokens: Readonly<Record<string, number | null>>;
    readonly cost: number | null;
    readonly calls: number | null;
  }[];
  readonly steps: readonly {
    readonly runId: string;
    /** The delivered session identity for the per-session plane selection (F-6). */
    readonly sessionId: string;
    readonly model: string | null;
    readonly agentRole: string | null;
    readonly tokens: Readonly<Record<string, number | null>>;
    readonly calls: number | null;
    readonly cost: number | null;
    readonly capturedAt: string;
  }[];
  readonly transitions: readonly {
    readonly phaseId: string;
    readonly operation: "start" | "complete" | "reopen";
    readonly timestamp: string;
  }[];
  readonly ceremony: readonly MetricsCeremonyRun[];
  /** The delivered telemetry-absence condition, when telemetry is absent. */
  readonly absenceReason?: string;
  /** The delivered spend fold's figures for the same selection (DM-3). */
  readonly dispatch?: {
    readonly tokensByClass: Readonly<Record<string, number>>;
    readonly costTotals: MetricsCostTotals;
    readonly restarts: number;
    readonly perAgent: readonly MetricsAgentEntry[];
    readonly breakdowns: MetricsBreakdowns;
    readonly reconciliation: { readonly basis: string; readonly verdict: string };
  };
};

/** The injected read seams the metrics composition consumes (NFR-7). */
export type MetricsReadSeams = {
  readonly readState: (ref: string) => MetricsStateOutcome;
  readonly readBaselineLog: () => MetricsBaselineLogRead;
  readonly readConfigNode: () => MetricsConfigNodeRead;
  readonly readCorpus: () => MetricsCorpusRead;
};

/** The state read outcome: verified evidence, or a delivered `state.*` identity. */
export type MetricsStateOutcome =
  | { readonly ok: true; readonly value: MetricsStateRead }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: "state";
        readonly code: StateFailure["code"];
        readonly consequence: "not_landed";
        readonly location: StateSafeLocation;
      };
    };

/** One classified metrics failure: the log's damage, a node defect, or store damage. */
export type MetricsCommandFailure =
  | {
      readonly kind: "input";
      readonly code: "input.value.rejected";
      readonly summary?: string;
    }
  | {
      readonly kind: "metrics";
      readonly code: typeof METRICS_BASELINE_UNREADABLE_CODE;
      readonly summary?: string;
    }
  | {
      readonly kind: "config";
      readonly code: "config.value.invalid";
      readonly summary?: string;
      readonly cause?: string;
    }
  | {
      readonly kind: "state";
      readonly code: StateFailure["code"];
      readonly consequence: "not_landed";
      readonly location: StateSafeLocation;
    };

/** The outcome the injected metrics runtime returns to the command handler. */
export type MetricsCommandOutcome =
  | { readonly ok: true; readonly data: MetricsReport }
  | { readonly ok: false; readonly error: MetricsCommandFailure };

/** The report request the command hands the runtime after grammar validation. */
export type MetricsReportRequest = {
  readonly ref: string;
  readonly from?: string;
  readonly through?: string;
};

/**
 * The injected metrics runtime (composition edge only).
 *
 * `resolveActiveRef` answers the omitted-`--ref` default from the local delivery
 * context without touching the state store; `report` validates the declaration
 * node, performs the verified reads, and runs the pure fold.
 */
export type MetricsCommandRuntime = {
  readonly resolveActiveRef: () => { readonly ref: string } | { readonly ref: null };
  readonly report: (request: MetricsReportRequest) => MetricsCommandOutcome;
};
