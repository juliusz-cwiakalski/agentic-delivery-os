/**
 * TC-METRICS-012 / TC-METRICS-056 — read-only discipline as a byte fact: no
 * invocation path edits, appends to, fences, or rewrites any read source.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import { documentText, type MetricsFixture, runMetrics } from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const baselinePath = "doc/planning/oss-tooling/measurement-baseline.yaml";
const configPath = ".example-product/config.yaml";

describe("TC-METRICS-012 the read sources stay byte-identical", () => {
  test("every invocation path leaves the log, the config, and the corpus unchanged", async () => {
    const fixture = makeMetricsCase({ label: "write-discipline" });
    fixtures.push(fixture);
    const before = {
      snapshot: fixture.snapshot(),
      baseline: documentText(fixture, baselinePath),
      config: documentText(fixture, configPath),
    };
    // Success, repeat, value refusal, and node defect in sequence.
    expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(0);
    expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(0);
    expect((await runMetrics(fixture, ["metrics", "--ref", "gh-299", "--json"])).exitCode).toBe(1);
    fixture.setConfig(burnRateConfig({ threshold: 0 }));
    expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(1);
    fixture.setConfig(burnRateConfig());
    expect(documentText(fixture, baselinePath)).toBe(before.baseline);
    expect(documentText(fixture, configPath)).toBe(before.config);
    expect(fixture.snapshot()).toBe(before.snapshot);
  });

  test("no fence, append, salvage, or write member is called on the store", async () => {
    const fixture = makeMetricsCase({ label: "write-discipline-counters" });
    fixtures.push(fixture);
    await runMetrics(fixture, ["metrics", "--json"]);
    for (const member of ["acquireFence", "append", "releaseFence", "salvage"]) {
      expect(fixture.reads.storeReads.filter((entry) => entry === member)).toEqual([]);
    }
  });

  test("a committed comparison record is neither edited nor appended to", async () => {
    const fixture = makeMetricsCase({ label: "write-discipline-record" });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    const log = documentText(fixture, baselinePath);
    expect(log).toContain("comparisons: []");
    expect(log.split("comparisons:").length - 1).toBe(1);
  });

  test("the outputs claim no write about any source", async () => {
    const fixture = makeMetricsCase({ label: "write-discipline-claims" });
    fixtures.push(fixture);
    const machine = await runMetrics(fixture, ["metrics", "--json"]);
    const human = await runMetrics(fixture, ["metrics"]);
    for (const text of [machine.stdout, human.stdout]) {
      const lower = text.toLowerCase();
      expect(lower).not.toContain("written");
      expect(lower).not.toContain("updated");
      expect(lower).not.toContain("appended");
    }
  });
});

describe("TC-METRICS-056 the alarm path writes no state", () => {
  test("a crossing evaluation and its repeat leave the store and documents byte-identical", async () => {
    const fixture = makeMetricsCase({
      label: "alarm-write-discipline",
      config: burnRateConfig({ threshold: 1000, basis: "tokens", window: "14d" }),
    });
    fixtures.push(fixture);
    const before = fixture.snapshot();
    const first = await runMetrics(fixture, ["metrics", "--json"]);
    const second = await runMetrics(fixture, ["metrics", "--json"]);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(fixture.snapshot()).toBe(before);
    for (const member of ["append", "acquireFence", "salvage"]) {
      expect(fixture.reads.storeReads.filter((entry) => entry === member)).toEqual([]);
    }
    expect((JSON.parse(first.stdout) as { data: { alarms: unknown[] } }).data.alarms).toHaveLength(
      1,
    );
    expect((JSON.parse(second.stdout) as { data: { alarms: unknown[] } }).data.alarms).toHaveLength(
      1,
    );
  });
});
