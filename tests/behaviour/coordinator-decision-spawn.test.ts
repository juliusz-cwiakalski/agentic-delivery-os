/**
 * TC-COORD-022 / TC-COORD-023 — the three `spawn-fresh` recovery reasons each
 * consume exactly one ordinal, while a first start or a clean end consumes none.
 */
import { describe, expect, test } from "bun:test";
import { COORDINATOR_ERROR_CODES } from "../../packages/core/src/contracts/index";
import { decideLifecycle } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorIteration,
  appendCoordinatorRestart,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  LIFECYCLE_CASES,
  NO_ORDINAL_CASES,
  RECOVERY_CASES,
} from "../fixtures/coordinator/lifecycle";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  iterationRecord,
  makeCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

describe("TC-COORD-022 the three recovery spawn reasons consume one ordinal", () => {
  const recoverySpawn = RECOVERY_CASES.filter((entry) => entry.expected.kind === "spawn-fresh");

  test("context-pressure, context-unknown, and session-interrupted each consume one", () => {
    expect([...new Set(recoverySpawn.map((entry) => entry.expected.reason))].sort()).toEqual([
      "context-pressure",
      "context-unknown",
      "session-interrupted",
    ]);
    for (const entry of recoverySpawn) {
      const decision = decideLifecycle(entry.facts);
      expect(decision.kind, entry.id).toBe("spawn-fresh");
      expect(decision.reason, entry.id).toBe(entry.expected.reason);
      expect(decision.consumesOrdinal, entry.id).toBe(1);
    }
  });

  test("an undeclared resume is a decision input, not an error identity", () => {
    const entry = LIFECYCLE_CASES.find(
      (item) => item.id === "resume-undeclared-spawns-without-error",
    );
    if (entry === undefined) throw new Error("missing fixture");
    const decision = decideLifecycle(entry.facts);
    expect(decision.kind).toBe("spawn-fresh");
    expect(decision.reason).toBe("session-interrupted");
    expect((COORDINATOR_ERROR_CODES as readonly string[]).includes("coordinator.resume.gap")).toBe(
      false,
    );
  });

  test("each recovery appends one restart record with the next ordinal", () => {
    const { store } = makeCoordinatorStore("decision-spawn");
    let ordinal = 0;
    for (const entry of recoverySpawn) {
      const decision = decideLifecycle(entry.facts);
      ordinal += decision.consumesOrdinal;
      expect(
        appendCoordinatorRestart(
          store,
          "writer",
          restartRecord({
            ordinal,
            restartId: `${COORDINATOR_ID}#${EPOCH_ID}#${ordinal}`,
            reason: entry.expected.reason as "context-pressure",
          }),
        ).ok,
        entry.id,
      ).toBe(true);
    }
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts.map((entry) => entry.ordinal)).toEqual(
      recoverySpawn.map((_entry, index) => index + 1),
    );
  });
});

describe("TC-COORD-023 a first start or a clean end consumes no ordinal", () => {
  test("initial-start and clean-iteration-end both consume zero", () => {
    for (const entry of NO_ORDINAL_CASES) {
      const decision = decideLifecycle(entry.facts);
      expect(decision.consumesOrdinal, entry.id).toBe(0);
      expect(decision.kind).toBe(entry.expected.kind);
    }
  });

  test("no restart record is written for a first start", () => {
    const entry = LIFECYCLE_CASES.find((item) => item.id === "no-prior-session-initial-start");
    if (entry === undefined) throw new Error("missing fixture");
    const { store } = makeCoordinatorStore("decision-first-start");
    const decision = decideLifecycle(entry.facts);
    appendCoordinatorIteration(
      store,
      "writer",
      iterationRecord({ decision: decision.kind, reason: decision.reason, sessionId: null }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts).toHaveLength(0);
    expect(read.iterations[0]?.decision).toBe("spawn-fresh");
    expect(read.iterations[0]?.reason).toBe("initial-start");
  });
});
