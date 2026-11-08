/**
 * TC-BLKADOPT-001/002 — lanes publish typed blockers, the coordinator answers
 * them as data with an applied posture, and no lifecycle prompt writes the
 * pm-notes `blockers:` collection.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");
const pm = read(".opencode/agent/pm.md");
const ceo = read(".opencode/agent/ceo.md");
const coder = read(".opencode/agent/coder.md");

const NEGATIONS = [/\bnever\b/i, /\bdo not\b/i, /\bdon't\b/i, /\bmust not\b/i];

const nonNegated = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !NEGATIONS.some((pattern) => pattern.test(line)));

describe("TC-BLKADOPT-001 lanes publish typed blockers", () => {
  test("the PM and coder publish through blockers and never write the collection", () => {
    expect(pm).toContain("blockers publish");
    expect(coder).toContain("blockers publish");
    for (const [name, text] of [
      ["pm", pm],
      ["coder", coder],
    ] as const) {
      const writes = nonNegated(text).filter(
        (line) =>
          line.includes("blockers:") && /\b(add|write|record|append|edit|update)\b/i.test(line),
      );
      expect(writes, name).toEqual([]);
    }
  });
});

describe("TC-BLKADOPT-002 the coordinator answers blockers as data", () => {
  test("an answer records the substance and the applied posture", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [
        makeQuestion({
          id: "q-adopt",
          type: "spec-ambiguity",
          audience: "owner",
          options: [],
        }),
      ],
    });
    try {
      const run = await harness.run(["answer", "q-adopt", "--text", "use criterion two"]);
      expect(run.exitCode).toBe(0);
      expect(harness.read().answers).toHaveLength(1);
      const answer = harness.read().answers[0];
      expect(answer?.text).toBe("use criterion two");
      expect(answer?.applied).toBe(false);
      expect(answer?.laneResume).toBeDefined();
    } finally {
      harness.cleanup();
    }
  });

  test("the coordinator reads status/blockers and answers with blockers answer", () => {
    expect(ceo).toContain("blockers answer");
    expect(ceo).toContain("status");
    const writes = nonNegated(ceo).filter(
      (line) =>
        line.includes("blockers:") && /\b(add|write|record|append|edit|update)\b/i.test(line),
    );
    expect(writes).toEqual([]);
  });
});
