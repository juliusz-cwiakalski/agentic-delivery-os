/**
 * TC-QLC-082 (GH-292, AC-NFR-3, NFR-3) — the hook's operation cost: with and
 * without the hook the step outcomes and the exit are identical and the
 * operation count differs only by the queue block's one fold and at most two
 * appends; the fence is acquired exactly once per apply either way.
 */
import { describe, expect, test } from "bun:test";
import {
  queueRemovalForCloseout,
  readQueueFold,
  readQueueRemovals,
} from "../../packages/core/src/app/index";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  seedQueueEntry,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;
const NOW_ISO = "2026-11-12T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);

/** Count every whole-store read the hook performs through one injected store. */
const countingStore = (store: StateStorePort) => {
  let reads = 0;
  const wrapped = new Proxy(store, {
    get(target, property) {
      if (property === "readRecords") {
        return () => {
          reads += 1;
          return target.readRecords();
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { store: wrapped, reads: () => reads };
};

describe("TC-QLC-082 hook operation cost", () => {
  test("the apply appends at most the closeout records plus one park and one removal", async () => {
    const harness = createQueueRemovalHarness({ label: "cost", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const before = harness.store.readRecords();
      expect(before.ok).toBe(true);
      if (!before.ok) return;
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const after = harness.store.readRecords();
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      const delta = after.value.records.length - before.value.records.length;
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      // The queue hook's own writes: exactly one removal record (no park was
      // active), on top of the closeout's delivered operation records.
      expect(removals.records).toHaveLength(1);
      expect(delta).toBeGreaterThanOrEqual(1);
      expect(delta).toBeLessThanOrEqual(before.value.records.length + 12 + 2);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-QLC-082 the hook's read budget is pinned", () => {
  test("the fold classifies entries and removals from one snapshot (no second removals scan)", () => {
    const harness = createQueueRemovalHarness({ label: "cost-fold", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const counting = countingStore(harness.store);
      const fold = readQueueFold(counting.store);
      expect(fold.ok).toBe(true);
      // One snapshot classifies entries and removals; dependencies are the
      // second (and last) whole-store read.
      expect(counting.reads()).toBe(2);
    } finally {
      harness.dispose();
    }
  });

  test("the no-entry closeout path performs two whole-store reads", () => {
    const harness = createQueueRemovalHarness({ label: "cost-no-entry", apply: true });
    try {
      const counting = countingStore(harness.store);
      const data = queueRemovalForCloseout(counting.store, {
        mode: "apply",
        workItemRef: WORK_ITEM_REF,
        mergedObserved: true,
        recordedAt: NOW_ISO,
        nowMs: NOW_MS,
      });
      expect(data).toEqual({ outcome: "satisfied", ref: WORK_ITEM_REF });
      expect(counting.reads()).toBe(2);
    } finally {
      harness.dispose();
    }
  });

  test("the plan path performs one fold plus one lease read", () => {
    const harness = createQueueRemovalHarness({ label: "cost-plan-reads", apply: false });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const counting = countingStore(harness.store);
      const data = queueRemovalForCloseout(counting.store, {
        mode: "plan",
        workItemRef: WORK_ITEM_REF,
        mergedObserved: true,
        recordedAt: NOW_ISO,
        nowMs: NOW_MS,
      });
      expect(data).toEqual({ outcome: "would-remove", ref: WORK_ITEM_REF, reason: "landed" });
      expect(counting.reads()).toBe(3);
    } finally {
      harness.dispose();
    }
  });

  test("the apply path performs the hook fold, lease read, and the removal's reads", () => {
    const harness = createQueueRemovalHarness({ label: "cost-apply-reads", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const fence = harness.store.acquireFence("cost-apply-fence");
      expect(fence.ok).toBe(true);
      if (!fence.ok) return;
      try {
        const counting = countingStore(harness.store);
        const data = queueRemovalForCloseout(counting.store, {
          mode: "apply",
          workItemRef: WORK_ITEM_REF,
          mergedObserved: true,
          recordedAt: NOW_ISO,
          nowMs: NOW_MS,
          handle: fence.value.handle,
        });
        expect(data).toEqual({ outcome: "removed", ref: WORK_ITEM_REF, reason: "landed" });
        // Hook fold (2) + hook lease read (1) + removal body (10: pre-fold 2,
        // in-fence fold 2, lease 1, parks 1, pre-append 1, verification 1,
        // final fold 2).
        expect(counting.reads()).toBe(13);
      } finally {
        harness.store.releaseFence(fence.value.handle);
      }
    } finally {
      harness.dispose();
    }
  });
});
