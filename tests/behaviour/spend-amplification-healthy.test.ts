/**
 * TC-SPEND-014 — a healthy single record-bearing run reads exactly 1, and the
 * multi-run control proves the value is not a constant.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import { A01, A02 } from "../fixtures/spend/cases";
import { foldSeed, removeRoot, SYNTHETIC_BRAND } from "../fixtures/spend/harness";

describe("TC-SPEND-014 healthy amplification is exactly 1", () => {
  test("ratio is strictly 1 with no events, no progress-run name and no restart", () => {
    const { fold, root } = foldSeed(A01.seed, "amplification-healthy");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.amplification.ratio).toBe(1);
      expect(fold.data.amplification.progressRun).toBeNull();
      expect(fold.data.amplification.events).toEqual([]);
      expect(fold.data.restarts).toBe(0);
      const paid = Object.values(fold.data.tokensByClass).reduce((sum, value) => sum + value, 0);
      expect(paid).toBe(A01.paid);
    } finally {
      removeRoot(root);
    }
  });

  test("the human amplification section renders the ratio and states no superseded runs", () => {
    const { fold, root } = foldSeed(A01.seed, "amplification-healthy-human");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: true,
      });
      expect(human).toContain("ratio      1 (paid 185 / progress 185)");
      expect(human).toContain("events     none (no superseded record-bearing run)");
    } finally {
      removeRoot(root);
    }
  });

  test("the multi-run control moves the ratio above 1 with three events", () => {
    const { fold, root } = foldSeed(A02.seed, "amplification-healthy-control");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.amplification.ratio).not.toBe(1);
      if (fold.data.amplification.ratio === null) throw new Error("ratio is null");
      expect(fold.data.amplification.ratio).toBeGreaterThan(1);
      const progress = A02.progress;
      if (progress === null) throw new Error("fixture progress must be positive");
      expect(fold.data.amplification.ratio).toBe(A02.paid / progress);
      expect(fold.data.amplification.events).toHaveLength(3);
      expect(fold.data.amplification.progressRun).toBeNull();
    } finally {
      removeRoot(root);
    }
  });
});
