/**
 * Weight-class resolution and per-runner accounting (GH-237 F-5, DM-7, DEC-10,
 * AC-F5-1, AC-F5-2).
 *
 * A validated plan owns the class: an omitted declaration is `standard`, a
 * declared-but-unrecognized value is `heavy`, and a plan that cannot be read or
 * validated is `heavy` with source `plan-unreadable`; an absent plan is `heavy`
 * with source `plan-absent`. Only a validated plan can make an absent
 * declaration mean `standard`. Weight is a per-runner resource class, never a
 * lane cap.
 */

import {
  QUEUE_WEIGHT_CLASSES,
  type QueueActiveLease,
  type QueueWeightClass,
  type QueueWeightClassSource,
} from "#contracts";
import type { QueuePlanFact } from "./queue-readiness.js";

/** The resolved class plus its provenance and (where applicable) identity. */
export type QueueWeightResolution = {
  readonly weightClass: QueueWeightClass;
  readonly source: QueueWeightClassSource;
  readonly code?: "plan.schema.invalid" | "plan.artifact.missing" | "plan.format.legacy-markdown";
};

/** Resolve one entry's weight class from its plan artifact fact. */
export const resolveQueueWeight = (plan: QueuePlanFact | undefined): QueueWeightResolution => {
  if (plan === undefined || plan.state === "absent") {
    return { weightClass: "heavy", source: "plan-absent", code: "plan.artifact.missing" };
  }
  if (plan.state === "invalid") {
    return { weightClass: "heavy", source: "plan-unreadable", code: plan.code };
  }
  if (plan.weightClass === undefined) {
    return { weightClass: "standard", source: "absent" };
  }
  if ((QUEUE_WEIGHT_CLASSES as readonly string[]).includes(plan.weightClass)) {
    return { weightClass: plan.weightClass as QueueWeightClass, source: "declared" };
  }
  return { weightClass: "heavy", source: "declared" };
};

/** One active heavy lease on the runner, if any. */
export const activeHeavyLease = (
  leases: readonly QueueActiveLease[],
  runner: string,
  ref: string,
): QueueActiveLease | undefined =>
  leases.find(
    (lease) => lease.runner === runner && lease.weightClass === "heavy" && lease.ref !== ref,
  );

/**
 * Whether a heavy candidate is held by the runner's single-heavy rule. A
 * standard candidate is never held; the active-repository count is unchanged.
 */
export const isHeldByWeight = (
  resolution: QueueWeightResolution,
  leases: readonly QueueActiveLease[],
  runner: string,
  ref: string,
): QueueActiveLease | undefined =>
  resolution.weightClass === "heavy" ? activeHeavyLease(leases, runner, ref) : undefined;

/** The per-runner weight-load view (one row per runner/class). */
export type QueueWeightLoad = {
  readonly runner: string;
  readonly class: QueueWeightClass;
  readonly active: number;
  readonly refs: readonly string[];
};

/** Fold active leases into deterministic per-runner weight loads. */
export const weightLoads = (
  leases: readonly QueueActiveLease[],
): readonly QueueWeightLoad[] => {
  const rows = new Map<string, { runner: string; class: QueueWeightClass; refs: string[] }>();
  for (const lease of leases) {
    const key = `${lease.runner}\u0000${lease.weightClass}`;
    const row = rows.get(key) ?? { runner: lease.runner, class: lease.weightClass, refs: [] };
    if (!row.refs.includes(lease.ref)) row.refs.push(lease.ref);
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => ({
      runner: row.runner,
      class: row.class,
      active: row.refs.length,
      refs: [...row.refs].sort(),
    }))
    .sort((left, right) =>
      left.runner === right.runner
        ? left.class.localeCompare(right.class)
        : left.runner.localeCompare(right.runner),
    );
};
