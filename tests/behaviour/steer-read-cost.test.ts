/**
 * TC-STEER-085 — the declared read set per subcommand, with the asks join
 * reusing one delivered ledger read.
 */
import { describe, expect, test } from "bun:test";
import { cappedPopulation } from "../fixtures/steer/ask-matrix";
import { CREATED, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

describe("TC-STEER-085 the read cost is a bound, not a description", () => {
  test("read performs exactly one store, phase, and asks read", async () => {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: cappedPopulation(),
    });
    try {
      harness.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
      const run = await harness.run(["read"]);
      expect(run.exitCode).toBe(0);
      expect(harness.steerCalls.readQueue).toBe(1);
      expect(harness.steerCalls.readPhaseFold).toBe(1);
      expect(harness.steerCalls.readAsks).toBe(1);
      expect(harness.steerCalls.appendOutcomes).toBe(1);
      expect(harness.session.calls).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("list performs one store read and no phase or ledger read", async () => {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: cappedPopulation(),
    });
    try {
      expect((await harness.run(["list"])).exitCode).toBe(0);
      expect(harness.steerCalls.readQueue).toBe(1);
      expect(harness.steerCalls.readPhaseFold).toBe(0);
      expect(harness.steerCalls.readAsks).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("complete performs one store read and no phase or ledger read", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      const run = await harness.run(["complete", "msg-landed", "--ref", "doc/proof.md"]);
      expect(run.exitCode).toBe(0);
      expect(harness.steerCalls.readQueue).toBe(1);
      expect(harness.steerCalls.readPhaseFold).toBe(0);
      expect(harness.steerCalls.readAsks).toBe(0);
      expect(harness.steerCalls.appendCompletion).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("send performs no queue read before the append", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      expect((await harness.run(["send", "no read filing"])).exitCode).toBe(0);
      expect(harness.steerCalls.readQueue).toBe(0);
      expect(harness.steerCalls.readPhaseFold).toBe(0);
      expect(harness.steerCalls.readAsks).toBe(0);
      expect(harness.steerCalls.appendMessage).toBe(1);
    } finally {
      harness.cleanup();
    }
  });
});
