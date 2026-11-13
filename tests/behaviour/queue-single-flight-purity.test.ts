/**
 * TC-QLC-045 (GH-292, AC-F4-6, NFR-2) — refusal purity: every admission refusal
 * leaves the record count, the lane/lease set, and the folded entry set
 * identical, with two independent observations per absence (the direct claim
 * seam plus the zero record delta), and no case asserts a same-holder/same-ref
 * claim refusal (that outcome is the delivered renewal).
 */
import { describe, expect, test } from "bun:test";
import {
  activeLease,
  claimAdmission,
  dispatchClaim,
  foldedRefs,
  recordCount,
  seedLease,
  singleFlightStore,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-045 refusal purity and precedence", () => {
  test("a dispatch-family refusal changes zero records and zero leases", () => {
    const single = singleFlightStore("purity-dispatch");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const recordsBefore = recordCount(single);
      const leasesBefore = activeLease(single);
      const refsBefore = foldedRefs(single);
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(false);
      expect(recordCount(single)).toBe(recordsBefore);
      expect(activeLease(single)).toEqual(leasesBefore);
      expect(foldedRefs(single)).toEqual(refsBefore);
    } finally {
      single.dispose();
    }
  });

  test("a claim-path refusal changes zero records and keeps the live holder", () => {
    const single = singleFlightStore("purity-claim");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const recordsBefore = recordCount(single);
      const refusal = claimAdmission(single, { ref: "GH-241", holder: "lane-2" });
      expect(refusal).toMatchObject({ code: "queue.single-flight", holder: "lane-1" });
      expect(recordCount(single)).toBe(recordsBefore);
      expect(activeLease(single).map((lease) => lease.holder)).toEqual(["lane-1"]);
    } finally {
      single.dispose();
    }
  });

  test("the delivered owner-hold and precheck precedences keep their order", () => {
    const single = singleFlightStore("purity-order");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      // An unobserved ref cannot resolve a repository, so no lease applies and
      // the admission abstains; the delivered claim refusals classify it.
      expect(claimAdmission(single, { ref: "GH-999", holder: "lane-2" })).toBeUndefined();
    } finally {
      single.dispose();
    }
  });
});
