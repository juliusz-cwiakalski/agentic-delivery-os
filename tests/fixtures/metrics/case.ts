/**
 * The composed metrics case fixture (GH-299 test plan §4.1).
 *
 * One helper seeds a complete, deterministic evidence picture — the committed
 * baseline log, the declaration node, telemetry steps, a transition history,
 * in-window ceremony records, and a committed corpus document — so a suite can
 * name only the dimension it varies.
 */
import { baselineDocument, CEREMONY_ROW, CI_ROW, CYCLE_ROW, FALSE_SIGNAL_ROW } from "./baseline";
import { type CeremonySeedRun, inWindowCeremonies, seedCeremony } from "./ceremony";
import { type BurnRateConfigInput, burnRateConfig } from "./config";
import { type CiObservationInput, corpusDocument, type EvidenceInput } from "./corpus";
import {
  DAY_MS,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
} from "./harness";
import { fullyAttributableSteps, seedTelemetry } from "./telemetry";
import { completeHistory, seedHistory } from "./transitions";

export type MetricsCaseOptions = {
  readonly label?: string;
  readonly activeRef?: string | null;
  readonly config?: string;
  readonly configInput?: BurnRateConfigInput;
  readonly omitConfig?: boolean;
  readonly baseline?: string;
  readonly omitBaseline?: boolean;
  readonly steps?: readonly import("../../../packages/core/src/contracts/index").TelemetryStepRecord[];
  readonly ceremony?: readonly CeremonySeedRun[];
  readonly history?: readonly import("./transitions").TransitionSeed[];
  readonly ci?: readonly CiObservationInput[];
  readonly evidence?: readonly EvidenceInput[];
  readonly nowMs?: number;
};

/** The committed log a full case renders by default: three consumed rows plus the fourth. */
export const defaultBaseline = (): string =>
  baselineDocument({ rows: [CEREMONY_ROW, CYCLE_ROW, CI_ROW, FALSE_SIGNAL_ROW] });

/** The committed corpus a full case renders by default: two observed, one red/mixed. */
export const defaultCi = (): readonly CiObservationInput[] => [
  {
    ref: "GH-1",
    observed: true,
    outcome: "red",
    observedAt: new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString(),
  },
  {
    ref: "GH-2",
    observed: true,
    outcome: "green",
    observedAt: new Date(METRICS_NOW_MS - 3 * DAY_MS).toISOString(),
  },
  {
    ref: "GH-3",
    observed: true,
    outcome: "mixed",
    observedAt: new Date(METRICS_NOW_MS - 4 * DAY_MS).toISOString(),
  },
  {
    ref: "GH-4",
    observed: false,
    outcome: null,
    observedAt: new Date(METRICS_NOW_MS - 5 * DAY_MS).toISOString(),
  },
  {
    ref: "GH-5",
    observed: true,
    outcome: "red",
    observedAt: new Date(METRICS_NOW_MS - 200 * DAY_MS).toISOString(),
  },
];

/** Create one complete case and return its fixture. */
export const makeMetricsCase = (options: MetricsCaseOptions = {}): MetricsFixture => {
  const fixture = makeMetricsFixture({
    label: options.label ?? "case",
    activeRef: options.activeRef === undefined ? METRICS_REF : options.activeRef,
    ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
  });
  if (options.omitConfig !== true) {
    fixture.setConfig(options.config ?? burnRateConfig(options.configInput ?? {}));
  }
  if (options.omitBaseline !== true) {
    fixture.setBaseline(options.baseline ?? defaultBaseline());
  }
  seedTelemetry(
    fixture.store,
    options.steps ??
      fullyAttributableSteps({
        ref: METRICS_REF,
        capturedAt: new Date(fixture.nowMs - 2 * DAY_MS).toISOString(),
      }),
  );
  seedHistory(fixture.store, METRICS_REF, options.history ?? completeHistory());
  seedCeremony(fixture.store, options.ceremony ?? inWindowCeremonies(fixture.nowMs - 3_600_000));
  fixture.setCorpusDocument(
    "2026-11/2026-11-16--GH-299--metrics-spend/chg-GH-299-pm-notes.yaml",
    corpusDocument({ ci: options.ci ?? defaultCi(), evidence: options.evidence ?? [] }),
  );
  return fixture;
};
