/**
 * GH-301 provenance and the schema/provenance presence partition
 * (TC-MEMPROV-001).
 */
import { describe, expect, test } from "bun:test";
import {
  MEMORY_RECORD_EVIDENCE_PREFIXES,
  MEMORY_RECORD_SOURCES,
  type MemoryEvaluationResult,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { provenanceMutants } from "../fixtures/memory/mutants";
import { recordText, treeWith, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (
  records: readonly { readonly relative: string; readonly text: string }[],
): MemoryEvaluationResult =>
  evaluateMemory({ files: treeWith(records), today: TODAY, privacy: EMPTY_VOCABULARY });

describe("TC-MEMPROV-001 evidence and writer are provenance-owned", () => {
  for (const mutant of provenanceMutants()) {
    test(mutant.name, () => {
      const result = evaluate(mutant.records);
      expect({ name: mutant.name, ids: result.findings.map((finding) => finding.ruleId) }).toEqual({
        name: mutant.name,
        ids: [mutant.expected],
      });
      const found = result.findings[0];
      if (mutant.name.includes("source")) {
        expect(found?.area).toBe("schema");
        expect(result.findings.some((finding) => finding.area === "provenance")).toBe(false);
        expect(found?.detail).toContain("source");
      } else {
        expect(found?.area).toBe("provenance");
        expect(result.findings.some((finding) => finding.area === "schema")).toBe(false);
      }
    });
  }

  test("the finding never echoes a full evidence value", () => {
    const result = evaluate([
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: recordText(validLessonFields({ evidence: "we all agreed" })),
      },
    ]);
    expect(result.findings[0]?.detail).not.toContain("we all agreed");
  });

  test("every declared evidence shape and source channel is silent", () => {
    for (const prefix of MEMORY_RECORD_EVIDENCE_PREFIXES) {
      for (const source of MEMORY_RECORD_SOURCES) {
        const result = evaluate([
          {
            relative: "lessons/lesson-2026-001-baseline.md",
            text: recordText(validLessonFields({ evidence: `${prefix} value`, source })),
          },
        ]);
        expect({ prefix, source, findings: result.findings }).toEqual({
          prefix,
          source,
          findings: [],
        });
      }
    }
  });
});
