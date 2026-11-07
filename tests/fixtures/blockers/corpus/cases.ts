/**
 * The committed blocker behaviour corpus: facts, invocation, and exact
 * expectations for every declared category (TC-BLK-042).
 */
import type { BlockerQuestionRecord } from "../../../../packages/core/src/contracts/index";
import { REGISTERED_SECRET } from "../credentials";
import { makeAnswer, makeQuestion } from "../records";

export type CorpusCase = {
  readonly id: string;
  readonly category:
    | "type"
    | "audience"
    | "priority"
    | "channel"
    | "guard-layer-1"
    | "guard-layer-2"
    | "guard-non-refusal"
    | "mismatch"
    | "delegation"
    | "capability-declared"
    | "capability-absent"
    | "open-answered"
    | "bounds"
    | "state-edge"
    | "v0-posture";
  readonly argv: readonly string[];
  readonly callerAudienceFact?: string;
  readonly capability?: { readonly resumeInjection: boolean; readonly mode?: string };
  readonly secrets?: readonly string[];
  readonly seedQuestions?: readonly BlockerQuestionRecord[];
  readonly seedAnswers?: ReturnType<typeof makeAnswer>[];
  readonly expectedExit: 0 | 1 | 2;
  readonly expectedCode?: string;
  readonly expectedChoice?: string;
  readonly expectedText?: string;
  readonly expectedApplied?: false;
  readonly expectedResumeMode?: string;
  readonly expectedQuestionCount?: number;
  readonly expectedAnswerCount?: number;
};

export const REQUIRED_CATEGORIES = [
  "type",
  "audience",
  "priority",
  "channel",
  "guard-layer-1",
  "guard-layer-2",
  "guard-non-refusal",
  "mismatch",
  "delegation",
  "capability-declared",
  "capability-absent",
  "open-answered",
  "bounds",
  "state-edge",
  "v0-posture",
] as const;

const decision = (id: string, audience: "owner" | "coordinator" = "coordinator") =>
  makeQuestion({ id, type: "decision-needed", audience, options: ["a", "b"] });

export const corpusCases = (): readonly CorpusCase[] => [
  {
    id: "valid-four-types",
    category: "type",
    argv: ["publish", "external-wait", "--lane", "L2", "awaiting vendor"],
    expectedExit: 0,
    expectedQuestionCount: 1,
  },
  {
    id: "invalid-type",
    category: "type",
    argv: ["publish", "unknown-type", "--lane", "L2", "q"],
    expectedExit: 1,
    expectedCode: "blockers.invalid-type",
    expectedQuestionCount: 0,
  },
  {
    id: "explicit-audience",
    category: "audience",
    argv: [
      "publish",
      "decision-needed",
      "--lane",
      "L2",
      "--audience",
      "owner",
      "--options",
      "a",
      "q",
    ],
    expectedExit: 0,
    expectedQuestionCount: 1,
  },
  {
    id: "invalid-audience",
    category: "audience",
    argv: ["publish", "spec-ambiguity", "--lane", "L2", "--audience", "human", "q"],
    expectedExit: 1,
    expectedCode: "input.value.rejected",
    expectedQuestionCount: 0,
  },
  {
    id: "priority-ranking",
    category: "priority",
    argv: ["list"],
    seedQuestions: [
      makeQuestion({
        id: "q-e",
        type: "external-wait",
        askedAt: "2026-11-01T00:00:00Z",
        options: [],
      }),
      makeQuestion({
        id: "q-d",
        type: "decision-needed",
        askedAt: "2026-11-05T00:00:00Z",
        options: ["a"],
      }),
    ],
    expectedExit: 0,
    expectedQuestionCount: 2,
  },
  {
    id: "choice-channel",
    category: "channel",
    argv: ["answer", "q-1", "--choice", "2"],
    seedQuestions: [decision("q-1")],
    expectedExit: 0,
    expectedChoice: "b",
    expectedAnswerCount: 1,
  },
  {
    id: "text-channel",
    category: "channel",
    argv: ["answer", "q-2", "--text", "answer"],
    seedQuestions: [
      makeQuestion({ id: "q-2", type: "spec-ambiguity", audience: "owner", options: [] }),
    ],
    expectedExit: 0,
    expectedText: "answer",
    expectedAnswerCount: 1,
  },
  {
    id: "layer-1-refusal",
    category: "guard-layer-1",
    argv: ["publish", "spec-ambiguity", "--lane", "L2", `secret ${REGISTERED_SECRET}`],
    secrets: [REGISTERED_SECRET],
    expectedExit: 1,
    expectedCode: "blockers.credential-value-rejected",
    expectedQuestionCount: 0,
  },
  {
    id: "layer-2-refusal",
    category: "guard-layer-2",
    argv: ["publish", "credential-missing", "--lane", "L2", "GITHUB_TOKEN=abc123"],
    expectedExit: 1,
    expectedCode: "blockers.credential-value-rejected",
    expectedQuestionCount: 0,
  },
  {
    id: "layer-2-name-only",
    category: "guard-non-refusal",
    argv: ["publish", "credential-missing", "--lane", "L2", "GITHUB_TOKEN"],
    expectedExit: 0,
    expectedQuestionCount: 1,
  },
  {
    id: "audience-mismatch",
    category: "mismatch",
    argv: ["answer", "q-1", "--choice", "1"],
    callerAudienceFact: "coordinator",
    seedQuestions: [decision("q-1", "owner")],
    expectedExit: 1,
    expectedCode: "blockers.audience-mismatch",
    expectedAnswerCount: 0,
  },
  {
    id: "delegation-exception",
    category: "delegation",
    argv: ["answer", "q-1", "--choice", "1"],
    callerAudienceFact: "owner",
    seedQuestions: [decision("q-1", "coordinator")],
    expectedExit: 0,
    expectedChoice: "a",
    expectedAnswerCount: 1,
  },
  {
    id: "capability-declared",
    category: "capability-declared",
    argv: ["answer", "q-1", "--choice", "1"],
    capability: { resumeInjection: true, mode: "boundary-note" },
    seedQuestions: [decision("q-1")],
    expectedExit: 0,
    expectedResumeMode: "boundary-note",
    expectedApplied: false,
    expectedAnswerCount: 1,
  },
  {
    id: "capability-absent",
    category: "capability-absent",
    argv: ["answer", "q-1", "--choice", "1"],
    capability: { resumeInjection: false },
    seedQuestions: [decision("q-1")],
    expectedExit: 0,
    expectedResumeMode: "resume-prompt-reentry",
    expectedApplied: false,
    expectedAnswerCount: 1,
  },
  {
    id: "open-and-answered",
    category: "open-answered",
    argv: ["list"],
    seedQuestions: [
      decision("q-1"),
      makeQuestion({ id: "q-2", type: "spec-ambiguity", options: [] }),
    ],
    seedAnswers: [makeAnswer({ questionId: "q-2", text: "done" })],
    expectedExit: 0,
    expectedQuestionCount: 2,
  },
  {
    id: "over-cap-bounds",
    category: "bounds",
    argv: ["list"],
    seedQuestions: Array.from({ length: 9 }, (_, index) =>
      makeQuestion({
        id: `q-${index + 1}`,
        type: "external-wait",
        askedAt: `2026-11-0${(index % 9) + 1}T00:00:00Z`,
        options: [],
      }),
    ),
    expectedExit: 0,
    expectedQuestionCount: 8,
  },
  {
    id: "verified-empty-state-edge",
    category: "state-edge",
    argv: ["list"],
    expectedExit: 0,
    expectedQuestionCount: 0,
  },
  {
    id: "v0-applied-false",
    category: "v0-posture",
    argv: ["answer", "q-1", "--choice", "1"],
    seedQuestions: [decision("q-1")],
    expectedExit: 0,
    expectedApplied: false,
    expectedAnswerCount: 1,
  },
];
