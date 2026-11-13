/**
 * TC-QLC-040 (GH-292, F-4, AC-F4-1) — the dispatch family refuses ANY live
 * lease whose recorded ref equals the requested ref, same or different holder,
 * with `queue.single-flight` naming the live holder, before any claim, spawn,
 * resume, attempt, or record; the other-ref live lease keeps the delivered
 * `queue.lease-conflict`; a stale lease is not active and proceeds.
 */
import { describe, expect, test } from "bun:test";
import {
  activeLease,
  claim,
  dispatchClaim,
  foldedRefs,
  recordCount,
  seedLease,
  singleFlightStore,
  TTL,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-040 dispatch-family per-ref admission", () => {
  test("a live same-ref lease held by another holder refuses queue.single-flight", () => {
    const single = singleFlightStore("dispatch-other-holder");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const before = recordCount(single);
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(false);
      if (claimed.ok) return;
      expect(claimed.code).toBe("queue.single-flight");
      expect(claimed.holder).toBe("lane-1");
      expect(claimed.summary).toContain("lane-1");
      expect(recordCount(single)).toBe(before);
    } finally {
      single.dispose();
    }
  });

  test("a live same-ref lease held by the dispatch holder itself refuses identically", () => {
    const single = singleFlightStore("dispatch-self-holder");
    try {
      seedLease(single, { holder: "dispatch", ref: "GH-241" });
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(false);
      if (claimed.ok) return;
      expect(claimed.code).toBe("queue.single-flight");
      expect(claimed.holder).toBe("dispatch");
    } finally {
      single.dispose();
    }
  });

  test("a live other-ref lease refuses the delivered queue.lease-conflict", () => {
    const single = singleFlightStore("dispatch-other-ref");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const claimed = dispatchClaim(single, "GH-242");
      expect(claimed.ok).toBe(false);
      if (claimed.ok) return;
      expect(claimed.code).toBe("queue.lease-conflict");
      expect(claimed.summary).toContain("lane-1");
    } finally {
      single.dispose();
    }
  });

  test("a lease at its TTL is stale, not active, and the dispatch proceeds", () => {
    const single = singleFlightStore("dispatch-stale");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL });
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(true);
      const active = activeLease(single);
      const dispatchLease = active.find((lease) => lease.holder === "dispatch");
      expect(dispatchLease?.ref).toBe("GH-241");
      expect(dispatchLease?.takeover?.previousHolder).toBe("lane-1");
    } finally {
      single.dispose();
    }
  });

  test("no live lease admits the dispatch and one lease record is appended", () => {
    const single = singleFlightStore("dispatch-free");
    try {
      const before = recordCount(single);
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(true);
      expect(recordCount(single)).toBe(before + 1);
      expect(foldedRefs(single)).toEqual(["GH-241", "GH-242"]);
    } finally {
      single.dispose();
    }
  });

  test("the refusal precedes the claim: no lease record or attempt record exists", () => {
    const single = singleFlightStore("dispatch-refusal-purity");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const before = recordCount(single);
      dispatchClaim(single, "GH-241");
      expect(recordCount(single)).toBe(before);
      expect(claim(single, { ref: "GH-241", holder: "lane-1" }).ok).toBe(true);
    } finally {
      single.dispose();
    }
  });
});
