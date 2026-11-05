/**
 * TC-DPLAN-002 and TC-DPLAN-003 — invalid schema is classified naming phase
 * and field, every uncomputable class is refused, and none is silently
 * accepted. The real bounded YAML parse path runs; no parser mock.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validatePlanValue } from "../../packages/core/src/domain/plan-validate";
import {
  fixture,
  planYamlParser,
  validateYamlFixture,
} from "../fixtures/plan/harness/index";

const INVALID_DIR = join(import.meta.dir, "..", "fixtures", "plan", "invalid");

type Expectation = {
  readonly code: string;
  readonly field: string;
  readonly phase?: number;
};

const expectations = JSON.parse(
  readFileSync(join(INVALID_DIR, "expectations.json"), "utf8"),
) as Record<string, Expectation>;

const fixtureFiles = readdirSync(INVALID_DIR)
  .filter((entry) => entry !== "expectations.json")
  .sort();

describe("TC-DPLAN-002 invalid schema naming phase and field", () => {
  test("a phase missing its scope reports plan.schema.invalid phase 6 scope.files", () => {
    const verdict = validateYamlFixture("GH-308", "invalid/phase-missing-scope.yaml");
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.errors.length).toBeGreaterThan(0);
    const match = verdict.errors.find(
      (error) => error.code === "plan.schema.invalid" && error.phase === 6,
    );
    expect(match?.field).toBe("scope.files");
    expect(match?.problem).toBe("missing");
    expect(verdict.errors.some((error) => error.code === "fallback.internal")).toBe(false);
  });
});

describe("TC-DPLAN-003 rejection corpus", () => {
  test("the expectation table matches the directory contents (non-vacuity)", () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(10);
    expect(fixtureFiles).toEqual(Object.keys(expectations).sort());
  });

  test("every invalid fixture is classified with the expected code, phase, and field", () => {
    for (const file of fixtureFiles) {
      const expected = expectations[file];
      expect(expected, file).toBeDefined();
      const verdict = validateYamlFixture("GH-306", `invalid/${file}`);
      expect(verdict.verdict, file).toBe("invalid");
      expect(verdict.readyForDevelopment, file).toBe(false);
      expect(verdict.errors.length, file).toBeGreaterThan(0);
      const matching = verdict.errors.find(
        (error) =>
          error.code === expected?.code &&
          error.field === expected?.field &&
          (expected?.phase === undefined || error.phase === expected.phase),
      );
      expect(matching, `${file}: missing ${expected?.code} ${expected?.field}`).toBeDefined();
      for (const error of verdict.errors) {
        expect(error.code.startsWith("plan."), file).toBe(true);
      }
    }
  });

  test("no fixture throws, emits a stack trace, or reports valid", () => {
    for (const file of fixtureFiles) {
      let verdict: ReturnType<typeof validateYamlFixture> | undefined;
      expect(() => {
        verdict = validateYamlFixture("GH-306", `invalid/${file}`);
      }, file).not.toThrow();
      expect(verdict?.verdict, file).toBe("invalid");
    }
  });

  test("unparseable YAML is classified rather than reinterpreted", () => {
    const verdict = validateYamlFixture("GH-306", "invalid/unparseable.yaml.txt");
    expect(verdict.errors[0]?.code).toBe("plan.schema.invalid");
    expect(verdict.errors[0]?.field).toBe("document");
  });
});

describe("TC-DPLAN-003 parsed-value validation", () => {
  test("a non-mapping top level is classified at the document", () => {
    const verdict = validatePlanValue(["not", "a", "mapping"]);
    expect(verdict.errors[0]?.field).toBe("document");
    expect(verdict.perPhase).toEqual([]);
  });

  test("the corpus text is real fixture text, not generated in the test", () => {
    expect(fixture("invalid/wrong-value-type.yaml")).toContain("files: not-an-array");
    expect(planYamlParser("schemaVersion: delivery.plan.v1\n").ok).toBe(true);
  });
});
