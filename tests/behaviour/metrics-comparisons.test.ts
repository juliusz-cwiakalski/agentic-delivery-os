/**
 * TC-METRICS-030/031/032/033 — the comparison view under the committed
 * protocol: full row attribution, the sample minimum at exactly five, the
 * declared ordering, and authored comparison records consumed as data only.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  baselineDocument,
  CEREMONY_ROW,
  CI_ROW,
  CYCLE_ROW,
  committedComparisonBaseline,
  fullBaseline,
  monthsLongWindowBaseline,
  partialBaseline,
} from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import {
  DAY_MS,
  METRICS_NOW_MS,
  type MetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";
import { completeHistory } from "../fixtures/metrics/transitions";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const report = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  fixtures.push(fixture);
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return run.envelope?.data as Record<string, unknown>;
};

const rows = (data: Record<string, unknown>): readonly Record<string, unknown>[] =>
  (data.comparisons ?? []) as readonly Record<string, unknown>[];

const nested = (row: Record<string, unknown> | undefined, key: string, inner: string): unknown => {
  const side = row?.[key];
  if (typeof side !== "object" || side === null) return undefined;
  return (side as Record<string, unknown>)[inner];
};

const ciRows = (count: number, failed: number) =>
  Array.from({ length: count }, (_, index) => ({
    ref: `GH-${String(index + 1)}`,
    observed: true,
    outcome: index < failed ? ("red" as const) : ("green" as const),
    observedAt: new Date(METRICS_NOW_MS - (index + 1) * DAY_MS).toISOString(),
  }));

describe("TC-METRICS-030 the row carries every declared member", () => {
  test("the row key set is the declared DM-5 set", async () => {
    const data = await report(makeMetricsCase({ label: "comparison-shape" }));
    for (const row of rows(data)) {
      const expected = [
        "after",
        "before",
        "definitionRef",
        "metricId",
        "sampleMinimum",
        "verdict",
        ...(Object.hasOwn(row, "caveat") ? ["caveat"] : []),
      ];
      expect(Object.keys(row).sort()).toEqual(expected.sort());
      expect(row.sampleMinimum).toBe(5);
    }
  });

  test("before comes from the log text and after from the live window", async () => {
    const data = await report(makeMetricsCase({ label: "comparison-inputs", ci: ciRows(5, 1) }));
    const ci = rows(data).find((row) => row.metricId === "MET-CI-FAILURE-RATE");
    expect(ci?.definitionRef).toEqual({
      logPath: "doc/planning/oss-tooling/measurement-baseline.yaml",
      sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
    });
    expect(ci?.before).toMatchObject({
      value: 0.25,
      window: { start: "2026-02-01T00:00:00Z", end: "2026-10-31T23:59:59Z" },
      basis: "session_proxy",
      measurementKind: "proxy",
      status: "PARTIAL",
    });
    const after = ci?.after as Record<string, unknown>;
    expect(after.sampleSize).toBe(5);
    expect(after.window).toEqual(data.window as unknown);
    expect(after.measurementKind).toBe("proxy");
    expect(after.status).toBe("PARTIAL");
  });

  test("the ordering follows the vocabulary, not the log row order", async () => {
    const shuffled = await report(
      makeMetricsCase({
        label: "comparison-order",
        baseline: baselineDocument({ rows: [CI_ROW, CYCLE_ROW, CEREMONY_ROW] }),
      }),
    );
    expect(rows(shuffled).map((row) => row.metricId)).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
    ]);
  });
});

describe("TC-METRICS-031 the sample minimum is exactly five", () => {
  test("four observations yield insufficient-sample and no trend claim anywhere", async () => {
    const fixture = makeMetricsCase({ label: "minimum-4", ci: ciRows(5, 1).slice(0, 4) });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = run.envelope?.data as Record<string, unknown>;
    const ci = rows(data).find((row) => row.metricId === "MET-CI-FAILURE-RATE");
    expect(ci?.verdict).toBe("insufficient-sample");
    expect(nested(ci, "after", "sampleSize")).toBe(4);
    for (const row of rows(data)) {
      expect(row.verdict).not.toBe("improved");
      expect(row.verdict).not.toBe("regressed");
    }
    const human = await runMetrics(fixture, ["metrics"]);
    for (const token of ["verdict=improved", "verdict=regressed", "trend:"]) {
      expect(human.human.toLowerCase()).not.toContain(token);
    }
  });

  test("five observations compare against the before value and the direction", async () => {
    const data = await report(makeMetricsCase({ label: "minimum-5", ci: ciRows(5, 1) }));
    const ci = rows(data).find((row) => row.metricId === "MET-CI-FAILURE-RATE");
    // 1/5 = 0.2 is lower than the committed 0.25 and lower is better.
    expect(ci?.verdict).toBe("improved");
    expect(Number(nested(ci, "after", "value"))).toBeCloseTo(0.2, 12);
  });

  test("six observations with a higher ratio regress and an equal ratio is flat", async () => {
    const regressed = await report(makeMetricsCase({ label: "minimum-6", ci: ciRows(6, 3) }));
    expect(rows(regressed).find((row) => row.metricId === "MET-CI-FAILURE-RATE")?.verdict).toBe(
      "regressed",
    );
    const flat = await report(
      makeMetricsCase({
        label: "flat",
        ci: ciRows(8, 2),
      }),
    );
    // 2/8 = 0.25 equals the committed value.
    expect(rows(flat).find((row) => row.metricId === "MET-CI-FAILURE-RATE")?.verdict).toBe("flat");
  });

  test("a below-minimum row still carries the cross-kind caveat", async () => {
    const data = await report(makeMetricsCase({ label: "minimum-caveat", history: [] }));
    const cycle = rows(data).find((row) => row.metricId === "MET-CYCLE-TIME");
    expect(cycle?.verdict).toBe("not-established");
    expect(cycle?.caveat).toContain("not interchangeable");
  });
});

describe("TC-METRICS-032 not-established, verbatim windows, and the untouched log", () => {
  test("an unmeasurable after-sample is not-established and not omitted", async () => {
    const data = await report(makeMetricsCase({ label: "not-established", history: [] }));
    const cycle = rows(data).find((row) => row.metricId === "MET-CYCLE-TIME");
    expect(cycle?.verdict).toBe("not-established");
    expect(nested(cycle, "after", "value")).toBeUndefined();
    expect(nested(cycle, "after", "sampleSize")).toBe(0);
    expect(data.omitted).toBe(0);
  });

  test("the months-long committed window is carried verbatim with no refusal", async () => {
    const data = await report(
      makeMetricsCase({ label: "months-window", baseline: monthsLongWindowBaseline() }),
    );
    const ceremony = rows(data).find((row) => row.metricId === "MET-CEREMONY-SHARE");
    expect((ceremony?.before as { window: unknown } | undefined)?.window).toEqual({
      start: "2025-01-01T00:00:00Z",
      end: "2026-10-31T23:59:59Z",
    });
    expect(ceremony?.verdict).not.toBe("not-established");
  });

  test("the log stays byte-identical and its comparison list is untouched", async () => {
    const fixture = makeMetricsCase({
      label: "comparison-bytes",
      baseline: committedComparisonBaseline(),
    });
    fixtures.push(fixture);
    const before = fixture.snapshot();
    expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(0);
    expect(fixture.snapshot()).toBe(before);
    expect(fullBaseline().split("comparisons:").length - 1).toBe(1);
    expect(partialBaseline("MET-CYCLE-TIME").length).toBeGreaterThan(0);
    expect(completeHistory().length).toBeGreaterThan(0);
  });
});

describe("TC-METRICS-033 a committed comparison record is consumed as data only", () => {
  test("the live verdict follows the evidence, not the authored record", async () => {
    const data = await report(
      makeMetricsCase({
        label: "committed-record",
        baseline: committedComparisonBaseline(),
        ci: ciRows(5, 1),
      }),
    );
    const ceremony = rows(data).find((row) => row.metricId === "MET-CEREMONY-SHARE");
    // The authored record says regressed; the live evidence shows no trend below
    // the minimum, so the row is insufficient-sample.
    expect(ceremony?.verdict).toBe("insufficient-sample");
    expect(JSON.stringify(data)).not.toContain("DISTINCTIVE-COMMITTED-COMPARISON-DISCLOSURE");
  });

  test("the report writes nothing and cites the log path plus commit", async () => {
    const fixture = makeMetricsCase({
      label: "committed-record-bytes",
      baseline: committedComparisonBaseline(),
    });
    fixtures.push(fixture);
    const before = fixture.snapshot();
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(fixture.snapshot()).toBe(before);
    for (const row of rows(run.envelope?.data as Record<string, unknown>)) {
      expect((row.definitionRef as { logPath: string }).logPath).toBe(
        "doc/planning/oss-tooling/measurement-baseline.yaml",
      );
    }
    expect(fixture.reads.storeReads.filter((entry) => entry === "append")).toEqual([]);
  });
});
