/**
 * GH-301 dating classification and revalidation windows
 * (TC-MEMDATE-001, TC-MEMDATE-002).
 */
import { describe, expect, test } from "bun:test";
import type {
  MemoryEvaluationResult,
  MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { datingMutants, type MutantCase, revalidationMutants } from "../fixtures/memory/mutants";
import { treeWith } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (
  records: readonly { readonly relative: string; readonly text: string }[],
  extras: readonly MemoryScannedFile[] = [],
): MemoryEvaluationResult =>
  evaluateMemory({ files: treeWith(records, extras), today: TODAY, privacy: EMPTY_VOCABULARY });

const assertCase = (mutant: MutantCase): void => {
  const result = evaluate(mutant.records, mutant.extras ?? []);
  if (mutant.expected === "none") {
    expect({ name: mutant.name, findings: result.findings }).toEqual({
      name: mutant.name,
      findings: [],
    });
    return;
  }
  expect({ name: mutant.name, ids: result.findings.map((finding) => finding.ruleId) }).toEqual({
    name: mutant.name,
    ids: [mutant.expected],
  });
  const area = mutant.expected.split(".")[1];
  expect(result.findings.every((finding) => finding.area === area)).toBe(true);
};

describe("TC-MEMDATE-001 creation-date classification", () => {
  for (const mutant of datingMutants(TODAY)) {
    test(mutant.name, () => {
      assertCase(mutant);
    });
  }

  test("an absent created yields exactly one schema finding and zero dating findings", () => {
    const mutant = datingMutants(TODAY).find((entry) => entry.name === "created absent");
    const result = evaluate(mutant?.records ?? []);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "memory.schema.keys-missing",
    ]);
    expect(result.findings.some((finding) => finding.area === "dating")).toBe(false);
    expect(result.findings[0]?.detail).toContain("created");
  });

  test("a file-name year never synthesizes a creation date", () => {
    const result = evaluate([
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: '---\nid: "lesson-2026-001"\nkind: "lesson"\nscope: "repo"\nstatement: "x"\nevidence: "test:case"\nsource: "ci_verdict"\ntrust: "T4"\ncreated_by: "coder"\nstatus: "candidate"\n---\n',
      },
    ]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "memory.schema.keys-missing",
    ]);
    expect(result.findings.some((finding) => finding.area === "dating")).toBe(false);
  });
});

describe("TC-MEMDATE-002 revalidation windows and capture lines", () => {
  for (const mutant of revalidationMutants(TODAY)) {
    test(mutant.name, () => {
      assertCase(mutant);
    });
  }

  test("an expired window is an advisory and never changes the exit", () => {
    const mutant = revalidationMutants(TODAY).find(
      (entry) => entry.expected === "memory.dating.revalidate-expired",
    );
    const result = evaluate(mutant?.records ?? []);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.severity).toBe("warn");
    expect(result.exitCode).toBe(0);
  });

  test("two runs over the same fixed date are byte-identical", () => {
    const mutant = datingMutants(TODAY).find((entry) => entry.name === "created in the future");
    const first = evaluate(mutant?.records ?? []);
    const second = evaluate(mutant?.records ?? []);
    expect(first.lines).toEqual(second.lines);
  });
});
