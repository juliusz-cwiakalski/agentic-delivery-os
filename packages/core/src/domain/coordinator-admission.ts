/**
 * The durable coordinator restart admission fold (GH-241 F-5, DEC-8; AC-F5-2/3).
 *
 * The budget is per budget epoch and stored in the coordinator restart
 * namespace. Ordinals are contiguous from `1`; a torn, gapped, or duplicated
 * ordinal set is unevaluable and is never read as count `0`. The bound is
 * configuration policy supplied by the caller, never a literal here.
 */
import type { CoordinatorRestartRecord } from "#contracts";

/** The admission verdict. */
export type CoordinatorRestartAdmission =
  | {
      readonly state: "admit";
      readonly count: number;
      readonly bound: number;
      readonly nextOrdinal: number;
    }
  | { readonly state: "refuse"; readonly count: number; readonly bound: number }
  | {
      readonly state: "unevaluable";
      readonly count: null;
      readonly bound: number;
      readonly reason: "torn-ordinals";
    };

/**
 * Fold the ordinals of one epoch and decide admission.
 *
 * A below-bound restart admits with the next contiguous ordinal; at or above the
 * bound nothing is admitted (a bound of `0` therefore admits no restart).
 */
export const evaluateCoordinatorRestartAdmission = (input: {
  readonly records: readonly CoordinatorRestartRecord[];
  readonly budgetEpochId: string;
  readonly bound: number;
}): CoordinatorRestartAdmission => {
  const ordinals = input.records
    .filter((record) => record.budgetEpochId === input.budgetEpochId)
    .map((record) => record.ordinal)
    .sort((left, right) => left - right);
  const count = ordinals.length;
  for (let index = 0; index < ordinals.length; index += 1) {
    if (ordinals[index] !== index + 1) {
      return { state: "unevaluable", count: null, bound: input.bound, reason: "torn-ordinals" };
    }
  }
  const bound = input.bound;
  if (count >= bound) return { state: "refuse", count, bound };
  return { state: "admit", count, bound: input.bound, nextOrdinal: count + 1 };
};

/** The continuation restart ordinal (or `null` when no restart may land). */
export const nextRestartOrdinal = (admission: CoordinatorRestartAdmission): number | null =>
  admission.state === "admit" ? admission.nextOrdinal : null;
