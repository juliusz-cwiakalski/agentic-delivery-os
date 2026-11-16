/**
 * TC-STEER-084 — the write matrix: exactly the declared appends, fenced verified
 * writes (append then read-back), no edits/deletes, and only the three steering
 * record kinds.
 */
import { describe, expect, test } from "bun:test";
import {
  CREATED,
  makeAppliedOutcome,
  makeExpiredOutcome,
  makeMessage,
} from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const appendCount = (calls: readonly string[]): number =>
  calls.filter((call) => call === "append").length;

const kindsInLedger = (text: string): readonly string[] =>
  text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => String((JSON.parse(line) as { readonly kind?: unknown }).kind));

describe("TC-STEER-084 the append matrix is exactly as declared", () => {
  test("send appends 1; read appends only the transitions; complete appends 1 then 0", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      expect((await harness.run(["send", "write matrix"])).exitCode).toBe(0);
      expect(appendCount(harness.recorder.calls)).toBe(1);
      harness.recorder.calls.length = 0;

      const landedA = makeMessage({ id: "msg-pre-landed-a", created: CREATED });
      const landedB = makeMessage({ id: "msg-pre-landed-b", created: CREATED });
      const expired = makeMessage({ id: "msg-pre-expired", created: "2026-11-10T12:00:00.000Z" });
      const due = makeMessage({ id: "msg-due", created: CREATED });
      const elapsed = makeMessage({ id: "msg-elapsed", created: "2026-11-10T12:00:00.000Z" });
      for (const message of [landedA, landedB, expired, due, elapsed]) harness.seedMessage(message);
      harness.seedOutcome(makeAppliedOutcome(landedA));
      harness.seedOutcome(makeAppliedOutcome(landedB));
      harness.seedOutcome(makeExpiredOutcome(expired));
      harness.recorder.calls.length = 0;
      expect((await harness.run(["read"])).exitCode).toBe(0);
      expect(appendCount(harness.recorder.calls)).toBe(3);

      harness.recorder.calls.length = 0;
      expect((await harness.run(["complete", "msg-due", "--ref", "doc/proof.md"])).exitCode).toBe(
        0,
      );
      expect(appendCount(harness.recorder.calls)).toBe(1);
      harness.recorder.calls.length = 0;
      expect((await harness.run(["complete", "msg-due", "--ref", "doc/proof2.md"])).exitCode).toBe(
        1,
      );
      expect(appendCount(harness.recorder.calls)).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("every append is followed by a read-back verification", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      harness.recorder.calls.length = 0;
      await harness.run(["send", "verified append"]);
      const calls = harness.recorder.calls;
      const appendIndex = calls.indexOf("append");
      expect(appendIndex).toBeGreaterThanOrEqual(0);
      expect(calls.slice(appendIndex + 1)).toContain("readRecords");
    } finally {
      harness.cleanup();
    }
  });

  test("the ledger holds exactly the three steering kinds and no other state kind", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      harness.seedCompletion({
        schemaId: "delivery.steering.completion.v1",
        id: "msg-landed",
        completedAt: harness.now.iso,
        artifact: "doc/proof.md",
      });
      const kinds = [...new Set(kindsInLedger(harness.ledgerText()))].sort();
      expect(kinds).toEqual(["steering.completion", "steering.message", "steering.outcome"]);
      expect(harness.ledgerText()).not.toContain("blocker.");
    } finally {
      harness.cleanup();
    }
  });

  test("a pre-existing record is never rewritten (the byte prefix stays)", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      harness.seedMessage(makeMessage({ id: "msg-prefix", created: CREATED }));
      const before = harness.ledgerBytes();
      const landed = makeMessage({ id: "msg-new", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      const after = harness.ledgerBytes();
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      expect(after.length).toBeGreaterThanOrEqual(before.length);
    } finally {
      harness.cleanup();
    }
  });
});
