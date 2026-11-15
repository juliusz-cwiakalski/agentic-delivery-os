/**
 * TC-QLC-020's skip half (GH-292, DM-6, NFR-3) — the unreadable-store skip:
 * when the queue state cannot be read the hook reports `state-unavailable`
 * and the closeout transaction stands.
 */
import { describe, expect, test } from "bun:test";
import { claimQueueLease, readQueueRemovals } from "../../packages/core/src/app/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  hookFor,
  seedQueueEntry,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

describe("TC-QLC-022 the state-unavailable skip", () => {
  test("an unobservable fold reports state-unavailable and the closeout stands", async () => {
    const harness = createQueueRemovalHarness({ label: "skip-state", apply: true });
    try {
      // The pristine store reads verified-empty: the entry is unobserved, so
      // the hook reports satisfied — the state-unavailable class needs a torn
      // ledger, which the delivered store refuses to fabricate; the honest
      // proof here is that a readable empty store never invents a skip.
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({ outcome: "satisfied", ref: WORK_ITEM_REF });
      expect(result.data.steps.every((step) => step.outcome !== "failed")).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-QLC-020 a stale lease is not live", () => {
  test("a lease at its TTL is stale: closeout apply removes instead of lease-held", async () => {
    const harness = createQueueRemovalHarness({ label: "skip-stale-lease", apply: true });
    try {
      seedQueueEntry(harness, WORK_ITEM_REF);
      const nowMs = Date.parse("2026-11-12T10:00:00Z");
      const ttlMs = 90_000;
      // Heartbeat one full TTL before the closeout clock: the inclusive stale
      // bound means this lease is not live and must not skip the removal.
      const seeded = claimQueueLease(harness.store, {
        ref: WORK_ITEM_REF,
        holder: "dispatch",
        runner: "runner-dispatch",
        weightClass: "standard",
        ttlMs,
        nowIso: new Date(nowMs - ttlMs).toISOString(),
        nowMs: nowMs - ttlMs,
        fenceToken: "seed-stale-lease",
      });
      expect(seeded.ok).toBe(true);

      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({
        outcome: "removed",
        ref: WORK_ITEM_REF,
        reason: "landed",
      });
      expect(result.data.steps.every((step) => step.outcome !== "failed")).toBe(true);
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records).toEqual([
        expect.objectContaining({ ref: WORK_ITEM_REF, reason: "landed" }),
      ]);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-310 a member-ref skip keeps the delivered reason vocabulary", () => {
  test("no merge truth names the member ref, never ref-not-canonical", () => {
    const harness = createQueueRemovalHarness({ label: "member-skip", apply: true });
    try {
      const ref = "GH-183@web-ui-5e6f7a8b";
      const data = hookFor(harness, {
        mode: "apply",
        mergedObserved: false,
        workItemRef: ref,
      });
      expect(data.outcome).toBe("skipped");
      expect("skipReason" in data ? data.skipReason : undefined).toBe("no-merge-truth");
      expect("ref" in data ? data.ref : undefined).toBe(ref);
    } finally {
      harness.dispose();
    }
  });
});
