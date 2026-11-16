/**
 * The decision-record mirror-sync planning module (GH-296 F-3; NFR-12, RSK-3).
 *
 * Pure planning over declared targets and inspected state: the declared write
 * set, the clean/declared-base preconditions, `artifact-equals-source` in both
 * directions, dry-run default, declared targets only, and no force path. The
 * landing path is the delivered commit primitive, composed at the edge; this
 * module never commits, executes a command, or touches an undeclared target.
 */
import type { CeremonyMirrorInspection } from "#contracts";

/** One planned target outcome. */
export type CeremonyMirrorTargetPlan = {
  readonly target: string;
  readonly state: CeremonyMirrorInspection["state"];
  readonly equal: boolean;
  readonly extra: readonly string[];
  readonly missing: readonly string[];
  readonly applied: boolean;
  readonly reason?: string;
};

/** The planning input; every fact is injected. */
export type CeremonyMirrorPlanInput = {
  readonly targets: readonly string[];
  readonly sources: Readonly<Record<string, readonly string[]>>;
  readonly inspect: (target: string) => CeremonyMirrorInspection;
  readonly applyTarget?: (
    target: string,
    records: readonly string[],
  ) => { readonly ok: boolean; readonly detail?: string };
  readonly apply: boolean;
};

/** The planning result: per-target plans plus the first failure reason, if any. */
export type CeremonyMirrorPlan = {
  readonly targets: readonly CeremonyMirrorTargetPlan[];
  readonly failure?: string;
};

const setEqual = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((entry, index) => entry === rightSorted[index]);
};

/**
 * Plan (and, only with `apply`, land) the declared mirror write set.
 *
 * A dry run verifies the target preconditions and computes the write set; a
 * target whose mirror set already differs is reported per target without
 * failing the run, because nothing landed (E-8, AC-F4-5). With `--apply`, the
 * landing must leave every target equal to its source set in both directions
 * (NFR-12); a precondition failure or an unequal landing names the target.
 */
export const planCeremonyMirror = (input: CeremonyMirrorPlanInput): CeremonyMirrorPlan => {
  if (input.targets.length === 0) {
    return { targets: [], failure: "no affected repository targets were declared" };
  }
  if (input.targets.length > 8) {
    return {
      targets: [],
      failure: `declares ${String(input.targets.length)} targets; the bound is 8`,
    };
  }
  const plans: CeremonyMirrorTargetPlan[] = [];
  for (const target of input.targets) {
    const inspection = input.inspect(target);
    const source = input.sources[target] ?? [];
    const extra = inspection.mirrorSet.filter((entry) => !source.includes(entry));
    const missing = source.filter((entry) => !inspection.mirrorSet.includes(entry));
    if (inspection.state !== "clean") {
      plans.push({
        target,
        state: inspection.state,
        equal: false,
        extra,
        missing,
        applied: false,
        reason: `precondition "${inspection.state}" on target "${target}"`,
      });
      continue;
    }
    if (!input.apply) {
      plans.push({
        target,
        state: "clean",
        equal: setEqual(inspection.mirrorSet, source),
        extra,
        missing,
        applied: false,
      });
      continue;
    }
    if (input.applyTarget === undefined) {
      plans.push({
        target,
        state: "clean",
        equal: false,
        extra,
        missing,
        applied: false,
        reason: "no landing path is composed",
      });
      continue;
    }
    const applied = input.applyTarget(target, source);
    const after = input.inspect(target);
    plans.push({
      target,
      state: after.state,
      equal: applied.ok && setEqual(after.mirrorSet, source),
      extra: after.mirrorSet.filter((entry) => !source.includes(entry)),
      missing: source.filter((entry) => !after.mirrorSet.includes(entry)),
      applied: applied.ok,
      ...(applied.ok ? {} : { reason: applied.detail ?? "apply failed" }),
    });
  }
  const failure = plans.find((plan) => plan.reason !== undefined || (input.apply && !plan.equal));
  return {
    targets: plans,
    ...(failure === undefined
      ? {}
      : { failure: failure.reason ?? `target "${failure.target}" does not equal its source set` }),
  };
};

/** The mirror report schema identity (F-3). */
export const CEREMONY_MIRROR_REPORT_SCHEMA = "delivery.ceremony.mirror-report.v1" as const;

/** The mirror target schema identity (F-3). */
export const CEREMONY_MIRROR_TARGET_SCHEMA = "delivery.ceremony.mirror-target.v1" as const;
