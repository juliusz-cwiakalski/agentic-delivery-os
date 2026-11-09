/**
 * TC-COORD-094 — lock contention between two claims over two store handles
 * yields exactly one acquisition and one `coordinator.already-running` with no
 * loser re-read and no append.
 */
import { describe, expect, test } from "bun:test";
import { openStore } from "../fixtures/state/harness";
import { createCoordinatorHarness, errorCodeOf } from "../fixtures/coordinator/harness";
import { fenceRecord, makeCoordinatorStore } from "../fixtures/coordinator/states";
import {
  contentionController,
  openClaimHandles,
  serializationController,
} from "../fixtures/coordinator/claim-race";

describe("TC-COORD-094 lock contention yields exactly one acquisition", () => {
  test("the loser sees a busy fence, re-reads nothing, and appends nothing", async () => {
    const harness = createCoordinatorHarness({
      label: "claim-race",
      alive: { 4242: true },
      session: { liveness: "alive" },
    });
    const winner = openStore(harness.store.identity).store;
    const held = winner.acquireFence("winner");
    if (!held.ok) throw new Error("winner could not acquire");

    const before = harness.counters.reads;
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    expect(harness.counters.reads).toBe(before);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences).toHaveLength(0);
    winner.releaseFence(held.value.handle);
  });

  test("the contention controller forces state.lock.busy on the loser", () => {
    const handles = openClaimHandles("contention");
    const controller = contentionController(handles);
    const loser = controller.loserAcquire();
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.error.code).toBe("state.lock.busy");
    controller.release();
  });

  test("the serialization controller runs the winner fully, then the loser re-reads", () => {
    const handles = openClaimHandles("serialization");
    const controller = serializationController(handles);
    expect(controller.appended).toBe(true);
    const read = controller.loserRead();
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.fences).toHaveLength(1);
    expect(controller.epochId).toBe("epoch-1");
  });

  test("two independent state dirs never contend", async () => {
    const first = createCoordinatorHarness({ label: "race-a", alive: { 4242: true } });
    const second = createCoordinatorHarness({ label: "race-b", alive: { 4242: true } });
    const heldA = first.store.acquireFence("a");
    expect(heldA.ok).toBe(true);
    const result = await second.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
  });

  test("a single acquisition counter over two handles", async () => {
    const { store } = makeCoordinatorStore("race-two-handles");
    const second = openStore(store.identity).store;
    const acquired = store.acquireFence("one");
    expect(acquired.ok).toBe(true);
    const busy = second.acquireFence("two");
    expect(busy.ok).toBe(false);
    if (!busy.ok) expect(busy.error.code).toBe("state.lock.busy");
    const records = store.readRecords();
    expect(records.ok).toBe(true);
    // No lease record exists yet: only an explicit append would create one.
    if (records.ok) {
      expect(records.value.records.filter((record) => record.kind === "coordinator.fence")).toHaveLength(0);
    }
    void fenceRecord;
  });
});
