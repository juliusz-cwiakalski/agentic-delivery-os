/**
 * TC-BLK-042 — the committed corpus covers every declared blocker behaviour and
 * edge; each case asserts its exact exit, identity, substance, record counts, and
 * v0 posture, and a corrupted expectation fails by name.
 */
import { describe, expect, test } from "bun:test";
import {
  type CorpusCase,
  corpusCases,
  REQUIRED_CATEGORIES,
} from "../fixtures/blockers/corpus/cases";
import { createBlockersHarness } from "../fixtures/blockers/harness";

const evaluateCase = async (testCase: CorpusCase): Promise<string[]> => {
  const harness = createBlockersHarness({
    ...(testCase.callerAudienceFact === undefined
      ? {}
      : { callerAudienceFact: testCase.callerAudienceFact }),
    ...(testCase.capability === undefined ? {} : { capability: testCase.capability }),
    ...(testCase.secrets === undefined ? {} : { secrets: testCase.secrets }),
    ...(testCase.seedQuestions === undefined ? {} : { seedQuestions: testCase.seedQuestions }),
    ...(testCase.seedAnswers === undefined ? {} : { seedAnswers: testCase.seedAnswers }),
  });
  try {
    const run = await harness.run(testCase.argv);
    const failures: string[] = [];
    if (run.exitCode !== testCase.expectedExit) {
      failures.push(`${testCase.id}: exit ${run.exitCode} != ${testCase.expectedExit}`);
    }
    const error = run.envelope?.error as Record<string, unknown> | undefined;
    if (testCase.expectedCode !== undefined && error?.code !== testCase.expectedCode) {
      failures.push(`${testCase.id}: code ${String(error?.code)} != ${testCase.expectedCode}`);
    }
    if (testCase.expectedCode === undefined && error !== undefined) {
      failures.push(`${testCase.id}: unexpected error ${String(error.code)}`);
    }
    if (testCase.expectedChoice !== undefined && run.data?.choice !== testCase.expectedChoice) {
      failures.push(
        `${testCase.id}: choice ${String(run.data?.choice)} != ${testCase.expectedChoice}`,
      );
    }
    if (testCase.expectedText !== undefined && run.data?.text !== testCase.expectedText) {
      failures.push(`${testCase.id}: text ${String(run.data?.text)} != ${testCase.expectedText}`);
    }
    if (
      testCase.expectedApplied !== undefined &&
      (run.data?.applied as unknown) !== testCase.expectedApplied
    ) {
      failures.push(`${testCase.id}: applied ${String(run.data?.applied)} != false`);
    }
    if (testCase.expectedResumeMode !== undefined) {
      const resume = run.data?.laneResume as Record<string, unknown> | undefined;
      if (resume?.mode !== testCase.expectedResumeMode) {
        failures.push(
          `${testCase.id}: resume mode ${String(resume?.mode)} != ${testCase.expectedResumeMode}`,
        );
      }
    }
    const read = harness.read();
    const listed = run.data?.questions;
    const rendered = Array.isArray(listed) ? listed.length : undefined;
    const questionCount = rendered ?? read.questions.length;
    if (
      testCase.expectedQuestionCount !== undefined &&
      questionCount !== testCase.expectedQuestionCount
    ) {
      failures.push(
        `${testCase.id}: questions ${questionCount} != ${testCase.expectedQuestionCount}`,
      );
    }
    if (
      testCase.expectedAnswerCount !== undefined &&
      read.answers.length !== testCase.expectedAnswerCount
    ) {
      failures.push(
        `${testCase.id}: answers ${read.answers.length} != ${testCase.expectedAnswerCount}`,
      );
    }
    if (harness.session.calls.length > 0) {
      failures.push(`${testCase.id}: session calls ${harness.session.calls.join(",")}`);
    }
    return failures;
  } finally {
    harness.cleanup();
  }
};

describe("TC-BLK-042 committed corpus", () => {
  test("the corpus is non-empty and covers every declared category", () => {
    const cases = corpusCases();
    expect(cases.length).toBeGreaterThan(0);
    const categories = new Set(cases.map((testCase) => testCase.category));
    for (const category of REQUIRED_CATEGORIES)
      expect(categories.has(category), category).toBe(true);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length);
  });

  test("every case meets its exact expectation", async () => {
    const failures: string[] = [];
    for (const testCase of corpusCases()) failures.push(...(await evaluateCase(testCase)));
    expect(failures).toEqual([]);
  });

  test("a corrupted expectation fails by case name", async () => {
    const corrupted = corpusCases().map((testCase) =>
      testCase.id === "valid-four-types"
        ? { ...testCase, expectedExit: 1 as const, expectedCode: "blockers.invalid-type" }
        : testCase,
    );
    const failures: string[] = [];
    for (const testCase of corrupted) failures.push(...(await evaluateCase(testCase)));
    expect(failures.some((line) => line.includes("valid-four-types"))).toBe(true);
  });

  test("zero live network calls across the corpus", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("network forbidden");
    }) as typeof fetch;
    try {
      for (const testCase of corpusCases()) await evaluateCase(testCase);
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
