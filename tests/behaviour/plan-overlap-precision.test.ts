/**
 * TC-DPLAN-015 — overlap precision across path and wildcard granularity: no
 * false positives, no prefix bleed, and every sequence path genuinely shared.
 * The same-static-prefix conservative sequence is pinned separately (F-6): a
 * pair whose patterns cannot intersect may still answer sequence, never
 * parallel, because package comparison uses static prefixes only.
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
) as Record<
  string,
  { readonly verdict: "parallel" | "run-in-sequence"; readonly overlappingPaths: readonly string[] }
>;

const presentInScope = (
  scope: {
    readonly files?: readonly string[];
    readonly folders?: readonly string[];
    readonly packages?: readonly string[];
  },
  descriptor: string,
): boolean => {
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

  test("same-static-prefix disjoint package globs answer sequence conservatively", () => {
    const planA = planDocumentFor("GH-306", "overlap/precision/same-static-prefix-a.yaml");
    const planB = planDocumentFor("GH-307", "overlap/precision/same-static-prefix-b.yaml");
    const scopeA = planA.phases[0]?.scope;
    const scopeB = planB.phases[0]?.scope;
    if (scopeA === undefined || scopeB === undefined) {
      throw new Error("same-static-prefix fixtures must declare one phase");
    }
    // "packages/core/a*" and "packages/core/b*" share the "packages/core"
    // static prefix but no concrete path can satisfy both (provably disjoint).
    expect(scopeCoversPath(scopeA, "packages/core/auth.ts")).toBe(true);
    expect(scopeCoversPath(scopeA, "packages/core/billing.ts")).toBe(false);
    expect(scopeCoversPath(scopeB, "packages/core/billing.ts")).toBe(true);
    expect(scopeCoversPath(scopeB, "packages/core/auth.ts")).toBe(false);

    // packagePairOverlap compares static prefixes only, so it cannot see the
    // disjoint dynamic segments; it answers sequence — the safe direction
    // (conservative false sequence, never a false parallel). The emitted
    // descriptor is the lexicographically smaller declared pattern, which is
    // not literally present in the other scope.
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    expect(verdict.verdict).toBe("run-in-sequence");
    expect(verdict.overlappingPaths).toEqual(["packages/core/a*"]);
    expect(verdict.ordering).toBe("GH-306-before-GH-307");
    expect(verdict.reason).toBe("shared-paths");

    const reversed = computePlanOverlap({
      refA: "GH-307",
      planA: planB,
      refB: "GH-306",
      planB: planA,
    });
    expect(reversed.verdict).toBe("run-in-sequence");
    expect(reversed.overlappingPaths).toEqual(["packages/core/a*"]);
    expect(reversed.ordering).toBe("GH-306-before-GH-307");
  });
});
