/**
 * TC-COORD-083 — coordinator records are additive, validated, and the schema
 * version is unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  STATE_SCHEMA_VERSION,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendCoordinatorExhaustion,
  appendCoordinatorFence,
  appendCoordinatorIteration,
  appendCoordinatorPayload,
  appendCoordinatorRestart,
  appendCoordinatorStuck,
  appendCoordinatorWake,
  coordinatorExhaustionKey,
  coordinatorFenceKey,
  coordinatorIterationKey,
  coordinatorRestartKey,
  coordinatorStuckKey,
  coordinatorWakeKey,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  COORDINATOR_ID,
  exhaustionRecord,
  fenceRecord,
  iterationRecord,
  makeCoordinatorStore,
  restartRecord,
  stuckRecord,
  wakeRecord,
} from "../fixtures/coordinator/states";

const six = (store: StateStorePort) => {
  const token = "writer";
  expect(appendCoordinatorIteration(store, token, iterationRecord()).ok).toBe(true);
  expect(appendCoordinatorRestart(store, token, restartRecord()).ok).toBe(true);
  expect(appendCoordinatorStuck(store, token, stuckRecord()).ok).toBe(true);
  expect(
    appendCoordinatorStuck(
      store,
      token,
      stuckRecord({ phase: "outcome", killOutcome: "terminated" }),
    ).ok,
  ).toBe(true);
  expect(appendCoordinatorExhaustion(store, token, exhaustionRecord()).ok).toBe(true);
  expect(appendCoordinatorWake(store, token, wakeRecord()).ok).toBe(true);
  expect(appendCoordinatorFence(store, token, fenceRecord()).ok).toBe(true);
  const read = readCoordinatorRecords(store, COORDINATOR_ID);
  if (!read.ok) throw new Error(`read failed: ${read.code}`);
  return read;
};

describe("TC-COORD-083 coordinator records are additive and validated", () => {
  test("the six kinds round-trip under their own keys with the schema version unchanged", () => {
    const { store } = makeCoordinatorStore("records-roundtrip");
    const read = six(store);
    expect(read.iterations).toHaveLength(1);
    expect(read.restarts).toHaveLength(1);
    expect(read.stuck).toHaveLength(2);
    expect(read.exhaustion).toHaveLength(1);
    expect(read.wakes).toHaveLength(1);
    expect(read.fences).toHaveLength(1);
    expect(read.verifiedEmpty).toBe(false);
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    expect(coordinatorIterationKey(COORDINATOR_ID)).toStartWith("coordinator.iterations:");
    expect(coordinatorRestartKey(COORDINATOR_ID)).toBe(`coordinator/${COORDINATOR_ID}`);
    expect(coordinatorStuckKey(COORDINATOR_ID)).toStartWith("coordinator.stuck:");
    expect(coordinatorExhaustionKey(COORDINATOR_ID)).toStartWith("coordinator.exhaustion:");
    expect(coordinatorWakeKey(COORDINATOR_ID)).toStartWith("coordinator.wake:");
    expect(coordinatorFenceKey(COORDINATOR_ID)).toStartWith("coordinator.fence:");
  });

  test("a verified-empty coordinator read is a valid state, not an error", () => {
    const { store } = makeCoordinatorStore("records-empty");
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.verifiedEmpty).toBe(true);
  });

  test("a malformed payload classifies torn and is never served", () => {
    const { store } = makeCoordinatorStore("records-torn");
    const appended = appendCoordinatorPayload(store, "writer", {
      kind: "coordinator.restart",
      recordKey: coordinatorRestartKey(COORDINATOR_ID),
      payload: {
        schemaId: "delivery.coordinator.restart.v1",
        restartId: "bad#1",
        coordinatorId: COORDINATOR_ID,
        budgetEpochId: "epoch-1",
        sessionId: null,
        ordinal: 1,
        reason: "not-a-reason",
        previousSessionId: null,
        recordedAt: "2026-11-09T00:00:00.000Z",
      },
    });
    expect(appended.ok).toBe(true);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });

  test("an undeclared coordinator kind classifies unknown", () => {
    const { store } = makeCoordinatorStore("records-unknown");
    appendCoordinatorPayload(store, "writer", {
      kind: "coordinator.mystery",
      recordKey: coordinatorIterationKey(COORDINATOR_ID),
      payload: { schemaId: "x", coordinatorId: COORDINATOR_ID, id: "x" },
    });
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.unknown");
  });

  test("an unevaluable verdict with an outcome phase is rejected", () => {
    const { store } = makeCoordinatorStore("records-unevaluable");
    appendCoordinatorPayload(store, "writer", {
      kind: "coordinator.stuck",
      recordKey: coordinatorStuckKey(COORDINATOR_ID),
      payload: {
        ...stuckRecord({ verdict: "unevaluable", reason: "evidence-unevaluable" }),
        phase: "outcome",
      },
    });
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });

  test("a faulted read classifies its state code and never serves values", () => {
    const { store } = makeCoordinatorStore("records-fault");
    const failing: StateStorePort = {
      ...store,
      readRecords: () => ({
        ok: false,
        error: {
          kind: "state",
          code: "state.permission.denied",
          consequence: "not_landed",
          location: { path: "/denied" },
        },
      }),
    };
    const read = readCoordinatorRecords(failing, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.permission.denied");
  });

  test("no lane or economics record is written by a coordinator append", () => {
    const { store } = makeCoordinatorStore("records-noninterference");
    six(store);
    const records = store.readRecords();
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    const keys = records.value.records.map((record) => record.key);
    for (const key of keys) {
      expect(key.startsWith("coordinator")).toBe(true);
      expect(key.startsWith("lane")).toBe(false);
      expect(key.startsWith("economics")).toBe(false);
    }
  });
});
