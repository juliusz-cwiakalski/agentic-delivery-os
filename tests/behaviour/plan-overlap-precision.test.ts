/**
 * TC-DPLAN-015 — overlap precision across path and wildcard granularity: no
 * false positives, no prefix bleed, and every sequence path genuinely shared.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { normalizeRepoPath, scopeCoversPath } from "../../packages/core/src/domain/plan-paths";
import { planDocumentFor } from "../fixtures/plan/harness/index";

const PRECISION_DIR = join(import.meta.dir, "..", "fixtures", "plan", "overlap", "precision");
const expectations = JSON.parse(
  readFileSync(join(PRECISION_DIR, "expectations.json"), "utf8"),
) as Record<string, { readonly verdict: "parallel" | "run-in-sequence"; readonly overlappingPaths: readonly string[] }>;

const presentInScope = (scope: { readonly files?: readonly string[]; readonly folders?: readonly string[]; readonly packages?: readonly string[] }, descriptor: string): boolean => {
  const value = normalizeRepoPath(descriptor);
  for (const key of ["files", "folders", "packages"] as const) {
    if ((scope[key] ?? []).some((entry) => normalizeRepoPath(entry) === value)) return true;
  }
  return !value.includes("*") && scopeCoversPath(scope, value);
};

describe("TC-DPLAN-015 precision corpus", () => {
  test("the corpus contains both a parallel and a sequence case (non-vacuity)", () => {
    const verdicts = Object.values(expectations).map((entry) => entry.verdict);
    expect(verdicts).toContain("parallel");
    expect(verdicts).toContain("run-in-sequence");
  });

  test("every pair is classified as hand-computed, with no false verdicts", () => {
    for (const [name, expected] of Object.entries(expectations)) {
      const planA = planDocumentFor("GH-306", `overlap/precision/${name}-a.yaml`);
      const planB = planDocumentFor("GH-307", `overlap/precision/${name}-b.yaml`);
      const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
      expect(verdict.verdict, name).toBe(expected.verdict);
      expect(verdict.overlappingPaths, name).toEqual(expected.overlappingPaths);
      if (verdict.verdict === "run-in-sequence") {
        expect(verdict.overlappingPaths.length, name).toBeGreaterThan(0);
        for (const path of verdict.overlappingPaths) {
          expect(
            planA.phases.some((phase) => presentInScope(phase.scope, path)),
            `${name}: ${path} missing from A`,
          ).toBe(true);
          expect(
            planB.phases.some((phase) => presentInScope(phase.scope, path)),
            `${name}: ${path} missing from B`,
          ).toBe(true);
        }
      }
    }
  });

  test("sibling folders never bleed into each other", () => {
    const planA = planDocumentFor("GH-306", "overlap/precision/sibling-folders-a.yaml");
    const planB = planDocumentFor("GH-307", "overlap/precision/sibling-folders-b.yaml");
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    expect(verdict.verdict).toBe("parallel");
    expect(verdict.overlappingPaths).toEqual([]);
  });
});
