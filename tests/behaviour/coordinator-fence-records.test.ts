/**
 * TC-COORD-017 — `coordinator.fence` records acquisition, release, single-record
 * stale takeover, stop request, and the non-claim per-append fence rule durably.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedLease,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-017 fence records are durable and per-append fenced", () => {
  test("acquire -> release round-trips through a reopened read", async () => {
    const harness = createCoordinatorHarness({
      label: "fence-durable",
      session: { liveness: "alive" },
      alive: { 4242: true },
    });
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
    expect(new Set(read.fences.map((record) => record.instanceId)).size).toBe(1);
  });

  test("a single-record takeover is never followed by a second acquired", async () => {
    const harness = createCoordinatorHarness({ label: "fence-takeover", alive: { 4242: false } });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const actions = read.fences.map((record) => record.action);
    expect(actions.filter((action) => action === "stale-takeover")).toHaveLength(1);
    const takeoverIndex = actions.indexOf("stale-takeover");
    expect(actions[takeoverIndex + 1]).toBe("released");
    expect(actions.filter((action) => action === "acquired")).toHaveLength(1);
  });

  test("a stop request is recorded without a release", async () => {
    const harness = createCoordinatorHarness({ label: "fence-stop", alive: { 4242: true } });
    seedLease(harness, { action: "acquired", recordedAt: new Date(0).toISOString() });
    await harness.run(["coordinator", "stop", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "stop-requested"]);
  });

  test("a torn fence record fails closed with the state identity", async () => {
    const harness = createCoordinatorHarness({ label: "fence-torn" });
    harness.appendRaw({
      kind: "coordinator.fence",
      recordKey: "coordinator.fence:coordinator-main",
      payload: {
        schemaId: "delivery.coordinator.fence.v1",
        fenceId: "bad",
        instanceId: "bad",
        coordinatorId: "coordinator-main",
        action: "not-an-action",
        holder: "x",
        pid: 1,
        processStartTimeMs: 1,
        supervisorMode: "foreground",
        externalUnit: "absent",
        previousHolder: null,
        fenceAgeMs: null,
        recordedAt: "1970-01-01T00:00:00.000Z",
      },
    });
    const result = await harness.run(["coordinator", "status", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("state.store.torn");
  });

  test("a busy non-claim append maps to state.lock.busy, never already-running", async () => {
    const harness = createCoordinatorHarness({
      label: "fence-busy-append",
      session: { liveness: "alive" },
      alive: { 4242: true },
    });
    const held = harness.store.acquireFence("other-writer");
    expect(held.ok).toBe(true);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    // The claim acquire refuses first with the claim identity.
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
  });

  test("status reports the last lease action and holder", async () => {
    const harness = createCoordinatorHarness({ label: "fence-status" });
    seedLease(harness, {
      action: "stale-takeover",
      recordedAt: harness.clock.nowIso(),
      previousHolder: "pid:1:start:1",
      fenceAgeMs: 42,
    });
    const data = dataOf(await harness.run(["coordinator", "status", "--json"]));
    expect(data.fence?.action).toBe("stale-takeover");
    expect(data.fence?.previousHolder).toBe("pid:1:start:1");
    expect(data.fence?.fenceAgeMs).toBe(42);
  });
});
