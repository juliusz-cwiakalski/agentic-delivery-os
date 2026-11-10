/**
 * TC-COORD-051 — a below-bound restart appends the next contiguous ordinal and
 * proceeds; the bound is configuration data.
 */
import { describe, expect, test } from "bun:test";
import { evaluateCoordinatorRestartAdmission } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorRestart,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  makeCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

describe("TC-COORD-051 a below-bound restart admits the next ordinal", () => {
  test("admission is contiguous and the bound is a parameter", () => {
    for (const bound of [1, 2, 10]) {
      const admission = evaluateCoordinatorRestartAdmission({
        records: [],
        budgetEpochId: EPOCH_ID,
        bound,
      });
      expect(admission.state).toBe("admit");
      if (admission.state === "admit") {
        expect(admission.count).toBe(0);
        expect(admission.nextOrdinal).toBe(1);
        expect(admission.bound).toBe(bound);
      }
    }
  });

  test("each admitted restart appends the next ordinal and reads back", () => {
    const { store } = makeCoordinatorStore("restart-admit");
    for (let expected = 1; expected <= 3; expected += 1) {
      const read = readCoordinatorRecords(store, COORDINATOR_ID);
      if (!read.ok) throw new Error("read failed");
      const admission = evaluateCoordinatorRestartAdmission({
        records: read.restarts,
        budgetEpochId: EPOCH_ID,
        bound: 10,
      });
      expect(admission.state).toBe("admit");
      if (admission.state !== "admit") return;
      expect(admission.nextOrdinal).toBe(expected);
      const appended = appendCoordinatorRestart(
        store,
        "writer",
        restartRecord({
          ordinal: admission.nextOrdinal,
          restartId: `${COORDINATOR_ID}#${EPOCH_ID}#${admission.nextOrdinal}`,
        }),
      );
      expect(appended.ok).toBe(true);
    }
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts.map((entry) => entry.ordinal)).toEqual([1, 2, 3]);
  });

  test("a below-bound admission proceeds; at-bound refuses", () => {
    const records = [1, 2].map((ordinal) => ({
      ...restartRecord(),
      ordinal,
      restartId: `${COORDINATOR_ID}#${EPOCH_ID}#${ordinal}`,
    }));
    const below = evaluateCoordinatorRestartAdmission({
      records,
      budgetEpochId: EPOCH_ID,
      bound: 3,
    });
    expect(below.state).toBe("admit");
    const atBound = evaluateCoordinatorRestartAdmission({
      records,
      budgetEpochId: EPOCH_ID,
      bound: 2,
    });
    expect(atBound.state).toBe("refuse");
  });
});
