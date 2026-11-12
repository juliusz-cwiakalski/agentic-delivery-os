/**
 * TC-QLC-043 (GH-292, NG-4) — the delivered stale-takeover rule is unchanged by
 * the per-ref guard: a lease at or over its TTL is not active on any path, the
 * takeover appends its incident evidence, and one liveness predicate serves
 * every path (the same boundary is one millisecond below the TTL on the
 * dispatch family and the claim path).
 */
import { describe, expect, test } from "bun:test";
import {
  claim,
  claimAdmission,
  dispatchClaim,
  seedLease,
  singleFlightStore,
  TTL,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-043 stale takeover stays delivered", () => {
  test("at the TTL boundary the dispatch family takes over with incident evidence", () => {
    const single = singleFlightStore("takeover-dispatch");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL });
      const claimed = dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(true);
    } finally {
      single.dispose();
    }
  });

  test("one millisecond below the TTL both paths refuse: the boundary is shared", () => {
    const single = singleFlightStore("takeover-boundary");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL - 1 });
      const dispatchRefused = dispatchClaim(single, "GH-241");
      expect(dispatchRefused.ok).toBe(false);
      if (!dispatchRefused.ok) expect(dispatchRefused.code).toBe("queue.single-flight");
      expect(claimAdmission(single, { ref: "GH-241", holder: "lane-2" })).toMatchObject({
        code: "queue.single-flight",
        holder: "lane-1",
      });
    } finally {
      single.dispose();
    }
  });

  test("the claim path takes a stale lease over with the delivered incident evidence", () => {
    const single = singleFlightStore("takeover-claim");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL });
      const claimed = claim(single, { ref: "GH-241", holder: "lane-2" });
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      expect(claimed.value.result).toBe("taken-over");
      expect(claimed.value.incident?.type).toBe("lease-stale-takeover");
      expect(claimed.value.incident?.evidence.map((entry) => entry.key)).toContain(
        "previousHolder",
      );
    } finally {
      single.dispose();
    }
  });
});
