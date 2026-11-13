/**
 * TC-QLC-023 / TC-QLC-024 (GH-292, F-2, NFR-10) — the automatic path converges:
 * a re-run over an already-removed ref and a closeout for a ref that never had
 * an entry both exit 0 and report `satisfied`; a live lease skips without
 * failing the transaction.
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

describe("TC-QLC-024 idempotent convergence", () => {
  test("a re-run over an already-removed ref reports satisfied at exit 0", async () => {
    const first = createQueueRemovalHarness({ label: "rerun-first", apply: true });
    seedQueueEntry(first, WORK_ITEM_REF);
    const seeded = await first.run();
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    expect(seeded.data.queueRemoval?.outcome).toBe("removed");
    first.dispose();

    const second = createQueueRemovalHarness({ label: "rerun-second", apply: true });
    try {
      const result = await second.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({ outcome: "satisfied", ref: WORK_ITEM_REF });
      const removals = readQueueRemovals(second.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records).toEqual([]);
    } finally {
      second.dispose();
    }
  });

  test("a closeout for a ref that never had an entry reports satisfied", async () => {
    const harness = createQueueRemovalHarness({ label: "never-entered", apply: true });
    try {
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({ outcome: "satisfied", ref: WORK_ITEM_REF });
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-QLC-023 fail-open under a live lease", () => {
  test("the lease skip changes no step outcome and the closeout still applies", async () => {
    const harness = createQueueRemovalHarness({ label: "fail-open", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      seedQueueLease(harness, { holder: "dispatch", ref: WORK_ITEM_REF });
      const recordsBefore = harness.store.readRecords();
      expect(recordsBefore.ok).toBe(true);
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "skipped",
        skipReason: "lease-held",
        ref: WORK_ITEM_REF,
      });
      const stepsFailed = result.data.steps.filter((step) => step.outcome === "failed");
      expect(stepsFailed).toEqual([]);
    } finally {
      harness.dispose();
    }
  });
});
