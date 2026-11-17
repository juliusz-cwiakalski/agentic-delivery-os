/**
 * TC-METRICS-005 / TC-METRICS-006 — one payload identity under the untouched
 * five-field envelope on every exit form, the drawn window arithmetic, and the
 * inclusive bounds derived from the injected clock.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  METRICS_DATA_SCHEMA_ID,
  type MetricsCommandRuntime,
} from "../../packages/core/src/contracts/index";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  DAY_MS,
  drawnWindow,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  runMetrics,
  runWithRuntime,
} from "../fixtures/metrics/harness";
import { fullyAttributableSteps, seedTelemetry } from "../fixtures/metrics/telemetry";
import { completeHistory, seedHistory } from "../fixtures/metrics/transitions";

const ROOT = process.cwd();
const fixtures: MetricsFixture[] = [];

const fullFixture = (label = "envelope"): MetricsFixture => {
  const fixture = makeMetricsFixture({ label, activeRef: METRICS_REF });
  fixture.setConfig(burnRateConfig());
  fixture.setBaseline(fullBaseline());
  seedTelemetry(
    fixture.store,
    fullyAttributableSteps({
      ref: METRICS_REF,
      capturedAt: new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString(),
    }),
  );
  seedHistory(fixture.store, METRICS_REF, completeHistory());
  fixtures.push(fixture);
  return fixture;
};

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const expectedEnvelopeKeys = (kind: "data" | "error"): readonly string[] =>
  ["schemaVersion", "runId", "exitCode", "timing", kind].sort();

describe("TC-METRICS-005 one identity under the untouched five-field envelope", () => {
  test("the success cell carries the five envelope fields and only data below them", async () => {
    const run = await runMetrics(fullFixture(), ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(Object.keys(run.envelope ?? {}).sort()).toEqual(expectedEnvelopeKeys("data"));
    expect(run.envelope?.data).toBeDefined();
    expect(run.stdout).not.toContain('"ok"');
    expect(run.stdout).not.toContain('"command"');
  });

  test("the value and grammar refusals carry the error field only", async () => {
    for (const argv of [
      ["metrics", "--ref", "gh-299", "--json"],
      ["metrics", "history", "--json"],
    ]) {
      const run = await runMetrics(fullFixture(), argv);
      expect(Object.keys(run.envelope ?? {}).sort()).toEqual(expectedEnvelopeKeys("error"));
      expect(run.envelope?.data).toBeUndefined();
      expect(run.stdout).not.toContain('"ok"');
      expect(run.stdout).not.toContain('"command"');
    }
  });

  test("the damaged-baseline cell is metrics.baseline-unreadable at exit 2", async () => {
    const fixture = fullFixture();
    fixture.setBaseline("schema_version: 2\nsource_commit: \nmetrics: []\n");
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(run.envelope?.error?.code).toBe("metrics.baseline-unreadable");
    expect(Object.keys(run.envelope ?? {}).sort()).toEqual(expectedEnvelopeKeys("error"));
  });

  test("the node-defect cell is config.value.invalid at exit 1", async () => {
    const fixture = fullFixture();
    fixture.setConfig(burnRateConfig({ threshold: 0 }));
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(run.envelope?.error?.code).toBe("config.value.invalid");
  });

  test("the store-damage cell keeps the delivered state identity at exit 2", async () => {
    const runtime: MetricsCommandRuntime = {
      resolveActiveRef: () => ({ ref: METRICS_REF }),
      report: () => ({
        ok: false,
        error: {
          kind: "state",
          code: "state.store.torn",
          consequence: "not_landed",
          location: { path: "store", record: 3 },
        },
      }),
    };
    const run = await runWithRuntime(runtime, ["metrics", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(run.envelope?.error?.code).toBe("state.store.torn");
    expect(run.envelope?.data).toBeUndefined();
  });

  test("the payload identity is a contract constant, never a CLI literal or data key", () => {
    expect(METRICS_DATA_SCHEMA_ID).toBe("delivery.metrics.v1");
    const cli = readFileSync(join(ROOT, "packages/cli/src/commands/metrics.ts"), "utf8");
    expect(cli).not.toContain("delivery.metrics.v1");
    const contracts = readFileSync(join(ROOT, "packages/core/src/contracts/metrics.ts"), "utf8");
    expect(contracts.split('"delivery.metrics.v1"').length - 1).toBe(1);
  });
});

describe("TC-METRICS-006 the drawn window and inclusive bounds", () => {
  test("the bare report draws exactly the trailing 30 days from the injected clock", async () => {
    const fixture = fullFixture();
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.envelope?.data?.window).toEqual(drawnWindow(fixture.nowMs));
  });

  test("advancing the injected clock moves the window by the same delta", async () => {
    const fixture = fullFixture();
    const first = await runMetrics(fixture, ["metrics", "--json"]);
    fixture.setNow(fixture.nowMs + 36 * 3_600_000);
    const second = await runMetrics(fixture, ["metrics", "--json"]);
    const before = first.envelope?.data?.window as { from: string; through: string };
    const after = second.envelope?.data?.window as { from: string; through: string };
    expect(Date.parse(after.through) - Date.parse(before.through)).toBe(36 * 3_600_000);
    expect(Date.parse(after.from) - Date.parse(before.from)).toBe(36 * 3_600_000);
  });

  test("the window is disclosed on the windowed entry evidence and the comparison rows", async () => {
    const fixture = fullFixture();
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = run.envelope?.data as Record<string, unknown>;
    const comparisons = data.comparisons as readonly Record<string, unknown>[];
    expect(comparisons.length).toBeGreaterThan(0);
    for (const row of comparisons) {
      const after = row.after as { window: { from: string; through: string } };
      expect(after.window).toEqual(drawnWindow(fixture.nowMs));
    }
  });
});
