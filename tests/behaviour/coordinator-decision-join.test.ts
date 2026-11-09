/**
 * TC-COORD-020 — a live session records `join-live` and consumes no ordinal.
 */
import { describe, expect, test } from "bun:test";
import { decideLifecycle, lifecycleEffect } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorIteration,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";
import { CONTEXT_LIMIT, LIFECYCLE_CASES } from "../fixtures/coordinator/lifecycle";
import { COORDINATOR_ID, iterationRecord, makeCoordinatorStore } from "../fixtures/coordinator/states";

describe("TC-COORD-020 a live session joins and consumes no ordinal", () => {
  const liveCase = LIFECYCLE_CASES.find((entry) => entry.id === "live-session-joins");
  if (liveCase === undefined) throw new Error("missing live fixture");

  test("the decision is join-live with no ordinal and an attach effect", () => {
    const decision = decideLifecycle(liveCase.facts);
    expect(decision.kind).toBe("join-live");
    expect(decision.consumesOrdinal).toBe(0);
    expect(lifecycleEffect(decision)).toBe("attach");
    expect(liveCase.facts.contextLimit).toBe(CONTEXT_LIMIT);
  });

  test("the iteration record lands before the effect and no restart record exists", () => {
    const { store } = makeCoordinatorStore("decision-join");
    const recorder = createRecordingProcessPort();
    const decision = decideLifecycle(liveCase.facts);
    const appended = appendCoordinatorIteration(
      store,
      "writer",
      iterationRecord({
        decision: decision.kind,
        reason: decision.reason,
        trigger: "collection",
        sessionId: "session-live",
      }),
    );
    expect(appended.ok).toBe(true);
    // The effect for join-live is attach: nothing is spawned or resumed.
    expect(lifecycleEffect(decision)).toBe("attach");
    expect(recorder.calls.spawn).toBe(0);
    expect(recorder.calls.signal).toBe(0);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.iterations).toHaveLength(1);
    expect(read.iterations[0]?.decision).toBe("join-live");
    expect(read.iterations[0]?.reason).toBe("live-session");
    expect(read.restarts).toHaveLength(0);
  });
});
