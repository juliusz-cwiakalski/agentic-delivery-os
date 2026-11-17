/**
 * TC-METRICS-071 — store damage on any read keeps the delivered `state.*`
 * identity with its own projection and is never re-projected as absence.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { MetricsCommandRuntime } from "../../packages/core/src/contracts/index";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
  runWithRuntime,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const damagedRuntime = (code: string): MetricsCommandRuntime => ({
  resolveActiveRef: () => ({ ref: METRICS_REF }),
  report: () => ({
    ok: false,
    error: {
      kind: "state",
      code: code as "state.store.torn",
      consequence: "not_landed",
      location: { path: "state store", record: 7 },
    },
  }),
});

describe("TC-METRICS-071 damage keeps the delivered state identities", () => {
  const codes = [
    "state.store.torn",
    "state.schema.mismatch",
    "state.keys.missing",
    "state.permission.denied",
    "state.lock.busy",
    "state.storage.exhausted",
    "state.store.unknown",
  ] as const;

  for (const code of codes) {
    test(`${code} surfaces with its own projection and no absence classification`, async () => {
      const run = await runWithRuntime(damagedRuntime(code), ["metrics", "--json"]);
      expect(run.envelope?.error?.code).toBe(code);
      expect(run.envelope?.data).toBeUndefined();
      expect(run.envelope?.error?.consequence).toBe("not_landed");
      const exit = run.exitCode;
      // The delivered projection classes are unchanged: permission denied is a
      // user-validation row at exit 1; the platform rows project exit 2.
      expect(exit, code).toBe(code === "state.permission.denied" ? 1 : 2);
      expect(JSON.stringify(run.envelope)).not.toContain("telemetry-absent");
      expect(JSON.stringify(run.envelope)).not.toContain("row-absent");
      expect(JSON.stringify(run.envelope)).not.toContain("metrics.baseline-unreadable");
    });
  }

  test("a torn telemetry store on the real read path is not absence", async () => {
    const fixture = makeMetricsCase({ label: "torn-store" });
    fixtures.push(fixture);
    const before = fixture.snapshot();
    // A verified-empty read is absence; a torn read is damage. Simulate the
    // torn ledger by appending an unknown record kind the boundary rejects.
    const broken = makeMetricsFixture({ label: "torn-store-direct", activeRef: METRICS_REF });
    fixtures.push(broken);
    broken.setConfig(burnRateConfig());
    broken.setBaseline(fullBaseline());
    const torn: MetricsCommandRuntime = {
      resolveActiveRef: () => ({ ref: METRICS_REF }),
      report: () => {
        const read = fixture.runtime.report({ ref: METRICS_REF });
        if (!read.ok) return read;
        return {
          ok: false,
          error: {
            kind: "state",
            code: "state.store.torn",
            consequence: "not_landed",
            location: { path: "state store", record: 2 },
          },
        };
      },
    };
    const run = await runWithRuntime(torn, ["metrics", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(run.envelope?.error?.code).toBe("state.store.torn");
    expect(fixture.snapshot()).toBe(before);
  });

  test("a readable twin renders normally, so the damage is attributable to the store", async () => {
    const fixture = makeMetricsCase({ label: "damage-twin" });
    fixtures.push(fixture);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect((data.dispatch as { telemetryState: string }).telemetryState).toBe("present");
    expect((data.metrics as readonly unknown[]).length).toBe(4);
  });
});
