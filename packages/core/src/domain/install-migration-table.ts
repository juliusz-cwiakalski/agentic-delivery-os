/**
 * GH-365 F-3 — the migration decision table and the verdict composition (pure).
 *
 * The table is for NON-derived entries, evaluated in the declared order. The
 * derived rule is evaluated before it by the plan builder. The verdict is
 * DM-6's stated maximum-severity composition; it is data, never an error code.
 */
import {
  MIGRATION_VERDICT_SEVERITY,
  type MigrationDisposition,
  type MigrationVerdict,
} from "#contracts";

export type NonDerivedDecisionInput = {
  readonly sourceExists: boolean;
  readonly sourceIsSymlink: boolean;
  readonly destinationExists: boolean;
  readonly destinationIsSymlink: boolean;
  readonly identical: boolean;
};

/** The five-row table, with the symlink rule evaluated first (DM-6). */
export const decideNonDerived = (input: NonDerivedDecisionInput): MigrationDisposition => {
  if (input.sourceIsSymlink) return "blocked";
  if (input.destinationIsSymlink) return "conflict";
  if (!input.sourceExists) return input.destinationExists ? "already-migrated" : "absent";
  if (!input.destinationExists) return "moved";
  return input.identical ? "duplicate-identical" : "conflict";
};

/** A derived entry takes only `already-migrated` (destination copy) or `absent`. */
export const decideDerived = (destinationExists: boolean): MigrationDisposition =>
  destinationExists ? "already-migrated" : "absent";

const isBlocking = (disposition: MigrationDisposition): boolean =>
  disposition === "conflict" || disposition === "blocked";

/**
 * Compose a root's or the run's verdict: the maximum severity over the
 * dispositions, with `absent`/`already-migrated` neutral. A conflict or block
 * reports `partial` when at least one planned move completed and the maximum
 * itself when none did; `duplicate-identical` is a retained success.
 */
export const composeVerdict = (
  dispositions: readonly MigrationDisposition[],
  movedCount: number,
): MigrationVerdict => {
  let severity = 0;
  let blocking: MigrationDisposition | undefined;
  for (const disposition of dispositions) {
    if (disposition === "moved") severity = Math.max(severity, MIGRATION_VERDICT_SEVERITY.migrated);
    if (disposition === "duplicate-identical") {
      severity = Math.max(severity, MIGRATION_VERDICT_SEVERITY["duplicate-identical"]);
    }
    if (isBlocking(disposition)) {
      severity = Math.max(
        severity,
        disposition === "blocked"
          ? MIGRATION_VERDICT_SEVERITY.blocked
          : MIGRATION_VERDICT_SEVERITY.conflict,
      );
      if (disposition === "blocked") blocking = "blocked";
      else if (blocking === undefined) blocking = "conflict";
    }
  }
  if (blocking !== undefined) {
    return movedCount > 0 ? "partial" : blocking === "blocked" ? "blocked" : "conflict";
  }
  if (severity >= MIGRATION_VERDICT_SEVERITY.migrated) return "migrated";
  return "already-migrated";
};
