/**
 * TC-COORD-043 — no kill exists without the current instance lease; a contended
 * tick is refused and a crashed holder is recoverable by `tick`.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedIteration,
  seedLease,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-043 a kill requires the current instance lease", () => {
  test("a refused tick performs no kill", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-fence-refused",
      session: { liveness: "alive" },
      alive: { 4242: true, 7777: true },
    });
    seedLease(harness, {
      action: "acquired",
      pid: 7777,
      processStartTimeMs: 1,
      recordedAt: harness.clock.nowIso(),
    });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    expect(harness.process.killCalls).toBe(0);
    const read = harness.records();
    if (read.ok) expect(read.stuck).toHaveLength(0);
  });

  test("a crashed holder is recovered by tick and the kill then runs", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-fence-recovered",
      session: { liveness: "alive" },
      alive: { 4242: false },
    });
    seedLease(harness, {
      action: "acquired",
      pid: 7777,
      processStartTimeMs: 1,
      recordedAt: new Date(0).toISOString(),
    });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.process.signals).toHaveLength(1);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
    expect(read.stuck.map((record) => record.phase)).toEqual(["verdict", "outcome"]);
  });
});
