/**
 * TC-COORD-012 — `tick` claims the lease, runs exactly one bounded cycle,
 * exposes persisted stuck and `tickVerdict`, and starts no loop.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedStuckVerdict,
} from "../fixtures/coordinator/harness";
import { fenceRecord, iterationRecord } from "../fixtures/coordinator/states";

const liveHarness = (label: string) =>
  createCoordinatorHarness({
    label,
    session: { liveness: "alive", sessionId: "session-live" },
    alive: { 4242: true },
  });

describe("TC-COORD-012 tick runs one bounded cycle and starts no loop", () => {
  test("a quiet cycle appends exactly the lease pair and no action record", async () => {
    const harness = liveHarness("tick-quiet");
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
    expect(read.iterations).toHaveLength(0);
    expect(read.restarts).toHaveLength(0);
    expect(read.stuck).toHaveLength(0);
    expect(read.wakes).toHaveLength(0);
    expect(harness.driver.boundaries).toBe(0);
    expect(dataOf(result).tickVerdict).not.toBeNull();
  });

  test("the tick uses exactly one verified state read", async () => {
    const harness = liveHarness("tick-read-cost");
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.reads).toBe(1);
  });

  test("a first tick on a fresh dir records the spawn decision", async () => {
    const harness = createCoordinatorHarness({
      label: "tick-first",
      session: { sessionId: null, liveness: "absent", contextTokens: null },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.iterations[0]?.decision).toBe("spawn-fresh");
    expect(read.iterations[0]?.reason).toBe("initial-start");
    expect(read.restarts).toHaveLength(0);
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
  });

  test("a live holder refuses the tick with no cycle and no append", async () => {
    const harness = createCoordinatorHarness({ label: "tick-live-holder", alive: { 4242: true } });
    harness.appendRaw({
      kind: "coordinator.fence",
      recordKey: "coordinator.fence:coordinator-main",
      payload: { ...fenceRecord({ pid: 4242, processStartTimeMs: 2_000, holder: "pid:4242:start:2000" }) },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(1);
    expect(harness.process.progressReads).toBe(0);
  });

  test("persisted stuck is reported separately from the tick verdict", async () => {
    const harness = createCoordinatorHarness({ label: "tick-split" });
    harness.appendRaw({
      kind: "coordinator.iteration",
      recordKey: "coordinator.iterations:coordinator-main",
      payload: { ...iterationRecord({ recordedAt: new Date(0).toISOString() }) },
    });
    seedStuckVerdict(harness);
    harness.clock.value += 1_000_000;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    const data = dataOf(result);
    expect(data.stuck?.verdict).toBe("stuck");
    expect(data.stuck?.evidence).toContain("merge=");
    expect(data.tickVerdict?.verdict).toBeDefined();
  });

  test("the tick human line carries the cycle fields", async () => {
    const harness = liveHarness("tick-text");
    const result = await harness.run(["coordinator", "tick"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("coordinator tick");
    expect(result.stdout).toContain("decision=");
    expect(result.stdout.split("\n").length).toBeLessThanOrEqual(32);
  });
});
