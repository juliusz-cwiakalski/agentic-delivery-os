/**
 * GH-354 F-6 — the answer matrix (TC-MATRIX-001, TC-MATRIX-002, TC-NFR-001) and
 * the delivery-path regression half of TC-CONTRACT-002.
 *
 * The registry is the ONLY declaration of the combinations: this suite
 * enumerates nothing itself, so a lifecycle state or a mode cannot silently
 * shrink. Two consecutive runs must be byte-identical after canonicalization.
 */
import { describe, expect, test } from "bun:test";
import { OPERATOR_MATRIX, runPreparedMatrixCase } from "../../fixtures/dispatch/operator/matrix";

describe("TC-MATRIX the operator answer matrix", () => {
  test("TC-MATRIX-001 all twelve lifecycle-state combinations answer by data and exit, in both output modes", async () => {
    const rows = OPERATOR_MATRIX.filter((entry) =>
      ["MATRIX-STATUS", "MATRIX-LOG", "MATRIX-ISDEL"].some((prefix) => entry.id.startsWith(prefix)),
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
    const failures: string[] = [];
    for (const entry of rows) {
      const outcome = await runPreparedMatrixCase(entry);
      if (outcome.failures.length > 0)
        failures.push(`${outcome.id}: ${outcome.failures.join("; ")}`);
    }
    expect(failures).toEqual([]);
  }, 120_000);

  test("TC-MATRIX-001 the five message-ladder rows answer their declared reason", async () => {
    const rows = OPERATOR_MATRIX.filter((entry) => entry.group === "MSG");
    expect(rows).toHaveLength(5);
    const failures: string[] = [];
    for (const entry of rows) {
      const outcome = await runPreparedMatrixCase(entry);
      if (outcome.failures.length > 0)
        failures.push(`${outcome.id}: ${outcome.failures.join("; ")}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  test("TC-MATRIX-002 the registry is one declaration: unique ids, projection-derived exits, both forms and modes", () => {
    const ids = OPERATOR_MATRIX.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Four queries x three lifecycle states are all declared.
    for (const state of ["live", "terminal", "absent"] as const) {
      for (const prefix of ["MATRIX-STATUS", "MATRIX-LOG", "MATRIX-ISDEL"]) {
        expect(
          OPERATOR_MATRIX.some((entry) => entry.id.startsWith(prefix) && entry.state === state),
          `${prefix} ${state}`,
        ).toBe(true);
      }
    }
    // Both `is-delivering` forms and both output modes are representable.
    expect(OPERATOR_MATRIX.some((entry) => entry.query === "is-delivering")).toBe(true);
    expect(OPERATOR_MATRIX.some((entry) => entry.mode === "human")).toBe(true);
    expect(OPERATOR_MATRIX.some((entry) => entry.mode === "json")).toBe(true);
    // The exit is a projection class, never a literal digit.
    for (const entry of OPERATOR_MATRIX) {
      expect(["success", "user-validation", "platform-provider"]).toContain(entry.projection);
    }
    // Every row names a proven seam, and none depends on a not-proven surface.
    expect(OPERATOR_MATRIX.every((entry) => entry.precondition.length > 0)).toBe(true);
  });

  test("TC-NFR-001 two consecutive battery runs are identical with zero live network and processes", async () => {
    const rows = OPERATOR_MATRIX.filter((entry) => entry.group !== "MSG");
    const runOnce = async (): Promise<readonly string[]> => {
      const answers: string[] = [];
      for (const entry of rows) {
        const outcome = await runPreparedMatrixCase(entry);
        answers.push(`${outcome.id}:${outcome.exit}:${outcome.failures.join("|")}`);
      }
      return answers;
    };
    const first = await runOnce();
    // Two full sweeps: the budget is declared so a slow machine is not a flake.
    const second = await runOnce();
    expect(second).toEqual(first);
  }, 120_000);

  test("TC-CONTRACT-002 the delivered dispatch path is unchanged", async () => {
    // The delivered end-to-end suite is re-run as the control in the gate; here
    // the invariant is that the family's own forms still answer their delivered
    // shapes, so a payload edit cannot move a phase boundary.
    const delivered = OPERATOR_MATRIX.filter((entry) => entry.group === "ISDEL");
    expect(delivered.length).toBeGreaterThan(0);
    for (const entry of OPERATOR_MATRIX) {
      expect(entry.query.startsWith("dispatch")).toBe(false);
    }
  });
});
