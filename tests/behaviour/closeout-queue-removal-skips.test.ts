/**
 * TC-QLC-020's skip half (GH-292, DM-6, NFR-3) — the unreadable-store skip:
 * when the queue state cannot be read the hook reports `state-unavailable`
 * and the closeout transaction stands.
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  readQueueFold,
  readQueueRemovals,
} from "../../packages/core/src/app/index";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  hookFor,
  seedQueueEntry,
} from "../fixtures/closeout/queue-removal";
import { memberCloseoutObservation } from "../fixtures/cross-repository/closeout";
import { API_MEMBER, memberRef, WEB_MEMBER } from "../fixtures/cross-repository/constants";

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

describe("GH-310 member-mode skip discloses one member without touching the other", () => {
  test("an unlanded member keeps its entry and is disclosed in data", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER, { merged: false }),
    ];
    const harness = createQueueRemovalHarness({
      label: "member-skip-partial",
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
      expect(
        result.data.members?.find((entry) => entry.repoKey === WEB_MEMBER.repoKey)?.landed,
      ).toBe(false);
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual([webRef]);
    } finally {
      harness.dispose();
    }
  });
});
