/**
 * TC-COORD-096 — a serialized second claim re-reads the held lease and refuses
 * with `coordinator.already-running` and no append.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, errorCodeOf, seedLease } from "../fixtures/coordinator/harness";

describe("TC-COORD-096 a serialized second claim refuses without an append", () => {
  test("the loser re-reads the held lease and refuses", async () => {
    const harness = createCoordinatorHarness({
      label: "claim-serialized",
      alive: { 4242: true },
      session: { liveness: "alive" },
    });
    seedLease(harness, { action: "acquired", recordedAt: harness.clock.nowIso() });
    const readsBefore = harness.counters.reads;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    // The loser performed its under-fence read (exactly one) and appended nothing.
    expect(harness.counters.reads).toBe(readsBefore + 1);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired"]);
  });

  test("a released lease lets the second claim proceed", async () => {
    const harness = createCoordinatorHarness({
      label: "claim-serialized-released",
      session: { liveness: "alive" },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    seedLease(harness, { action: "released", recordedAt: harness.clock.nowIso() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "acquired")).toHaveLength(2);
  });

  test("a dead lease lets the second claim take over", async () => {
    const harness = createCoordinatorHarness({
      label: "claim-serialized-dead",
      alive: { 4242: false },
    });
    seedLease(harness, { action: "acquired", recordedAt: harness.clock.nowIso() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
  });
});
