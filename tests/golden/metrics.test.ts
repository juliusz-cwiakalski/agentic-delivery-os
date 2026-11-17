/**
 * TC-METRICS-101 (golden half) and the golden cells of TC-METRICS-001/050/052/
 * 053/055 — every declared form renders the committed bytes, and regeneration
 * is an explicit reviewed command.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { belowThresholdMatrix, crossingMatrix } from "../fixtures/metrics/alarms";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import { DAY_MS, METRICS_NOW_MS, METRICS_REF, runMetrics } from "../fixtures/metrics/harness";

const GOLDEN = join(process.cwd(), "tests/fixtures/metrics/golden");
const CAPTURED_AT = new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString();

const golden = (name: string): string => readFileSync(join(GOLDEN, name), "utf8");

describe("the metrics goldens are committed bytes", () => {
  test("the bare human digest and machine data match their goldens", async () => {
    const fixture = makeMetricsCase({ label: "golden-bare-check" });
    const human = await runMetrics(fixture, ["metrics"]);
    const machine = await runMetrics(fixture, ["metrics", "--json"]);
    expect(human.human).toBe(golden("bare.txt"));
    expect(`${JSON.stringify(machine.envelope?.data, null, 2)}\n`).toBe(golden("bare.json"));
    fixture.dispose();
  });

  test("the crossing form matches its golden", async () => {
    const crossing = crossingMatrix(METRICS_REF, CAPTURED_AT);
    const fixture = makeMetricsCase({
      label: "golden-crossing-check",
      steps: crossing.steps,
      config: burnRateConfig(crossing.config),
    });
    expect((await runMetrics(fixture, ["metrics"])).human).toBe(golden("crossing.txt"));
    fixture.dispose();
  });

  test("the below-threshold form matches its golden", async () => {
    const below = belowThresholdMatrix(METRICS_REF, CAPTURED_AT);
    const fixture = makeMetricsCase({
      label: "golden-below-check",
      steps: below.steps,
      config: burnRateConfig(below.config),
    });
    expect((await runMetrics(fixture, ["metrics"])).human).toBe(golden("below-threshold.txt"));
    fixture.dispose();
  });

  test("the telemetry-absent form matches its golden", async () => {
    const fixture = makeMetricsCase({ label: "golden-absent-check", steps: [] });
    expect((await runMetrics(fixture, ["metrics"])).human).toBe(golden("telemetry-absent.txt"));
    fixture.dispose();
  });

  test("the undeclared-threshold and insufficient-sample forms match their goldens", async () => {
    const undeclared = makeMetricsCase({ label: "golden-undeclared-check", steps: [] });
    undeclared.removeConfig();
    expect((await runMetrics(undeclared, ["metrics"])).human).toBe(
      golden("undeclared-threshold.txt"),
    );
    undeclared.dispose();
    const insufficient = makeMetricsCase({
      label: "golden-insufficient-check",
      steps: [],
      ci: [
        {
          ref: "GH-1",
          observed: true,
          outcome: "red",
          observedAt: new Date(METRICS_NOW_MS - DAY_MS).toISOString(),
        },
      ],
    });
    expect((await runMetrics(insufficient, ["metrics"])).human).toBe(
      golden("insufficient-sample.txt"),
    );
    insufficient.dispose();
  });

  test("the regeneration script exists as the explicit reviewed command", () => {
    const script = readFileSync(join(GOLDEN, "regenerate.ts"), "utf8");
    expect(script).toContain("export const regenerate");
    expect(script).toContain("import.meta.main");
  });
});
