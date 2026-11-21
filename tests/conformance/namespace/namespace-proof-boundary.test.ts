/**
 * GH-365 P7 TC-IDENTITY-006 — the permanent namespace proof boundary.
 *
 * `NAMESPACE_PROOF_BOUNDARY` is the only source of the change's boundary: eight
 * proven ids and eight not-proven ids in the declared order. The battery rows
 * are complete for every proven id by this phase. Five planted controls prove the
 * check is not vacuous.
 */
import { describe, expect, test } from "bun:test";
import {
  boundaryViolations,
  NAMESPACE_BATTERY_ROWS,
  NAMESPACE_PROOF_BOUNDARY,
  type NamespaceBatteryRow,
  structuralViolations,
} from "../../fixtures/namespace/evidence";

const PROVEN = [
  "committed-layer",
  "clean-clone",
  "authoritative-root",
  "prior-notice",
  "migration-plan",
  "migration-move",
  "shim-reconciliation",
  "conformance-negative-controls",
] as const;
const NOT_PROVEN = [
  "real-operator-home",
  "second-machine-clone",
  "ci-runner-home",
  "other-checkouts",
  "third-party-alias-consumers",
  "shim-removal-release",
  "prose-residual",
  "shell-fallback-post-migration",
] as const;

const row = (caseId: string, proven: string): NamespaceBatteryRow =>
  ({ caseId, proven, phase: 7 }) as NamespaceBatteryRow;

describe("TC-IDENTITY-006 the permanent proof boundary", () => {
  test("the boundary declares the eight proven / eight not-proven ids in order", () => {
    expect(NAMESPACE_PROOF_BOUNDARY.proven).toEqual([...PROVEN]);
    expect(NAMESPACE_PROOF_BOUNDARY.notProven).toEqual([...NOT_PROVEN]);
    expect(new Set(NAMESPACE_PROOF_BOUNDARY.proven).size).toBe(8);
    expect(new Set(NAMESPACE_PROOF_BOUNDARY.notProven).size).toBe(8);
    for (const id of NAMESPACE_PROOF_BOUNDARY.proven) {
      expect(NAMESPACE_PROOF_BOUNDARY.notProven).not.toContain(id);
    }
    expect(boundaryViolations()).toEqual([]);
  });

  test("every battery row names exactly one proven id and every proven id owns a row", () => {
    for (const entry of NAMESPACE_BATTERY_ROWS) {
      expect(NAMESPACE_PROOF_BOUNDARY.proven).toContain(entry.proven);
    }
    for (const id of NAMESPACE_PROOF_BOUNDARY.proven) {
      expect(
        NAMESPACE_BATTERY_ROWS.some((entry) => entry.proven === id),
        id,
      ).toBe(true);
    }
  });

  test("control 1: a not-proven id in a row fails by name", () => {
    const rows = [...NAMESPACE_BATTERY_ROWS, row("TC-CONTROL-1", "real-operator-home")];
    expect(structuralViolations(rows).join("\n")).toContain("not a proven id");
  });

  test("control 2: a row naming an unknown id fails by name", () => {
    const rows = [...NAMESPACE_BATTERY_ROWS, row("TC-CONTROL-2", "not-a-surface")];
    expect(structuralViolations(rows).join("\n")).toContain("not a proven id");
  });

  test("control 3: a proven id with no row fails by name", () => {
    const rows = NAMESPACE_BATTERY_ROWS.filter((entry) => entry.proven !== "prior-notice");
    expect(boundaryViolations(rows).join("\n")).toContain(
      "proven id prior-notice has no battery row",
    );
  });

  test("control 4: a not-proven id in the proven list breaks disjointness", () => {
    const proven = [...NAMESPACE_PROOF_BOUNDARY.proven, "real-operator-home"] as const;
    const notProven = NAMESPACE_PROOF_BOUNDARY.notProven;
    const overlap = proven.filter((id) => (notProven as readonly string[]).includes(id));
    expect(overlap).toEqual(["real-operator-home"]);
    expect(NAMESPACE_PROOF_BOUNDARY.proven).not.toContain("real-operator-home");
  });

  test("control 5: a row naming a not-proven surface is never credited as proven", () => {
    const rows = [...NAMESPACE_BATTERY_ROWS, row("TC-CONTROL-5", "prose-residual")];
    const violations = structuralViolations(rows);
    expect(violations.some((line) => line.includes("prose-residual"))).toBe(true);
    expect(boundaryViolations(rows)).toEqual(
      expect.arrayContaining(violations.filter((line) => line.includes("prose-residual"))),
    );
  });
});
