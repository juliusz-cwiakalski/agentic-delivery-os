/**
 * TC-GATE-003 / TC-GATE-004 / TC-GATE-005 (phase 6) — the exposure floor is 20
 * counted dispatches or 7 consecutive UTC dates with at least one counted
 * dispatch, whichever comes first; the either/or binds only the floor and never
 * substitutes for coverage, incident truth, or corroboration.
 */
import { describe, expect, test } from "bun:test";
import {
  evaluateSpecs,
  fourteenOnSevenDates,
  gappedDates,
  eligibleSpecs,
  missingClassSpecs,
  twentyOnSixDates,
  uncorroboratedSpecs,
} from "../fixtures/dispatch/evidence-windows";

describe("TC-GATE-003 floor variant: 20 counted dispatches", () => {
  test("20 dispatches across six dates meet the floor and are eligible", () => {
    const { window, evaluation } = evaluateSpecs(twentyOnSixDates());
    expect(window.countedInWindow).toHaveLength(20);
    expect(window.dayCount).toBe(6);
    expect(window.consecutiveDates).toBe(6);
    expect(window.floorMet).toBe(true);
    expect(evaluation.eligibility).toBe(true);
  });

  test("19 dispatches fail the floor and name it", () => {
    const specs = twentyOnSixDates().slice(0, 19);
    const { window, evaluation } = evaluateSpecs(specs);
    expect(window.floorMet).toBe(false);
    expect(evaluation.eligibility).toBe(false);
    expect(evaluation.unmetConditions.map((entry) => entry.condition)).toContain("floor");
  });
});

describe("TC-GATE-004 floor variant: 7 consecutive UTC dates", () => {
  test("14 dispatches on seven consecutive dates meet the floor and are eligible", () => {
    const { window, evaluation } = evaluateSpecs(fourteenOnSevenDates());
    expect(window.countedInWindow).toHaveLength(14);
    expect(window.dayCount).toBe(7);
    expect(window.consecutiveDates).toBe(7);
    expect(window.floorMet).toBe(true);
    expect(evaluation.eligibility).toBe(true);
  });

  test("six consecutive dates plus a gap fail the consecutive requirement", () => {
    const { window, evaluation } = evaluateSpecs(gappedDates());
    expect(window.countedInWindow.length).toBeLessThan(20);
    expect(window.consecutiveDates).toBeLessThan(7);
    expect(window.floorMet).toBe(false);
    expect(evaluation.eligibility).toBe(false);
    expect(evaluation.unmetConditions.map((entry) => entry.condition)).toContain("floor");
  });
});

describe("TC-GATE-005 the floor never substitutes for the other conditions", () => {
  test("floor-met mutants still fail on the specific non-floor condition", () => {
    const cases = [
      { specs: missingClassSpecs("merged"), condition: "coverage" },
      { specs: uncorroboratedSpecs(), condition: "corroboration" },
    ] as const;
    for (const testCase of cases) {
      const { window, evaluation } = evaluateSpecs(testCase.specs);
      expect(window.floorMet).toBe(true);
      expect(evaluation.eligibility).toBe(false);
      expect(evaluation.unmetConditions.map((entry) => entry.condition)).toContain(testCase.condition);
    }
  });

  test("an unresolved divergence fails truth while the floor is met", () => {
    const { window, evaluation } = evaluateSpecs(eligibleSpecs(), {
      divergences: [
        {
          schema: "delivery.dispatch.divergence.v1",
          divergenceId: "DIV-1",
          repository: "github.com/owner/repo",
          ref: "GH-239",
          attemptId: "all11-0",
          state: "open",
          comparisonClass: "tracker-truth",
          engineToken: "pr-open",
          comparisonToken: "blocked",
          evidenceRefs: [],
          recordedAt: "2026-11-08T10:00:00.000Z",
        },
      ],
    });
    expect(window.floorMet).toBe(true);
    expect(evaluation.eligibility).toBe(false);
    expect(evaluation.unmetConditions.map((entry) => entry.condition)).toContain("truth");
  });

  test("the floor is reported separately with its only-floor marker", () => {
    const scenario = evaluateSpecs(eligibleSpecs());
    expect(scenario.window.floorMet).toBe(true);
    // The rendered summary states the floor-only rule (asserted in the golden test).
  });
});
