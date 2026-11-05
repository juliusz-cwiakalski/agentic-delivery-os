/**
 * TC-DPLAN-013 (domain half) — overlap answers sequence with every overlapping
 * path named and the declared producer first.
 */
import { describe, expect, test } from "bun:test";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { scopeCoversPath } from "../../packages/core/src/domain/plan-paths";
import { planDocumentFor } from "../fixtures/plan/harness/index";

const planA = planDocumentFor("GH-306", "overlap/sequence/gh-306.yaml");
const planB = planDocumentFor("GH-307", "overlap/sequence/gh-307.yaml");

describe("TC-DPLAN-013 sequence verdict", () => {
  test("names every shared path and orders the producer first", () => {
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    expect(verdict.verdict).toBe("run-in-sequence");
    expect(verdict.overlappingPaths).toEqual([
      "doc/spec/features/feature-scheduler.md",
      "packages/core/src/contracts/queue.ts",
    ]);
    expect(verdict.ordering).toBe("GH-306-before-GH-307");
    expect(verdict.reason).toBe("shared-contract-files");
  });

  test("the ordering is unchanged when the refs are reversed", () => {
    const verdict = computePlanOverlap({ refA: "GH-307", planA: planB, refB: "GH-306", planB: planA });
    expect(verdict.ordering).toBe("GH-306-before-GH-307");
    expect(verdict.verdict).toBe("run-in-sequence");
  });

  test("every listed path is present in both declared scopes", () => {
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    for (const path of verdict.overlappingPaths) {
      const inA = planA.phases.some((phase) => scopeCoversPath(phase.scope, path));
      const inB = planB.phases.some((phase) => scopeCoversPath(phase.scope, path));
      expect(inA, `${path} missing from GH-306`).toBe(true);
      expect(inB, `${path} missing from GH-307`).toBe(true);
    }
  });
});
