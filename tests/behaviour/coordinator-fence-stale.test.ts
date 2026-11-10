/**
 * TC-COORD-015 — a dead-holder lease is taken over with one recorded
 * `stale-takeover`; a live holder is never taken over.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedLease,
} from "../fixtures/coordinator/harness";

const harnessFor = (alive: boolean | null) => {
  const harness = createCoordinatorHarness({
    label: "fence-stale",
    alive: { 4242: alive },
    session: { liveness: "alive" },
  });
  return harness;
};

describe("TC-COORD-015 liveness is decided before age", () => {
  test("a dead holder is taken over with exactly one stale-takeover", async () => {
    const harness = createCoordinatorHarness({ label: "takeover-dead", alive: { 4242: false } });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
    expect(read.fences.filter((record) => record.action === "acquired")).toHaveLength(1);
    const takeover = read.fences.find((record) => record.action === "stale-takeover");
    expect(takeover?.previousHolder).toBe("pid:4242:start:2000");
    expect(takeover?.fenceAgeMs).toBeGreaterThan(0);
    expect(dataOf(result).tickVerdict).not.toBeNull();
  });

  test("a live holder is never taken over regardless of lease age", async () => {
    const harness = harnessFor(true);
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    harness.clock.value += 365 * 24 * 60 * 60 * 1000;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    const read = harness.records();
    if (read.ok) expect(read.fences.filter((r) => r.action === "stale-takeover")).toHaveLength(0);
  });

  test("a declared-but-unanswered young lease is held", async () => {
    const harness = harnessFor(null);
    seedLease(harness, { action: "acquired", recordedAt: harness.clock.nowIso() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
  });

  test("a declared-but-unanswered old lease is taken over", async () => {
    const harness = harnessFor(null);
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    harness.clock.value += 10 * 60 * 1000;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
  });

  test("a released lease is acquired normally", async () => {
    const harness = harnessFor(true);
    seedLease(harness, { action: "released", recordedAt: new Date(0).toISOString() });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.filter((record) => record.action === "acquired")).toHaveLength(1);
    expect(read.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(0);
  });
});
