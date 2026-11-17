/**
 * TC-METRICS-106 — the declared read budget is a counted fact: at most one
 * verified read per source, no reads beyond the declared sources, the same
 * counts on a repeat, and a printed latency reference that is never asserted.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import {
  DAY_MS,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";
import { seedTelemetry, stepOf, tokens } from "../fixtures/metrics/telemetry";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

describe("TC-METRICS-106 the read budget holds", () => {
  test("one verified store read pass and at most one read per declared document", async () => {
    const fixture = makeMetricsCase({ label: "read-budget" });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    const storeReads = fixture.reads.storeReads;
    // One pass per declared source (telemetry families, transitions, economics,
    // ceremony); no pass scales with the record population.
    expect(storeReads.filter((entry) => entry === "readRecords").length).toBeLessThanOrEqual(6);
    const configReads = fixture.reads.documentReads.filter((path) =>
      path.endsWith(".example-product/config.yaml"),
    );
    const logReads = fixture.reads.documentReads.filter((path) =>
      path.endsWith("measurement-baseline.yaml"),
    );
    expect(configReads.length).toBe(1);
    expect(logReads.length).toBe(1);
    expect(
      fixture.reads.documentReads.filter((path) => path.includes("chg-GH-299-pm-notes.yaml"))
        .length,
    ).toBe(1);
    // The corpus scan reads only committed documents under the changes tree.
    for (const path of fixture.reads.documentReads) {
      expect(path.startsWith("tmp/") || path.startsWith(".ai/local/")).toBe(false);
    }
  });

  test("a second invocation performs exactly the same counts", async () => {
    const fixture = makeMetricsCase({ label: "read-budget-repeat" });
    fixtures.push(fixture);
    await runMetrics(fixture, ["metrics", "--json"]);
    const first = {
      store: [...fixture.reads.storeReads],
      documents: [...fixture.reads.documentReads],
    };
    fixture.reads.storeReads.length = 0;
    fixture.reads.documentReads.length = 0;
    await runMetrics(fixture, ["metrics", "--json"]);
    expect(fixture.reads.storeReads).toEqual(first.store);
    expect(fixture.reads.documentReads).toEqual(first.documents);
  });

  test("the budget does not scale with the record population (printed reference only)", async () => {
    const seed = (count: number): MetricsFixture => {
      const fixture = makeMetricsCase({ label: `read-cost-${String(count)}`, steps: [] });
      fixtures.push(fixture);
      const steps = Array.from({ length: count }, (_, index) =>
        stepOf({
          ref: METRICS_REF,
          runId: `run-cost-${String(index % 25)}`,
          agentRole: "coder",
          model: "model-alpha",
          tokens: tokens({ input: 1 }),
          cost: 0.001,
          capturedAt: new Date(METRICS_NOW_MS - DAY_MS).toISOString(),
        }),
      );
      seedTelemetry(fixture.store, steps);
      return fixture;
    };
    const small = seed(50);
    const large = seed(250);
    const measure = async (fixture: MetricsFixture): Promise<number> => {
      const started = performance.now();
      expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(0);
      return performance.now() - started;
    };
    const smallMs = await measure(small);
    const largeMs = await measure(large);
    // Reference only: never asserted as a timing gate.
    process.stdout.write(
      `metrics read-cost reference: 50 records ${smallMs.toFixed(1)}ms; 250 records ${largeMs.toFixed(1)}ms\n`,
    );
    expect(small.reads.storeReads.filter((entry) => entry === "readRecords").length).toBe(
      large.reads.storeReads.filter((entry) => entry === "readRecords").length,
    );
    expect(small.reads.documentReads).toEqual(large.reads.documentReads);
  });
});
