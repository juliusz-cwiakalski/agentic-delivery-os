/**
 * TC-METRICS-100 / TC-METRICS-101 (bounds half) / TC-METRICS-102/103/104 — the
 * machine and human bounds are measured, every drop is counted, the tail order
 * is declared, and the never-dropped set survives a binding cap.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  METRICS_MAX_HUMAN_BYTES,
  METRICS_MAX_HUMAN_LINES,
  METRICS_MAX_MACHINE_BYTES,
  type MetricsReport,
} from "../../packages/core/src/contracts/index";
import { boundMetricsReport } from "../../packages/core/src/domain/metrics";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import type { EvidenceInput } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";
import { seedTelemetry, stepOf, tokens } from "../fixtures/metrics/telemetry";
import { completeHistory, seedHistory } from "../fixtures/metrics/transitions";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

const syntheticReport = (): MetricsReport => {
  const long = "x".repeat(4_000);
  return {
    ref: METRICS_REF,
    window: {
      from: new Date(METRICS_NOW_MS - 30 * DAY_MS).toISOString(),
      through: new Date(METRICS_NOW_MS).toISOString(),
    },
    metrics: [
      {
        id: "escaped-defects",
        value: 20,
        status: "MEASURED",
        measurementKind: "curated-count",
        basis: "committed-evidence-corpus",
        unit: "count",
        direction: "lower is better",
        sample: { n: 20 },
        limitation: long,
        incidents: Array.from({ length: 20 }, (_, index) => ({
          artifact: `doc/changes/x/incident-${String(index)}.md`,
          anchor: `ANCHOR-${String(index)}`,
          class: "post-gate-review" as const,
          observedAt: new Date(METRICS_NOW_MS - DAY_MS).toISOString(),
        })),
      },
    ],
    dispatch: {
      telemetryState: "present",
      tokensByClass: { input: 1 },
      costTotals: { total: 1, models: [], sparse: false },
      restarts: 0,
      perAgent: Array.from({ length: 20 }, (_, index) => ({
        role: `role-${String(index)}`,
        model: long,
        calls: 1,
        tokens: 1,
      })),
      breakdowns: { role: [], model: [] },
    },
    alarms: [
      {
        kind: "burn-rate",
        ref: METRICS_REF,
        basis: "tokens",
        threshold: 1,
        measured: 2,
        window: {
          start: new Date(METRICS_NOW_MS - 14 * DAY_MS).toISOString(),
          end: new Date(METRICS_NOW_MS).toISOString(),
        },
        crossedAt: new Date(METRICS_NOW_MS).toISOString(),
      },
    ],
    alarmEvaluation: {
      kind: "burn-rate",
      status: "evaluated",
      threshold: 1,
      basis: "tokens",
      window: {
        start: new Date(METRICS_NOW_MS - 14 * DAY_MS).toISOString(),
        end: new Date(METRICS_NOW_MS).toISOString(),
      },
    },
    comparisons: Array.from({ length: 20 }, (_unused, index) => ({
      metricId: "MET-CI-FAILURE-RATE" as const,
      definitionRef: { logPath: "log.yaml", sourceCommit: "commit" },
      before: {
        value: 0.5,
        window: { start: "2026-01-01T00:00:00Z", end: "2026-02-01T00:00:00Z" },
        basis: "session_proxy",
        measurementKind: "proxy" as const,
        status: "PARTIAL",
      },
      after: {
        value: 0.5,
        window: { from: "2026-10-01T00:00:00Z", through: "2026-11-01T00:00:00Z" },
        measurementKind: "proxy" as const,
        status: "PARTIAL" as const,
        sampleSize: 10,
      },
      sampleMinimum: 5 as const,
      verdict: "flat" as const,
      caveat: long,
    })),
    omitted: 0,
    truncated: false,
  };
};

describe("TC-METRICS-102/103 the machine cap and its tail order", () => {
  test("an inflated report is cut to the byte cap with every drop counted", () => {
    const report = syntheticReport();
    expect(bytes(report)).toBeGreaterThan(METRICS_MAX_MACHINE_BYTES);
    const bounded = boundMetricsReport(report);
    expect(bytes(bounded.report)).toBeLessThanOrEqual(METRICS_MAX_MACHINE_BYTES);
    expect(bytes(bounded.report)).toBeGreaterThan(0);
    expect(bounded.report.truncated).toBe(true);
    expect(bounded.report.omitted).toBe(bounded.omitted);
    expect(bounded.omitted).toBeGreaterThan(0);
  });

  test("comparisons drop first, then incidents, then perAgent", () => {
    const bounded = boundMetricsReport(syntheticReport()).report;
    const escaped = bounded.metrics.find((entry) => entry.id === "escaped-defects");
    expect(bounded.comparisons.length).toBeLessThan(20);
    // The comparison tail is fully spent before the incident tail starts.
    if (bounded.comparisons.length > 0) {
      expect(escaped?.incidents?.length).toBe(20);
    }
  });

  test("the never-dropped set survives a binding cap", () => {
    const report = syntheticReport();
    const bounded = boundMetricsReport(report).report;
    expect(bounded.ref).toBe(report.ref);
    expect(bounded.window).toEqual(report.window);
    expect(bounded.alarms).toEqual(report.alarms);
    expect(bounded.alarmEvaluation).toEqual(report.alarmEvaluation);
    expect(bounded.metrics.map((entry) => entry.id)).toEqual(
      report.metrics.map((entry) => entry.id),
    );
    expect(bounded.metrics[0]?.value).toBe(20);
  });

  test("rows drop from the tail: the head is preserved in declared order", () => {
    // A compact report whose byte overflow is small: the comparison tail spends
    // first and the head survives.
    const compact: MetricsReport = {
      ...syntheticReport(),
      comparisons: syntheticReport().comparisons.map((row) => ({
        ...row,
        caveat: "c".repeat(2000),
      })),
      metrics: [],
      dispatch: {
        telemetryState: "present",
        perAgent: Array.from({ length: 20 }, (_, index) => ({
          role: `role-${String(index)}`,
          model: "m".repeat(1300),
          calls: 1,
          tokens: 1,
        })),
        tokensByClass: { input: 20 },
      },
    };
    const bounded = boundMetricsReport(compact).report;
    expect(bounded.truncated).toBe(true);
    expect(bounded.comparisons.length).toBeGreaterThan(0);
    expect(bounded.comparisons[0]?.metricId).toBe("MET-CI-FAILURE-RATE");
    expect(bounded.comparisons.length).toBeLessThan(20);
  });

  test("an under-cap report is untouched and declares no omission", async () => {
    const fixture = makeMetricsCase({ label: "bounds-under" });
    fixtures.push(fixture);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(bytes(data)).toBeLessThanOrEqual(METRICS_MAX_MACHINE_BYTES);
    expect(data.omitted).toBe(0);
    expect(data.truncated).toBe(false);
  });

  test("the bounds are imported from contract constants, not duplicated literals", () => {
    for (const relative of [
      "packages/core/src/domain/metrics.ts",
      "packages/core/src/domain/metrics-text.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      expect(source, relative).not.toContain("65536");
      expect(source, relative).not.toContain("16384");
      expect(source, relative).not.toContain("200");
    }
  });
});

describe("TC-METRICS-104 the row caps are independent of the byte cap", () => {
  test("21 comparisons list 20 with one counted omission; 20 list in full", () => {
    const report = syntheticReport();
    const compactComparisons = report.comparisons.map((row) => ({ ...row, caveat: undefined }));
    const twentyOne: MetricsReport = {
      ...report,
      metrics: [],
      dispatch: { telemetryState: "absent" },
      comparisons: [...compactComparisons, ...compactComparisons].slice(0, 21),
    };
    const bounded = boundMetricsReport(twentyOne);
    expect(bounded.report.comparisons.length).toBe(20);
    expect(bounded.report.omitted).toBe(1);
    const twenty: MetricsReport = { ...twentyOne, comparisons: twentyOne.comparisons.slice(0, 20) };
    expect(boundMetricsReport(twenty).report.omitted).toBe(0);
  });

  test("21 perAgent rows list 20 with one counted omission", () => {
    const report = syntheticReport();
    const agents = Array.from({ length: 21 }, (_, index) => ({
      role: `role-${String(index)}`,
      model: `model-${String(index)}`,
      calls: 1,
      tokens: 1,
    }));
    const bounded = boundMetricsReport({
      ...report,
      metrics: [],
      comparisons: [],
      dispatch: { telemetryState: "present", perAgent: agents, tokensByClass: { input: 21 } },
    }).report;
    expect(bounded.dispatch.perAgent?.length).toBe(20);
    expect(bounded.omitted).toBe(1);
    expect(bounded.truncated).toBe(true);
  });

  test("the measurement totals are unaffected by the display caps", () => {
    const report = syntheticReport();
    const bounded = boundMetricsReport(report).report;
    const escaped = bounded.metrics.find((entry) => entry.id === "escaped-defects");
    expect(escaped?.value).toBe(20);
    expect(escaped?.sample.n).toBe(20);
  });

  test("the human digest stays inside the declared line and byte bounds", async () => {
    const fixture = makeMetricsCase({ label: "bounds-human" });
    fixtures.push(fixture);
    const human = await runMetrics(fixture, ["metrics"]);
    const lines = human.human.split("\n");
    expect(lines.length).toBeLessThanOrEqual(METRICS_MAX_HUMAN_LINES);
    expect(Buffer.byteLength(human.human, "utf8")).toBeLessThanOrEqual(METRICS_MAX_HUMAN_BYTES);
  });

  test("the human render prints the counted shortfall consistently", async () => {
    const fixture = makeMetricsFixture({ label: "bounds-human-omitted", activeRef: METRICS_REF });
    fixtures.push(fixture);
    fixture.setConfig(burnRateConfig());
    seedHistory(fixture.store, METRICS_REF, completeHistory());
    seedTelemetry(fixture.store, [
      stepOf({
        ref: METRICS_REF,
        runId: "run-bounds",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 10 }),
        cost: 1,
        capturedAt: new Date(METRICS_NOW_MS - DAY_MS).toISOString(),
      }),
    ]);
    const human = (await runMetrics(fixture, ["metrics"])).human;
    expect(human).toContain("omitted=0 truncated=false");
  });
});

describe("TC-METRICS-063/104 the incidents row cap counts its omissions", () => {
  const at = (daysAgo: number): string => new Date(METRICS_NOW_MS - daysAgo * DAY_MS).toISOString();

  const incidentCase = (count: number): MetricsFixture => {
    const rows: EvidenceInput[] = Array.from({ length: count }, (_, index) => ({
      path: `doc/changes/2026-11/x/review/incident-${String(index)}.md`,
      anchor: `INCIDENT-${String(index)}`,
      class: "post-gate-review" as const,
      observedAt: at((index % 10) + 1),
      ref: METRICS_REF,
    }));
    const fixture = makeMetricsCase({ label: `bounds-incidents-${String(count)}`, evidence: rows });
    fixtures.push(fixture);
    for (let index = 0; index < count; index += 1) {
      fixture.project.set(
        `doc/changes/2026-11/x/review/incident-${String(index)}.md`,
        `INCIDENT-${String(index)} cited\n`,
      );
    }
    return fixture;
  };

  test("two, eight, and eleven incidents render 2, 8, and 8 rows with counted drops", async () => {
    const expectations: readonly (readonly [number, number, number, boolean])[] = [
      [2, 2, 0, false],
      [8, 8, 0, false],
      [11, 8, 3, true],
    ];
    for (const [count, rows, omitted, truncated] of expectations) {
      const fixture = incidentCase(count);
      const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
      expect(data.omitted, `count ${String(count)}`).toBe(omitted);
      expect(data.truncated, `count ${String(count)}`).toBe(truncated);
      const entry = (data.metrics as readonly Record<string, unknown>[]).find(
        (candidate) => candidate.id === "escaped-defects",
      );
      const incidents = entry?.incidents;
      expect(Array.isArray(incidents) ? incidents.length : 0).toBe(rows);
      expect(entry?.value).toBe(count);
    }
  });

  test("the dropped incidents are not counted twice and the total is untouched", async () => {
    const fixture = incidentCase(11);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(data.omitted).toBe(3);
    const entry = (data.metrics as readonly Record<string, unknown>[]).find(
      (candidate) => candidate.id === "escaped-defects",
    );
    const sample = (entry?.sample ?? {}) as Record<string, number>;
    expect(sample.n).toBe(11);
    expect((await runMetrics(fixture, ["metrics"])).human).toContain("truncated");
  });
});
