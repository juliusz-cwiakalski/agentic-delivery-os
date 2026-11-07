/**
 * TC-SPEND-016 — the captured-at descending / run-id ascending tie-break,
 * permutation invariance, and the absence of any ambient clock or randomness in
 * the formula.
 */
import { describe, expect, test } from "bun:test";
import { computeSpendReport } from "../../packages/core/src/domain/index";
import { A02, A03, A10_RECORDS } from "../fixtures/spend/cases";
import {
  createProbeSpy,
  foldSeed,
  makeSessionRecord,
  removeRoot,
  tokens,
} from "../fixtures/spend/harness";

const reverse = <T>(items: readonly T[]): readonly T[] => [...items].reverse();

describe("TC-SPEND-016 deterministic ordering of the formula", () => {
  test("equal stamps select the lexicographically smallest run id as the progress run", () => {
    const forward = foldSeed(A03.seed, "amplification-tie-forward");
    const backward = foldSeed(
      { records: reverse(A03.seed.records ?? []), transitions: A03.seed.transitions },
      "amplification-tie-backward",
    );
    try {
      if (forward.fold === undefined || !forward.fold.ok) throw new Error("forward failed");
      if (backward.fold === undefined || !backward.fold.ok) throw new Error("backward failed");
      expect(forward.fold.data.amplification).toEqual(backward.fold.data.amplification);
      const progress = A03.progress;
      if (progress === null) throw new Error("fixture progress must be positive");
      expect(forward.fold.data.amplification.ratio).toBe(A03.paid / progress);
      expect(forward.fold.data.amplification.progressRun).toBeNull();
      expect(forward.fold.data.amplification.events).toHaveLength(1);
      expect(forward.fold.data.amplification.events[0]?.tokensWasted).toBe(300);
    } finally {
      removeRoot(forward.root);
      removeRoot(backward.root);
    }
  });

  test("the ordering never depends on a run id's sortability", () => {
    const stamps = "2026-11-01T10:00:00.000Z";
    const records = [
      makeSessionRecord({ runId: "run-7", capturedAt: stamps, tokens: tokens({ input: 100 }) }),
      makeSessionRecord({
        runId: "run-10",
        sessionId: "ses-10",
        capturedAt: stamps,
        tokens: tokens({ input: 400 }),
      }),
    ];
    const folded = foldSeed({ records, transitions: [] }, "amplification-opaque-ids");
    try {
      if (folded.fold === undefined || !folded.fold.ok) throw new Error("fold failed");
      // "run-10" < "run-7" lexicographically, so run-10 is the progress run.
      expect(folded.fold.data.amplification.ratio).toBe(500 / 400);
    } finally {
      removeRoot(folded.root);
    }
  });

  test("a shuffled A-02 renders the identical data payload", () => {
    const baseline = foldSeed(A02.seed, "amplification-shuffle-baseline");
    const shuffled = foldSeed(
      { records: A10_RECORDS, transitions: A02.seed.transitions },
      "amplification-shuffle",
    );
    try {
      if (baseline.fold === undefined || !baseline.fold.ok) throw new Error("baseline failed");
      if (shuffled.fold === undefined || !shuffled.fold.ok) throw new Error("shuffled failed");
      expect(JSON.stringify(shuffled.fold.data)).toBe(JSON.stringify(baseline.fold.data));
    } finally {
      removeRoot(baseline.root);
      removeRoot(shuffled.root);
    }
  });

  test("throwing ambient clock and randomness stubs change nothing and zero model calls", () => {
    const seeded = foldSeed(A02.seed, "amplification-no-clock");
    try {
      if (seeded.fold === undefined || !seeded.fold.ok) throw new Error("fold failed");
      if (!seeded.read.ok) throw new Error("read failed");
      const adapter = createProbeSpy();
      const originalNow = Date.now;
      const originalRandom = Math.random;
      Date.now = () => {
        throw new Error("the spend fold must never read the clock");
      };
      Math.random = () => {
        throw new Error("the spend fold must never read randomness");
      };
      try {
        const again = computeSpendReport(seeded.read.value, { workItemRef: "GH-236" });
        expect(again.ok).toBe(true);
        if (!again.ok) return;
        expect(JSON.stringify(again.data)).toBe(JSON.stringify(seeded.fold.data));
        expect(adapter.calls()).toBe(0);
      } finally {
        Date.now = originalNow;
        Math.random = originalRandom;
      }
    } finally {
      removeRoot(seeded.root);
    }
  });
});
