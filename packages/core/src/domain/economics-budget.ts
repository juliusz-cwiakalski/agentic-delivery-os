/**
 * The single restart-budget admission gate (GH-235 F-4, D-11, DEC-3, DEC-5).
 *
 * Pure over injected data: the delivery's restart records, the bound resolved at
 * evaluation time, and the delivery identity. No clock, randomness,
 * environment, or filesystem access; no bound literal. The fold is fail-closed:
 * an unevaluable record set refuses (never admits) and a count is never
 * fabricated from state that cannot be read.
 */
import {
  type EconomicsRecordFailureCode,
  type EconomicsRestartRecord,
  type RestartBudgetDecision,
} from "#contracts";
import {
  economicsReferenceFor,
  formatBudgetEvidence,
  formatUnevaluableEvidence,
} from "./economics-evidence.js";

/** The restart budget gate's injected input (D-11, D-9). */
export type RestartBudgetGateInput = {
  readonly workItemRef: string;
  /** The resolved bound, read at evaluation time; never captured at construction. */
  readonly bound: number;
  readonly records: readonly EconomicsRestartRecord[];
  /** Unknown record kinds among the delivery's records (state.store.unknown). */
  readonly unknownKinds?: readonly string[];
  /** An unreadable-store classification propagated from the injected port. */
  readonly unreadable?: EconomicsRecordFailureCode;
};

const sorts = (records: readonly EconomicsRestartRecord[]): readonly EconomicsRestartRecord[] =>
  [...records].sort((left, right) => left.ordinal - right.ordinal);

type FoldedRestarts =
  | { readonly ok: true; readonly records: readonly EconomicsRestartRecord[] }
  | { readonly ok: false; readonly code: EconomicsRecordFailureCode };

/** Fold verified restart records into the count/history, refusing torn ordinals. */
export const foldRestartRecords = (
  records: readonly EconomicsRestartRecord[],
): FoldedRestarts => {
  const ordered = sorts(records);
  let expected = 1;
  for (const record of ordered) {
    if (!Number.isInteger(record.ordinal) || record.ordinal !== expected) {
      return { ok: false, code: "state.store.torn" };
    }
    expected += 1;
  }
  return { ok: true, records: ordered };
};

const exitFor = (code: EconomicsRecordFailureCode): 1 | 2 =>
  code === "state.permission.denied" ? 1 : 2;

const unevaluable = (
  workItemRef: string,
  code: EconomicsRecordFailureCode,
): RestartBudgetDecision => ({
  outcome: "unevaluable",
  code,
  exitCode: exitFor(code),
  corpus: formatUnevaluableEvidence({ reason: code, workItemRef }),
});

/**
 * The one admission gate every resume path composes. The bound arrives as data
 * on each evaluation (D-11), so a changed resolved policy is observed without
 * reconstruction.
 */
export const evaluateRestartBudget = (input: RestartBudgetGateInput): RestartBudgetDecision => {
  if (input.unreadable !== undefined) return unevaluable(input.workItemRef, input.unreadable);
  if (input.unknownKinds !== undefined && input.unknownKinds.length > 0) {
    return unevaluable(input.workItemRef, "state.store.unknown");
  }
  const folded = foldRestartRecords(input.records);
  if (!folded.ok) return unevaluable(input.workItemRef, folded.code);
  const count = folded.records.length;
  const historyRef = economicsReferenceFor(input.workItemRef);
  if (count >= input.bound) {
    return {
      outcome: "refuse-budget",
      code: "dispatch.restart-budget-exceeded",
      exitCode: 1,
      count,
      historyRef,
      corpus: formatBudgetEvidence({
        reason: "dispatch.restart-budget-exceeded",
        restarts: count,
        workItemRef: input.workItemRef,
      }),
    };
  }
  return {
    outcome: "admit",
    count,
    nextOrdinal: count + 1,
    bound: input.bound,
    historyRef,
  };
};
