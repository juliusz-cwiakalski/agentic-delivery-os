/**
 * TC-COORD-093 — a live holder past 2x`collection-interval` is never taken over
 * and can still be stopped; lease age anchors to the acquisition record.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedLease,
} from "../fixtures/coordinator/harness";

const OLD = new Date(0).toISOString();
const YOUNG = new Date(1_000_000).toISOString();

describe("TC-COORD-093 a live old holder is refused and stoppable", () => {
  test("a live holder older than the 2x bound is still refused", async () => {
    const harness = createCoordinatorHarness({ label: "liveness-old", alive: { 4242: true } });
    seedLease(harness, { action: "acquired", recordedAt: OLD });
    harness.clock.value += 10 * 60 * 60 * 1000;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
  });

  test("a live old holder can still be stopped", async () => {
    const harness = createCoordinatorHarness({ label: "liveness-stop", alive: { 4242: true } });
    seedLease(harness, { action: "acquired", recordedAt: OLD });
    harness.clock.value += 10 * 60 * 60 * 1000;
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(0);
    expect(dataOf(result).state).toBe("requested");
  });

  test("age is anchored to the acquisition record, not a later stop request", async () => {
    const harness = createCoordinatorHarness({ label: "liveness-anchor", alive: { 4242: null } });
    seedLease(harness, { action: "acquired", recordedAt: OLD });
    seedLease(harness, { action: "stop-requested", recordedAt: YOUNG });
    // The injected now is well past the acquisition-anchored bound, but the
    // stop-requested record is young: a re-anchored age would refuse.
    harness.clock.value += 10 * 60 * 1000;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
  });

  test("a young unanswered lease is held", async () => {
    const harness = createCoordinatorHarness({ label: "liveness-young", alive: { 4242: null } });
    seedLease(harness, { action: "acquired", recordedAt: YOUNG });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
  });

  test("a dead holder is takeover-eligible even when the lease is young", async () => {
    const harness = createCoordinatorHarness({ label: "liveness-dead-young", alive: { 4242: false } });
    seedLease(harness, { action: "acquired", recordedAt: YOUNG });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
  });
});
