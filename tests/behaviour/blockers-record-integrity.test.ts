/**
 * TC-BLK-011/012 — torn, wrong-kind, malformed, and verified-empty histories
 * are classified across surfaces; one authoritative answer and coverage +1.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { STATE_SCHEMA_VERSION, type StateJsonValue } from "../../packages/core/src/contracts/index";
import { createBlockersHarness, rawAppend } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";
import { ledgerPath } from "../fixtures/state/harness";

const malformedQuestion = (): StateJsonValue => ({
  schemaId: "delivery.blocker.question.v1",
  id: "q-legacy",
  type: "spec-ambiguity",
  audience: "owner",
  lane: "L2",
  question: "legacy",
  options: [],
  askedAt: "2026-11-06T10:00:00Z",
});

const answerPayload = (questionId: string): StateJsonValue => ({
  schemaId: "delivery.blocker.answer.v1",
  questionId,
  answeringAudience: "owner",
  text: "first",
  answeredAt: "2026-11-06T10:00:00Z",
  applied: false,
  laneResume: {
    mode: "boundary-note",
    sessionReentry: false,
    capabilitySource: "adapter-declared",
  },
});

describe("TC-BLK-011 corruption classification", () => {
  test("verified-empty reads exit 0 with an empty list, never an error", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(run.data).toEqual({
        schemaVersion: "delivery.blockers.v1",
        questions: [],
        truncated: false,
        omitted: 0,
      });
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a torn ledger exits 2 with state.store.torn and no appends", async () => {
    const harness = createBlockersHarness();
    try {
      await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "which spec?"]);
      const bytes = harness.ledgerBytes();
      writeFileSync(ledgerPath(harness.state.identity), bytes.subarray(0, bytes.length - 3));
      const beforeAppendCount = harness.recorder.calls.filter((call) => call === "append").length;
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({ code: "state.store.torn" });
      expect(harness.recorder.calls.filter((call) => call === "append")).toHaveLength(
        beforeAppendCount,
      );
    } finally {
      harness.cleanup();
    }
  });

  test("a wrong-kind record exits 2 with state.store.unknown and no appends", async () => {
    const harness = createBlockersHarness();
    try {
      rawAppend(harness.state.store, {
        kind: "other.kind",
        recordKey: "blockers.questions:q-legacy",
        payload: malformedQuestion(),
      });
      const before = harness.ledgerBytes();
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({ code: "state.store.unknown" });
      expect(harness.ledgerBytes().equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a malformed payload exits 2 and is never served as an empty ranking", async () => {
    const harness = createBlockersHarness();
    try {
      rawAppend(harness.state.store, {
        kind: "blocker.question",
        recordKey: "blockers.questions:q-legacy",
        payload: malformedQuestion(),
      });
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toBeDefined();
      expect(run.data).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });

  test("publish and answer on a torn store exit 2 and append nothing", async () => {
    const harness = createBlockersHarness();
    try {
      await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "which spec?"]);
      const bytes = harness.ledgerBytes();
      writeFileSync(ledgerPath(harness.state.identity), bytes.subarray(0, bytes.length - 3));
      const before = harness.ledgerBytes();
      const publish = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "another question",
      ]);
      expect(publish.exitCode).toBe(2);
      const answer = await harness.run(["answer", "q-fixture-1", "--text", "answer"]);
      expect(answer.exitCode).toBe(2);
      expect(harness.ledgerBytes().equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("a valid control reads its questions and exits 0", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-valid", options: ["a"] })],
    });
    try {
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.questions as Record<string, unknown>[]).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-BLK-012 one authoritative answer", () => {
  test("a second answer is refused before landing and the first stays authoritative", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a", "b"] })],
    });
    try {
      const first = await harness.run(["answer", "q-1", "--choice", "1"]);
      expect(first.exitCode).toBe(0);
      const before = harness.ledgerBytes();
      const second = await harness.run(["answer", "q-1", "--choice", "2"]);
      expect(second.exitCode).toBe(1);
      expect(second.envelope?.error).toMatchObject({ code: "input.value.rejected" });
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().answers).toHaveLength(1);
      expect(harness.read().answers[0]?.choice).toBe("a");
    } finally {
      harness.cleanup();
    }
  });

  test("a duplicate answer history fails closed as state.store.torn", async () => {
    const harness = createBlockersHarness();
    try {
      rawAppend(harness.state.store, {
        kind: "blocker.question",
        recordKey: "blockers.questions:q-1",
        payload: {
          schemaId: "delivery.blocker.question.v1",
          id: "q-1",
          type: "decision-needed",
          audience: "coordinator",
          lane: "L5",
          ref: null,
          question: "pick",
          options: ["a", "b"],
          askedAt: "2026-11-06T10:00:00Z",
        },
      });
      rawAppend(harness.state.store, {
        kind: "blocker.answer",
        recordKey: "blockers.answers:q-1",
        payload: answerPayload("q-1"),
      });
      rawAppend(harness.state.store, {
        kind: "blocker.answer",
        recordKey: "blockers.answers:q-1",
        payload: answerPayload("q-1"),
      });
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({ code: "state.store.torn" });
    } finally {
      harness.cleanup();
    }
  });

  test("coverage verifies exactly +1 and two questions each get one answer", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [
        makeQuestion({ id: "q-1", options: ["a"] }),
        makeQuestion({ id: "q-2", options: ["b"] }),
      ],
    });
    try {
      expect((await harness.run(["answer", "q-1", "--choice", "1"])).exitCode).toBe(0);
      expect((await harness.run(["answer", "q-2", "--choice", "1"])).exitCode).toBe(0);
      const read = harness.read();
      expect(read.answers).toHaveLength(2);
      expect(read.answers.map((answer) => answer.questionId).sort()).toEqual(["q-1", "q-2"]);
      expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    } finally {
      harness.cleanup();
    }
  });
});
