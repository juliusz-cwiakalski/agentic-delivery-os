/**
 * The permanent namespace proof boundary and the battery-row registry.
 *
 * `NAMESPACE_PROOF_BOUNDARY` is the only source of the change's proven /
 * not-proven boundary (spec Appendix G). Rows are appended by every phase that
 * lands a case group; a row carries its case id and exactly one proven id, never
 * an expected output (the case carries that).
 */

export const NAMESPACE_PROOF_BOUNDARY = {
  proven: [
    "committed-layer",
    "clean-clone",
    "authoritative-root",
    "prior-notice",
    "migration-plan",
    "migration-move",
    "shim-reconciliation",
    "conformance-negative-controls",
  ],
  notProven: [
    "real-operator-home",
    "second-machine-clone",
    "ci-runner-home",
    "other-checkouts",
    "third-party-alias-consumers",
    "shim-removal-release",
    "prose-residual",
    "shell-fallback-post-migration",
  ],
} as const;

export type NamespaceProvenId = (typeof NAMESPACE_PROOF_BOUNDARY.proven)[number];
export type NamespaceNotProvenId = (typeof NAMESPACE_PROOF_BOUNDARY.notProven)[number];

export type NamespaceBatteryRow = {
  readonly caseId: string;
  readonly proven: NamespaceProvenId;
  readonly phase: number;
};

/** The registered battery rows, appended one case group at a time. */
export const NAMESPACE_BATTERY_ROWS: readonly NamespaceBatteryRow[] = [
  { caseId: "TC-LAYER-001", proven: "committed-layer", phase: 1 },
  { caseId: "TC-LAYER-002", proven: "clean-clone", phase: 1 },
  { caseId: "TC-LAYER-003", proven: "clean-clone", phase: 1 },
  { caseId: "TC-LAYER-004", proven: "committed-layer", phase: 1 },
  { caseId: "TC-SHIM-001", proven: "shim-reconciliation", phase: 2 },
  { caseId: "TC-SHIM-002", proven: "shim-reconciliation", phase: 3 },
  { caseId: "TC-SCAN-001", proven: "conformance-negative-controls", phase: 3 },
  { caseId: "TC-SCAN-002", proven: "conformance-negative-controls", phase: 3 },
];

const provenSet: ReadonlySet<string> = new Set(NAMESPACE_PROOF_BOUNDARY.proven);
const notProvenSet: ReadonlySet<string> = new Set(NAMESPACE_PROOF_BOUNDARY.notProven);

/**
 * Structural violations that hold at every phase: the declared counts and order,
 * disjointness, and every row declaring exactly one proven id (never a
 * not-proven surface).
 */
export const structuralViolations = (
  rows: readonly NamespaceBatteryRow[] = NAMESPACE_BATTERY_ROWS,
): string[] => {
  const violations: string[] = [];
  if (NAMESPACE_PROOF_BOUNDARY.proven.length !== 8) {
    violations.push(
      `proven boundary expected 8 ids, received ${String(NAMESPACE_PROOF_BOUNDARY.proven.length)}`,
    );
  }
  if (NAMESPACE_PROOF_BOUNDARY.notProven.length !== 8) {
    violations.push(
      `not-proven boundary expected 8 ids, received ${String(NAMESPACE_PROOF_BOUNDARY.notProven.length)}`,
    );
  }
  for (const id of NAMESPACE_PROOF_BOUNDARY.proven) {
    if (notProvenSet.has(id)) violations.push(`boundary id ${id} is both proven and not proven`);
  }
  for (const row of rows) {
    if (!provenSet.has(row.proven)) {
      violations.push(`row ${row.caseId} names ${row.proven}, which is not a proven id`);
    }
    if (notProvenSet.has(row.proven)) {
      violations.push(`row ${row.caseId} names a not-proven surface ${row.proven}`);
    }
  }
  return violations;
};

/**
 * The complete boundary check: the structural properties plus the property that
 * every proven id owns at least one row. The registry is complete for every
 * proven id at or before the proof-boundary case's phase.
 */
export const boundaryViolations = (
  rows: readonly NamespaceBatteryRow[] = NAMESPACE_BATTERY_ROWS,
): string[] => {
  const violations = structuralViolations(rows);
  for (const id of NAMESPACE_PROOF_BOUNDARY.proven) {
    if (!rows.some((row) => row.proven === id)) {
      violations.push(`proven id ${id} has no battery row`);
    }
  }
  return violations;
};
