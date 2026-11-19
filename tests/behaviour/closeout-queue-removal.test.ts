/**
 * TC-QLC-020 / TC-QLC-021 / TC-QLC-022 (GH-292, F-2, DM-6) — `closeout --apply`
 * removes the landed ref with reason `landed` through the additive fail-open
 * `queueRemoval` block; plan mode appends nothing and reports `would-remove`;
 * the closed skip reasons cover no merge truth, a live lease, unreadable
 * state, and a non-canonical ref.
 */
import { describe, expect, test } from "bun:test";
import {
  queueRemovalForCloseout,
  readQueueFold,
  readQueueRemovals,
} from "../../packages/core/src/app/index";
import { CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS } from "../../packages/core/src/contracts/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  hookFor,
  seedQueueEntry,
  seedQueueLease,
} from "../fixtures/closeout/queue-removal";
import { memberCloseoutObservation } from "../fixtures/cross-repository/closeout";
import { API_MEMBER, memberRef, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  createCloseoutRemovalVariantHarness,
  type MilestoneVariant,
  seedVariantQueueEntry,
} from "../fixtures/queue/closeout-removal-variants";

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
      expect(seeded.ok ? seeded.data.steps.length : 0).toBe(13);
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

describe("GH-310 a member-ref landing removes only that member ref", () => {
  test("the hook removes the member ref with reason landed", () => {
    const harness = createQueueRemovalHarness({ label: "member-ref", apply: true });
    try {
      const ref = "GH-183@api-service-1a2b3c4d";
      seedQueueEntry(harness, ref);
      const fence = harness.store.acquireFence("member-ref-fence");
      expect(fence.ok).toBe(true);
      if (!fence.ok) return;
      try {
        const data = queueRemovalForCloseout(harness.store, {
          mode: "apply",
          mergedObserved: true,
          workItemRef: ref,
          recordedAt: "2026-11-12T10:00:00Z",
          nowMs: Date.parse("2026-11-12T10:00:00Z"),
          handle: fence.value.handle,
        });
        expect(data).toEqual({ outcome: "removed", ref, reason: "landed" });
      } finally {
        harness.store.releaseFence(fence.value.handle);
      }
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records.map((record) => record.ref)).toEqual([ref]);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-310 per-member landing removal inside the closeout fence", () => {
  test("one member's landing removes only its own member-ref entry", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER, { merged: false }),
    ];
    const harness = createQueueRemovalHarness({
      label: "member-landing-partial",
      apply: true,
      members: observations,
    });
    try {
      const apiRef = memberRef(API_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      const webRef = memberRef(WEB_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      seedQueueEntry(harness, apiRef, "host/owner/api");
      seedQueueEntry(harness, webRef, "host/owner/web");
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemovals).toEqual([
        { outcome: "removed", ref: apiRef, reason: "landed" },
        { outcome: "skipped", skipReason: "no-merge-truth", ref: webRef },
      ]);
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual([webRef]);
    } finally {
      harness.dispose();
    }
  });
});

/* --------------- TC-F6-008 the automatic removal across variants ---------- */

const MILESTONE_OUTCOME: Record<MilestoneVariant, string> = {
  applied: "applied",
  withheld: "skipped-noop",
  gap: "skipped-gap",
};

type StepOutcomes = Readonly<Record<string, string>>;

const stepOutcomes = (data: {
  readonly steps: readonly { readonly stepId: string; readonly outcome: string }[];
}): StepOutcomes => Object.fromEntries(data.steps.map((step) => [step.stepId, step.outcome]));

const withoutMilestone = (outcomes: StepOutcomes): StepOutcomes => {
  const rest: Record<string, string> = {};
  for (const [stepId, outcome] of Object.entries(outcomes)) {
    if (stepId !== "milestone-sync") rest[stepId] = outcome;
  }
  return rest;
};

describe("TC-F6-008 the automatic landed removal is unchanged across the milestone variants", () => {
  test("applied, withheld and gap each remove once inside one fence, as a non-step, with equal other steps", async () => {
    const outcomesByVariant = new Map<MilestoneVariant, StepOutcomes>();
    const fenceCounts: number[] = [];
    for (const variant of ["applied", "withheld", "gap"] as const) {
      const harness = createCloseoutRemovalVariantHarness({
        label: `variant-${variant}`,
        variant,
      });
      try {
        seedVariantQueueEntry(harness, CLOSEOUT_WORK_ITEM_REF);
        const fencesBefore = harness.writeLog.fences;
        const result = await harness.run();
        const fencesAfter = harness.writeLog.fences;
        expect(result.ok, variant).toBe(true);
        if (!result.ok) continue;
        expect(fencesAfter - fencesBefore, `${variant} fence count`).toBe(1);
        fenceCounts.push(fencesAfter - fencesBefore);
        expect(result.data.queueRemoval).toEqual({
          outcome: "removed",
          ref: CLOSEOUT_WORK_ITEM_REF,
          reason: "landed",
        });
        // The removal block is a non-step disclosure: it never enters steps[].
        expect(result.data.steps.some((step) => step.stepId === "queue-removal")).toBe(false);
        expect(result.data.steps).toHaveLength(13);
        expect(result.data.steps.filter((step) => step.outcome === "failed")).toEqual([]);
        const milestone = result.data.steps.find((step) => step.stepId === "milestone-sync");
        expect(milestone?.outcome, `${variant} milestone outcome`).toBe(MILESTONE_OUTCOME[variant]);
        const removals = readQueueRemovals(harness.store);
        expect(removals.ok).toBe(true);
        if (!removals.ok) continue;
        expect(removals.records).toHaveLength(1);
        expect(removals.records[0]?.reason).toBe("landed");
        const fold = readQueueFold(harness.store);
        expect(fold.ok).toBe(true);
        if (!fold.ok) continue;
        expect(fold.value.entries.map((entry) => entry.ref)).not.toContain(CLOSEOUT_WORK_ITEM_REF);
        outcomesByVariant.set(variant, stepOutcomes(result.data));
      } finally {
        harness.dispose();
      }
    }
    const baseline = outcomesByVariant.get("gap");
    expect(baseline).toBeDefined();
    for (const variant of ["applied", "withheld"] as const) {
      const current = outcomesByVariant.get(variant);
      expect(current, `${variant} produced step outcomes`).toBeDefined();
      if (current === undefined || baseline === undefined) continue;
      expect(
        withoutMilestone(current),
        `${variant} steps equal the milestone-free fixture`,
      ).toEqual(withoutMilestone(baseline));
    }
    expect(fenceCounts).toEqual([1, 1, 1]);
  });
});
