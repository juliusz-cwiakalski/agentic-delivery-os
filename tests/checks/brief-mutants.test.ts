/**
 * TC-BRIEF-021 — non-vacuity meta-check: every named guard is load-bearing. The
 * clean production payload resists each prohibited observable; the mutant
 * produces it, and the failure message names the case.
 */
import { describe, expect, test } from "bun:test";
import { projectBrief } from "../../packages/core/src/domain/index";
import { capSizedFacts } from "../fixtures/brief/harness";
import { briefMutants } from "../fixtures/brief/mutants/catalog";

const clean = projectBrief(capSizedFacts());

const ALL_ACS = [
  "AC-F1-1",
  "AC-F1-2",
  "AC-F2-1",
  "AC-F2-2",
  "AC-F3-1",
  "AC-F4-1",
  "AC-F5-1",
  "AC-F6-1",
  "AC-F6-2",
  "AC-F6-3",
] as const;

describe("TC-BRIEF-021 non-vacuity mutants", () => {
  test("the mutant corpus is non-empty and covers every acceptance criterion", () => {
    expect(briefMutants.length).toBeGreaterThan(0);
    const covered = new Set(briefMutants.map((mutant) => mutant.ac));
    for (const ac of ALL_ACS) expect(covered.has(ac), ac).toBe(true);
    expect(new Set(briefMutants.map((mutant) => mutant.id)).size).toBe(briefMutants.length);
  });

  for (const mutant of briefMutants) {
    test(`${mutant.caseName} produces its prohibited observable`, () => {
      expect(mutant.detect(clean), `${mutant.caseName}: clean payload must resist`).toBe(false);
      const mutated = mutant.apply(clean);
      expect(mutant.detect(mutated), `${mutant.caseName} (${mutant.ac})`).toBe(true);
    });
  }

  test("the clean production payload passes every guard simultaneously", () => {
    for (const mutant of briefMutants) {
      expect(mutant.detect(clean), mutant.caseName).toBe(false);
    }
  });
});
