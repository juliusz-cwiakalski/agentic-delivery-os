/**
 * TC-QLC-020 / TC-QLC-021 / TC-QLC-022 (GH-292, F-2, DM-6) — `closeout --apply`
 * removes the landed ref with reason `landed` through the additive fail-open
 * `queueRemoval` block; plan mode appends nothing and reports `would-remove`;
 * the closed skip reasons cover no merge truth, a live lease, unreadable
 * state, and a non-canonical ref.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold, readQueueRemovals } from "../../packages/core/src/app/index";
import { CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS } from "../../packages/core/src/contracts/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  hookFor,
  seedQueueEntry,
  seedQueueLease,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

describe("TC-QLC-020 closeout --apply removes the landed ref", () => {
  test("an apply with an observed merge and a seeded entry records one landed removal", async () => {
    const harness = createQueueRemovalHarness({ label: "apply-landed", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "removed",
        ref: WORK_ITEM_REF,
        reason: "landed",
      });
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).not.toContain(WORK_ITEM_REF);
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records.map((record) => record.reason)).toEqual(["landed"]);
      expect(removals.records.map((record) => record.ref)).toEqual([WORK_ITEM_REF]);
    } finally {
      harness.dispose();
    }
  });

  test("the twelve step outcomes and the exit are identical with and without the hook", async () => {
    const withHook = createQueueRemovalHarness({ label: "steps-with", apply: true });
    seedQueueEntry(withHook, WORK_ITEM_REF);
    const seeded = await withHook.run();
    withHook.dispose();
    const withoutHook = createQueueRemovalHarness({
      label: "steps-without",
      apply: true,
      hookEnabled: false,
    });
    try {
      const result = await withoutHook.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.steps.map((step) => step.stepId)).toEqual(
        seeded.ok ? seeded.data.steps.map((step) => step.stepId) : [],
      );
      expect(result.data.steps.map((step) => step.outcome)).toEqual(
        seeded.ok ? seeded.data.steps.map((step) => step.outcome) : [],
      );
      expect(seeded.ok ? seeded.data.steps.length : 0).toBe(12);
      expect(result.data.queueRemoval).toBeUndefined();
    } finally {
      withoutHook.dispose();
    }
  });
});

describe("TC-QLC-021 plan mode discloses without removing", () => {
  test("plan mode reports would-remove and appends zero records", async () => {
    const harness = createQueueRemovalHarness({ label: "plan-would", apply: false });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const before = harness.store.readRecords();
      expect(before.ok).toBe(true);
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.mode).toBe("plan");
      expect(result.data.queueRemoval).toEqual({
        outcome: "would-remove",
        ref: WORK_ITEM_REF,
        reason: "landed",
      });
      const after = harness.store.readRecords();
      expect(after.ok).toBe(true);
      if (!before.ok || !after.ok) return;
      expect(after.value.records.length).toBe(before.value.records.length);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-QLC-022 the closed skip reasons", () => {
  test("no merge truth, a live lease, and a non-canonical ref each skip", async () => {
    // The no-merge cell at the wired seam: the delivered apply closeout refuses
    // without a merge before any hook runs, so the seam is the honest proof.
    const noMerge = createQueueRemovalHarness({ label: "skip-no-merge", apply: true });
    try {
      seedQueueEntry(noMerge, WORK_ITEM_REF);
      const before = noMerge.store.readRecords();
      expect(before.ok).toBe(true);
      const disclosure = hookFor(noMerge, { mode: "apply", mergedObserved: false });
      expect(disclosure).toEqual({
        outcome: "skipped",
        skipReason: "no-merge-truth",
        ref: WORK_ITEM_REF,
      });
      const after = noMerge.store.readRecords();
      expect(after.ok).toBe(true);
      if (!before.ok || !after.ok) return;
      expect(after.value.records.length).toBe(before.value.records.length);
    } finally {
      noMerge.dispose();
    }

    const leased = createQueueRemovalHarness({ label: "skip-lease", apply: true });
    try {
      seedQueueEntry(leased, WORK_ITEM_REF);
      seedQueueLease(leased, { holder: "dispatch", ref: WORK_ITEM_REF });
      const result = await leased.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "skipped",
        skipReason: "lease-held",
        ref: WORK_ITEM_REF,
      });
    } finally {
      leased.dispose();
    }

    // The non-canonical cell at the wired seam: the closeout's own ref is
    // always canonical, so the seam proves the closed reason directly.
    const canonical = createQueueRemovalHarness({ label: "skip-canonical", apply: true });
    try {
      const disclosure = hookFor(canonical, {
        mode: "apply",
        mergedObserved: true,
        workItemRef: "not-a-ref",
      });
      expect(disclosure).toEqual({ outcome: "skipped", skipReason: "ref-not-canonical" });
    } finally {
      canonical.dispose();
    }
    expect(CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS).toEqual([
      "no-merge-truth",
      "lease-held",
      "state-unavailable",
      "ref-not-canonical",
    ]);
  });
});
