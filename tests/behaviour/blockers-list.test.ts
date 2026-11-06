/**
 * TC-BLK-034 — the `blockers list` surface: declared `questions[]` fields,
 * default vs `--open`, open ranked ahead of the resolved group, text parity, and
 * a verified-empty explicit empty result.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { createBlockersHarness, FIXED_NOW_MS } from "../fixtures/blockers/harness";
import { makeAnswer, makeQuestion } from "../fixtures/blockers/records";

const at = (hoursAgo: number): string =>
  new Date(FIXED_NOW_MS - hoursAgo * 3_600_000).toISOString();

const population = () => ({
  seedQuestions: [
    makeQuestion({
      id: "q-1",
      type: "decision-needed",
      audience: "coordinator",
      askedAt: at(1),
      options: ["a", "b"],
    }),
    makeQuestion({
      id: "q-2",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(5),
      options: [],
    }),
    makeQuestion({
      id: "q-3",
      type: "external-wait",
      audience: "coordinator",
      askedAt: at(2),
      options: [],
    }),
    makeQuestion({
      id: "q-4",
      type: "decision-needed",
      audience: "owner",
      askedAt: at(30),
      options: ["a"],
    }),
    makeQuestion({
      id: "q-5",
      type: "spec-ambiguity",
      audience: "owner",
      askedAt: at(40),
      options: [],
    }),
  ],
  seedAnswers: [
    makeAnswer({ questionId: "q-4", answeringAudience: "owner", choice: "a" }),
    makeAnswer({ questionId: "q-5", answeringAudience: "owner", text: "spec" }),
  ],
});

describe("TC-BLK-034 list surface", () => {
  test("machine mode carries every declared field and exit 0", async () => {
    const harness = createBlockersHarness(population());
    try {
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      const questions = run.data?.questions as Record<string, unknown>[];
      expect(questions).toHaveLength(5);
      for (const question of questions) {
        for (const key of [
          "id",
          "type",
          "audience",
          "lane",
          "ref",
          "question",
          "options",
          "askedAt",
          "age",
          "status",
        ]) {
          expect(Object.hasOwn(question, key), `${question.id} ${key}`).toBe(true);
        }
        if (question.status === "open") {
          expect(typeof question.rank).toBe("number");
        } else {
          expect(question.rank).toBeUndefined();
          expect(question.answer).toBeDefined();
        }
      }
      expect(questions.map((question) => question.status)).toEqual([
        "open",
        "open",
        "open",
        "answered",
        "answered",
      ]);
      expect(questions.map((question) => question.id)).toEqual(["q-1", "q-2", "q-3", "q-5", "q-4"]);
      expect(questions[0]?.age).toBe(3_600_000);
      expect(questions[0]?.ref).toBeNull();
      expect(questions[0]?.options).toEqual(["a", "b"]);
      expect(questions.find((question) => question.id === "q-2")?.options).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("--open keeps only the open ranking with the same ranks", async () => {
    const harness = createBlockersHarness(population());
    try {
      const all = await harness.run(["list"]);
      const open = await harness.run(["list", "--open"]);
      expect(open.exitCode).toBe(0);
      const openQuestions = open.data?.questions as Record<string, unknown>[];
      expect(openQuestions.map((question) => question.id)).toEqual(["q-1", "q-2", "q-3"]);
      expect(openQuestions.map((question) => question.status)).toEqual(["open", "open", "open"]);
      const allQuestions = all.data?.questions as Record<string, unknown>[];
      expect(openQuestions.map((question) => question.rank)).toEqual(
        allQuestions.slice(0, 3).map((question) => question.rank),
      );
    } finally {
      harness.cleanup();
    }
  });

  test("human mode renders one ranked line per question with a separate answered group", async () => {
    const harness = createBlockersHarness(population());
    try {
      const run = await harness.run(["list"], { json: false });
      expect(run.exitCode).toBe(0);
      const text = run.stdout;
      for (const id of ["q-1", "q-2", "q-3", "q-4", "q-5"]) expect(text).toContain(id);
      for (const token of ["audience=", "lane=", "age="]) expect(text).toContain(token);
      expect(text).toContain("1.");
      expect(text).toContain("answered");
      expect(text.indexOf("q-1")).toBeLessThan(text.indexOf("q-4"));
      expect(text.includes("\u001b[")).toBe(false);
      expect(text).not.toContain("askedAt");
    } finally {
      harness.cleanup();
    }
  });

  test("verified-empty renders an explicit empty list at exit 0", async () => {
    const harness = createBlockersHarness();
    try {
      const machine = await harness.run(["list"]);
      expect(machine.exitCode).toBe(0);
      expect(machine.data?.questions).toEqual([]);
      const human = await harness.run(["list"], { json: false });
      expect(human.exitCode).toBe(0);
      expect(human.stdout).toContain("no questions");
    } finally {
      harness.cleanup();
    }
  });

  test("malformed invocations are fallback.invocation before any read", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run(["list", "--unknown"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
      expect(harness.recorder.calls.filter((call) => call === "readRecords")).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});
