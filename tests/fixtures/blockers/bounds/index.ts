/**
 * Bounds fixtures: content-cap boundary values and population sizes.
 */
import type { BlockerQuestionRecord } from "../../../../packages/core/src/contracts/index";
import { makeQuestion } from "../records";

export const AT_CAP_QUESTION = "q".repeat(120);
export const OVER_CAP_QUESTION = "q".repeat(121);
export const AT_CAP_OPTION = "o".repeat(60);
export const OVER_CAP_OPTION = "o".repeat(61);
export const AT_CAP_ANSWER = "a".repeat(160);
export const OVER_CAP_ANSWER = "a".repeat(161);

export const MULTIBYTE_QUESTION = "ż".repeat(120);
export const OVER_MULTIBYTE_QUESTION = "ż".repeat(121);
export const MULTIBYTE_ANSWER = "ż".repeat(160);
export const OVER_MULTIBYTE_ANSWER = "ż".repeat(161);

export const atCapOptions = (): readonly string[] => [
  AT_CAP_OPTION,
  `${AT_CAP_OPTION.slice(0, 59)}1`,
  `${AT_CAP_OPTION.slice(0, 59)}2`,
  `${AT_CAP_OPTION.slice(0, 59)}3`,
];

export const hostileLane = (): string => "L".repeat(2_000);

export const capSizedQuestions = (
  count: number,
  overrides: (index: number) => Partial<BlockerQuestionRecord> = () => ({}),
): readonly BlockerQuestionRecord[] =>
  Array.from({ length: count }, (_, index) =>
    makeQuestion({
      id: `q-${String(index + 1).padStart(2, "0")}`,
      type:
        index % 4 === 0
          ? "decision-needed"
          : index % 4 === 1
            ? "spec-ambiguity"
            : index % 4 === 2
              ? "credential-missing"
              : "external-wait",
      audience: index % 2 === 0 ? "coordinator" : "owner",
      question:
        index % 4 === 2
          ? "GITHUB_TOKEN"
          : `${String(index + 1).padStart(2, "0")} ${"x".repeat(100)}`,
      options:
        index % 4 === 0
          ? [
              AT_CAP_OPTION.slice(0, 50),
              AT_CAP_OPTION.slice(0, 50),
              AT_CAP_OPTION.slice(0, 50),
              AT_CAP_OPTION.slice(0, 50),
            ]
          : [],
      askedAt: new Date(
        Date.parse("2026-11-06T12:00:00Z") - (count - index) * 3_600_000,
      ).toISOString(),
      ...overrides(index),
    }),
  );
