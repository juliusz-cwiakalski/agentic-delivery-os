/**
 * Corpus expectation checker (TC-BRIEF-010, TC-BRIEF-016).
 *
 * Returns failures naming the case and surface. Used by the corpus test and by
 * its corruption control; never by production code.
 */
import type { BriefSurfaceState } from "../../../packages/core/src/contracts/index";
import { projectBrief } from "../../../packages/core/src/domain/index";
import type { BriefCase } from "./cases";

export const surfaceMismatches = (testCase: BriefCase): string[] => {
  const brief = projectBrief(testCase.facts);
  const failures: string[] = [];
  for (const [id, expected] of Object.entries(testCase.expected.surfaces)) {
    const surface = brief.surfaces.find((entry) => entry.id === id);
    if (surface === undefined) {
      failures.push(`${testCase.name}: surface ${id} is missing`);
      continue;
    }
    if (surface.state !== expected) {
      failures.push(`${testCase.name}: surface ${id} is ${surface.state}, expected ${expected}`);
    }
  }
  return failures;
};

export const declaredStates = (cases: readonly BriefCase[]): readonly BriefSurfaceState[] => {
  const states = new Set<BriefSurfaceState>();
  for (const testCase of cases) {
    for (const state of Object.values(testCase.expected.surfaces)) states.add(state);
  }
  return [...states];
};
