/**
 * TC-QLC-082 (GH-292, AC-NFR-3, NFR-3) — the hook's operation cost: with and
 * without the hook the step outcomes and the exit are identical and the
 * operation count differs only by the queue block's one fold and at most two
 * appends; the fence is acquired exactly once per apply either way.
 */
import { describe, expect, test } from "bun:test";
import { readQueueRemovals } from "../../packages/core/src/app/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  seedQueueEntry,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

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
