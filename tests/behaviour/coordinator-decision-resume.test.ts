/**
 * TC-COORD-021 — a resumable unclean session records `resume-context` without
 * re-paying prefill, consuming exactly one recovery ordinal.
 */
import { describe, expect, test } from "bun:test";
import { decideLifecycle, lifecycleEffect } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorIteration,
  appendCoordinatorRestart,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { LIFECYCLE_CASES } from "../fixtures/coordinator/lifecycle";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  iterationRecord,
  makeCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

describe("TC-COORD-021 resume-context consumes one ordinal and reuses the session", () => {
  const resumeCase = LIFECYCLE_CASES.find((entry) => entry.id === "resumable-known-below-limit");
  if (resumeCase === undefined) throw new Error("missing resume fixture");

  test("the decision resumes and consumes exactly one ordinal", () => {
    const decision = decideLifecycle(resumeCase.facts);
    expect(decision.kind).toBe("resume-context");
    expect(decision.consumesOrdinal).toBe(1);
    expect(lifecycleEffect(decision)).toBe("resume");
  });

  test("the recorded decision and ordinal land before the resume effect", () => {
    const { store } = makeCoordinatorStore("decision-resume");
    const recorder = createRecordingProcessPort();
    const decision = decideLifecycle(resumeCase.facts);
    appendCoordinatorIteration(
      store,
      "writer",
      iterationRecord({ decision: decision.kind, reason: decision.reason, sessionId: "session-1" }),
    );
    const restart = appendCoordinatorRestart(
      store,
      "writer",
      restartRecord({ ordinal: 1, reason: "session-interrupted", sessionId: "session-1" }),
    );
    expect(restart.ok).toBe(true);
    // The resume reuses the recorded session; no fresh spawn is issued.
    expect(recorder.calls.spawn).toBe(0);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.iterations[0]?.contextTokens).toBe(1_000);
    expect(read.restarts.map((entry) => entry.ordinal)).toEqual([1]);
    expect(read.restarts[0]?.restartId).toBe(`${COORDINATOR_ID}#${EPOCH_ID}#1`);
  });
});
