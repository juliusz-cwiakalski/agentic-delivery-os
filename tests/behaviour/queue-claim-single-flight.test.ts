/**
 * TC-QLC-041 (GH-292, F-4, AC-F4-2) — `queue claim` keeps the delivered
 * holder-aware outcomes: the caller's own holder's same-ref lease renews, an
 * another holder's same-ref lease refuses `queue.single-flight` naming the
 * live holder, and any other-ref live lease refuses the delivered
 * `queue.lease-conflict` with the recorded ref unchanged.
 */
import { describe, expect, test } from "bun:test";
import { dispatchAdmissionRefusal } from "../../packages/core/src/app/index";
import { singleFlightRefusalFromLeases } from "../../packages/core/src/app/queue";
import {
  activeLease,
  claim,
  claimAdmission,
  REPO,
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

describe("TC-F6-001 the cross-ref control is repository-scoped, never ref-scoped", () => {
  test("a ref-scoped double admits the cross-ref claim the delivered predicate refuses", () => {
    const single = singleFlightStore("claim-cross-ref-control");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      // The delivered admission answers for a live lease on ANOTHER ref in the
      // same repository: the repository-exclusive conflict, naming the holder.
      const delivered = dispatchAdmissionRefusal(single.store, {
        ref: "GH-242",
        nowMs: single.nowMs(),
      });
      expect(delivered?.code).toBe("queue.lease-conflict");
      expect(delivered?.summary).toContain(`holder:lane-1`);

      // A deliberately broken double scoped to the ref instead of the repository
      // admits the claim. The divergence is the lease it fails to name.
      const brokenRefScoped = (
        leases: readonly { readonly ref: string; readonly repository?: string }[],
        ref: string,
      ) => leases.some((lease) => lease.ref === ref);
      const leaked = brokenRefScoped([{ ref: "GH-241", repository: REPO }], "GH-242");
      expect(leaked).toBe(false);
      // The control's divergence is the difference the double hides: the
      // delivered predicate refuses while the ref-scoped double admits.
      const controlDivergence =
        delivered !== undefined && leaked === false
          ? "the ref-scoped double admits the cross-ref claim and names no lease"
          : undefined;
      expect(controlDivergence).toContain("names no lease");
      expect(() => {
        throw new Error(controlDivergence ?? "the cross-ref control produced no divergence");
      }).toThrow("names no lease");

      // The pure predicate over the same folded lease stays ref-scoped by
      // contract: it refuses only the same ref, so the repository conflict is the
      // admission's job.
      expect(
        singleFlightRefusalFromLeases(
          [{ ref: "GH-241", repository: REPO, holder: "lane-1", heartbeatAgeMs: 0, ttlMs: 90_000 }],
          { ref: "GH-242", holder: "lane-2", repository: REPO },
        ),
      ).toBeUndefined();
    } finally {
      single.dispose();
    }
  });
});
