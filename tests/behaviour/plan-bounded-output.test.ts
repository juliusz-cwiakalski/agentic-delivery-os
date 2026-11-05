/**
 * TC-DPLAN-025 — oversized verdict payloads truncate deterministically with an
 * explicit marker and total count; truncation never changes the verdict.
 */
import { describe, expect, test } from "bun:test";
import { PLAN_MAX_DIFF_PATHS, PLAN_MAX_OVERLAPPING_PATHS } from "../../packages/core/src/contracts/index";
import { computePlanDiff } from "../../packages/core/src/domain/plan-diff";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { diffFixture, planDocumentFor } from "../fixtures/plan/harness/index";

describe("TC-DPLAN-025 overlap bounds", () => {
  test("the path list truncates with a marker, total count, and an unchanged verdict", () => {
    const planA = planDocumentFor("GH-306", "overlap/bounded/a.yaml");
    const planB = planDocumentFor("GH-307", "overlap/bounded/b.yaml");
    const data = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    expect(data.verdict).toBe("run-in-sequence");
    expect(data.overlappingPaths).toHaveLength(PLAN_MAX_OVERLAPPING_PATHS);
    expect(data.totalOverlappingPaths).toBe(80);
    expect(data.truncated).toBe(true);
    expect(data.overlappingPaths.length).toBeGreaterThan(0);
    expect(JSON.stringify(computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB }))).toBe(
      JSON.stringify(data),
    );
  });
});

describe("TC-DPLAN-025 diff bounds", () => {
  test("the entry table truncates with a marker and total count", () => {
    const fixture = diffFixture("diff/bounded");
    const data = computePlanDiff({
      workItemRef: "GH-308",
      document: planDocumentFor("GH-308", "diff/bounded/plan.yaml"),
      actualPaths: fixture.paths,
      against: fixture.against,
    });
    expect(data.verdict).toBe("findings");
    expect(data.entries).toHaveLength(PLAN_MAX_DIFF_PATHS);
    expect(data.totalEntries).toBe(80);
    expect(data.truncated).toBe(true);
  });
});
