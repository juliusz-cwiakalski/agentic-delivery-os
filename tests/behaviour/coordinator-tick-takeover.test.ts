/**
 * TC-COORD-095 — a `tick` recovers a crashed holder with one `stale-takeover`,
 * one cycle, and one `released`; no separate `start` is required.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, seedLease } from "../fixtures/coordinator/harness";

describe("TC-COORD-095 tick recovers a crashed holder", () => {
  test("an acquired-but-dead root is recovered in one tick", async () => {
    const harness = createCoordinatorHarness({
      label: "tick-takeover-acquired",
      alive: { 4242: false },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
    expect(harness.driver.boundaries).toBe(0);
  });

  test("a stop-requested-but-dead root is recovered in one tick", async () => {
    const harness = createCoordinatorHarness({
      label: "tick-takeover-stopped",
      alive: { 4242: false },
    });
    seedLease(harness, { action: "stop-requested", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
  });

  test("the tick does not block on the dead holder's lease", async () => {
    const harness = createCoordinatorHarness({
      label: "tick-takeover-no-start",
      alive: { 4242: false },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const readsBefore = harness.counters.reads;
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.counters.reads - readsBefore).toBe(1);
  });

  test("a live holder is refused rather than taken over", async () => {
    const harness = createCoordinatorHarness({
      label: "tick-takeover-live",
      alive: { 4242: true },
    });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(0);
  });
});
