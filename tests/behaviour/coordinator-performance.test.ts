/**
 * TC-COORD-088 (performance half) — tick p95 <= 2000 ms, status p95 <= 1000 ms,
 * and start p95 <= 2000 ms excluding spawn, over a reference state store.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, seedRestart } from "../fixtures/coordinator/harness";

const percentile = (values: readonly number[], p: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
};

const reference = (label: string) => {
  const harness = createCoordinatorHarness({ label, session: { liveness: "alive" } });
  for (let ordinal = 1; ordinal <= 5; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-088 performance stays within the declared thresholds", () => {
  test("tick p95 is at most 2000 ms", async () => {
    const harness = reference("perf-tick");
    const samples: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const started = performance.now();
      const result = await harness.run(["coordinator", "tick", "--json"]);
      samples.push(performance.now() - started);
      expect(result.code).toBe(0);
    }
    expect(percentile(samples, 95)).toBeLessThanOrEqual(2_000);
  });

  test("status p95 is at most 1000 ms", async () => {
    const harness = reference("perf-status");
    const samples: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const started = performance.now();
      const result = await harness.run(["coordinator", "status", "--json"]);
      samples.push(performance.now() - started);
      expect(result.code).toBe(0);
    }
    expect(percentile(samples, 95)).toBeLessThanOrEqual(1_000);
  });

  test("start p95 excluding spawn is at most 2000 ms", async () => {
    const samples: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const harness = createCoordinatorHarness({
        label: `perf-start-${index}`,
        cycle: { cycles: 0 },
        session: { liveness: "alive" },
      });
      const started = performance.now();
      const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
      samples.push(performance.now() - started);
      expect(result.code).toBe(0);
    }
    expect(percentile(samples, 95)).toBeLessThanOrEqual(2_000);
  });
});
