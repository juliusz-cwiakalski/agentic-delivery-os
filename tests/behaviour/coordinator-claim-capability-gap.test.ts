/**
 * TC-COORD-097 — an undeclared alive capability at claim time fails closed with
 * `coordinator.process.capability-gap`, no lease record, and no takeover.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, errorCodeOf, seedLease } from "../fixtures/coordinator/harness";

describe("TC-COORD-097 an undeclared alive capability fails closed", () => {
  test("tick fails closed with no lease record and no takeover", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-tick",
      declared: { alive: false },
      session: { liveness: "alive" },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.process.capability-gap");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired"]);
  });

  test("start fails closed before any append", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-start",
      declared: { alive: false },
      cycle: { cycles: 0 },
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.process.capability-gap");
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(0);
  });

  test("stop fails closed rather than reporting not-running", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-stop",
      declared: { alive: false },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.process.capability-gap");
  });

  test("a declared-but-unanswered probe is unknown, never a gap", async () => {
    const young = createCoordinatorHarness({ label: "gap-unknown-young", alive: { 4242: null } });
    seedLease(young, { action: "acquired", recordedAt: young.clock.nowIso() });
    expect(errorCodeOf(await young.run(["coordinator", "tick", "--json"]))).toBe(
      "coordinator.already-running",
    );
    const old = createCoordinatorHarness({ label: "gap-unknown-old", alive: { 4242: null } });
    seedLease(old, { action: "acquired", recordedAt: new Date(0).toISOString() });
    old.clock.value += 10 * 60 * 1000;
    expect((await old.run(["coordinator", "tick", "--json"])).code).toBe(0);
  });

  test("no destructive action is performed on the gap path", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-no-destructive",
      declared: { alive: false, killWithGrace: false, startTimeIdentity: false },
      session: { liveness: "alive" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.process.signals).toHaveLength(0);
    expect(harness.process.killCalls).toBe(0);
  });
});
