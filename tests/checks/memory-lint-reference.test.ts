/**
 * GH-301 reference integrity (TC-MEMREF-001, TC-MEMREF-002).
 */
import { describe, expect, test } from "bun:test";
import type { MemoryEvaluationResult } from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { referenceMutants } from "../fixtures/memory/mutants";
import { recordText, treeWith, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (
  records: readonly { readonly relative: string; readonly text: string }[],
): MemoryEvaluationResult =>
  evaluateMemory({ files: treeWith(records), today: TODAY, privacy: EMPTY_VOCABULARY });

describe("TC-MEMREF-001 dangling references", () => {
  for (const mutant of referenceMutants()) {
    test(mutant.name, () => {
      const result = evaluate(mutant.records);
      expect({ name: mutant.name, ids: result.findings.map((finding) => finding.ruleId) }).toEqual({
        name: mutant.name,
        ids: [mutant.expected],
      });
      expect(result.findings[0]?.area).toBe("reference");
      expect(result.findings.some((finding) => finding.area === "schema")).toBe(false);
    });
  }
});

describe("TC-MEMREF-002 resolvable references are silent", () => {
  const symmetric = [
    {
      relative: "lessons/lesson-2026-001-baseline.md",
      text: recordText(
        validLessonFields({ supersedes: ["lesson-2026-002"], contradicts: ["lesson-2026-002"] }),
        "[the other record](./lesson-2026-002-baseline.md)\n",
      ),
    },
    {
      relative: "lessons/lesson-2026-002-baseline.md",
      text: recordText(
        validLessonFields({ id: "lesson-2026-002", superseded_by: "lesson-2026-001" }),
      ),
    },
  ];

  test("a symmetric supersession, a resolvable contradiction, and a resolvable link are silent", () => {
    const result = evaluate(symmetric);
    expect(result.findings.filter((finding) => finding.area === "reference")).toEqual([]);
  });

  test("removing the target makes the same tree noisy", () => {
    const result = evaluate(symmetric.slice(0, 1));
    expect(
      result.findings.some((finding) => finding.ruleId === "memory.reference.supersedes-dangling"),
    ).toBe(true);
  });

  test("an out-of-tree citation is silent while an in-tree missing link fires (F-5)", () => {
    const outOfTree = [
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: recordText(
          validLessonFields(),
          "[agents](../../../AGENTS.md)\n[spec](/doc/spec/features/feature-memory-lint.md)\n",
        ),
      },
    ];
    expect(evaluate(outOfTree).findings).toEqual([]);

    const inTreeMissing = [
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: recordText(validLessonFields(), "[missing](./lesson-2026-999-baseline.md)\n"),
      },
    ];
    expect(evaluate(inTreeMissing).findings.map((finding) => finding.ruleId)).toEqual([
      "memory.reference.link-dangling",
    ]);
  });
});
