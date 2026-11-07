/**
 * Rank classes and close-first ordering (GH-237 F-7, DM-8, DEC-4,
 * AC-F7-1, AC-F7-2).
 *
 * `merge-ready` and `in-review` reuse the delivered close association; a
 * resumable park is `resume-parked`; everything else is `new-start`. A stuck
 * park is excluded before rank assignment and never becomes a candidate.
 */

import {
  QUEUE_RANK_CLASSES,
  type QueueNextAction,
  type QueueParkCause,
  type QueuePreemptionBlock,
  type QueueRankClass,
} from "#contracts";
import type { QueueCloseFact, QueueParkEvaluation } from "./queue-readiness.js";

/** The rank-class order index; lower ranks first. */
export const rankClassIndex = (rankClass: QueueRankClass): number =>
  QUEUE_RANK_CLASSES.indexOf(rankClass);

/**
 * Derive the rank class per pass. Returns `undefined` for a stuck park: it is a
 * hard exclusion, never a `resume-parked` candidate.
 */
export const resolveRankClass = (
  close: QueueCloseFact,
  park: QueueParkEvaluation | undefined,
): QueueRankClass | undefined => {
  if (park?.state === "stuck") return undefined;
  if (close === "merge-ready") return "merge-ready";
  if (close === "in-review") return "in-review";
  if (park?.state === "resumable") return "resume-parked";
  return "new-start";
};

/** The named park cause for a resumable preemption park. */
export const preemptionParkCause = (): QueueParkCause => "preempted-for-close-item";

/** Build the preemption block for a close item blocked by a new start's lease. */
export const preemptionBlock = (input: {
  readonly closeRef: string;
  readonly repository: string;
  readonly holder: string;
}): QueuePreemptionBlock => ({
  targetRef: input.closeRef,
  repository: input.repository,
  holder: input.holder,
  parkCause: "preempted-for-close-item",
  conditionType: "preemption",
  closeRef: input.closeRef,
});

/** Whether a rank class is a close item (merge-ready or in-review). */
export const isCloseRank = (rankClass: QueueRankClass): boolean =>
  rankClass === "merge-ready" || rankClass === "in-review";

/** Whether an action is a preemption proposal rather than a delivery action. */
export const isPreemptionAction = (action: QueueNextAction): boolean =>
  action.preemption !== undefined;
