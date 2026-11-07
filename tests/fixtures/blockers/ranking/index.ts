/**
 * Ranking fixtures: mixed priority classes, exact age ties, reverse-of-insertion
 * ids, and answered records older than the oldest open question.
 */
import type {
  BlockerAnswerRecord,
  BlockerQuestionRecord,
} from "../../../../packages/core/src/contracts/index";
import { makeAnswer, makeQuestion } from "../records";

const at = (hoursAgo: number): string =>
  new Date(Date.parse("2026-11-06T12:00:00Z") - hoursAgo * 3_600_000).toISOString();

export const rankingQuestions = (): readonly BlockerQuestionRecord[] => [
  // class 1, newer than the external wait below
  makeQuestion({
    id: "q-b",
    type: "decision-needed",
    audience: "coordinator",
    askedAt: at(1),
    options: ["a", "b"],
  }),
  // class 3, oldest
  makeQuestion({
    id: "q-a",
    type: "external-wait",
    audience: "coordinator",
    askedAt: at(30),
    options: [],
  }),
  // class 1, same age as q-b, id sorts after q-b
  makeQuestion({
    id: "q-c",
    type: "credential-missing",
    audience: "owner",
    askedAt: at(1),
    question: "GITHUB_TOKEN",
    options: [],
  }),
  // class 2
  makeQuestion({
    id: "q-d",
    type: "spec-ambiguity",
    audience: "owner",
    askedAt: at(40),
    options: [],
  }),
];

export const tiedIdQuestions = (): readonly BlockerQuestionRecord[] => [
  makeQuestion({ id: "q-z", type: "spec-ambiguity", askedAt: at(5), options: [] }),
  makeQuestion({ id: "q-y", type: "spec-ambiguity", askedAt: at(5), options: [] }),
];

export const rankingAnswers = (): readonly BlockerAnswerRecord[] => [
  makeAnswer({ questionId: "q-old-answered", answeringAudience: "owner", choice: "full" }),
];

export const answeredOlderThanOpen = (): {
  readonly questions: readonly BlockerQuestionRecord[];
  readonly answers: readonly BlockerAnswerRecord[];
} => ({
  questions: [
    makeQuestion({ id: "q-open", type: "decision-needed", askedAt: at(2), options: ["a"] }),
    makeQuestion({ id: "q-closed", type: "decision-needed", askedAt: at(50), options: ["a"] }),
  ],
  answers: [makeAnswer({ questionId: "q-closed", answeringAudience: "owner", choice: "a" })],
});

export const reverse = <T>(items: readonly T[]): readonly T[] => [...items].reverse();
