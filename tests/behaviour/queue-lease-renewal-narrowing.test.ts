/**
 * TC-QLC-044 (GH-292, DEC-13, TDR-0026 DC-3) — renewal is narrowed to one
 * `(repository, ref, holder)`: the direct `claimQueueLease` seam's
 * same-holder/same-ref renewal is unchanged, and a same-holder claim for a
 * different ref refuses the delivered `queue.lease-conflict` so the lease's
 * recorded ref is never rewritten.
 */
import { describe, expect, test } from "bun:test";
import {
  activeLease,
  claim,
  seedLease,
  singleFlightStore,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-044 narrowed same-holder renewal", () => {
  test("the same holder on the same ref still renews the delivered way", () => {
    const single = singleFlightStore("narrow-renew");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const claimed = claim(single, { ref: "GH-241", holder: "lane-1" });
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      expect(claimed.value.result).toBe("renewed");
      expect(claimed.value.lease.ref).toBe("GH-241");
    } finally {
      single.dispose();
    }
  });

  test("the same holder claiming a different ref refuses queue.lease-conflict", () => {
    const single = singleFlightStore("narrow-other-ref");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const claimed = claim(single, { ref: "GH-242", holder: "lane-1" });
      expect(claimed.ok).toBe(false);
      if (!claimed.ok && claimed.kind === "queue") {
        expect(claimed.code).toBe("queue.lease-conflict");
        if (claimed.code === "queue.lease-conflict") {
          expect(claimed.conflict.holder).toBe("lane-1");
        }
      }
      // The lease's recorded ref is unchanged: the second ref was not adopted.
      const active = activeLease(single);
      expect(active).toHaveLength(1);
      expect(active[0]?.ref).toBe("GH-241");
    } finally {
      single.dispose();
    }
  });
});
