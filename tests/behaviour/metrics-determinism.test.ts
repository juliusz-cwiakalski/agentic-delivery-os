/**
 * TC-METRICS-101 / TC-METRICS-105 — determinism: byte-identical repeats over
 * every declared form, permutation independence over store/document order, and
 * every timestamp a pure function of the injected clock.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { baselineDocument, CEREMONY_ROW, CI_ROW, CYCLE_ROW } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { inWindowCeremonies, seedCeremony } from "../fixtures/metrics/ceremony";
import { burnRateConfig } from "../fixtures/metrics/config";
import { type CiObservationInput, corpusDocument } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  entriesById,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";
import { fullyAttributableSteps, seedTelemetry } from "../fixtures/metrics/telemetry";
import { censoredHistory, completeHistory, seedHistory } from "../fixtures/metrics/transitions";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const at = (daysAgo: number): string => new Date(METRICS_NOW_MS - daysAgo * DAY_MS).toISOString();

const ciRows = (): readonly CiObservationInput[] => [
  { ref: "GH-1", observed: true, outcome: "red", observedAt: at(1) },
  { ref: "GH-2", observed: true, outcome: "green", observedAt: at(2) },
  { ref: "GH-3", observed: true, outcome: "mixed", observedAt: at(3) },
  { ref: "GH-4", observed: false, outcome: null, observedAt: at(4) },
];

const forms: readonly (readonly [string, () => MetricsFixture])[] = [
  ["bare", () => makeMetricsCase({ label: "det-bare" })],
  ["explicit window", () => makeMetricsCase({ label: "det-window", nowMs: METRICS_NOW_MS })],
  [
    "crossing alarm",
    () =>
      makeMetricsCase({
        label: "det-crossing",
        config: burnRateConfig({ threshold: 1000, basis: "tokens", window: "14d" }),
      }),
  ],
  ["undeclared threshold", () => makeMetricsCase({ label: "det-undeclared", omitConfig: true })],
  ["telemetry-absent", () => makeMetricsCase({ label: "det-absent", steps: [] })],
  [
    "insufficient sample",
    () => makeMetricsCase({ label: "det-insufficient", ci: ciRows().slice(0, 1) }),
  ],
];

describe("TC-METRICS-101 two runs are byte-identical on every form", () => {
  for (const [label, build] of forms) {
    test(`${label} is byte-identical on the human and machine output`, async () => {
      const fixture = build();
      fixtures.push(fixture);
      const argv =
        label === "explicit window"
          ? (["metrics", "--from", at(10), "--through", at(1), "--json"] as const)
          : (["metrics", "--json"] as const);
      const first = await runMetrics(fixture, argv);
      const second = await runMetrics(fixture, argv);
      expect(second.envelope?.data).toEqual(first.envelope?.data);
      const humanFirst = await runMetrics(fixture, ["metrics"]);
      const humanSecond = await runMetrics(fixture, ["metrics"]);
      expect(humanSecond.human).toBe(humanFirst.human);
    });
  }

  test("four source permutations collapse to one output", async () => {
    const build = (label: string, reverse: boolean): MetricsFixture => {
      const fixture = makeMetricsFixture({ label, activeRef: METRICS_REF });
      fixtures.push(fixture);
      fixture.setConfig(burnRateConfig());
      fixture.setBaseline(
        baselineDocument({
          rows: reverse ? [CI_ROW, CYCLE_ROW, CEREMONY_ROW] : [CEREMONY_ROW, CYCLE_ROW, CI_ROW],
        }),
      );
      const steps = fullyAttributableSteps({ ref: METRICS_REF, capturedAt: at(2) });
      seedTelemetry(fixture.store, reverse ? [...steps].reverse() : steps);
      seedHistory(fixture.store, METRICS_REF, completeHistory());
      seedCeremony(fixture.store, inWindowCeremonies(fixture.nowMs - 3_600_000));
      fixture.setCorpusDocument(
        "x/chg-GH-299-pm-notes.yaml",
        corpusDocument({ ci: reverse ? [...ciRows()].reverse() : ciRows() }),
      );
      return fixture;
    };
    const canonical = build("perm-canonical", false);
    const permuted = build("perm-reversed", true);
    const canonicalData = reportOf(await runMetrics(canonical, ["metrics", "--json"]));
    const permutedData = reportOf(await runMetrics(permuted, ["metrics", "--json"]));
    expect(permutedData.metrics).toEqual(canonicalData.metrics);
    expect(permutedData.comparisons).toEqual(canonicalData.comparisons);
    expect(permutedData.alarms).toEqual(canonicalData.alarms);
    expect(permutedData.dispatch).toEqual(canonicalData.dispatch);
  });

  test("neither the run id nor the timing appears inside data", async () => {
    const fixture = makeMetricsCase({ label: "det-envelope" });
    fixtures.push(fixture);
    const first = await runMetrics(fixture, ["metrics", "--json"], { runId: "run-one" });
    const second = await runMetrics(fixture, ["metrics", "--json"], { runId: "run-two" });
    expect(first.envelope?.runId).toBe("run-one");
    expect(second.envelope?.runId).toBe("run-two");
    const serialized = JSON.stringify(first.envelope?.data);
    expect(serialized).not.toContain("run-one");
    expect(serialized).not.toContain("totalMs");
  });
});

describe("TC-METRICS-105 every timestamp is a pure function of the injected clock", () => {
  test("the window, the comparison after-window, the alarm window, and crossedAt follow the clock", async () => {
    const fixture = makeMetricsCase({ label: "clock-schedule" });
    fixtures.push(fixture);
    const base = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect((base.window as { through: string }).through).toBe(
      new Date(METRICS_NOW_MS).toISOString(),
    );
    const alarm = (base.alarms as readonly { crossedAt: string; window: { end: string } }[])[0];
    expect(alarm?.crossedAt).toBe(new Date(METRICS_NOW_MS).toISOString());
    expect(alarm?.window.end).toBe(alarm?.crossedAt);
    for (const advance of [1, 3_600_000]) {
      fixture.setNow(METRICS_NOW_MS + advance);
      const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
      expect((data.window as { through: string }).through).toBe(
        new Date(METRICS_NOW_MS + advance).toISOString(),
      );
      const next = (data.alarms as readonly { crossedAt: string }[])[0];
      expect(next?.crossedAt).toBe(new Date(METRICS_NOW_MS + advance).toISOString());
    }
    // A 30-day advance ages the crossing evidence out of the declared 14-day
    // alarm window: the window moves and the alarm set empties, never a stale alarm.
    fixture.setNow(METRICS_NOW_MS + 30 * DAY_MS);
    const aged = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect((aged.window as { through: string }).through).toBe(
      new Date(METRICS_NOW_MS + 30 * DAY_MS).toISOString(),
    );
    expect(aged.alarms).toEqual([]);
    expect((aged.alarmEvaluation as { status: string }).status).toBe("evaluated");
  });

  test("the censoring anchor is the last completed phase and never moves with the clock", async () => {
    const fixture = makeMetricsCase({
      label: "clock-censored",
      history: censoredHistory(),
    });
    fixtures.push(fixture);
    const first = entriesById(reportOf(await runMetrics(fixture, ["metrics", "--json"])))[
      "MET-CYCLE-TIME"
    ];
    fixture.setNow(METRICS_NOW_MS + 5 * DAY_MS);
    const second = entriesById(reportOf(await runMetrics(fixture, ["metrics", "--json"])))[
      "MET-CYCLE-TIME"
    ];
    expect(second?.value).toBe(first?.value);
    const sample = (second?.sample ?? {}) as Record<string, number>;
    expect(sample.censored).toBe(1);
  });
});
