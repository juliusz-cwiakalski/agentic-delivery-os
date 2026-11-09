/**
 * TC-COORD-053 — the budget survives a supervisor crash and a replay appends
 * nothing.
 */
import { describe, expect, test } from "bun:test";
import { evaluateCoordinatorRestartAdmission } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorPayload,
  appendCoordinatorRestart,
  coordinatorRestartKey,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  makeCoordinatorStore,
  reopenCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

describe("TC-COORD-053 the restart budget survives a crash", () => {
  test("a reopened store reads the same count and bound", () => {
    const { store, identity } = makeCoordinatorStore("restart-durability");
    appendCoordinatorRestart(store, "writer", restartRecord({ ordinal: 1 }));
    appendCoordinatorRestart(
      store,
      "writer",
      restartRecord({
        ordinal: 2,
        restartId: `${COORDINATOR_ID}#${EPOCH_ID}#2`,
        recordedAt: "2026-11-09T00:03:00.000Z",
      }),
    );
    const reopened = reopenCoordinatorStore(identity);
    const read = readCoordinatorRecords(reopened, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const admission = evaluateCoordinatorRestartAdmission({
      records: read.restarts,
      budgetEpochId: EPOCH_ID,
      bound: 10,
    });
    expect(admission.state).toBe("admit");
    if (admission.state !== "admit") return;
    expect(admission.count).toBe(2);
    expect(admission.nextOrdinal).toBe(3);
  });

  test("a replayed ordinal appends nothing and never duplicates", () => {
    const { store, identity } = makeCoordinatorStore("restart-replay");
    const first = appendCoordinatorRestart(store, "writer", restartRecord({ ordinal: 1 }));
    expect(first.ok && first.appended).toBe(true);
    const reopened = reopenCoordinatorStore(identity);
    const replay = appendCoordinatorRestart(reopened, "writer", restartRecord({ ordinal: 1 }));
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.appended).toBe(false);
    const read = readCoordinatorRecords(reopened, COORDINATOR_ID);
    if (read.ok) expect(read.restarts).toHaveLength(1);
  });

  test("a duplicate ordinal in the store classifies torn rather than count 2", () => {
    const { store } = makeCoordinatorStore("restart-duplicate");
    appendCoordinatorRestart(store, "writer", restartRecord({ ordinal: 1 }));
    // A raw tampered duplicate with a distinct restartId but the same ordinal.
    appendCoordinatorPayload(store, "writer", {
      kind: "coordinator.restart",
      recordKey: coordinatorRestartKey(COORDINATOR_ID),
      payload: {
        ...restartRecord({ ordinal: 1 }),
        restartId: `${COORDINATOR_ID}#${EPOCH_ID}#dup`,
      },
    });
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });
});
