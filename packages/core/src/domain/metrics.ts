/**
 * The pure metrics report domain (GH-299 F-2..F-8; DM-1..DM-8; DEC-3, DEC-5,
 * DEC-7, DEC-10, DEC-11, DEC-13, DEC-14; NFR-2, NFR-6).
 *
 * One fold over injected inputs: the verified state read, the committed baseline
 * log, the resolved burn-rate declaration, and the bounded committed corpus
 * scan. No I/O, no ambient clock, no randomness, no ids. Absence is classified
 * per section and never rendered as zero; the alarm set is a derived view with
 * at most one burn-rate entry per evaluation.
 */
import {
  ALARM_KINDS,
  BASELINE_CONSUMED_METRIC_IDS,
  type BaselineConsumedMetricId,
  COMPARISON_VERDICTS,
  ESCAPED_DEFECT_CLASSES,
  ESCAPED_DEFECTS_METRIC_ID,
  type EscapedDefectClass,
  type METRIC_BASES,
  METRIC_IDS,
  METRICS_BASELINE_LOG_PATH,
  METRICS_BURN_RATE_BASES,
  METRICS_BURN_RATE_MAX_WINDOW_DAYS,
  METRICS_BURN_RATE_MIN_WINDOW_DAYS,
  METRICS_BURN_RATE_NODE_KEYS,
  METRICS_DAY_MS,
  METRICS_DRAWN_WINDOW_DAYS,
  METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT,
  METRICS_EXCLUSION_REASONS,
  METRICS_MAX_COMPARISONS,
  METRICS_MAX_INCIDENTS,
  METRICS_MAX_MACHINE_BYTES,
  METRICS_MAX_PER_AGENT,
  METRICS_PROXY_NATIVE_CAVEAT,
  METRICS_SAMPLE_MINIMUM,
  METRICS_TELEMETRY_ABSENT_REASON,
  type MeasurementKind,
  type MetricsAlarm,
  type MetricsAlarmEvaluation,
  type MetricsBaselineDocument,
  type MetricsBaselineLogRead,
  type MetricsBaselineRow,
  type MetricsBreakdowns,
  type MetricsBurnRateDeclaration,
  type MetricsBurnRateNodeRead,
  type MetricsCeremonyRun,
  type MetricsComparisonRow,
  type MetricsCorpusRead,
  type MetricsDispatch,
  type MetricsEvidenceRow,
  type MetricsExclusion,
  type MetricsExclusionReason,
  type MetricsIncident,
  type MetricsMetricEntry,
  type MetricsReport,
  type MetricsSample,
  type MetricsStateRead,
  type MetricsWindow,
} from "#contracts";

/** The window resolution outcome: one effective window or a grammar reason. */
export type MetricsWindowOutcome =
  | { readonly ok: true; readonly window: MetricsWindow; readonly drawn: boolean }
  | { readonly ok: false; readonly reason: string };

/** The ISO-8601 instant grammar: a date-time with seconds and an explicit zone. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

const isInstant = (value: string): boolean =>
  ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));

/** The drawn trailing window: the declared day count ending at the read instant. */
export const drawMetricsWindow = (nowMs: number): MetricsWindow => ({
  from: new Date(nowMs - METRICS_DRAWN_WINDOW_DAYS * METRICS_DAY_MS).toISOString(),
  through: new Date(nowMs).toISOString(),
});

/**
 * Resolve the effective evidence window from the declared bounds and the
 * injected read instant. Inclusive bounds; jointly required or jointly omitted;
 * a reversed, malformed, date-only, or zone-less bound is refused.
 */
export const resolveMetricsWindow = (input: {
  readonly from?: string;
  readonly through?: string;
  readonly nowMs: number;
}): MetricsWindowOutcome => {
  if (input.from === undefined && input.through === undefined) {
    return { ok: true, window: drawMetricsWindow(input.nowMs), drawn: true };
  }
  if (input.from === undefined || input.through === undefined) {
    return { ok: false, reason: "--from and --through are jointly required or jointly omitted" };
  }
  if (!isInstant(input.from)) {
    return { ok: false, reason: "invalid --from instant; expected an inclusive ISO-8601 instant" };
  }
  if (!isInstant(input.through)) {
    return {
      ok: false,
      reason: "invalid --through instant; expected an inclusive ISO-8601 instant",
    };
  }
  if (Date.parse(input.from) > Date.parse(input.through)) {
    return { ok: false, reason: "--from must not be later than --through" };
  }
  return { ok: true, window: { from: input.from, through: input.through }, drawn: false };
};

const windowBounds = (
  window: MetricsWindow,
): { readonly fromMs: number; readonly throughMs: number } => ({
  fromMs: Date.parse(window.from),
  throughMs: Date.parse(window.through),
});

const inWindow = (instant: string | null, window: MetricsWindow): boolean => {
  if (instant === null) return false;
  const parsed = Date.parse(instant);
  if (!Number.isFinite(parsed)) return false;
  const bounds = windowBounds(window);
  return parsed >= bounds.fromMs && parsed <= bounds.throughMs;
};

const nonZero = (entries: readonly MetricsExclusion[]): readonly MetricsExclusion[] =>
  entries.filter((entry) => entry.count > 0);

/** The committed measurement kind mapped into the closed report vocabulary. */
export const mapMeasurementKind = (committed: string): MeasurementKind => {
  if (committed === "native") return "native";
  if (committed === "curated_count" || committed === "curated-count") return "curated-count";
  return "proxy";
};

/** The row's committed direction: lower-is-better unless declared otherwise. */
const lowerIsBetter = (direction: string): boolean => direction.toLowerCase().includes("lower");

const roundHours = (ms: number): number => Math.round(ms / 360_000) / 10;

const rowOf = (
  document: MetricsBaselineDocument,
  id: BaselineConsumedMetricId,
): MetricsBaselineRow | undefined => document.rows.find((row) => row.id === id);

/** The phase entries one transition history folds to: `[first start, latest completion]`. */
type PhaseFold = readonly [string | null, string | null];

const foldTransitions = (state: MetricsStateRead): Map<string, PhaseFold> => {
  const phases = new Map<string, PhaseFold>();
  for (const transition of state.transitions) {
    const current = phases.get(transition.phaseId);
    if (transition.operation === "complete") {
      phases.set(transition.phaseId, [
        (current === undefined ? null : current[0]) ?? transition.timestamp,
        transition.timestamp,
      ]);
      continue;
    }
    if (current !== undefined) phases.set(transition.phaseId, [current[0], null]);
  }
  return phases;
};

/** The native cycle-time measurement under the committed interval (F-3, DEC-7). */
type CycleTimeMeasure =
  | {
      readonly kind: "measured";
      readonly hours: number;
      readonly censored: boolean;
      readonly phaseUsed: string;
      readonly excluded: readonly MetricsExclusion[];
    }
  | {
      readonly kind: "unavailable";
      readonly reason: string;
      readonly excluded: readonly MetricsExclusion[];
    };

const measureCycleTime = (state: MetricsStateRead, window: MetricsWindow): CycleTimeMeasure => {
  const phases = foldTransitions(state);
  const start = phases.get("clarify_scope")?.[0] ?? null;
  if (start === null) {
    return {
      kind: "unavailable",
      reason: "no usable clarify_scope start in the transition history",
      excluded: [{ reason: "missing_metric_input", count: 1 }],
    };
  }
  if (!inWindow(start, window)) {
    return {
      kind: "unavailable",
      reason: "the clarify_scope start falls outside the evidence window",
      excluded: [{ reason: "outside_window", count: 1 }],
    };
  }
  const completion = phases.get("pr_creation")?.[1] ?? null;
  if (completion !== null) {
    const hours = roundHours(Date.parse(completion) - Date.parse(start));
    return { kind: "measured", hours, censored: false, phaseUsed: "pr_creation", excluded: [] };
  }
  // Right-censoring: the latest completed phase anchors the lower bound.
  let latest: { readonly phaseId: string; readonly timestamp: string } | undefined;
  for (const [phaseId, fold] of phases) {
    const completed = fold[1];
    if (completed === null) continue;
    if (latest === undefined || completed > latest.timestamp) {
      latest = { phaseId, timestamp: completed };
    }
  }
  if (latest === undefined) {
    return {
      kind: "unavailable",
      reason: "no completed phase to anchor the censored interval",
      excluded: [{ reason: "missing_metric_input", count: 1 }],
    };
  }
  return {
    kind: "measured",
    hours: roundHours(Date.parse(latest.timestamp) - Date.parse(start)),
    censored: true,
    phaseUsed: latest.phaseId,
    excluded: [],
  };
};

/** The native ceremony-share measurement over the runner fold (F-3, DEC-7). */
type CeremonyMeasure =
  | {
      readonly kind: "measured";
      readonly share: number;
      readonly runs: number;
      readonly steps: number;
      readonly phases: number;
      readonly excluded: readonly MetricsExclusion[];
    }
  | { readonly kind: "unavailable"; readonly excluded: readonly MetricsExclusion[] };

const runDurationMs = (run: MetricsCeremonyRun): number => {
  const starts = run.steps.map((step) => step.startedAtMs).filter(Number.isFinite);
  const ends = run.steps.map((step) => step.endedAtMs).filter(Number.isFinite);
  if (starts.length === 0 || ends.length === 0) return 0;
  return Math.max(0, Math.max(...ends) - Math.min(...starts));
};

const measureCeremonyShare = (state: MetricsStateRead, window: MetricsWindow): CeremonyMeasure => {
  const bounds = windowBounds(window);
  let outside = 0;
  const measured: MetricsCeremonyRun[] = [];
  for (const run of state.ceremony) {
    const starts = run.steps.map((step) => step.startedAtMs).filter(Number.isFinite);
    const start = starts.length === 0 ? Number.NaN : Math.min(...starts);
    if (!Number.isFinite(start) || start < bounds.fromMs || start > bounds.throughMs) {
      outside += 1;
      continue;
    }
    measured.push(run);
  }
  if (measured.length === 0) {
    return {
      kind: "unavailable",
      excluded: nonZero([{ reason: "outside_window", count: outside }]),
    };
  }
  const elapsed = Math.max(1, bounds.throughMs - bounds.fromMs);
  const totalMs = measured.reduce((sum, run) => sum + runDurationMs(run), 0);
  const phases = measured.reduce((sum, run) => sum + run.steps.length, 0);
  return {
    kind: "measured",
    share: totalMs / elapsed,
    runs: measured.length,
    steps: measured.reduce((sum, run) => sum + run.steps.length, 0),
    phases,
    excluded: nonZero([{ reason: "outside_window", count: outside }]),
  };
};

/** The CI-failure-rate proxy recomputation under the committed definition (F-3). */
type CiProxyMeasure =
  | {
      readonly kind: "measured";
      readonly ratio: number;
      readonly observed: number;
      readonly excluded: readonly MetricsExclusion[];
    }
  | { readonly kind: "unavailable"; readonly excluded: readonly MetricsExclusion[] };

const measureCiProxy = (corpus: MetricsCorpusRead, window: MetricsWindow): CiProxyMeasure => {
  const reasons = new Map<MetricsExclusionReason, number>();
  let observed = 0;
  let failed = 0;
  for (const row of corpus.rows) {
    if (row.kind !== "ci-observation") continue;
    if (!row.observed) {
      reasons.set("no_ci_observation", (reasons.get("no_ci_observation") ?? 0) + 1);
      continue;
    }
    if (row.observedAt === null) {
      reasons.set("date_only_or_missing_time", (reasons.get("date_only_or_missing_time") ?? 0) + 1);
      continue;
    }
    if (!Number.isFinite(Date.parse(row.observedAt))) {
      reasons.set("unparseable_yaml", (reasons.get("unparseable_yaml") ?? 0) + 1);
      continue;
    }
    if (!inWindow(row.observedAt, window)) {
      reasons.set("outside_window", (reasons.get("outside_window") ?? 0) + 1);
      continue;
    }
    observed += 1;
    if (row.outcome === "red" || row.outcome === "mixed") failed += 1;
  }
  const excluded = nonZero(
    METRICS_EXCLUSION_REASONS.filter((reason) => (reasons.get(reason) ?? 0) > 0).map((reason) => ({
      reason,
      count: reasons.get(reason) ?? 0,
    })),
  );
  if (observed === 0) return { kind: "unavailable", excluded };
  return { kind: "measured", ratio: failed / observed, observed, excluded };
};

/** One curated evidence row's admission decision (F-7, DEC-2). */
const PROHIBITED_PREFIXES = ["tmp/", ".ai/local/"] as const;

const isCommittedPath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("/tmp/") &&
  !path.startsWith("../") &&
  !PROHIBITED_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));

const isEscapedClass = (value: unknown): value is EscapedDefectClass =>
  typeof value === "string" && (ESCAPED_DEFECT_CLASSES as readonly string[]).includes(value);

type CurationOutcome = {
  readonly incidents: readonly MetricsIncident[];
  readonly perClass: Readonly<Record<EscapedDefectClass, number>>;
  readonly excluded: number;
};

const curateEscapedDefects = (
  corpus: MetricsCorpusRead,
  ref: string,
  window: MetricsWindow,
): CurationOutcome => {
  const perClass: Record<EscapedDefectClass, number> = {
    "post-gate-review": 0,
    "landed-ci-failure": 0,
    "retro-attributed": 0,
  };
  const incidents: MetricsIncident[] = [];
  let excluded = 0;
  const rows = corpus.rows.filter((row): row is MetricsEvidenceRow => row.kind === "evidence");
  for (const row of rows) {
    if (row.class === null || !isEscapedClass(row.class)) {
      excluded += 1;
      continue;
    }
    if (!isCommittedPath(row.path)) {
      excluded += 1;
      continue;
    }
    if (row.anchor === null || row.anchor.trim().length === 0) {
      excluded += 1;
      continue;
    }
    if (row.citation === "unresolved") {
      excluded += 1;
      continue;
    }
    if (row.observedAt === null || !inWindow(row.observedAt, window)) {
      excluded += 1;
      continue;
    }
    if (row.ref !== null && row.ref !== ref) {
      excluded += 1;
      continue;
    }
    perClass[row.class] += 1;
    incidents.push({
      artifact: row.path,
      anchor: row.anchor,
      class: row.class,
      observedAt: row.observedAt,
    });
  }
  incidents.sort((left, right) => {
    if (left.observedAt !== right.observedAt) return left.observedAt < right.observedAt ? -1 : 1;
    if (left.artifact !== right.artifact) return left.artifact < right.artifact ? -1 : 1;
    return left.anchor < right.anchor ? -1 : left.anchor > right.anchor ? 1 : 0;
  });
  return { incidents, perClass, excluded };
};

/** The declared per-entry basis and kind for each baseline-consumed member. */
export const BASELINE_ENTRY_DECLARATIONS: Readonly<
  Record<
    BaselineConsumedMetricId,
    { readonly kind: MeasurementKind; readonly basis: (typeof METRIC_BASES)[number] }
  >
> = {
  "MET-CEREMONY-SHARE": { kind: "native", basis: "ceremony-runner-fold" },
  "MET-CYCLE-TIME": { kind: "native", basis: "phase-transition-history" },
  "MET-CI-FAILURE-RATE": { kind: "proxy", basis: "committed-pm-notes-corpus" },
};

const missingRowEntry = (
  id: BaselineConsumedMetricId,
  row: MetricsBaselineRow | undefined,
): MetricsMetricEntry => {
  const declaration = BASELINE_ENTRY_DECLARATIONS[id];
  return {
    id,
    status: "UNAVAILABLE",
    measurementKind: declaration.kind,
    basis: declaration.basis,
    unit: row?.unit ?? "unknown",
    direction: row?.direction ?? "lower is better",
    sample: { n: 0 },
    limitation:
      "Row-absent evidence: the committed baseline log carries no row for this metric ID, so no value is reported and no definition reference is invented.",
  };
};

const statusOf = (
  row: MetricsBaselineRow | undefined,
  hasValue: boolean,
  censored: boolean,
): MetricsMetricEntry["status"] => {
  if (!hasValue) return "UNAVAILABLE";
  if (censored) return "PARTIAL";
  if (row === undefined) return "MEASURED";
  return row.status === "UNAVAILABLE" ? "MEASURED" : (row.status as MetricsMetricEntry["status"]);
};

type EntryBuildInput = {
  readonly baseline: MetricsBaselineLogRead;
  readonly state: MetricsStateRead;
  readonly corpus: MetricsCorpusRead;
  readonly ref: string;
  readonly window: MetricsWindow;
};

const buildEntries = (input: EntryBuildInput): readonly MetricsMetricEntry[] => {
  const document =
    input.baseline.ok && input.baseline.state === "present" ? input.baseline.document : undefined;
  const definitionSpread = ():
    | { readonly definitionRef: NonNullable<MetricsMetricEntry["definitionRef"]> }
    | Record<string, never> =>
    document === undefined
      ? {}
      : {
          definitionRef: {
            logPath: METRICS_BASELINE_LOG_PATH,
            sourceCommit: document.sourceCommit,
          },
        };

  const entries: MetricsMetricEntry[] = [];

  // MET-CEREMONY-SHARE — native through the delivered runner fold (DEC-13).
  {
    const id: BaselineConsumedMetricId = "MET-CEREMONY-SHARE";
    const row = document === undefined ? undefined : rowOf(document, id);
    if (row === undefined) {
      entries.push(missingRowEntry(id, undefined));
    } else {
      const measure = measureCeremonyShare(input.state, input.window);
      const declaration = BASELINE_ENTRY_DECLARATIONS[id];
      if (measure.kind === "unavailable") {
        entries.push({
          ...missingRowEntry(id, row),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          sample: { n: 0 },
          ...definitionSpread(),
          ...(measure.excluded.length === 0 ? {} : { excluded: measure.excluded }),
          limitation: `${row.limitation} No ceremony run record falls inside the evidence window, so sample.n is 0 and no value is reported.`,
        });
      } else {
        entries.push({
          id,
          value: measure.share,
          status: statusOf(row, true, false),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          sample: {
            n: measure.runs,
            runs: measure.runs,
            steps: measure.steps,
            phases: measure.phases,
          },
          ...definitionSpread(),
          ...(measure.excluded.length === 0 ? {} : { excluded: measure.excluded }),
          limitation: `${row.limitation} Native basis: measured ceremony run time over the evidence window's elapsed time; this figure is not the committed pm-notes duration-ratio proxy and is not interchangeable with it.`,
        });
      }
    }
  }

  // MET-CYCLE-TIME — native from the transition history (DEC-7, AC-F3-1).
  {
    const id: BaselineConsumedMetricId = "MET-CYCLE-TIME";
    const row = document === undefined ? undefined : rowOf(document, id);
    if (row === undefined) {
      entries.push(missingRowEntry(id, undefined));
    } else {
      const measure = measureCycleTime(input.state, input.window);
      const declaration = BASELINE_ENTRY_DECLARATIONS[id];
      if (measure.kind === "unavailable") {
        entries.push({
          ...missingRowEntry(id, row),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          ...definitionSpread(),
          excluded: measure.excluded,
          limitation: `${row.limitation} No usable interval exists in the transition history (${measure.reason}); no figure is synthesized.`,
        });
      } else {
        entries.push({
          id,
          value: measure.hours,
          status: statusOf(row, true, measure.censored),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          sample: { n: 1, censored: measure.censored ? 1 : 0 },
          ...definitionSpread(),
          ...(measure.excluded.length === 0 ? {} : { excluded: measure.excluded }),
          limitation: measure.censored
            ? `${row.limitation} Right-censored: pr_creation has not completed, so the interval ends at the latest completed phase (${measure.phaseUsed}) and the value is a lower bound anchored to that phase, not to the read instant.`
            : row.limitation,
        });
      }
    }
  }

  // MET-CI-FAILURE-RATE — proxy recomputation over the committed corpus (DEC-7).
  {
    const id: BaselineConsumedMetricId = "MET-CI-FAILURE-RATE";
    const row = document === undefined ? undefined : rowOf(document, id);
    if (row === undefined) {
      entries.push(missingRowEntry(id, undefined));
    } else {
      const measure = measureCiProxy(input.corpus, input.window);
      const declaration = BASELINE_ENTRY_DECLARATIONS[id];
      if (measure.kind === "unavailable") {
        entries.push({
          ...missingRowEntry(id, row),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          ...definitionSpread(),
          ...(measure.excluded.length === 0 ? {} : { excluded: measure.excluded }),
          limitation: `${row.limitation} No committed row in the evidence window carries a CI observation, so sample.n is 0 and no rate is reported; unobserved deliveries are never assumed green.`,
        });
      } else {
        entries.push({
          id,
          value: measure.ratio,
          status: statusOf(row, true, false),
          measurementKind: declaration.kind,
          basis: declaration.basis,
          unit: row.unit,
          direction: row.direction,
          sample: {
            n: measure.observed,
            observed: measure.observed,
            unobserved:
              measure.excluded.find((entry) => entry.reason === "no_ci_observation")?.count ?? 0,
          },
          ...definitionSpread(),
          ...(measure.excluded.length === 0 ? {} : { excluded: measure.excluded }),
          limitation: row.limitation,
        });
      }
    }
  }

  // escaped-defects — curated floor, non-MET, no definitionRef (DEC-2).
  {
    const curated = curateEscapedDefects(input.corpus, input.ref, input.window);
    const total =
      curated.perClass["post-gate-review"] +
      curated.perClass["landed-ci-failure"] +
      curated.perClass["retro-attributed"];
    const sample: MetricsSample = {
      n: total,
      postGateReview: curated.perClass["post-gate-review"],
      landedCiFailure: curated.perClass["landed-ci-failure"],
      retroAttributed: curated.perClass["retro-attributed"],
      excludedNonEvidence: curated.excluded,
    };
    const base: MetricsMetricEntry = {
      id: ESCAPED_DEFECTS_METRIC_ID,
      status: total === 0 ? "UNAVAILABLE" : "MEASURED",
      measurementKind: "curated-count",
      basis: "committed-evidence-corpus",
      unit: "count",
      direction: "lower is better",
      sample,
      limitation: METRICS_ESCAPED_DEFECTS_FLOOR_CAVEAT,
      ...(total === 0
        ? {}
        : {
            value: total,
            incidents: curated.incidents,
          }),
    };
    entries.push(base);
  }

  return entries;
};

/** The comparison view: a live evaluation under the committed protocol (F-4). */
const buildComparisons = (
  entries: readonly MetricsMetricEntry[],
  baseline: MetricsBaselineLogRead,
  window: MetricsWindow,
): readonly MetricsComparisonRow[] => {
  if (!baseline.ok || baseline.state !== "present") return [];
  const document = baseline.document;
  const rows: MetricsComparisonRow[] = [];
  for (const id of BASELINE_CONSUMED_METRIC_IDS) {
    const row = rowOf(document, id);
    if (row === undefined) continue;
    const entry = entries.find((candidate) => candidate.id === id);
    if (entry === undefined) continue;
    const beforeKind = mapMeasurementKind(row.measurementKind);
    const afterValue = entry.value;
    const verdict = (() => {
      if (afterValue === undefined) return "not-established" as const;
      if (entry.sample.n < METRICS_SAMPLE_MINIMUM) return "insufficient-sample" as const;
      if (row.value === null) return "not-established" as const;
      if (afterValue === row.value) return "flat" as const;
      const lower = lowerIsBetter(row.direction);
      const afterIsLower = afterValue < row.value;
      if (lower) return afterIsLower ? ("improved" as const) : ("regressed" as const);
      return afterIsLower ? ("regressed" as const) : ("improved" as const);
    })();
    const caveat = entry.measurementKind === beforeKind ? undefined : METRICS_PROXY_NATIVE_CAVEAT;
    rows.push({
      metricId: id,
      definitionRef: {
        logPath: METRICS_BASELINE_LOG_PATH,
        sourceCommit: document.sourceCommit,
      },
      before: {
        value: row.value,
        window: document.window,
        basis: row.measurementKind,
        measurementKind: beforeKind,
        status: row.status,
      },
      after: {
        ...(afterValue === undefined ? {} : { value: afterValue }),
        window,
        measurementKind: entry.measurementKind,
        status: entry.status,
        sampleSize: entry.sample.n,
      },
      sampleMinimum: METRICS_SAMPLE_MINIMUM,
      verdict,
      ...(caveat === undefined ? {} : { caveat }),
    });
  }
  return rows;
};

const attachEntryCaveats = (
  entries: readonly MetricsMetricEntry[],
  comparisons: readonly MetricsComparisonRow[],
): readonly MetricsMetricEntry[] =>
  entries.map((entry) => {
    const row = comparisons.find((candidate) => candidate.metricId === entry.id);
    if (row?.caveat === undefined) return entry;
    return { ...entry, caveat: row.caveat };
  });

const dispatchOf = (state: MetricsStateRead): MetricsDispatch => {
  if (state.telemetryState === "absent" || state.dispatch === undefined) {
    return {
      telemetryState: "absent",
      absenceReason: state.absenceReason ?? METRICS_TELEMETRY_ABSENT_REASON,
    };
  }
  const fold = state.dispatch;
  const perAgentTotal = fold.perAgent.reduce((sum, row) => sum + row.tokens, 0);
  const totalTokens = Object.values(fold.tokensByClass).reduce((sum, value) => sum + value, 0);
  const unattributableTokens = Math.max(0, totalTokens - perAgentTotal);
  const skipped = state.steps.filter(
    (step) => step.agentRole === null || step.model === null,
  ).length;
  const breakdowns: MetricsBreakdowns = {
    role: fold.breakdowns.role,
    model: fold.breakdowns.model,
  };
  return {
    telemetryState: "present",
    tokensByClass: fold.tokensByClass,
    costTotals: fold.costTotals,
    restarts: fold.restarts,
    perAgent: fold.perAgent,
    breakdowns,
    reconciliation: fold.reconciliation,
    ...(skipped === 0 && unattributableTokens === 0
      ? {}
      : { unattributable: { steps: skipped, tokens: unattributableTokens } }),
  };
};

/** The windowed measured spend one alarm evaluation consumes (F-6). */
const measureSpend = (
  state: MetricsStateRead,
  window: { readonly start: string; readonly end: string },
): { readonly tokens: number; readonly cost: number | null; readonly sparse: boolean } => {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  let tokens = 0;
  let cost = 0;
  let priced = 0;
  let sparse = false;
  for (const step of state.steps) {
    const instant = Date.parse(step.capturedAt);
    if (!Number.isFinite(instant) || instant < startMs || instant > endMs) continue;
    for (const value of Object.values(step.tokens)) tokens += value ?? 0;
    if (step.cost === null) sparse = true;
    else {
      cost += step.cost;
      priced += 1;
    }
  }
  if (state.steps.length === 0) {
    for (const record of state.records) {
      const instant = Date.parse(record.capturedAt);
      if (!Number.isFinite(instant) || instant < startMs || instant > endMs) continue;
      for (const value of Object.values(record.tokens)) tokens += value ?? 0;
      if (record.cost === null) sparse = true;
      else {
        cost += record.cost;
        priced += 1;
      }
    }
  }
  return { tokens, cost: priced === 0 ? null : cost, sparse };
};

const burnRateWindow = (
  nowMs: number,
  days: number,
): { readonly start: string; readonly end: string } => ({
  start: new Date(nowMs - days * METRICS_DAY_MS).toISOString(),
  end: new Date(nowMs).toISOString(),
});

const evaluateAlarms = (input: {
  readonly state: MetricsStateRead;
  readonly node: MetricsBurnRateNodeRead;
  readonly ref: string;
  readonly nowMs: number;
}): {
  readonly alarms: readonly MetricsAlarm[];
  readonly alarmEvaluation: MetricsAlarmEvaluation;
} => {
  const kind = ALARM_KINDS[0];
  if (input.state.telemetryState === "absent") {
    return { alarms: [], alarmEvaluation: { kind, status: "telemetry-absent" } };
  }
  if (!input.node.ok || !input.node.declared) {
    return { alarms: [], alarmEvaluation: { kind, status: "threshold-undeclared" } };
  }
  const declaration = input.node.value;
  const window = burnRateWindow(input.nowMs, declaration.windowDays);
  const measured = measureSpend(input.state, window);
  const evaluation: MetricsAlarmEvaluation = {
    kind,
    status: "evaluated",
    threshold: declaration.threshold,
    basis: declaration.basis,
    window,
  };
  const value = declaration.basis === "tokens" ? measured.tokens : (measured.cost ?? 0);
  if (value < declaration.threshold) return { alarms: [], alarmEvaluation: evaluation };
  const alarm: MetricsAlarm = {
    kind,
    ref: input.ref,
    basis: declaration.basis,
    threshold: declaration.threshold,
    measured: value,
    window,
    crossedAt: window.end,
    ...(declaration.basis === "cost" ? { sparse: measured.sparse } : {}),
  };
  return { alarms: [alarm], alarmEvaluation: evaluation };
};

/** The declared truncation counters and the bounded report (DM-8, DEC-10). */
type TruncationState = {
  readonly omitted: number;
  readonly truncated: boolean;
};

const serializedBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;

const applyRowCaps = (
  report: MetricsReport,
): { readonly report: MetricsReport; readonly omitted: number } => {
  let omitted = 0;
  const comparisons =
    report.comparisons.length > METRICS_MAX_COMPARISONS
      ? report.comparisons.slice(0, METRICS_MAX_COMPARISONS)
      : report.comparisons;
  omitted += report.comparisons.length - comparisons.length;
  const metrics = report.metrics.map((entry) => {
    if (entry.incidents === undefined || entry.incidents.length <= METRICS_MAX_INCIDENTS) {
      return entry;
    }
    omitted += entry.incidents.length - METRICS_MAX_INCIDENTS;
    return { ...entry, incidents: entry.incidents.slice(0, METRICS_MAX_INCIDENTS) };
  });
  const perAgent = report.dispatch.perAgent;
  const cappedAgents =
    perAgent !== undefined && perAgent.length > METRICS_MAX_PER_AGENT
      ? perAgent.slice(0, METRICS_MAX_PER_AGENT)
      : perAgent;
  if (perAgent !== undefined && cappedAgents !== undefined) {
    omitted += perAgent.length - cappedAgents.length;
  }
  return {
    report: {
      ...report,
      metrics,
      comparisons,
      ...(cappedAgents === undefined
        ? { dispatch: report.dispatch }
        : { dispatch: { ...report.dispatch, perAgent: cappedAgents } }),
    },
    omitted,
  };
};

const boundMachine = (
  report: MetricsReport,
): { readonly report: MetricsReport } & TruncationState => {
  const capped = applyRowCaps(report);
  let current: MetricsReport = {
    ...capped.report,
    omitted: capped.omitted,
    truncated: capped.omitted > 0,
  };
  let omitted = capped.omitted;
  const drop = (state: MetricsReport): MetricsReport | undefined => {
    if (state.comparisons.length > 0) {
      omitted += 1;
      return { ...state, comparisons: state.comparisons.slice(0, -1) };
    }
    const withIncidents = state.metrics.find(
      (entry) => entry.incidents !== undefined && entry.incidents.length > 0,
    );
    if (withIncidents?.incidents !== undefined) {
      omitted += 1;
      return {
        ...state,
        metrics: state.metrics.map((entry) =>
          entry.id === withIncidents.id && entry.incidents !== undefined
            ? { ...entry, incidents: entry.incidents.slice(0, -1) }
            : entry,
        ),
      };
    }
    const agents = state.dispatch.perAgent;
    if (agents !== undefined && agents.length > 0) {
      omitted += 1;
      return { ...state, dispatch: { ...state.dispatch, perAgent: agents.slice(0, -1) } };
    }
    return undefined;
  };
  while (serializedBytes(current) > METRICS_MAX_MACHINE_BYTES) {
    const next = drop(current);
    if (next === undefined) break;
    current = next;
  }
  return {
    report: { ...current, omitted, truncated: omitted > 0 },
    omitted,
    truncated: omitted > 0,
  };
};

/** The fold's inputs: every seam already resolved by the composition edge. */
export type MetricsFoldInput = {
  readonly ref: string;
  readonly window: MetricsWindow;
  readonly nowMs: number;
  readonly state: MetricsStateRead;
  readonly baseline: MetricsBaselineLogRead;
  readonly node: MetricsBurnRateNodeRead;
  readonly corpus: MetricsCorpusRead;
};

/** Fold one report: entries, dispatch, alarms, comparisons, and the bounds. */
export const computeMetricsReport = (input: MetricsFoldInput): MetricsReport => {
  const rawEntries = buildEntries({
    baseline: input.baseline,
    state: input.state,
    corpus: input.corpus,
    ref: input.ref,
    window: input.window,
  });
  const comparisons = buildComparisons(rawEntries, input.baseline, input.window);
  const metrics = attachEntryCaveats(rawEntries, comparisons);
  const alarms = evaluateAlarms({
    state: input.state,
    node: input.node,
    ref: input.ref,
    nowMs: input.nowMs,
  });
  const report: MetricsReport = {
    ref: input.ref,
    window: input.window,
    metrics,
    dispatch: dispatchOf(input.state),
    alarms: alarms.alarms,
    alarmEvaluation: alarms.alarmEvaluation,
    comparisons,
    omitted: 0,
    truncated: false,
  };
  return boundMachine(report).report;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const WINDOW_DAYS = /^(\d{1,3})d$/u;

/**
 * Resolve one raw `metrics.burn-rate` node (DM-6, DEC-4).
 *
 * Absent is never a defect. Every defect — a non-mapping value, a missing or
 * non-positive threshold, an unknown basis, a non-conforming or out-of-range
 * window, or a non-string window — is `config.value.invalid` with no invented
 * default. An unknown extra member is tolerated: the declared three are the
 * contract.
 */
export const resolveMetricsBurnRate = (node: unknown): MetricsBurnRateNodeRead => {
  if (!isRecord(node)) {
    return { ok: false, code: "config.value.invalid", detail: "burn-rate.not-a-mapping" };
  }
  for (const key of METRICS_BURN_RATE_NODE_KEYS) {
    if (!Object.hasOwn(node, key)) {
      return { ok: false, code: "config.value.invalid", detail: `burn-rate.${key}.missing` };
    }
  }
  const threshold = node.threshold;
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, code: "config.value.invalid", detail: "burn-rate.threshold" };
  }
  const basis = node.basis;
  if (
    typeof basis !== "string" ||
    !(METRICS_BURN_RATE_BASES as readonly string[]).includes(basis)
  ) {
    return { ok: false, code: "config.value.invalid", detail: "burn-rate.basis" };
  }
  const window = node.window;
  if (typeof window !== "string") {
    return { ok: false, code: "config.value.invalid", detail: "burn-rate.window" };
  }
  const match = WINDOW_DAYS.exec(window);
  const days = match === null ? Number.NaN : Number(match[1]);
  if (
    !Number.isInteger(days) ||
    days < METRICS_BURN_RATE_MIN_WINDOW_DAYS ||
    days > METRICS_BURN_RATE_MAX_WINDOW_DAYS
  ) {
    return { ok: false, code: "config.value.invalid", detail: "burn-rate.window" };
  }
  const value: MetricsBurnRateDeclaration = {
    threshold,
    basis: basis as MetricsBurnRateDeclaration["basis"],
    windowDays: days,
  };
  return { ok: true, declared: true, value };
};

/** The closed verdict set, re-exported so the renderer asserts through it. */
export const METRICS_VERDICTS = COMPARISON_VERDICTS;

/** The closed metric-order assert (vocabulary order, never store order). */
export const METRICS_ENTRY_ORDER = METRIC_IDS;
