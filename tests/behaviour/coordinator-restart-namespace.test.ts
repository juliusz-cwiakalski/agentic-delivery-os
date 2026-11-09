/**
 * TC-COORD-050 — the restart namespace is the coordinator's, not lane or
 * economics; lane and economics records stay byte-unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  appendCoordinatorRestart,
  coordinatorRestartKey,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  appendEconomicsRestartEvent,
  readEconomicsRecords,
} from "../../packages/core/src/state/index";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  makeCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

const economicsRestart = {
  schemaId: "delivery.economics.restart.v1" as const,
  workItemRef: "GH-999",
  runId: "run-1",
  sessionId: "session-econ",
  ordinal: 1,
  reason: "session-interrupted" as const,
  recordedAt: "2026-11-09T00:00:00.000Z",
};

describe("TC-COORD-050 the restart namespace is the coordinator's", () => {
  test("the restart key is coordinator/<id> and never lane/economics", () => {
    expect(coordinatorRestartKey(COORDINATOR_ID)).toBe(`coordinator/${COORDINATOR_ID}`);
    expect(coordinatorRestartKey(COORDINATOR_ID).startsWith("lane")).toBe(false);
    expect(coordinatorRestartKey(COORDINATOR_ID).startsWith("economics")).toBe(false);
  });

  test("an economics restart in the same store is untouched", () => {
    const { store } = makeCoordinatorStore("restart-namespace");
    const economics = appendEconomicsRestartEvent(store, "econ-writer", economicsRestart);
    expect(economics.ok).toBe(true);
    const before = readEconomicsRecords(store, "GH-999");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const snapshot = JSON.stringify(before.restarts);

    appendCoordinatorRestart(store, "coord-writer", restartRecord());

    const after = readEconomicsRecords(store, "GH-999");
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(JSON.stringify(after.restarts)).toBe(snapshot);

    const coordinator = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(coordinator.ok).toBe(true);
    if (!coordinator.ok) return;
    expect(coordinator.restarts).toHaveLength(1);
    expect(coordinator.restarts[0]?.budgetEpochId).toBe(EPOCH_ID);
  });

  test("a coordinator read never serves another coordinator's namespace", () => {
    const { store } = makeCoordinatorStore("restart-namespace-other");
    appendCoordinatorRestart(store, "writer", restartRecord());
    appendCoordinatorRestart(
      store,
      "writer",
      restartRecord({
        coordinatorId: "coordinator-other",
        restartId: "coordinator-other#epoch-1#1",
      }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts).toHaveLength(1);
    expect(read.restarts[0]?.coordinatorId).toBe(COORDINATOR_ID);
  });
});
