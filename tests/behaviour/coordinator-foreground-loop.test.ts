/**
 * TC-COORD-099 — the foreground supervisor runs N cycles with one lifetime lease
 * pair and declared stop/fatal/signal exits.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedLease,
} from "../fixtures/coordinator/harness";

const startHarness = (
  label: string,
  cycle: Parameters<typeof createCoordinatorHarness>[0]["cycle"],
) =>
  createCoordinatorHarness({
    label,
    cycle,
    session: { liveness: "alive" },
    alive: { 4242: true },
  });

describe("TC-COORD-099 the foreground loop keeps one lifetime lease pair", () => {
  test("N boundaries append one acquisition and one release, no per-cycle lease", async () => {
    const harness = startHarness("loop-n", { cycles: 3 });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.driver.boundaries).toBe(3);
    expect(harness.driver.waits).toHaveLength(3);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
    // One start join-live plus one per collection cycle (AC-F2-1/F-05).
    expect(read.iterations).toHaveLength(4);
    expect(read.iterations.every((record) => record.decision === "join-live")).toBe(true);
  });

  test("a stop request observed at the boundary exits 0 after released", async () => {
    const harness = startHarness("loop-stop", {
      cycles: 5,
      beforeCycle: (index) => {
        if (index === 1) {
          // The request is honoured only for the holder's own instance (F-13).
          seedLease(harness, {
            action: "stop-requested",
            instanceId: "instance-0001",
            recordedAt: harness.clock.nowIso(),
          });
        }
      },
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
    expect(harness.driver.boundaries).toBe(2);
  });

  test("a stop request left for a replaced holder instance is ignored (F-13 race)", async () => {
    const harness = startHarness("loop-stop-race", {
      cycles: 3,
      beforeCycle: (index) => {
        if (index === 1) {
          // Simulate a takeover that raced the stop append: the latest record
          // names a different instance than the running supervisor.
          seedLease(harness, {
            action: "stop-requested",
            instanceId: "instance-other",
            recordedAt: harness.clock.nowIso(),
          });
        }
      },
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    // The mismatched request never stops the live holder; all three cycle
    // boundaries run and exactly one lifetime release lands.
    expect(harness.driver.boundaries).toBe(3);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
  });

  test("a signal exit releases the lifetime lease and exits 0", async () => {
    const harness = startHarness("loop-signal", { cycles: 1, exit: "signal" });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
    expect(dataOf(result).degradation).toContain("supervisor-loop-stopped");
  });

  test("a fatal cycle error exits with its typed identity and still releases", async () => {
    const harness = startHarness("loop-fatal", {
      cycles: 3,
      events: [
        { kind: "throw", afterCycle: 1, error: { kind: "state", code: "state.store.torn" } },
      ],
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("state.store.torn");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
  });

  test("a still-busy released append exits 2 with state.lock.busy (F-19)", async () => {
    const harness = createCoordinatorHarness({
      label: "loop-release-busy",
      cycle: { cycles: 1 },
      session: { liveness: "alive" },
      releaseBusy: true,
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("state.lock.busy");
  });

  test("an unlanded released append exits 2 with the delivered write identity", async () => {
    const harness = createCoordinatorHarness({
      label: "loop-release-failure",
      cycle: { cycles: 1 },
      session: { liveness: "alive" },
      releaseFails: true,
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("state.write.failed");
  });
});
