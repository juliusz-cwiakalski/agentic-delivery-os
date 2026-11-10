/**
 * TC-COORD-098 (command half) — a dead writer's stale state fence is recovered
 * with exactly one `recoverFence` and one retry, so `start`/`tick` is not wedged.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, dataOf, errorCodeOf } from "../fixtures/coordinator/harness";

const staleHarness = (label: string) =>
  createCoordinatorHarness({
    label,
    staleFenceMs: 30_000,
    session: { liveness: "alive" },
    alive: { 4242: true },
  });

describe("TC-COORD-098 the claim recovers one stale fence and retries", () => {
  test("a dead writer's stale lock is recovered with one recoverFence", async () => {
    const harness = staleHarness("stale-claim");
    const held = harness.store.acquireFence("dead-writer");
    expect(held.ok).toBe(true);
    harness.clock.value += 60_000;
    const acquiresBefore = harness.counters.acquireFence;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.recoverFence).toBe(1);
    // At least the failed acquire plus its retry (the cycle's own per-append
    // fences may add more, and each is released before the next).
    expect(harness.counters.acquireFence - acquiresBefore).toBeGreaterThanOrEqual(2);
  });

  test("start also recovers the stale fence and proceeds", async () => {
    const harness = createCoordinatorHarness({
      label: "stale-start",
      staleFenceMs: 30_000,
      cycle: { cycles: 0 },
      session: { liveness: "alive" },
    });
    expect(harness.store.acquireFence("dead-writer").ok).toBe(true);
    harness.clock.value += 60_000;
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.recoverFence).toBe(1);
    expect(dataOf(result).fence?.action).toBe("released");
  });

  test("a non-stale busy fence refuses with the remediation hint", async () => {
    const harness = staleHarness("stale-live");
    expect(harness.store.acquireFence("live-writer").ok).toBe(true);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    expect(harness.counters.recoverFence).toBe(0);
  });
});
