/**
 * Shared blocker record builders (test-plan §4.1).
 *
 * Every suite injects facts; nothing here reads the wall clock, environment,
 * network, or live tree. Builders return fresh values so a mutation control
 * never touches another case.
 */
import {
  BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  type BlockerAnswerRecord,
  type BlockerCapabilityFact,
  type BlockerQuestionRecord,
} from "../../../packages/core/src/contracts/index";
import { projectBlockerLaneResume } from "../../../packages/core/src/domain/blockers";

export const FIXED_ISO = "2026-11-06T12:00:00Z";
export const FIXED_MS = Date.parse(FIXED_ISO);

export type QuestionInput = {
  readonly id: string;
  readonly type?: BlockerQuestionRecord["type"];
  readonly audience?: BlockerQuestionRecord["audience"];
  readonly lane?: string;
  readonly ref?: string | null;
  readonly question?: string;
  readonly options?: readonly string[];
  readonly askedAt?: string;
};

export const makeQuestion = (input: QuestionInput): BlockerQuestionRecord => ({
  schemaId: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  id: input.id,
  type: input.type ?? "decision-needed",
  audience: input.audience ?? "coordinator",
  lane: input.lane ?? "L5",
  ref: input.ref ?? null,
  question: input.question ?? `Question ${input.id}`,
  options: [...(input.options ?? ["full", "lite+escalation"])],
  askedAt: input.askedAt ?? FIXED_ISO,
});

export type AnswerInput = {
  readonly questionId: string;
  readonly answeringAudience?: BlockerAnswerRecord["answeringAudience"];
  readonly choice?: string;
  readonly text?: string;
  readonly answeredAt?: string;
  readonly capability?: BlockerCapabilityFact;
};

export const makeAnswer = (input: AnswerInput): BlockerAnswerRecord => ({
  schemaId: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  questionId: input.questionId,
  answeringAudience: input.answeringAudience ?? "coordinator",
  ...(input.choice === undefined ? {} : { choice: input.choice }),
  ...(input.text === undefined ? {} : { text: input.text }),
  answeredAt: input.answeredAt ?? FIXED_ISO,
  applied: false,
  laneResume: projectBlockerLaneResume(input.capability),
});

export const boundaryCapability = (): BlockerCapabilityFact => ({
  resumeInjection: true,
  mode: "boundary-note",
});

export const attachCapability = (): BlockerCapabilityFact => ({
  resumeInjection: true,
  mode: "attach-continue",
});

export const declaredNoModeCapability = (): BlockerCapabilityFact => ({
  resumeInjection: true,
});

export const absentCapability = (): BlockerCapabilityFact => ({
  resumeInjection: false,
});

export const answerOpen = (
  question: BlockerQuestionRecord,
  input: Omit<AnswerInput, "questionId"> = {},
): BlockerAnswerRecord => makeAnswer({ questionId: question.id, ...input });
