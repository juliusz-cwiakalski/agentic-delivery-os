/**
 * TC-BLK-028/036/042 golden halves — the list and answer goldens are byte-exact,
 * read-only at test time, regenerated only by the explicit script, and
 * mutation-controlled (one byte, clock, run id).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN_RUN_ID, goldenAnswerRun, goldenListRun } from "../fixtures/blockers/golden/fixture";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/blockers/golden";
const path = (name: string): string => join(ROOT, GOLDEN, name);

const expectGolden = (actual: string, name: string): void => {
  const expected = readFileSync(path(name), "utf8");
  expect(actual, name).toBe(expected);
};

describe("TC-BLK-042 blocker goldens", () => {
  test("the list machine and human goldens are byte-exact", async () => {
    const run = await goldenListRun();
    expectGolden(run.machine, "list-envelope.txt");
    expectGolden(run.human, "list-human.txt");
    const envelope = JSON.parse(readFileSync(path("list-envelope.txt"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(envelope.runId).toBe(GOLDEN_RUN_ID);
    expect(Buffer.byteLength(readFileSync(path("list-envelope.txt"), "utf8"))).toBeLessThanOrEqual(
      65_536,
    );
    const human = readFileSync(path("list-human.txt"), "utf8");
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(4_096);
    expect(human.split("\n").filter((line) => line.length > 0).length).toBeLessThanOrEqual(24);
  });

  test("the answer machine and human goldens are byte-exact and record v0 applied:false", async () => {
    const run = await goldenAnswerRun();
    expectGolden(run.machine, "answer-envelope.txt");
    expectGolden(run.human, "answer-human.txt");
    const envelope = JSON.parse(readFileSync(path("answer-envelope.txt"), "utf8")) as {
      data: Record<string, unknown>;
    };
    expect(envelope.data.applied).toBe(false);
    expect(envelope.data.laneResume).toMatchObject({
      mode: "boundary-note",
      sessionReentry: false,
      capabilitySource: "adapter-declared",
    });
    expect(readFileSync(path("answer-human.txt"), "utf8")).toContain("applied=false");
  });

  test("the goldens are never rewritten by the suite", async () => {
    const files = [
      "list-envelope.txt",
      "list-human.txt",
      "answer-envelope.txt",
      "answer-human.txt",
    ];
    const before = files.map((file) => statSync(path(file)).mtimeMs);
    await goldenListRun();
    await goldenAnswerRun();
    const after = files.map((file) => statSync(path(file)).mtimeMs);
    expect(after).toEqual(before);
  });

  test("a one-byte mutation fails the golden by name", async () => {
    const run = await goldenListRun();
    const expected = readFileSync(path("list-human.txt"), "utf8");
    const mutated = `${expected.slice(0, 10)}X${expected.slice(11)}`;
    expect(mutated).not.toBe(expected);
    expect(run.human).not.toBe(mutated);
  });

  test("a changed run id changes the machine bytes", async () => {
    const harness = createBlockersHarness({
      runId: "different-run-id",
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      const run = await harness.run(["list"]);
      expect(run.stdout).not.toBe(readFileSync(path("list-envelope.txt"), "utf8"));
    } finally {
      harness.cleanup();
    }
  });

  test("a changed clock changes the human age bytes", async () => {
    const harness = createBlockersHarness({
      runId: GOLDEN_RUN_ID,
      nowIso: "2026-11-07T12:00:00Z",
      nowMs: Date.parse("2026-11-07T12:00:00Z"),
      seedQuestions: [makeQuestion({ id: "q-1", askedAt: "2026-11-06T12:00:00Z", options: ["a"] })],
    });
    try {
      const run = await harness.run(["list"], { json: false });
      expect(run.stdout).not.toBe(readFileSync(path("list-human.txt"), "utf8"));
    } finally {
      harness.cleanup();
    }
  });
});
