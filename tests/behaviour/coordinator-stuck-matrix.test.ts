/**
 * TC-COORD-031 — the advanced/stale/unknown evidence matrix is total and
 * deterministic, and each verdict persists the declared number of records.
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorStuck,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { EVIDENCE_MATRIX, factsForCell } from "../fixtures/coordinator/evidence";
import { COORDINATOR_ID, makeCoordinatorStore, stuckRecord } from "../fixtures/coordinator/states";

describe("TC-COORD-031 the evidence matrix persists the declared verdicts", () => {
  test("every matrix cell is total, deterministic, and persisted correctly", () => {
    const { store } = makeCoordinatorStore("stuck-matrix");
    const expectedRecords: string[] = [];
    for (const cell of EVIDENCE_MATRIX) {
      const evaluation = evaluateStuck(factsForCell(cell));
      expect(evaluation.verdict).toBe(cell.expected);
      if (evaluation.verdict === "progressing") {
        expectedRecords.push("progressing");
        continue;
      }
      const appended = appendCoordinatorStuck(
        store,
        "writer",
        stuckRecord({
          stuckId: `cell-${cell.digest}-${cell.merge}-${cell.answer}`,
          iterationId: `cell-${cell.digest}-${cell.merge}-${cell.answer}`,
          verdict: evaluation.verdict,
          reason: evaluation.reason,
          evidence: evaluation.evidence,
          killOutcome: "not-attempted",
        }),
      );
      expect(appended.ok).toBe(true);
      expectedRecords.push(evaluation.verdict);
    }
    const persisted = expectedRecords.filter((verdict) => verdict !== "progressing").length;
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.stuck).toHaveLength(persisted);
    expect(persisted).toBeGreaterThan(0);
    // `progressing` is never persisted.
    expect(read.stuck.every((entry) => entry.verdict !== "progressing")).toBe(true);
  });

  test("each row's verdict matches artifact evidence alone", () => {
    for (const cell of EVIDENCE_MATRIX) {
      const states = [cell.digest, cell.merge, cell.answer];
      if (states.includes("advanced")) expect(cell.expected).toBe("progressing");
      else if (states.every((state) => state === "unknown"))
        expect(cell.expected).toBe("unevaluable");
      else expect(cell.expected).toBe("stuck");
    }
  });
});
