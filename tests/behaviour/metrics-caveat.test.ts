/**
 * TC-METRICS-026 — the proxy-vs-native caveat is present exactly on cross-kind
 * comparisons and absent on same-kind rows, in both surfaces.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { METRICS_PROXY_NATIVE_CAVEAT } from "../../packages/core/src/contracts/index";
import { baselineDocument, CEREMONY_ROW, CI_ROW, CYCLE_ROW } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { entriesById, type MetricsFixture, runMetrics } from "../fixtures/metrics/harness";

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

const rowsById = (
  data: Record<string, unknown>,
): Readonly<Record<string, Record<string, unknown>>> => {
  const rows = (data.comparisons ?? []) as readonly Record<string, unknown>[];
  const byId: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const id = row.metricId;
    if (typeof id === "string") byId[id] = row;
  }
  return byId;
};

describe("TC-METRICS-026 the caveat follows the kind difference, not the metric", () => {
  test("the proxy-before/native-after rows carry the caveat on the row and the entry", async () => {
    const data = await report(makeMetricsCase({ label: "caveat-cross" }));
    const rows = rowsById(data);
    const entries = entriesById(data);
    for (const id of ["MET-CEREMONY-SHARE", "MET-CYCLE-TIME"]) {
      expect(rows[id]?.caveat).toBe(METRICS_PROXY_NATIVE_CAVEAT);
      expect(entries[id]?.caveat).toBe(METRICS_PROXY_NATIVE_CAVEAT);
    }
  });

  test("the same-kind CI row carries no caveat member at all", async () => {
    const data = await report(makeMetricsCase({ label: "caveat-same" }));
    const rows = rowsById(data);
    const entries = entriesById(data);
    expect(rows["MET-CI-FAILURE-RATE"]).toBeDefined();
    expect(Object.hasOwn(rows["MET-CI-FAILURE-RATE"] ?? {}, "caveat")).toBe(false);
    expect(Object.hasOwn(entries["MET-CI-FAILURE-RATE"] ?? {}, "caveat")).toBe(false);
  });

  test("the caveat text names both bases and claims no interchangeability", () => {
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("committed pm-notes proxy basis");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("native source");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("not interchangeable");
    expect(METRICS_PROXY_NATIVE_CAVEAT).toContain("no trend is claimed");
  });

  test("a native/native twin carries no caveat, so the rule keys on kind difference", async () => {
    const data = await report(
      makeMetricsCase({
        label: "caveat-native-native",
        baseline: baselineDocument({
          rows: [CEREMONY_ROW, { ...CYCLE_ROW, measurementKind: "native" }, CI_ROW],
        }),
      }),
    );
    const rows = rowsById(data);
    expect(Object.hasOwn(rows["MET-CYCLE-TIME"] ?? {}, "caveat")).toBe(false);
  });

  test("the human render carries the caveat on exactly the same rows", async () => {
    const fixture = makeMetricsCase({ label: "caveat-human" });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics"]);
    expect(run.exitCode).toBe(0);
    const caveatLines = run.human
      .split("\n")
      .filter((line) => line.trimStart().startsWith("caveat:"));
    expect(caveatLines.length).toBe(2);
    for (const line of caveatLines) expect(line).toContain("not interchangeable");
    const comparisonCaveats = run.human.split("\n").filter((line) => line.includes("[caveat:"));
    expect(comparisonCaveats.length).toBe(2);
  });
});
