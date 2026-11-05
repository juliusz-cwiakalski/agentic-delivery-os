/**
 * TC-DPLAN-014 — disjoint plans answer parallel with a present, empty list and
 * no invented ordering, in both argument orders.
 */
import { describe, expect, test } from "bun:test";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { planDocumentFor } from "../fixtures/plan/harness/index";

const planA = planDocumentFor("GH-306", "overlap/parallel/gh-306.yaml");
const planB = planDocumentFor("GH-307", "overlap/parallel/gh-307.yaml");

describe("TC-DPLAN-014 parallel verdict", () => {
  test("disjoint scopes answer parallel with an empty list in both orders", () => {
    for (const [refA, first, refB, second] of [
      ["GH-306", planA, "GH-307", planB],
      ["GH-307", planB, "GH-306", planA],
    ] as const) {
      const verdict = computePlanOverlap({ refA, planA: first, refB, planB: second });
      expect(verdict.verdict).toBe("parallel");
      expect(Array.isArray(verdict.overlappingPaths)).toBe(true);
      expect(verdict.overlappingPaths).toEqual([]);
      expect(verdict.totalOverlappingPaths).toBe(0);
      expect(verdict.truncated).toBe(false);
      expect(Object.hasOwn(verdict, "ordering")).toBe(false);
      expect(Object.hasOwn(verdict, "reason")).toBe(false);
    }
  });
});
