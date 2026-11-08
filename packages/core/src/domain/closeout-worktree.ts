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
