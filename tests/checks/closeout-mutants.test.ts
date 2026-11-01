/** TC-CLOSE-064 — every broken guard fails naming its mutant case. */
import { describe, expect, test } from "bun:test";
import { MUTANT_CASES } from "../fixtures/closeout/mutants/cases";

describe("TC-CLOSE-064 non-vacuity meta-check", () => {
  test("the mutant corpus is non-empty and every guard passes on the real module", () => {
    expect(MUTANT_CASES.length).toBeGreaterThan(0);
    for (const mutant of MUTANT_CASES) {
      expect(mutant.violates(mutant.real()), `${mutant.id}: real module`).toBe(false);
    }
  });

  test("every mutant produces the prohibited observable and names the case", () => {
    for (const mutant of MUTANT_CASES) {
      const prohibited = mutant.violates(mutant.mutant());
      if (!prohibited) throw new Error(`${mutant.id}: ${mutant.prohibited} did not fire`);
      expect(prohibited, mutant.id).toBe(true);
    }
  });
});
