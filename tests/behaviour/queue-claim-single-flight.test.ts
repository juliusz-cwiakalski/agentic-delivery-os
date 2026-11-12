/**
 * TC-QLC-041 (GH-292, F-4, AC-F4-2) — `queue claim` keeps the delivered
 * holder-aware outcomes: the caller's own holder's same-ref lease renews, an
 * another holder's same-ref lease refuses `queue.single-flight` naming the
 * live holder, and any other-ref live lease refuses the delivered
 * `queue.lease-conflict` with the recorded ref unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  activeLease,
  claim,
  claimAdmission,
  recordCount,
  seedLease,
  singleFlightStore,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-041 claim-path holder-aware admission", () => {
  test("the caller's own holder's same-ref lease renews and carries no refusal", () => {
    const single = singleFlightStore("claim-own-holder");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      expect(claimAdmission(single, { ref: "GH-241", holder: "lane-1" })).toBeUndefined();
      const claimed = claim(single, { ref: "GH-241", holder: "lane-1" });
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      expect(claimed.value.result).toBe("renewed");
    } finally {
      single.dispose();
    }
  });

  test("another holder's same-ref lease refuses queue.single-flight naming the holder", () => {
    const single = singleFlightStore("claim-other-holder");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const refusal = claimAdmission(single, { ref: "GH-241", holder: "lane-2" });
      expect(refusal).toMatchObject({ code: "queue.single-flight", holder: "lane-1" });
      const before = recordCount(single);
      const claimed = claim(single, { ref: "GH-241", holder: "lane-2" });
      expect(claimed.ok).toBe(false);
      if (!claimed.ok && claimed.kind === "queue") {
        expect(claimed.code).toBe("queue.lease-conflict");
      }
      expect(recordCount(single)).toBe(before);
    } finally {
      single.dispose();
    }
  });

  test("a live other-ref lease refuses the delivered queue.lease-conflict", () => {
    const single = singleFlightStore("claim-other-ref");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      expect(claimAdmission(single, { ref: "GH-242", holder: "lane-2" })).toBeUndefined();
      const claimed = claim(single, { ref: "GH-242", holder: "lane-2" });
      expect(claimed.ok).toBe(false);
      if (!claimed.ok && claimed.kind === "queue") {
        expect(claimed.code).toBe("queue.lease-conflict");
        if (claimed.code === "queue.lease-conflict") {
          expect(claimed.conflict.holder).toBe("lane-1");
        }
      }
      const active = activeLease(single);
      expect(active.find((lease) => lease.repository !== undefined)?.ref).toBe("GH-241");
    } finally {
      single.dispose();
    }
  });
});
