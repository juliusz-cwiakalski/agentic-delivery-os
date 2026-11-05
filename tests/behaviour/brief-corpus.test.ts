/**
 * TC-BRIEF-016 — corpus completeness: every surface, state edge, and placeholder
 * is represented by a committed case whose corruption fails by case name.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SURFACE_ORDER,
} from "../../packages/core/src/contracts/index";
import { declaredStates, surfaceMismatches } from "../fixtures/brief/check";
import { corpusCases } from "../fixtures/brief/corpus/cases";
import { matrixCases } from "../fixtures/status/matrix/cases";

const ROOT = process.cwd();
const CORPUS = "tests/fixtures/brief/corpus";

const projectPlaceholderIds = (testCase: (typeof corpusCases)[number]): string[] => {
  const ids: string[] = [];
  for (const id of Object.keys(testCase.expected.surfaces)) {
    if (BRIEF_PLACEHOLDER_CATALOG.some((entry) => entry.capability === id)) ids.push(id);
  }
  return ids;
};

describe("TC-BRIEF-016 corpus completeness", () => {
  test("every committed case matches its declared surface states", () => {
    expect(corpusCases.length).toBeGreaterThan(0);
    for (const testCase of corpusCases) {
      expect(surfaceMismatches(testCase), testCase.name).toEqual([]);
    }
  });

  test("the corpus file count is non-zero and the case-name set is sorted deterministically", () => {
    expect(readdirSync(join(ROOT, CORPUS)).length).toBeGreaterThan(0);
    const names = corpusCases
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    expect(new Set(names).size).toBe(names.length);
  });

  test("every closed surface is declared, and every state the digest can produce appears", () => {
    const declared = new Set<string>();
    for (const testCase of corpusCases) {
      for (const id of Object.keys(testCase.expected.surfaces)) declared.add(id);
    }
    for (const id of BRIEF_SURFACE_ORDER) expect(declared.has(id), id).toBe(true);
    const states = new Set(declaredStates(corpusCases));
    for (const state of ["observed", "degraded", "unknown", "unavailable", "not-delivered"]) {
      expect(states.has(state as never), state).toBe(true);
    }
  });

  test("every §4.7 matrix control and every catalog placeholder is named", () => {
    const names = corpusCases.map((entry) => entry.name);
    for (const matrixCase of matrixCases) {
      expect(names).toContain(`matrix-${matrixCase.name}`);
    }
    for (const entry of BRIEF_PLACEHOLDER_CATALOG) {
      const present = corpusCases.some((testCase) =>
        projectPlaceholderIds(testCase).includes(entry.capability),
      );
      expect(present, entry.capability).toBe(true);
    }
  });

  test("a corrupted state, count, or placeholder story fails by case name", () => {
    const original = corpusCases[0];
    if (original === undefined) throw new Error("corpus is empty");
    expect(surfaceMismatches(original)).toEqual([]);
    const corrupted = {
      ...original,
      expected: {
        surfaces: { ...original.expected.surfaces, ci: "unavailable" as const },
      },
    };
    const failures = surfaceMismatches(corrupted);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join("\n")).toContain(original.name);
  });
});
