/**
 * TC-SPEND-017 — the generalized zero-progress null rule: `ratio: null` with a
 * machine-readable `progressRun` naming the run, for paid > 0 and for the
 * degenerate paid = 0 case, plus the no-record-bearing-run null/null boundary.
 */
import { describe, expect, test } from "bun:test";
import { SPEND_AMPLIFICATION_KEYS } from "../../packages/core/src/contracts/index";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import { A01, A04, A05, A11 } from "../fixtures/spend/cases";
import { foldSeed, removeRoot, SYNTHETIC_BRAND } from "../fixtures/spend/harness";

describe("TC-SPEND-017 zero-progress null rule", () => {
  test("A-04 reports a strict null ratio naming the zero-token progress run", () => {
    const { fold, root } = foldSeed(A04.seed, "amplification-null-a04");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.amplification.ratio).toBeNull();
      expect(fold.data.amplification.progressRun).toBe("run-R2");
      expect(fold.data.amplification.events).toHaveLength(1);
      expect(fold.data.amplification.events[0]?.tokensWasted).toBe(400);
      expect(Object.keys(fold.data.amplification)).toEqual([...SPEND_AMPLIFICATION_KEYS]);
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: true,
      });
      expect(human).toContain("ratio      null (zero-token progress run run-R2)");
    } finally {
      removeRoot(root);
    }
  });

  test("A-05 the degenerate paid = 0 and progress = 0 case is a success report", () => {
    const { fold, root } = foldSeed(A05.seed, "amplification-null-a05");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.amplification.ratio).toBeNull();
      expect(fold.data.amplification.progressRun).toBe("run-R2");
      expect(fold.data.amplification.events).toEqual([]);
      expect(fold.data.tokensByClass).toEqual({
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      });
      // Records exist, so this is never telemetry-absent and never ratio 1.
      expect(fold.data.degradation.records).toBe(2);
      expect(fold.data.degradation.byReason["optional-field-absent"]).toBe(2);
    } finally {
      removeRoot(root);
    }
  });

  test("A-11 the no-record-bearing-run boundary is null/null and still successful", () => {
    const { fold, root } = foldSeed(A11.seed, "amplification-null-a11");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.amplification.ratio).toBeNull();
      expect(fold.data.amplification.progressRun).toBeNull();
      expect(fold.data.amplification.events).toEqual([]);
      expect(fold.data.restarts).toBe(0);
      expect(fold.data.degradation.records).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("the null/named pair and the null/null boundary are distinguishable", () => {
    const named = foldSeed(A04.seed, "amplification-null-distinguish-a04");
    const unborn = foldSeed(A11.seed, "amplification-null-distinguish-a11");
    try {
      if (!named.fold?.ok || !unborn.fold?.ok) throw new Error("fold failed");
      expect(named.fold.data.amplification.ratio).toBeNull();
      expect(unborn.fold.data.amplification.ratio).toBeNull();
      expect(named.fold.data.amplification.progressRun).not.toBeNull();
      expect(unborn.fold.data.amplification.progressRun).toBeNull();
    } finally {
      removeRoot(named.root);
      removeRoot(unborn.root);
    }
  });

  test("the healthy control never reports null for a positive single run", () => {
    const { fold, root } = foldSeed(A01.seed, "amplification-null-control");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.amplification.ratio).toBe(1);
    } finally {
      removeRoot(root);
    }
  });
});
