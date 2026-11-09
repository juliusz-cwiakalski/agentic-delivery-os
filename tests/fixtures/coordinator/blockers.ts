/**
 * Coordinator blocker fixtures (GH-241 TC-COORD-060..075): pickups, absent-status
 * rank-1, cap boundaries, near-miss escalation refs, and the escalation-ranked-
 * ninth ledger.
 */
import type {
  BlockerAnswerRecord,
  BlockerQuestionRecord,
} from "../../../packages/core/src/contracts/index";
import {
  BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
} from "../../../packages/core/src/contracts/index";

export const ASKED_AT = "1970-01-01T00:10:00.000Z";

export const question = (
  overrides: Partial<BlockerQuestionRecord> = {},
): BlockerQuestionRecord => ({
  schemaId: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  id: "q-0001",
  type: "decision-needed",
  audience: "coordinator",
  lane: "coordinator",
  ref: null,
  question: "Which delivery should the coordinator take next?",
  options: ["continue", "park"],
  askedAt: ASKED_AT,
  ...overrides,
});

export const answer = (
  overrides: Partial<BlockerAnswerRecord> = {},
): BlockerAnswerRecord => ({
  schemaId: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  questionId: "q-0001",
  answeringAudience: "coordinator",
  choice: "continue",
  answeredAt: "1970-01-01T00:11:00.000Z",
  applied: false,
  laneResume: {
    mode: "boundary-note",
    sessionReentry: false,
    capabilitySource: "adapter-declared",
  },
  ...overrides,
});

/** A rank-1 open coordinator question with an absent status (a pickup). */
export const pickupQuestion = (id = "q-pickup"): BlockerQuestionRecord =>
  question({ id, askedAt: "1970-01-01T00:00:01.000Z" });

/** An owner-audience question (never a coordinator pickup). */
export const ownerQuestion = (id = "q-owner"): BlockerQuestionRecord =>
  question({ id, audience: "owner", askedAt: "1970-01-01T00:00:02.000Z" });

/** A non-rank-1 coordinator question behind an owner head. */
export const secondCoordinatorQuestion = (id = "q-second"): BlockerQuestionRecord =>
  question({ id, askedAt: "1970-01-01T00:00:03.000Z" });

/** The reserved escalation question for one epoch. */
export const escalationQuestion = (
  coordinatorId: string,
  epoch: string,
  id = "q-escalation",
): BlockerQuestionRecord =>
  question({
    id,
    audience: "owner",
    lane: "coordinator",
    ref: `${coordinatorId}#${epoch}`,
    question: `Coordinator ${coordinatorId} exhausted its restart budget.`,
    options: ["restart-fresh-budget", "park-owner-review"],
  });

/** Near-miss refs that must never match the reserved-slot predicate. */
export const NEAR_MISS_ESCALATION_REFS = [
  "coordinator-main",
  "coordinator-main#",
  "#epoch-1",
  "coordinator-main#epoch-1#extra",
  `${"#"}epoch-1`,
] as const;

/** A cap-sized ledger with the escalation question ranked ninth by age. */
export const escalationRankedNinth = (
  coordinatorId: string,
  epoch: string,
): readonly BlockerQuestionRecord[] => {
  const older = Array.from({ length: 8 }, (_value, index) =>
    question({
      id: `q-old-${index + 1}`,
      audience: "coordinator",
      askedAt: `1970-01-01T00:00:0${index + 1}.000Z`,
    }),
  );
  return [...older, escalationQuestion(coordinatorId, epoch)];
};
