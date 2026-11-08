/**
 * TC-PLANSUM-001/002 — the optional non-empty `phases[].summary` is accepted,
 * echoed in the verdict, consumed by the commit path, and omission stays valid.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfigYaml } from "../../packages/adapters/src/file/index";
import {
  planDocumentFromValidateData,
  validatePlanValue,
} from "../../packages/core/src/domain/plan-validate";

const ROOT = process.cwd();
const fixture = (name: string): unknown => {
  const text = readFileSync(join(ROOT, `tests/fixtures/plan/summary/${name}.yaml`), "utf8");
  const parsed = parseConfigYaml(text, "project-committed", `${name}.yaml`);
  if (!parsed.ok) throw new Error(`fixture ${name} is not parseable`);
  return parsed.facts.values;
};

describe("TC-PLANSUM-001 optional summary is accepted and echoed", () => {
  test("the verdict echoes the phase summary", () => {
    const validated = validatePlanValue(fixture("with-summary"));
    expect(validated.errors).toEqual([]);
    expect(validated.perPhase[0]?.summary).toBe("Deliver the typed contracts");
    const document = planDocumentFromValidateData({
      verdict: "valid",
      readyForDevelopment: true,
      perPhase: validated.perPhase,
      errors: [],
      truncated: false,
      totalErrors: 0,
      tier: validated.tier,
      ...(validated.tierDeclaration === undefined
        ? {}
        : { tierDeclaration: validated.tierDeclaration }),
    });
    expect(document?.phases[0]?.summary).toBe("Deliver the typed contracts");
  });

  test("an empty summary is rejected as invalid", () => {
    const validated = validatePlanValue(fixture("empty-summary"));
    expect(validated.errors.map((error) => error.field)).toContain("summary");
    expect(validated.errors[0]?.code).toBe("plan.schema.invalid");
  });
});

describe("TC-PLANSUM-002 a plan without summary remains valid", () => {
  test("omission produces no error and no echoed summary", () => {
    const validated = validatePlanValue(fixture("without-summary"));
    expect(validated.errors).toEqual([]);
    expect(validated.perPhase[0]?.summary).toBeUndefined();
  });
});
