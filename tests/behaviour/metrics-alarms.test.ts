/**
 * TC-METRICS-050/051/052/053/055/056 — burn-rate alarm evaluation: exactly one
 * alarm per crossing with every member echoed, the exact `measured >=
 * threshold` boundary on both bases, the declared trailing window, the
 * classified undeclared and telemetry-absent states, the below-threshold shape,
 * and the derived-view invariants (no persisted state, no duplicate).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alarmMatrix, belowThresholdMatrix, crossingMatrix } from "../fixtures/metrics/alarms";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  DAY_MS,
  documentText,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";
import { seedTelemetry, stepOf, tokens } from "../fixtures/metrics/telemetry";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const capturedAt = new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString();

const caseFor = (
  label: string,
  steps: readonly import("../../../packages/core/src/contracts/index").TelemetryStepRecord[],
  config: string,
): MetricsFixture => {
  const fixture = makeMetricsCase({ label, steps, config });
  fixtures.push(fixture);
  return fixture;
};

describe("TC-METRICS-050 exactly one alarm per crossing with every member echoed", () => {
  test("the SC-M2-S6-02 crossing fixture yields one alarm with the declared members", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("alarm-crossing", crossing.steps, burnRateConfig(crossing.config));
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = reportOf(run);
    const alarms = data.alarms as readonly Record<string, unknown>[];
    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toEqual({
      kind: "burn-rate",
      ref: METRICS_REF,
      basis: "tokens",
      threshold: 1000,
      measured: crossing.expectedMeasured,
      window: {
        start: new Date(METRICS_NOW_MS - 14 * DAY_MS).toISOString(),
        end: new Date(METRICS_NOW_MS).toISOString(),
      },
      crossedAt: new Date(METRICS_NOW_MS).toISOString(),
    });
    expect(data.alarmEvaluation).toEqual({
      kind: "burn-rate",
      status: "evaluated",
      threshold: 1000,
      basis: "tokens",
      window: {
        start: new Date(METRICS_NOW_MS - 14 * DAY_MS).toISOString(),
        end: new Date(METRICS_NOW_MS).toISOString(),
      },
    });
  });

  test("a repeat evaluation is byte-identical with still exactly one alarm", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("alarm-repeat", crossing.steps, burnRateConfig(crossing.config));
    const first = await runMetrics(fixture, ["metrics", "--json"]);
    const second = await runMetrics(fixture, ["metrics", "--json"]);
    const firstData = reportOf(first);
    const secondData = reportOf(second);
    expect(secondData).toEqual(firstData);
    expect((secondData.alarms as readonly unknown[]).length).toBe(1);
    expect((await runMetrics(fixture, ["metrics"])).human).toBe(
      (await runMetrics(fixture, ["metrics"])).human,
    );
  });

  test("the cost basis echoes sparse and uses the fold's cost total", async () => {
    const sparse = alarmMatrix(METRICS_REF, capturedAt).find(
      (cell) => cell.label === "cost-sparse",
    );
    if (sparse === undefined) throw new Error("sparse matrix missing");
    const fixture = caseFor("alarm-cost", sparse.steps, burnRateConfig(sparse.config));
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const alarm = (data.alarms as readonly Record<string, unknown>[])[0];
    expect(alarm).toMatchObject({
      kind: "burn-rate",
      basis: "cost",
      threshold: 1,
      measured: 2,
      sparse: true,
    });
  });

  test("the alarm is report data: no store member is written", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("alarm-readonly", crossing.steps, burnRateConfig(crossing.config));
    const before = fixture.snapshot();
    await runMetrics(fixture, ["metrics", "--json"]);
    expect(fixture.snapshot()).toBe(before);
    for (const member of ["append", "acquireFence", "salvage"]) {
      expect(fixture.reads.storeReads.filter((entry) => entry === member)).toEqual([]);
    }
  });
});

describe("TC-METRICS-051 the crossing boundary is exactly measured >= threshold", () => {
  test("tokens 999 does not cross, 1000 and 1001 do", async () => {
    for (const cell of alarmMatrix(METRICS_REF, capturedAt).filter((row) =>
      row.label.startsWith("tokens-"),
    )) {
      const fixture = caseFor(`alarm-${cell.label}`, cell.steps, burnRateConfig(cell.config));
      const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
      const alarms = data.alarms as readonly unknown[];
      if (cell.expectedMeasured < 1000) {
        expect(alarms, cell.label).toHaveLength(0);
        expect((data.alarmEvaluation as { status: string }).status).toBe("evaluated");
        expect((data.alarmEvaluation as { threshold: number }).threshold).toBe(1000);
      } else {
        expect(alarms, cell.label).toHaveLength(1);
      }
    }
  });

  test("cost 12.49 does not cross, 12.5 does, with no float repair", async () => {
    for (const cell of alarmMatrix(METRICS_REF, capturedAt).filter(
      (row) => row.label === "cost-12.49" || row.label === "cost-12.5",
    )) {
      const fixture = caseFor(`alarm-${cell.label}`, cell.steps, burnRateConfig(cell.config));
      const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
      const alarms = data.alarms as readonly Record<string, unknown>[];
      if (cell.expectedMeasured < 12.5) {
        expect(alarms, cell.label).toHaveLength(0);
      } else {
        expect(alarms, cell.label).toHaveLength(1);
        expect(alarms[0]?.measured, cell.label).toBe(cell.expectedMeasured);
      }
    }
  });

  test("the tokens basis sums the five classes, and the declared window is measured", async () => {
    const fixture = makeMetricsFixture({ label: "alarm-window", activeRef: METRICS_REF });
    fixtures.push(fixture);
    fixture.setConfig(
      "metrics:\n  burn-rate:\n    threshold: 100\n    basis: tokens\n    window: 2d\n",
    );
    fixture.setBaseline(fullBaseline());
    // Each class is 60 (below 100) while the sum is 120 (above it).
    seedTelemetry(fixture.store, [
      stepOf({
        ref: METRICS_REF,
        runId: "run-classes",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 60, output: 60 }),
        cost: 1,
        capturedAt,
      }),
    ]);
    const crossed = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const alarm = (crossed.alarms as readonly { window: { start: string; end: string } }[])[0];
    expect(alarm).toBeDefined();
    expect(Date.parse(alarm?.window.end ?? "") - Date.parse(alarm?.window.start ?? "")).toBe(
      2 * DAY_MS,
    );
    // The single-class twin (60 tokens) does not cross.
    const single = makeMetricsFixture({ label: "alarm-single-class", activeRef: METRICS_REF });
    fixtures.push(single);
    single.setConfig(
      "metrics:\n  burn-rate:\n    threshold: 100\n    basis: tokens\n    window: 2d\n",
    );
    single.setBaseline(fullBaseline());
    seedTelemetry(single.store, [
      stepOf({
        ref: METRICS_REF,
        runId: "run-single",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 60 }),
        cost: 1,
        capturedAt,
      }),
    ]);
    const singleData = reportOf(await runMetrics(single, ["metrics", "--json"]));
    expect(singleData.alarms).toEqual([]);
  });
});

describe("TC-METRICS-052 an undeclared node classifies threshold-undeclared", () => {
  const cells: readonly (readonly [string, (fixture: MetricsFixture) => void])[] = [
    ["no document", (fixture) => fixture.removeConfig()],
    ["no metrics node", (fixture) => fixture.setConfig("commit:\n  phaseCommit: true\n")],
    ["no burn-rate member", (fixture) => fixture.setConfig("metrics:\n  other: 'declared'\n")],
    ["unrelated nodes only", (fixture) => fixture.setConfig("verify: {}\n")],
  ];

  for (const [label, prepare] of cells) {
    test(`${label} yields threshold-undeclared with empty alarms at exit 0`, async () => {
      const fixture = caseFor(
        `undeclared-${label.replaceAll(" ", "-")}`,
        crossingMatrix(METRICS_REF, capturedAt).steps,
        burnRateConfig(),
      );
      prepare(fixture);
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      const data = reportOf(run);
      expect(data.alarmEvaluation).toEqual({ kind: "burn-rate", status: "threshold-undeclared" });
      expect(data.alarms).toEqual([]);
      expect((data.metrics as readonly unknown[]).length).toBe(4);
      expect((data.comparisons as readonly unknown[]).length).toBe(3);
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('"threshold"');
    });
  }

  test("the declared twin raises one alarm and the document stays unchanged", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("undeclared-twin", crossing.steps, burnRateConfig(crossing.config));
    const before = documentText(fixture, ".example-product/config.yaml");
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect((data.alarms as readonly unknown[]).length).toBe(1);
    expect(documentText(fixture, ".example-product/config.yaml")).toBe(before);
    expect((await runMetrics(fixture, ["metrics"])).human).not.toContain(
      "threshold=1000 threshold",
    );
  });
});

describe("TC-METRICS-053 telemetry absence classifies telemetry-absent", () => {
  test("the dispatch declares absence, no alarm fires, and other metrics still measure", async () => {
    const fixture = makeMetricsCase({ label: "telemetry-absent", steps: [] });
    fixtures.push(fixture);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const dispatch = data.dispatch as Record<string, unknown>;
    expect(dispatch.telemetryState).toBe("absent");
    expect(dispatch.absenceReason).toBe("spend.telemetry-absent");
    for (const key of ["tokensByClass", "costTotals", "restarts", "perAgent", "breakdowns"]) {
      expect(dispatch[key], key).toBeUndefined();
    }
    expect(data.alarmEvaluation).toEqual({ kind: "burn-rate", status: "telemetry-absent" });
    expect(data.alarms).toEqual([]);
    expect(JSON.stringify(data)).not.toContain('"ok":false');
    const entries = data.metrics as readonly { id: string; value?: number }[];
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
    expect(byId["MET-CYCLE-TIME"]?.value).toBe(7);
    expect(byId["MET-CI-FAILURE-RATE"]?.value).toBeDefined();
    expect(byId["MET-CEREMONY-SHARE"]?.value).toBeDefined();
    const human = (await runMetrics(fixture, ["metrics"])).human;
    expect(human).toContain("telemetry absent");
    expect(human).not.toContain("tokens=0");
  });
});

describe("TC-METRICS-055 below threshold differs only by the empty alarm row", () => {
  test("980 yields evaluated with the echo and no alarm", async () => {
    const below = belowThresholdMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("below-threshold", below.steps, burnRateConfig(below.config));
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(data.alarms).toEqual([]);
    expect(data.alarmEvaluation).toEqual({
      kind: "burn-rate",
      status: "evaluated",
      threshold: 1000,
      basis: "tokens",
      window: {
        start: new Date(METRICS_NOW_MS - 14 * DAY_MS).toISOString(),
        end: new Date(METRICS_NOW_MS).toISOString(),
      },
    });
    const human = (await runMetrics(fixture, ["metrics"])).human;
    expect(human).toContain("Alarms: none");
    expect(human).toContain("threshold=1000");
  });

  test("the crossing and below payloads share their key sets at every level", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const crossingData = reportOf(
      await runMetrics(caseFor("shape-crossing", crossing.steps, burnRateConfig(crossing.config)), [
        "metrics",
        "--json",
      ]),
    );
    const below = belowThresholdMatrix(METRICS_REF, capturedAt);
    const belowData = reportOf(
      await runMetrics(caseFor("shape-below", below.steps, burnRateConfig(below.config)), [
        "metrics",
        "--json",
      ]),
    );
    const shape = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        const first = value[0];
        return first === undefined ? "empty-array" : `array-of:${JSON.stringify(shape(first))}`;
      }
      if (typeof value !== "object" || value === null) return typeof value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => (left < right ? -1 : 1))
          .map(([key, inner]) => [key, shape(inner)]),
      );
    };
    // The alarm row is the declared, only difference: compare every other level.
    const withoutAlarms = (data: Record<string, unknown>): Record<string, unknown> => {
      const copy: Record<string, unknown> = { ...data };
      delete copy.alarms;
      return copy;
    };
    expect(shape(withoutAlarms(crossingData))).toEqual(shape(withoutAlarms(belowData)));
    expect((crossingData.alarms as readonly unknown[]).length).toBe(1);
    expect(belowData.alarms).toEqual([]);
    const undeclared = caseFor("shape-undeclared", below.steps, burnRateConfig(below.config));
    undeclared.removeConfig();
    const undeclaredData = reportOf(await runMetrics(undeclared, ["metrics", "--json"]));
    expect((undeclaredData.alarmEvaluation as { status: string }).status).toBe(
      "threshold-undeclared",
    );
  });
});

describe("TC-METRICS-056 the alarm set is a derived view", () => {
  test("five repeats, a crossed-to-below-to-crossed sequence, and no persisted state", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("derived-view", crossing.steps, burnRateConfig(crossing.config));
    const snapshots: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      const data = reportOf(run);
      const alarms = data.alarms as readonly Record<string, unknown>[];
      expect(alarms).toHaveLength(1);
      snapshots.push(JSON.stringify(alarms[0]));
    }
    expect(new Set(snapshots).size).toBe(1);
    fixture.setConfig(burnRateConfig({ threshold: 5000, basis: "tokens", window: "14d" }));
    const belowData = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(belowData.alarms).toEqual([]);
    fixture.setConfig(burnRateConfig(crossing.config));
    const again = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect((again.alarms as readonly unknown[]).length).toBe(1);
    expect(JSON.stringify((again.alarms as readonly unknown[])[0])).toBe(snapshots[0]);
    expect(fixture.reads.storeReads.filter((entry) => entry === "append")).toEqual([]);
  });

  test("crossedAt moves with the injected clock", async () => {
    const crossing = crossingMatrix(METRICS_REF, capturedAt);
    const fixture = caseFor("derived-clock", crossing.steps, burnRateConfig(crossing.config));
    const first = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const firstAlarm = (first.alarms as readonly { crossedAt: string }[])[0];
    fixture.setNow(METRICS_NOW_MS + 3_600_000);
    const second = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const secondAlarm = (second.alarms as readonly { crossedAt: string }[])[0];
    expect(
      Date.parse(String(secondAlarm?.crossedAt)) - Date.parse(String(firstAlarm?.crossedAt)),
    ).toBe(3_600_000);
  });

  test("no delivered surface gains an alarm row", () => {
    for (const relative of [
      "packages/core/src/contracts/status.ts",
      "packages/core/src/contracts/brief.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      expect(source.toLowerCase()).not.toContain("burn-rate");
      expect(source.toLowerCase()).not.toContain("alarmEvaluation");
    }
  });
});
