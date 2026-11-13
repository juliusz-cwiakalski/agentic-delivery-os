/**
 * TC-QLC-021's disclosure half (GH-292, DM-6) — plan mode's `queueRemoval`
 * disclosure carries the pending removal with the recorded reason and the
 * ref, and appends nothing even when the merge truth is observed.
 */
import { describe, expect, test } from "bun:test";
import { readQueueRemovals } from "../../packages/core/src/app/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  seedQueueEntry,
  seedQueueLease,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

describe("TC-QLC-021 plan-mode disclosure", () => {
  test("plan mode reports would-remove with the landed reason", async () => {
    const harness = createQueueRemovalHarness({ label: "plan-disclose", apply: false });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "would-remove",
        ref: WORK_ITEM_REF,
        reason: "landed",
      });
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records).toEqual([]);
    } finally {
      harness.dispose();
    }
  });

  test("plan mode under a live lease reports the lease-held skip, not would-remove", async () => {
    const harness = createQueueRemovalHarness({ label: "plan-lease", apply: false });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      seedQueueLease(harness, { holder: "dispatch", ref: WORK_ITEM_REF });
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "skipped",
        skipReason: "lease-held",
        ref: WORK_ITEM_REF,
      });
    } finally {
      harness.dispose();
    }
  });
});
