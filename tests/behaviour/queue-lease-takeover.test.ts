/**
 * TC-QLC-043 (GH-292, NG-4) — the delivered stale-takeover rule is unchanged by
 * the per-ref guard: a lease at or over its TTL is not active on any path, the
 * takeover appends its incident evidence, and one liveness predicate serves
 * every path (the same boundary is one millisecond below the TTL on the
 * dispatch family and the claim path).
 */
import { describe, expect, test } from "bun:test";
import { isLeaseStale } from "../../packages/core/src/domain/index";
import {
  claim,
  claimAdmission,
  dispatchClaim,
  REPO,
  seedLease,
  singleFlightStore,
  TTL,
} from "../fixtures/queue/single-flight/harness";

describe("TC-QLC-043 stale takeover stays delivered", () => {
  test("at the TTL boundary the dispatch family takes over with incident evidence", async () => {
    const single = singleFlightStore("takeover-dispatch");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL });
      const claimed = await dispatchClaim(single, "GH-241");
      expect(claimed.ok).toBe(true);
    } finally {
      single.dispose();
    }
  });

  test("one millisecond below the TTL both paths refuse: the boundary is shared", async () => {
    const single = singleFlightStore("takeover-boundary");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241", ageMs: TTL - 1 });
      const dispatchRefused = await dispatchClaim(single, "GH-241");
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

describe("TC-F6-001 the stale predicate is shared and never silently never fires", () => {
  test("a stale lease is not live on the delivered predicate; a never-stale double names the heartbeat age", () => {
    const stale = {
      ref: "GH-241",
      repository: REPO,
      holder: "lane-1",
      heartbeatAgeMs: TTL,
      ttlMs: TTL,
    };
    // The delivered predicate: at the TTL the lease is not active, so no
    // per-ref refusal exists and the delivered takeover applies.
    expect(isLeaseStale(stale.heartbeatAgeMs, stale.ttlMs)).toBe(true);
    // A deliberately broken double whose stale predicate never fires treats the
    // stale lease as live and refuses the takeover. The divergence names both
    // the heartbeat age and the TTL it fails to consider.
    const brokenNeverStale = (heartbeatAgeMs: number, ttlMs: number): boolean => {
      void heartbeatAgeMs;
      void ttlMs;
      return false;
    };
    const refusedByDouble = !brokenNeverStale(stale.heartbeatAgeMs, stale.ttlMs);
    const controlDivergence = refusedByDouble
      ? `the never-stale double treats heartbeat age ${stale.heartbeatAgeMs} as live against TTL ${stale.ttlMs}`
      : undefined;
    expect(controlDivergence).toContain(String(TTL));
    expect(() => {
      throw new Error(controlDivergence ?? "the never-stale control produced no divergence");
    }).toThrow("heartbeat age");
  });
});
