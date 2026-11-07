/**
 * TC-BLK-009 — publish appends exactly one DM-1 record with every field intact,
 * a verified read, ordered options, a null ref, the injected clock, and exit 0.
 */
import { describe, expect, test } from "bun:test";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { createBlockersHarness, FIXED_NOW_ISO } from "../fixtures/blockers/harness";
import { createTestEdge, openStore } from "../fixtures/state/harness";

const PUBLISH = [
  "publish",
  "decision-needed",
  "--lane",
  "L5",
  "--audience",
  "coordinator",
  "--options",
  "full,lite+escalation",
  "closeout residue sweep: full or lite?",
] as const;

describe("TC-BLK-009 publish happy path", () => {
  test("publishes one complete DM-1 record and exits 0", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run([...PUBLISH]);
      expect(run.exitCode).toBe(0);
      expect(run.stderr).toBe("");
      const question = run.data?.question as Record<string, unknown>;
      expect(question).toMatchObject({
        schemaId: "delivery.blocker.question.v1",
        type: "decision-needed",
        audience: "coordinator",
        lane: "L5",
        ref: null,
        question: "closeout residue sweep: full or lite?",
        options: ["full", "lite+escalation"],
        askedAt: FIXED_NOW_ISO,
      });
      expect(String(question.id)).toMatch(/^q-.+/);

      const read = harness.read();
      expect(read.questions).toHaveLength(1);
      expect(read.verifiedEmpty).toBe(false);
      const record = read.questions[0];
      expect(record).toMatchObject(question);
      expect(Object.keys(record ?? {}).sort()).toEqual(
        [
          "askedAt",
          "audience",
          "id",
          "lane",
          "options",
          "question",
          "ref",
          "schemaId",
          "type",
        ].sort(),
      );
      expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    } finally {
      harness.cleanup();
    }
  });

  test("the append is append-only, one line, and coverage sees exactly one record", async () => {
    const harness = createBlockersHarness();
    try {
      await harness.run([...PUBLISH]);
      const after = harness.ledgerText();
      expect(after.endsWith("\n")).toBe(true);
      expect(after.split("\n").filter((line) => line !== "")).toHaveLength(1);
      const calls = harness.recorder.calls;
      expect(calls.filter((call) => call === "acquireFence")).toHaveLength(1);
      expect(calls.filter((call) => call === "append")).toHaveLength(1);
      expect(calls.filter((call) => call === "releaseFence")).toHaveLength(1);
      expect(calls.filter((call) => call === "readRecords")).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });

  test("the record is durable across a reopened store instance", async () => {
    const harness = createBlockersHarness();
    try {
      await harness.run([...PUBLISH]);
      const reopened = openStore(harness.state.identity, { edge: createTestEdge() });
      const read = readBlockerLedger(reopened.store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.questions).toHaveLength(1);
        expect(read.value.questions[0]?.question).toBe("closeout residue sweep: full or lite?");
      }
    } finally {
      harness.cleanup();
    }
  });

  test("a second publish appends a distinct record and leaves the first bytes intact", async () => {
    const harness = createBlockersHarness();
    try {
      const first = await harness.run([...PUBLISH]);
      const before = harness.ledgerBytes();
      const second = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "second question",
      ]);
      expect(second.exitCode).toBe(0);
      const after = harness.ledgerBytes();
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      const firstQuestion = first.data?.question as Record<string, unknown> | undefined;
      const secondQuestion = second.data?.question as Record<string, unknown> | undefined;
      expect(firstQuestion?.id).not.toBe(secondQuestion?.id);
      expect(harness.read().questions).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });
});
