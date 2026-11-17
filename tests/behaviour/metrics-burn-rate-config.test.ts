/**
 * TC-METRICS-054 — every `metrics.burn-rate` defect class is refused
 * `config.value.invalid` at exit 1 before any telemetry, log, ceremony,
 * transition, or corpus read; the boundary values are accepted.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig, defectConfigs } from "../fixtures/metrics/config";
import {
  documentText,
  type MetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const CONFIG_PATH = ".example-product/config.yaml";

describe("TC-METRICS-054 every defective node is refused before any read", () => {
  for (const [label, document] of Object.entries(defectConfigs())) {
    test(`${label} is config.value.invalid with only the config read performed`, async () => {
      const fixture = makeMetricsCase({ label: `node-${label}`, config: document });
      fixtures.push(fixture);
      const before = documentText(fixture, CONFIG_PATH);
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error?.code).toBe("config.value.invalid");
      expect(run.envelope?.error?.category).toBe("user");
      expect(run.envelope?.error?.consequence).toBe("not_landed");
      expect(run.envelope?.data).toBeUndefined();
      expect(fixture.reads.storeReads).toEqual([]);
      expect(fixture.reads.documentReads).toEqual([CONFIG_PATH]);
      expect(JSON.stringify(run.envelope)).not.toContain("metrics.baseline-unreadable");
      expect(JSON.stringify(run.envelope)).not.toContain("state.");
      expect(documentText(fixture, CONFIG_PATH)).toBe(before);
    });
  }

  test("a non-mapping node is the same refusal", async () => {
    const fixture = makeMetricsCase({
      label: "node-non-mapping",
      config: "metrics:\n  burn-rate: 'declared'\n",
    });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(run.envelope?.error?.code).toBe("config.value.invalid");
  });

  test("the boundary values are accepted at exit 0", async () => {
    for (const input of [
      { threshold: 0.01, basis: "cost", window: "1d" },
      { threshold: 1000, basis: "tokens", window: "90d" },
    ]) {
      const fixture = makeMetricsCase({
        label: `node-limit-${input.window}`,
        config: burnRateConfig(input),
      });
      fixtures.push(fixture);
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      expect(run.exitCode, JSON.stringify(input)).toBe(0);
      expect(reportOf(run).alarmEvaluation).toMatchObject({ status: "evaluated" });
    }
  });

  test("an unknown extra member is tolerated and the document without the node is unchanged", async () => {
    const tolerated = makeMetricsCase({
      label: "node-extra",
      config: burnRateConfig({ extra: { note: "declared" } }),
    });
    fixtures.push(tolerated);
    expect((await runMetrics(tolerated, ["metrics", "--json"])).exitCode).toBe(0);
    const absent = makeMetricsCase({
      label: "node-absent",
      omitConfig: true,
    });
    fixtures.push(absent);
    const absentRun = await runMetrics(absent, ["metrics", "--json"]);
    expect(absentRun.exitCode).toBe(0);
    expect((reportOf(absentRun).alarmEvaluation as { status: string }).status).toBe(
      "threshold-undeclared",
    );
  });
});
