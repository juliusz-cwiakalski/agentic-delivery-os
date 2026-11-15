/**
 * GH-301 schema mutation table and register conformance
 * (TC-MEMSCHEMA-002, TC-MEMSCHEMA-004).
 */
import { describe, expect, test } from "bun:test";
import {
  MEMORY_FINDING_AREA_ORDER,
  MEMORY_FINDING_REGISTER,
  MEMORY_RECORD_OPTIONAL_KEYS,
  MEMORY_RECORD_REQUIRED_KEYS,
  type MemoryEvaluationResult,
  type MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { type MutantCase, schemaControls, schemaMutants } from "../fixtures/memory/mutants";
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
  const found = result.findings[0];
  expect(found?.detail.length ?? 0).toBeGreaterThan(0);
  expect(mutant.records.some((record) => found?.path.endsWith(record.relative))).toBe(true);
};

describe("TC-MEMSCHEMA-002 one defect, one finding", () => {
  for (const mutant of schemaMutants()) {
    test(mutant.name, () => {
      assertCase(mutant);
    });
  }
  for (const control of schemaControls()) {
    test(control.name, () => {
      assertCase(control);
    });
  }
});

describe("TC-MEMSCHEMA-004 closed finding register", () => {
  test("the register declares exactly the Appendix A areas and ids", () => {
    expect([...MEMORY_FINDING_AREA_ORDER]).toEqual([
      "schema",
      "dating",
      "provenance",
      "reference",
      "index",
      "budget",
      "derivable",
      "secret",
    ]);
    expect(MEMORY_FINDING_REGISTER.schema.ids).toEqual([
      "memory.schema.frontmatter-missing",
      "memory.schema.frontmatter-malformed",
      "memory.schema.keys-missing",
      "memory.schema.key-unknown",
      "memory.schema.id-malformed",
      "memory.schema.id-duplicate",
      "memory.schema.file-name-mismatch",
      "memory.schema.value-unknown",
      "memory.schema.statement-too-long",
      "memory.schema.preference-source",
      "memory.schema.guild-mismatch",
      "memory.schema.superseded-by-missing",
    ]);
    expect(MEMORY_FINDING_REGISTER.provenance.ids).toEqual([
      "memory.provenance.evidence-missing",
      "memory.provenance.evidence-shape-unknown",
      "memory.provenance.created-by-missing",
    ]);
    expect(MEMORY_FINDING_REGISTER.reference.ids).toHaveLength(5);
    expect(
      MEMORY_RECORD_REQUIRED_KEYS.every((key) => !MEMORY_RECORD_OPTIONAL_KEYS.includes(key)),
    ).toBe(true);
  });

  test("every emitted id is a register member and every severity projects", () => {
    const cases = [...schemaMutants(), ...schemaControls()];
    for (const mutant of cases) {
      const result = evaluate(mutant.records, mutant.extras ?? []);
      for (const finding of result.findings) {
        const declared =
          finding.area === "secret"
            ? finding.ruleId.startsWith("memory.secret.")
            : (MEMORY_FINDING_REGISTER[finding.area].ids as readonly string[]).includes(
                finding.ruleId,
              );
        expect(declared).toBe(true);
        const areaSeverity = MEMORY_FINDING_REGISTER[finding.area].severity;
        if (finding.area === "derivable") {
          expect(finding.severity).toBe("warn");
        } else if (finding.ruleId === "memory.dating.revalidate-expired") {
          expect(finding.severity).toBe("warn");
        } else {
          expect(finding.severity).toBe(areaSeverity);
        }
      }
    }
  });
});
