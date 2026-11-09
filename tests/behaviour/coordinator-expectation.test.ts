/**
 * TC-COORD-038 — one iteration expectation is active per coordinator, and a
 * trigger refreshes the window with a new iteration record.
 */
import { describe, expect, test } from "bun:test";
import {
  appendCoordinatorIteration,
  foldCoordinatorDecision,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  COORDINATOR_ID,
  iterationRecord,
  makeCoordinatorStore,
} from "../fixtures/coordinator/states";

describe("TC-COORD-038 one active expectation per coordinator", () => {
  test("a trigger appends a new iteration record rather than a second expectation", () => {
    const { store } = makeCoordinatorStore("expectation");
    appendCoordinatorIteration(
      store,
      "writer",
      iterationRecord({ iterationId: "iteration-1", trigger: "start" }),
    );
    appendCoordinatorIteration(
      store,
      "writer",
      iterationRecord({
        iterationId: "iteration-2",
        trigger: "wake",
        decision: "none",
        reason: "expectation",
        expectationWindowMs: 600_000,
        recordedAt: "2026-11-09T00:05:00.000Z",
      }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.iterations).toHaveLength(2);
    // The latest by ledger sequence is the refreshed expectation.
    expect(read.iterations[read.iterations.length - 1]?.iterationId).toBe("iteration-2");
    expect(read.iterations[read.iterations.length - 1]?.reason).toBe("expectation");
    // The last real decision is still readable for status.
    expect(foldCoordinatorDecision(read.iterations)?.iterationId).toBe("iteration-1");
  });

  test("a replay of the same iteration id appends nothing", () => {
    const { store } = makeCoordinatorStore("expectation-replay");
    const first = appendCoordinatorIteration(store, "writer", iterationRecord());
    const second = appendCoordinatorIteration(store, "writer", iterationRecord());
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.appended).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.appended).toBe(false);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    if (read.ok) expect(read.iterations).toHaveLength(1);
  });

  test("the expectation window is carried on the record", () => {
    const record = iterationRecord({ trigger: "collection", decision: "none", reason: "expectation" });
    expect(record.expectationWindowMs).toBe(600_000);
    expect(record.digestFingerprint).toContain("cursor=");
  });
});
