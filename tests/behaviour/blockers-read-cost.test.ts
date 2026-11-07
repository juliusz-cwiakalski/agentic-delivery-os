/**
 * TC-BLK-037 — read cost: one verified blocker read per surface, one fenced
 * append plus coverage per publish/answer, zero network/retries, and refusals
 * that append nothing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";
import { briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import {
  baseFacts,
  blockersRead,
  createStatusRecorder,
  runStatusCli,
  statusRuntime,
} from "../fixtures/status/harness";

const ROOT = process.cwd();

const count = (calls: readonly string[], name: string): number =>
  calls.filter((call) => call === name).length;

describe("TC-BLK-037 read and write cost", () => {
  test("list performs one verified read and no mutation", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      harness.recorder.calls.length = 0;
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(count(harness.recorder.calls, "readRecords")).toBe(1);
      expect(count(harness.recorder.calls, "append")).toBe(0);
      expect(count(harness.recorder.calls, "acquireFence")).toBe(0);
      expect(count(harness.recorder.calls, "releaseFence")).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("publish performs one business read, one fence, one append, and one coverage", async () => {
    const harness = createBlockersHarness();
    try {
      harness.recorder.calls.length = 0;
      const run = await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "question"]);
      expect(run.exitCode).toBe(0);
      expect(count(harness.recorder.calls, "readRecords")).toBe(2);
      expect(count(harness.recorder.calls, "acquireFence")).toBe(1);
      expect(count(harness.recorder.calls, "append")).toBe(1);
      expect(count(harness.recorder.calls, "releaseFence")).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("answer reuses its read and performs one fence/append/coverage", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      harness.recorder.calls.length = 0;
      const run = await harness.run(["answer", "q-1", "--choice", "1"]);
      expect(run.exitCode).toBe(0);
      expect(count(harness.recorder.calls, "readRecords")).toBe(2);
      expect(count(harness.recorder.calls, "acquireFence")).toBe(1);
      expect(count(harness.recorder.calls, "append")).toBe(1);
      expect(count(harness.recorder.calls, "releaseFence")).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("status and brief each perform exactly one blockers read", async () => {
    const facts = baseFacts({
      blockers: blockersRead([makeQuestion({ id: "q-1", options: ["a"] })], []),
    });
    const statusRecorder = createStatusRecorder();
    await runStatusCli(["--json", "status"], statusRuntime(facts, statusRecorder), {
      recorder: statusRecorder,
    });
    expect(count(statusRecorder.calls, "readBlockers")).toBe(1);

    const briefRecorder = createStatusRecorder();
    await runBriefCli(["--json", "brief"], briefRuntime(facts, briefRecorder), {
      recorder: briefRecorder,
    });
    expect(count(briefRecorder.calls, "readBlockers")).toBe(1);
  });

  test("refusals append nothing and stay within one read", async () => {
    const harness = createBlockersHarness({
      secrets: ["blocker-test-secret-0001"],
      callerAudienceFact: "coordinator",
      seedQuestions: [
        makeQuestion({ id: "q-owner", type: "decision-needed", audience: "owner", options: ["a"] }),
      ],
    });
    try {
      const cases: readonly (readonly string[])[] = [
        ["publish", "nope", "--lane", "L2", "q"],
        ["answer", "q-missing", "--text", "x"],
        ["answer", "q-owner", "--choice", "1"],
        ["publish", "spec-ambiguity", "--lane", "L2", "x blocker-test-secret-0001"],
      ];
      for (const argv of cases) {
        harness.recorder.calls.length = 0;
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBeGreaterThan(0);
        expect(count(harness.recorder.calls, "append"), argv.join(" ")).toBe(0);
        expect(count(harness.recorder.calls, "acquireFence"), argv.join(" ")).toBe(0);
        expect(count(harness.recorder.calls, "readRecords"), argv.join(" ")).toBeLessThanOrEqual(1);
      }
    } finally {
      harness.cleanup();
    }
  });

  test("no network, retry loop, or pagination exists", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error("network forbidden");
    }) as typeof fetch;
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      await harness.run(["list"]);
      await harness.run(["answer", "q-1", "--choice", "1"]);
      expect(fetchCalls).toBe(0);
    } finally {
      harness.cleanup();
      globalThis.fetch = originalFetch;
    }
    const command = readFileSync(join(ROOT, "packages/cli/src/commands/blockers.ts"), "utf8");
    const state = readFileSync(join(ROOT, "packages/core/src/state/blockers.ts"), "utf8");
    expect(command.includes("while (")).toBe(false);
    expect(state.includes("while (")).toBe(false);
    expect(command.includes("fetch(")).toBe(false);
    expect(state.includes("fetch(")).toBe(false);
  });
});
