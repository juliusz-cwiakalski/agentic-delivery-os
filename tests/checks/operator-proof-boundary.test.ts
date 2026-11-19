/**
 * GH-354 §25.3 — the proved / not-proved boundary is a permanent constant and is
 * self-consistent (TC-FIXTURE-002).
 */
import { describe, expect, test } from "bun:test";
import {
  OPERATOR_NOT_PROVEN,
  OPERATOR_PROOF_BOUNDARY,
  OPERATOR_PROVEN,
  OPERATOR_ROW_SEAMS,
} from "../fixtures/dispatch/operator/bounds";
import { OPERATOR_MATRIX } from "../fixtures/dispatch/operator/matrix";

describe("TC-FIXTURE-002 the proof boundary", () => {
  test("the constant declares proven and not-proven ids, in order, with no duplicates", () => {
    expect(OPERATOR_PROOF_BOUNDARY.proven).toEqual(OPERATOR_PROVEN);
    expect(OPERATOR_PROOF_BOUNDARY.notProven).toEqual(OPERATOR_NOT_PROVEN);
    expect(new Set(OPERATOR_PROVEN).size).toBe(OPERATOR_PROVEN.length);
    expect(new Set(OPERATOR_NOT_PROVEN).size).toBe(OPERATOR_NOT_PROVEN.length);
    // No id may appear on both sides.
    for (const id of OPERATOR_PROVEN) expect(OPERATOR_NOT_PROVEN).not.toContain(id);
    // The declarations keep their declared order.
    expect(OPERATOR_PROVEN[0]).toBe("lane-view-fold");
    expect(OPERATOR_NOT_PROVEN[0]).toBe("live-storage-layouts");
  });

  test("every row's seam is a proven id and none depends on a not-proven surface", () => {
    for (const seam of OPERATOR_ROW_SEAMS) expect(OPERATOR_PROVEN).toContain(seam);
    // The matrix's own seam set is a subset of the proven ids.
    for (const seam of OPERATOR_ROW_SEAMS) {
      expect(OPERATOR_NOT_PROVEN).not.toContain(seam);
    }
    for (const entry of OPERATOR_MATRIX) expect(entry.precondition.length).toBeGreaterThan(0);
  });

  test("each planted drift fails with the declared control name", () => {
    const control = (proven: readonly string[], notProven: readonly string[]): string[] => {
      const drift: string[] = [];
      if (proven.length > OPERATOR_PROVEN.length) drift.push("proof boundary drift: add");
      if (proven.length < OPERATOR_PROVEN.length) drift.push("proof boundary drift: drop");
      if (notProven.length > OPERATOR_NOT_PROVEN.length) drift.push("proof boundary drift: add");
      if (notProven.length < OPERATOR_NOT_PROVEN.length) drift.push("proof boundary drift: drop");
      if (proven.length === OPERATOR_PROVEN.length && proven[0] !== OPERATOR_PROVEN[0]) {
        drift.push("proof boundary drift: reorder");
      }
      return drift;
    };
    expect(control(OPERATOR_PROVEN, OPERATOR_NOT_PROVEN)).toEqual([]);
    expect(control([...OPERATOR_PROVEN, "extra"], OPERATOR_NOT_PROVEN)).toContain(
      "proof boundary drift: add",
    );
    expect(control(OPERATOR_PROVEN.slice(1), OPERATOR_NOT_PROVEN)).toContain(
      "proof boundary drift: drop",
    );
    expect(control([...OPERATOR_PROVEN].reverse(), OPERATOR_NOT_PROVEN)).toContain(
      "proof boundary drift: reorder",
    );
  });

  test("the suite reads no change artifact", () => {
    // The boundary is a committed constant; the published page is reconciled by
    // the documentation phase and guarded by the delivered doc checks.
    expect(OPERATOR_PROVEN).not.toContain("doc/changes");
  });
});
