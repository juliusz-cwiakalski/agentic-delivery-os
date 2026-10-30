/**
 * TC-RESULT-001 / TC-RESULT-005 / TC-RESULT-006 — envelope field contract,
 * schema/runId discipline, and the conformance validator's rule bijection.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { RESULT_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  assertEnvelopeContract,
  loadGoldenCases,
  RULES,
  type RuleId,
} from "../../packages/testkit/src/result-conformance";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const KEY_SET = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/result/envelope-key-set.json"), "utf8"),
) as {
  schemaVersion: string;
  successKeys: string[];
  failureKeys: string[];
  errorKeys: string[];
};

const errorObject = () => ({
  code: "input.value.rejected",
  category: "user" as const,
  retryable: false,
  consequence: "not_landed" as const,
  remediationHint: "Correct the supplied value and retry.",
});

const successEnvelope = (): Record<string, unknown> => ({
  schemaVersion: RESULT_SCHEMA_VERSION,
  runId: "run-fixture-0001",
  exitCode: 0,
  timing: { totalMs: 13 },
  data: { message: "ok" },
});

const failureEnvelope = (): Record<string, unknown> => ({
  schemaVersion: RESULT_SCHEMA_VERSION,
  runId: "run-fixture-0002",
  exitCode: 1,
  timing: { totalMs: 7 },
  error: errorObject(),
});

const without = (value: Record<string, unknown>, key: string): Record<string, unknown> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};

const contractsFiles = (): string[] =>
  readdirSync(join(ROOT, CONTRACTS_DIR))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `${CONTRACTS_DIR}/${entry}`)
    .sort();

const parse = (relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const identifiers = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) names.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const stringLiterals = (source: ts.SourceFile): string[] => {
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      values.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
};

describe("TC-RESULT-001 envelope field contract", () => {
  test("success keys are exactly the recorded v1 key set", () => {
    const envelope = successEnvelope();
    expect(Object.keys(envelope).sort()).toEqual([...KEY_SET.successKeys].sort());
    expect(Object.hasOwn(envelope, "error")).toBe(false);
  });

  test("failure keys are exactly the recorded v1 key set", () => {
    const envelope = failureEnvelope();
    expect(Object.keys(envelope).sort()).toEqual([...KEY_SET.failureKeys].sort());
    expect(Object.hasOwn(envelope, "data")).toBe(false);
  });

  test("a void success carries an explicit empty data payload", () => {
    const envelope = { ...successEnvelope(), data: {} };
    expect(Object.hasOwn(envelope, "data")).toBe(true);
    expect(envelope.data).toEqual({});
    expect(Object.hasOwn(envelope, "error")).toBe(false);
    expect(assertEnvelopeContract(envelope)).toEqual([]);
  });

  test("an unexpected sixth top-level key fails the recorded key set", () => {
    const envelope = { ...successEnvelope(), extra: true };
    expect(Object.keys(envelope).sort()).not.toEqual([...KEY_SET.successKeys].sort());
    expect(
      assertEnvelopeContract(envelope).some(
        (violation) => violation.rule === "envelope.keys.success",
      ),
    ).toBe(true);
  });

  test("rejection corpus names the offending field and matched rule", () => {
    const cases: Array<{ name: string; rule: RuleId; field: string; envelope: unknown }> = [
      {
        name: "both data and error",
        rule: "envelope.exclusivity",
        field: "data",
        envelope: { ...successEnvelope(), error: errorObject() },
      },
      {
        name: "neither data nor error",
        rule: "envelope.exclusivity",
        field: "error",
        envelope: {
          schemaVersion: RESULT_SCHEMA_VERSION,
          runId: "run-fixture-0003",
          exitCode: 0,
          timing: { totalMs: 1 },
        },
      },
      {
        name: "missing schemaVersion",
        rule: "envelope.mandatory",
        field: "schemaVersion",
        envelope: without(successEnvelope(), "schemaVersion"),
      },
      {
        name: "missing runId",
        rule: "envelope.mandatory",
        field: "runId",
        envelope: without(successEnvelope(), "runId"),
      },
      {
        name: "missing exitCode",
        rule: "envelope.mandatory",
        field: "exitCode",
        envelope: without(successEnvelope(), "exitCode"),
      },
      {
        name: "missing timing",
        rule: "envelope.mandatory",
        field: "timing",
        envelope: without(successEnvelope(), "timing"),
      },
    ];
    for (const entry of cases) {
      const violations = assertEnvelopeContract(entry.envelope);
      expect(
        violations.some(
          (violation) => violation.rule === entry.rule && violation.field.includes(entry.field),
        ),
        entry.name,
      ).toBe(true);
    }
  });
});

describe("TC-RESULT-005 schemaVersion and runId", () => {
  test("schemaVersion is the fixed brand-neutral value", () => {
    expect(RESULT_SCHEMA_VERSION).toBe("delivery.result.v1");
    expect(RESULT_SCHEMA_VERSION).toMatch(/^delivery\.result\.v1$/);
    expect(successEnvelope().schemaVersion).toBe(RESULT_SCHEMA_VERSION);
    expect(failureEnvelope().schemaVersion).toBe(RESULT_SCHEMA_VERSION);
  });

  test("schemaVersion is declared exactly once across contracts", () => {
    const occurrences = contractsFiles().flatMap((file) =>
      stringLiterals(parse(file)).filter((value) => value === "delivery.result.v1"),
    );
    expect(occurrences).toHaveLength(1);
  });

  test("contracts contain no id, clock, or randomness facility", () => {
    const banned = ["randomUUID", "crypto", "setTimeout", "setInterval"];
    for (const file of contractsFiles()) {
      const source = parse(file);
      const names = identifiers(source);
      for (const name of banned) {
        expect(names, `${file} must not reference ${name}`).not.toContain(name);
      }
      const text = source.getFullText();
      expect(text.includes("Date.now"), `${file} must not read Date.now`).toBe(false);
      expect(text.includes("Math.random"), `${file} must not read Math.random`).toBe(false);
    }
  });

  test("runId is present, opaque, and injected", () => {
    const first = successEnvelope();
    const second = successEnvelope();
    second.runId = "run-fixture-9999";
    expect(typeof first.runId).toBe("string");
    expect((first.runId as string).length).toBeGreaterThan(0);
    expect(first.runId as string).toMatch(/^[\x21-\x7e]+$/);
    expect(second.runId).not.toBe(first.runId);
    const firstRest = { ...first };
    const secondRest = { ...second };
    delete firstRest.runId;
    delete secondRest.runId;
    expect(secondRest).toEqual(firstRest);
  });
});

describe("TC-RESULT-006 conformance validator rule bijection", () => {
  const negativeCases: Array<{ name: string; rule: RuleId; envelope: unknown }> = [
    { name: "non-object", rule: "envelope.non-object", envelope: null },
    {
      name: "success extra key",
      rule: "envelope.keys.success",
      envelope: { ...successEnvelope(), extra: true },
    },
    {
      name: "failure extra key",
      rule: "envelope.keys.failure",
      envelope: { ...failureEnvelope(), extra: true },
    },
    {
      name: "missing mandatory field",
      rule: "envelope.mandatory",
      envelope: without(successEnvelope(), "runId"),
    },
    {
      name: "both data and error",
      rule: "envelope.exclusivity",
      envelope: { ...successEnvelope(), error: errorObject() },
    },
    {
      name: "exit code out of range",
      rule: "envelope.exit-code",
      envelope: { ...successEnvelope(), exitCode: 3 },
    },
    {
      name: "error missing consequence",
      rule: "envelope.error.keys",
      envelope: {
        ...failureEnvelope(),
        error: {
          code: "input.value.rejected",
          category: "user",
          retryable: false,
          remediationHint: "Fix the value.",
        },
      },
    },
    {
      name: "invalid consequence",
      rule: "envelope.error.enums",
      envelope: {
        ...failureEnvelope(),
        error: { ...errorObject(), consequence: "maybe" },
      },
    },
    {
      name: "invalid category",
      rule: "envelope.error.enums",
      envelope: {
        ...failureEnvelope(),
        error: { ...errorObject(), category: "other" },
      },
    },
    {
      name: "wrong schemaVersion",
      rule: "envelope.schema-version",
      envelope: { ...successEnvelope(), schemaVersion: "delivery.result.v2" },
    },
    {
      name: "empty runId",
      rule: "envelope.run-id",
      envelope: { ...successEnvelope(), runId: "" },
    },
    {
      name: "negative timing",
      rule: "envelope.timing",
      envelope: { ...successEnvelope(), timing: { totalMs: -1 } },
    },
  ];

  test("every declared rule has at least one negative case", () => {
    const declared = RULES.map((rule) => rule.id);
    const covered = [...new Set(negativeCases.map((entry) => entry.rule))];
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  test("every negative case names a declared rule and reports a violation", () => {
    const declared = new Set<string>(RULES.map((rule) => rule.id));
    for (const entry of negativeCases) {
      expect(declared.has(entry.rule), entry.name).toBe(true);
      const violations = assertEnvelopeContract(entry.envelope);
      expect(
        violations.some((violation) => violation.rule === entry.rule),
        `${entry.name} -> ${entry.rule}`,
      ).toBe(true);
    }
  });

  test("validator accepts representative success and failure envelopes", () => {
    expect(assertEnvelopeContract(successEnvelope())).toEqual([]);
    expect(assertEnvelopeContract(failureEnvelope())).toEqual([]);
  });

  test("validator refuses an empty object or a non-object", () => {
    expect(assertEnvelopeContract({}).length).toBeGreaterThan(0);
    expect(assertEnvelopeContract("not an envelope").length).toBeGreaterThan(0);
    expect(assertEnvelopeContract([]).length).toBeGreaterThan(0);
  });

  test("validator imports no CLI surface", () => {
    const source = readFileSync(join(ROOT, "packages/testkit/src/result-conformance.ts"), "utf8");
    expect(source).not.toContain("@delivery-os/cli");
  });
});

describe("TC-RESULT-006 golden-file sweep", () => {
  test("every delivered golden is accepted with zero violations", async () => {
    const cases = await loadGoldenCases(join(ROOT, "tests/fixtures/result/envelopes"));
    expect(cases.length).toBeGreaterThan(0);
    for (const testCase of cases) {
      const parsed = JSON.parse(testCase.stdout) as unknown;
      expect(assertEnvelopeContract(parsed), testCase.id).toEqual([]);
    }
  });
});
