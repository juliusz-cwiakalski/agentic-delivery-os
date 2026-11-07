/**
 * TC-SPEND-005 — cost is never aggregated and never rendered: token counts
 * alone constitute the breakdown, and a null cost is a disclosed degradation.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeSessionRecord,
  removeRoot,
  type SpendSeed,
  SYNTHETIC_BRAND,
  tokens,
  warning,
} from "../fixtures/spend/harness";

const session = (cost: number | null) =>
  makeSessionRecord({
    runId: "run-R1",
    tokens: tokens({ input: 100, output: 50 }),
    cost,
    warnings: cost === null ? [warning("cost-missing", "cost")] : [],
  });

const withNullCost: SpendSeed = { records: [session(null)] };
const withNumericCost: SpendSeed = { records: [session(987_654.321)] };

describe("TC-SPEND-005 cost omission", () => {
  test("a numeric cost enters no sum and renders no currency", () => {
    const nullCase = foldSeed(withNullCost, "cost-null");
    const numericCase = foldSeed(withNumericCost, "cost-numeric");
    try {
      if (nullCase.fold === undefined || !nullCase.fold.ok) throw new Error("null fold failed");
      if (numericCase.fold === undefined || !numericCase.fold.ok) throw new Error("numeric fold");
      expect(numericCase.fold.data.tokensByClass).toEqual(nullCase.fold.data.tokensByClass);
      expect(numericCase.fold.data.perAgent).toEqual(nullCase.fold.data.perAgent);
      expect(numericCase.fold.data.amplification).toEqual(nullCase.fold.data.amplification);
      expect(Object.hasOwn(numericCase.fold.data, "cost")).toBe(false);
      const rendered = JSON.stringify(numericCase.fold.data);
      expect(rendered).not.toContain("987654");
      expect(rendered).not.toContain('"cost":');
      expect(rendered).not.toContain("$");
      const human = renderSpendHuman(numericCase.fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).not.toContain("$");
      expect(human).not.toContain("USD");
      expect(human).not.toContain("987654");
    } finally {
      removeRoot(nullCase.root);
      removeRoot(numericCase.root);
    }
  });

  test("a null cost is disclosed by reason, never zeroed or converted", () => {
    const { fold, root } = foldSeed(withNullCost, "cost-null-disclosed");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.degradation.byReason["cost-missing"]).toBe(1);
      expect(fold.data.degradation.records).toBe(1);
      expect(fold.data.tokensByClass.input).toBe(100);
    } finally {
      removeRoot(root);
    }
  });
});
