/**
 * Wake-on-typed-question evaluation (GH-241 F-7, DEC-9; AC-F7-1..6).
 *
 * The delivered `isCoordinatorPickup` predicate is reused, never re-implemented:
 * rank 1, open (an absent `status` counts as open), coordinator audience. Only a
 * successful wake persists a record and consumes the one-wake-per-question
 * lifetime; every other outcome is a tick result that appends nothing.
 */
import type { BlockerAudience, CoordinatorWakeOutcome } from "#contracts";
import { isCoordinatorPickup } from "./blockers.js";

/** The ranked head the cycle evaluates (the delivered view slice). */
export type CoordinatorWakeHead = {
  readonly id: string;
  readonly rank: number;
  readonly audience: BlockerAudience;
  readonly status?: string;
  readonly askedAt: string;
};

/** The persisted wake-dedupe key: coordinator id + question id + `askedAt`. */
export type CoordinatorWakeKey = {
  readonly coordinatorId: string;
  readonly questionId: string;
  readonly askedAt: string;
};

/** Every injected wake fact. */
export type CoordinatorWakeFacts = {
  readonly coordinatorId: string;
  /** The ranked open set; only its head participates in pickup. */
  readonly ranked: readonly CoordinatorWakeHead[];
  /** Question ids with a recorded answer. */
  readonly answeredQuestionIds: readonly string[];
  /** Persisted wake keys (durable `woken` records). */
  readonly woken: readonly CoordinatorWakeKey[];
  /** Whether the wake delivery attempt succeeded. */
  readonly delivered: boolean;
};

/** One evaluation: the closed outcome and whether a durable record lands. */
export type CoordinatorWakeEvaluation = {
  readonly outcome: CoordinatorWakeOutcome;
  readonly persists: boolean;
  readonly question: CoordinatorWakeHead | null;
};

const evaluated = (
  outcome: CoordinatorWakeOutcome,
  question: CoordinatorWakeHead | null,
): CoordinatorWakeEvaluation => ({
  outcome,
  persists: outcome === "woken",
  question,
});

/**
 * Evaluate the wake. Order is: pickup predicate -> answered-before-wake ->
 * already-woken -> delivery outcome -> `woken`.
 */
export const evaluateWake = (facts: CoordinatorWakeFacts): CoordinatorWakeEvaluation => {
  const head = facts.ranked[0];
  if (head === undefined || !isCoordinatorPickup([head])) return evaluated("no-pickup", null);
  if (facts.answeredQuestionIds.includes(head.id)) {
    return evaluated("answered-before-wake", head);
  }
  const already = facts.woken.some(
    (key) =>
      key.coordinatorId === facts.coordinatorId &&
      key.questionId === head.id &&
      key.askedAt === head.askedAt,
  );
  if (already) return evaluated("already-woken", head);
  if (!facts.delivered) return evaluated("delivery-failed", head);
  return evaluated("woken", head);
};

/** The dedupe key a persisted wake record would carry. */
export const wakeKeyFor = (
  coordinatorId: string,
  question: CoordinatorWakeHead,
): CoordinatorWakeKey => ({
  coordinatorId,
  questionId: question.id,
  askedAt: question.askedAt,
});
