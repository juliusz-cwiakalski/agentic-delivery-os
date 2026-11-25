/**
 * The local worktree safety predicate (GH-240 F-7, DEC-10, NFR-9).
 *
 * Mirrors branch deletion: merged evidence, convention match, exact head
 * equality, cleanliness, not-current, not-locked/foreign, successful restore,
 * and no earlier non-gap failure. A failing condition refuses; no force path
 * exists.
 */
export type WorktreeSafetyInput = {
  readonly present: boolean;
  readonly mergedObserved: boolean;
  readonly conventionMatch: boolean;
  readonly localHead?: string;
  readonly mergedHeadSha?: string;
  readonly clean: boolean;
  readonly isCurrent: boolean;
  readonly locked: boolean;
  readonly foreign: boolean;
  readonly restoreSucceeded: boolean;
  readonly earlierFailure: boolean;
};

export type WorktreeSafetyVerdict = {
  readonly safe: boolean;
  readonly reason?: string;
};

/** Evaluate the full predicate; absent is a `no-worktree` satisfaction. */
export const evaluateWorktreeSafety = (input: WorktreeSafetyInput): WorktreeSafetyVerdict => {
  if (!input.present) return { safe: false, reason: "no-worktree" };
  if (!input.mergedObserved) return { safe: false, reason: "not-merged" };
  if (!input.conventionMatch) return { safe: false, reason: "foreign" };
  if (input.localHead === undefined || input.mergedHeadSha === undefined) {
    return { safe: false, reason: "head-unknown" };
  }
  if (input.localHead !== input.mergedHeadSha) return { safe: false, reason: "head-moved" };
  if (!input.clean) return { safe: false, reason: "dirty" };
  if (input.isCurrent) return { safe: false, reason: "current-checkout" };
  if (input.locked) return { safe: false, reason: "locked" };
  if (input.foreign) return { safe: false, reason: "foreign" };
  if (!input.restoreSucceeded) return { safe: false, reason: "restore-failed" };
  if (input.earlierFailure) return { safe: false, reason: "earlier-failure" };
  return { safe: true };
};

/* ------------------------------------------------------------------------- */
/* GH-404 F-6 — the closeout ordering rules, layered AROUND the delivered    */
/* safety predicate above (reused, never redefined). The lane's logs are     */
/* swept before removal; removal happens strictly after the merge is         */
/* confirmed; a lane stopped without a merge keeps its worktree.             */
/* ------------------------------------------------------------------------- */

/** The closeout removal ordering plan (F-6, NFR-5). */
export type CloseoutWorktreeOrderingPlan =
  | { readonly remove: true }
  | {
      readonly remove: false;
      readonly reason: "merge-unconfirmed" | "logs-not-swept" | "safety-refused";
      /** The delivered predicate's own refusal reason when the ordering refused on safety. */
      readonly safetyReason?: string;
    };

/**
 * Plan the removal ordering for one lane closeout (F-6, NFR-5).
 *
 * The ordering is the contract: the merge must be confirmed first (a stalled
 * lane without a merge always keeps its worktree), the lane's logs must
 * already be swept to their destination, and only then does the delivered
 * safety predicate decide. Every refusal keeps the worktree and the logs
 * intact; there is no force path.
 */
export const planCloseoutWorktreeRemoval = (input: {
  /** The merge is confirmed (squash landing observed for this lane's change). */
  readonly mergeConfirmed: boolean;
  /** The lane's logs are already swept to their destination. */
  readonly logsSwept: boolean;
  /** The delivered safety predicate's input, evaluated unchanged. */
  readonly safety: WorktreeSafetyInput;
}): CloseoutWorktreeOrderingPlan => {
  if (!input.mergeConfirmed) return { remove: false, reason: "merge-unconfirmed" };
  if (!input.logsSwept) return { remove: false, reason: "logs-not-swept" };
  const verdict = evaluateWorktreeSafety(input.safety);
  if (!verdict.safe) {
    return {
      remove: false,
      reason: "safety-refused",
      ...(verdict.reason === undefined ? {} : { safetyReason: verdict.reason }),
    };
  }
  return { remove: true };
};
