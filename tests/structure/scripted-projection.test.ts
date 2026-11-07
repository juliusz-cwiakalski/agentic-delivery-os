/**
 * TC-GH223-021 — the conformance validator enforces scripted-projection rules
 * with a non-vacuous negative control for every declared rule.
 */
import { describe, expect, test } from "bun:test";
import {
  assertEnvelopeContract,
  assertScriptedProjection,
  RULES,
  SCRIPTED_RULES,
  type ScriptedRuleId,
} from "../../packages/testkit/src/result-conformance";

const errorObject = (): Record<string, unknown> => ({
  code: "input.value.rejected",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  remediationHint: "Correct the supplied value and retry.",
});

const successLine = (): string => `${JSON.stringify({ data: { message: "ok" } })}\n`;
const failureLine = (): string =>
  `${JSON.stringify({ error: errorObject(), runId: "run-fixture-0002" })}\n`;

describe("TC-GH223-021 scripted projection validator", () => {
  test("conforming success and failure lines produce zero violations", () => {
    expect(assertScriptedProjection(successLine())).toEqual([]);
    expect(assertScriptedProjection(failureLine())).toEqual([]);
    expect(assertScriptedProjection('{"data":{}}\n')).toEqual([]);
  });

  const negativeCases: Array<{ name: string; rule: ScriptedRuleId; text: string }> = [
    { name: "two lines", rule: "scripted.line", text: `${successLine()}${successLine()}` },
    {
      name: "pretty-indented",
      rule: "scripted.line",
      text: `${JSON.stringify({ data: {} }, null, 2)}\n`,
    },
    { name: "not json", rule: "scripted.object", text: "not-json\n" },
    {
      name: "success with schemaVersion",
      rule: "scripted.trimmed-absent",
      text: `${JSON.stringify({ data: {}, schemaVersion: "delivery.result.v1" })}\n`,
    },
    {
      name: "success with runId",
      rule: "scripted.trimmed-absent",
      text: `${JSON.stringify({ data: {}, runId: "run-1" })}\n`,
    },
    {
      name: "success with timing",
      rule: "scripted.trimmed-absent",
      text: `${JSON.stringify({ data: {}, timing: { totalMs: 1 } })}\n`,
    },
    {
      name: "failure without runId",
      rule: "scripted.failure.keys",
      text: `${JSON.stringify({ error: errorObject() })}\n`,
    },
    {
      name: "nested runId only",
      rule: "scripted.error.keys",
      text: `${JSON.stringify({ error: { ...errorObject(), runId: "run-1" }, runId: "run-1" })}\n`,
    },
    {
      name: "failure missing an error field",
      rule: "scripted.error.keys",
      text: `${JSON.stringify({ error: { code: "input.value.rejected" }, runId: "run-1" })}\n`,
    },
    {
      name: "data and error together",
      rule: "scripted.exclusivity",
      text: `${JSON.stringify({ data: {}, error: errorObject(), runId: "run-1" })}\n`,
    },
    {
      name: "empty object",
      rule: "scripted.exclusivity",
      text: "{}\n",
    },
    {
      name: "success with extra key",
      rule: "scripted.success.keys",
      text: `${JSON.stringify({ data: {}, extra: true })}\n`,
    },
    {
      name: "failure with extra key",
      rule: "scripted.failure.keys",
      text: `${JSON.stringify({ error: errorObject(), runId: "run-1", extra: true })}\n`,
    },
  ];

  test("every declared scripted rule has at least one failing control", () => {
    const declared = SCRIPTED_RULES.map((rule) => rule.id);
    const covered = [...new Set(negativeCases.map((entry) => entry.rule))];
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  test("every negative control reports its specific rule", () => {
    for (const entry of negativeCases) {
      const violations = assertScriptedProjection(entry.text);
      expect(
        violations.some((violation) => violation.rule === entry.rule),
        `${entry.name} -> ${entry.rule}`,
      ).toBe(true);
    }
  });

  test("interactive rules are untouched and the rule sets do not suppress each other", () => {
    const interactiveRules = RULES.map((rule) => rule.id);
    const scriptedRules = SCRIPTED_RULES.map((rule) => rule.id);
    expect(interactiveRules.some((id) => scriptedRules.includes(id as never))).toBe(false);
    expect(assertEnvelopeContract({ data: {} }).length).toBeGreaterThan(0);
    expect(assertScriptedProjection(successLine())).toEqual([]);
  });
});
