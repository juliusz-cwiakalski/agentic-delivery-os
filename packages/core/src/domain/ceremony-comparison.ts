/**
 * Ceremony measurement and the committed ceremony-share comparison (GH-296 F-8;
 * DM-8; DEC-1, DEC-8, DEC-14; RSK-4).
 *
 * The measurement fold derives run duration, per-phase durations, and
 * per-ceremony aggregates from the verified run/step records: no self-reported
 * input, no second stored figure. The comparison record uses the committed
 * `MET-CEREMONY-SHARE` identity and definition, states `insufficient-sample`
 * below five post-boundary changes, and never claims a trend below the minimum.
 * Pure: no clock, randomness, environment, network, or I/O.
 */
import {
  CEREMONY_COMPARISON_SCHEMA,
  CEREMONY_SAMPLE_MINIMUM,
  CEREMONY_SHARE_METRIC_ID,
  type CeremonyComparisonRecord,
  type CeremonyComparisonSample,
  type CeremonyNativeAggregate,
  type CeremonyStepRecord,
  type CeremonyWindow,
} from "#contracts";

/** One run and its verified step set, as the measurement fold consumes it. */
export type CeremonyMeasurementRun = {
  readonly ceremony: string;
  readonly runId: string;
  readonly steps: readonly CeremonyStepRecord[];
};

/** The native measurement fold: per-run, per-ceremony, and totals. */
export type CeremonyMeasurementFold = {
  readonly runs: number;
  readonly steps: number;
  readonly phases: number;
  readonly perRun: readonly {
    readonly ceremony: string;
    readonly runId: string;
    readonly durationMs: number;
  }[];
  readonly perCeremony: readonly CeremonyNativeAggregate[];
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const runDuration = (steps: readonly CeremonyStepRecord[]): number => {
  if (steps.length === 0) return 0;
  const starts = steps.map((step) => step.startedAtMs).filter(isFiniteNumber);
  const ends = steps.map((step) => step.endedAtMs).filter(isFiniteNumber);
  if (starts.length === 0 || ends.length === 0) return 0;
  return Math.max(0, Math.max(...ends) - Math.min(...starts));
};

/** Nearest-rank p90 with no interpolation (DM-8). */
export const ceremonyP90Ms = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(0.9 * sorted.length);
  return sorted[Math.max(0, rank - 1)] ?? 0;
};

/** Fold the verified run/step records into the native measurement basis. */
export const foldCeremonyMeasurement = (
  runs: readonly CeremonyMeasurementRun[],
): CeremonyMeasurementFold => {
  const perRun = runs.map((run) => ({
    ceremony: run.ceremony,
    runId: run.runId,
    durationMs: runDuration(run.steps),
  }));
  const byCeremony = new Map<string, number[]>();
  for (const run of perRun) {
    const durations = byCeremony.get(run.ceremony) ?? [];
    durations.push(run.durationMs);
    byCeremony.set(run.ceremony, durations);
  }
  const perCeremony: CeremonyNativeAggregate[] = [...byCeremony.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([ceremony, durations]) => ({
      ceremony,
      runs: durations.length,
      meanMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
      p90Ms: ceremonyP90Ms(durations),
    }));
  const phases = new Set<string>();
  for (const run of runs) {
    for (const step of run.steps) phases.add(`${run.runId}:${String(step.phaseIndex)}`);
  }
  return {
    runs: runs.length,
    steps: runs.reduce((sum, run) => sum + run.steps.length, 0),
    phases: phases.size,
    perRun,
    perCeremony,
  };
};

/** The before value from the committed metric row (the log's immutable record). */
export type CeremonyComparisonBefore = {
  readonly value: number;
  readonly window: CeremonyWindow;
  readonly sampleSize: number;
  readonly status: string;
  readonly basis: string;
};

/** The comparison builder input; every value is committed or injected data. */
export type CeremonyComparisonInput = {
  readonly logPath: string;
  readonly sourceCommit: string;
  readonly before: CeremonyComparisonBefore;
  readonly afterWindow: CeremonyWindow;
  readonly samples: readonly CeremonyComparisonSample[];
  readonly measurement: CeremonyMeasurementFold;
  readonly limitation: string;
  readonly afterBasis?: string;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Build the one committed comparison record (DM-8). */
export const buildCeremonyComparison = (
  input: CeremonyComparisonInput,
): CeremonyComparisonRecord => {
  const sampleSize = input.samples.length;
  const afterValue = sampleSize === 0 ? null : mean(input.samples.map((sample) => sample.value));
  const verdict: CeremonyComparisonRecord["verdict"] =
    sampleSize < CEREMONY_SAMPLE_MINIMUM
      ? "insufficient-sample"
      : afterValue === null
        ? "not-established"
        : afterValue < input.before.value
          ? "improved"
          : afterValue > input.before.value
            ? "regressed"
            : "flat";
  return {
    schemaId: CEREMONY_COMPARISON_SCHEMA,
    metricId: CEREMONY_SHARE_METRIC_ID,
    definitionRef: { logPath: input.logPath, sourceCommit: input.sourceCommit },
    before: {
      value: input.before.value,
      window: input.before.window,
      sampleSize: input.before.sampleSize,
      status: input.before.status,
      basis: input.before.basis,
    },
    after: {
      value: afterValue,
      window: input.afterWindow,
      samples: [...input.samples],
      sampleSize,
      basis: input.afterBasis ?? "ceremony-run-records",
    },
    sampleMinimum: CEREMONY_SAMPLE_MINIMUM,
    verdict,
    nativeBasis: {
      runs: input.measurement.runs,
      steps: input.measurement.steps,
      phases: input.measurement.phases,
      perCeremony: input.measurement.perCeremony,
      statement:
        "Runner-measured step durations are a native second basis; they are not interchangeable with the committed pm-notes proxy and are never substituted for it. No cross-metric aggregation is claimed.",
    },
    disclosure: `${String(sampleSize)} post-boundary change(s) observed in the window ${input.afterWindow.start}..${input.afterWindow.end}; the sample minimum is ${String(CEREMONY_SAMPLE_MINIMUM)}. The before value is the committed pm-notes proxy (${input.before.basis}); the after value is recomputed over the same definition and formula. ${input.limitation}`,
  };
};

/** The trend vocabulary a sub-minimum record must never carry (DEC-14). */
export const CEREMONY_TREND_TOKENS = ["improved", "regressed", "trend"] as const;

/**
 * Honesty scan: a comparison below the sample minimum must carry no trend claim
 * in the record or in any change artifact text handed to the scan.
 */
export const ceremonyComparisonHonestyViolations = (
  record: CeremonyComparisonRecord,
  artifacts: readonly string[] = [],
): readonly string[] => {
  const violations: string[] = [];
  if (
    record.after.sampleSize < CEREMONY_SAMPLE_MINIMUM &&
    record.verdict !== "insufficient-sample"
  ) {
    violations.push(
      `a sample below the minimum carries the verdict "${record.verdict}" instead of insufficient-sample`,
    );
  }
  if (record.verdict !== "insufficient-sample") return violations;
  if (record.after.sampleSize >= CEREMONY_SAMPLE_MINIMUM) {
    violations.push("insufficient-sample verdict with a sample at or above the minimum");
  }
  const recordText = JSON.stringify(record).toLowerCase();
  for (const token of CEREMONY_TREND_TOKENS) {
    if (recordText.includes(token)) violations.push(`record carries the trend token "${token}"`);
  }
  for (const [index, text] of artifacts.entries()) {
    for (const token of CEREMONY_TREND_TOKENS) {
      if (text.toLowerCase().includes(token)) {
        violations.push(`artifact ${String(index)} carries the trend token "${token}"`);
      }
    }
  }
  return violations;
};
