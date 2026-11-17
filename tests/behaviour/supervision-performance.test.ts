/**
 * TC-SUP-083 — a full run at the 200-lane cap completes under the spec's 5,000 ms
 * bound, offline, with the population proven in the same test (GH-295 NFR-5).
 */
import { describe, expect, test } from "bun:test";
import { runSupervisionBattery } from "../../packages/core/src/app/index";
import { syntheticReadPort } from "../fixtures/supervise/harness";
import { cappedScope } from "../fixtures/supervise/records";

const LATENCY_BOUND_MS = 5_000;

describe("TC-SUP-083 the 200-lane run stays under the declared bound", () => {
  test("two measured runs fold 200 lanes each within 5,000 ms", () => {
    const measurements: number[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reads = { count: 0 };
      const started = performance.now();
      const result = runSupervisionBattery({
        repository: "github.com/example/supervision-repo",
        nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
        nowIso: "2026-11-17T00:00:00.000Z",
        runId: "run-supervision-fixture",
        read: syntheticReadPort(cappedScope(200), reads),
      });
      const elapsed = performance.now() - started;
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      // Non-vacuous: the run actually folded the declared population.
      expect(result.report.lanes).toHaveLength(200);
      expect(reads.count).toBe(1);
      measurements.push(elapsed);
    }
    for (const elapsed of measurements) {
      expect(elapsed, `measured ${elapsed.toFixed(1)} ms`).toBeLessThan(LATENCY_BOUND_MS);
    }
  });
});
