/**
 * TC-COORD-098 (state half) — a dead writer's stale state fence is recovered
 * with exactly one `recoverFence` and one retry, so a non-claim append is never
 * wedged; a non-stale or still-busy fence returns the delivered
 * `state.lock.busy`, and a failed append returns `state.write.failed`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendCoordinatorFence,
  appendCoordinatorPayload,
  coordinatorFenceKey,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { COORDINATOR_ID, fenceRecord, spyStore } from "../fixtures/coordinator/states";
import { createTestEdge, makeIdentity, openStore } from "../fixtures/state/harness";

const openPair = (label: string, staleFenceMs = 30_000) => {
  const root = mkdtempSync(join(tmpdir(), `gh241-${label}-`));
  const identity = makeIdentity(root);
  const clock = { value: 1_000_000 };
  const writerEdge = createTestEdge({ clock });
  const { store: writer } = openStore(identity, { edge: writerEdge, staleFenceMs });
  const readerEdge = createTestEdge({ clock });
  const { store: reader } = openStore(identity, { edge: readerEdge, staleFenceMs });
  return { clock, writer, reader, identity };
};

describe("TC-COORD-098 the non-claim append recovers one stale fence and retries", () => {
  test("a stale dead-writer fence is recovered exactly once and the append lands", () => {
    const { clock, writer, reader } = openPair("fence-stale");
    const held = writer.acquireFence("dead-writer");
    expect(held.ok).toBe(true);
    // The dead writer never releases; its lock ages past the staleness window.
    clock.value += 60_000;
    expect(reader.fenceStatus().stale).toBe(true);

    const spy = spyStore(reader);
    const appended = appendCoordinatorFence(spy.store, "new-writer", fenceRecord());
    expect(appended.ok).toBe(true);
    if (appended.ok) expect(appended.appended).toBe(true);
    expect(spy.counts.recoverFence).toBe(1);
    expect(spy.counts.acquireFence).toBe(2);
    expect(spy.counts.releaseFence).toBe(1);
    const read = readCoordinatorRecords(reader, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.fences).toHaveLength(1);
  });

  test("a non-stale busy fence maps to state.lock.busy and appends nothing", () => {
    const { writer, reader } = openPair("fence-live");
    expect(writer.acquireFence("live-writer").ok).toBe(true);
    const spy = spyStore(reader);
    const appended = appendCoordinatorFence(spy.store, "new-writer", fenceRecord());
    expect(appended.ok).toBe(false);
    if (!appended.ok) expect(appended.code).toBe("state.lock.busy");
    expect(spy.counts.recoverFence).toBe(0);
    expect(spy.counts.append).toBe(0);
    expect(spy.counts.releaseFence).toBe(0);
  });

  test("a still-busy fence after one recovery maps to state.lock.busy", () => {
    const { clock, writer, reader } = openPair("fence-still-busy");
    expect(writer.acquireFence("dead-writer").ok).toBe(true);
    clock.value += 60_000;
    const spy = spyStore(reader);
    spy.setFenceStatus({ held: true, stale: true });
    // The recovery is attempted but the retry still sees a busy lock.
    spy.queueAcquireFailures(["state.lock.busy", "state.lock.busy"]);
    const appended = appendCoordinatorPayload(spy.store, "new-writer", {
      kind: "coordinator.fence",
      recordKey: coordinatorFenceKey(COORDINATOR_ID),
      payload: fenceRecord(),
    });
    expect(appended.ok).toBe(false);
    if (!appended.ok) expect(appended.code).toBe("state.lock.busy");
    expect(spy.counts.recoverFence).toBe(1);
    expect(spy.counts.acquireFence).toBe(2);
    expect(spy.counts.append).toBe(0);
  });

  test("a failed append returns state.write.failed and still releases the fence", () => {
    const { reader } = openPair("fence-write-failed");
    const spy = spyStore(reader);
    spy.failNextAppend("state.write.failed");
    const appended = appendCoordinatorFence(spy.store, "writer", fenceRecord());
    expect(appended.ok).toBe(false);
    if (!appended.ok) expect(appended.code).toBe("state.write.failed");
    expect(spy.counts.releaseFence).toBe(1);
  });

  test("the non-claim rule never maps to coordinator.already-running", () => {
    const { writer, reader } = openPair("fence-identity");
    expect(writer.acquireFence("live-writer").ok).toBe(true);
    const appended = appendCoordinatorFence(reader, "new-writer", fenceRecord());
    expect(appended.ok).toBe(false);
    if (!appended.ok) expect(appended.code).not.toBe("coordinator.already-running");
  });
});
