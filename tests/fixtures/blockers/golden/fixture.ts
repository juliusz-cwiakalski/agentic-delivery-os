/**
 * The fixed fixture behind the blocker goldens: a deterministic store, clock,
 * run id, brand, id generator, secrets, and capability. Suites read the golden
 * bytes; the explicit regeneration script writes them.
 */
import { createBlockersHarness, FIXED_NOW_ISO, RUN_ID } from "../harness";
import { makeAnswer, makeQuestion } from "../records";

export const GOLDEN_RUN_ID = "run-blockers-golden";
export const GOLDEN_NOW = FIXED_NOW_ISO;
export const GOLDEN_FIXED_RUN = RUN_ID;

export const goldenQuestions = () => [
  makeQuestion({
    id: "q-golden-1",
    type: "decision-needed",
    audience: "coordinator",
    lane: "L5",
    question: "closeout residue sweep: full or lite?",
    options: ["full", "lite+escalation"],
    askedAt: "2026-11-06T10:00:00Z",
  }),
  makeQuestion({
    id: "q-golden-2",
    type: "external-wait",
    audience: "coordinator",
    lane: "L9",
    question: "awaiting vendor confirmation",
    options: [],
    askedAt: "2026-11-06T11:00:00Z",
  }),
  makeQuestion({
    id: "q-golden-3",
    type: "spec-ambiguity",
    audience: "owner",
    lane: "L2",
    question: "which acceptance criterion applies?",
    options: [],
    askedAt: "2026-11-06T09:00:00Z",
  }),
];

export const goldenAnswers = () => [
  makeAnswer({ questionId: "q-golden-3", answeringAudience: "owner", text: "criterion two" }),
];

const fixed = {
  runId: GOLDEN_RUN_ID,
  nowIso: GOLDEN_NOW,
  nowMs: Date.parse(GOLDEN_NOW),
} as const;

export const goldenListRun = async () => {
  const harness = createBlockersHarness({
    ...fixed,
    seedQuestions: goldenQuestions(),
    seedAnswers: goldenAnswers(),
  });
  try {
    const machine = await harness.run(["list"]);
    const human = await harness.run(["list"], { json: false });
    return { machine: machine.stdout, human: human.stdout };
  } finally {
    harness.cleanup();
  }
};

const answerHarness = () =>
  createBlockersHarness({
    ...fixed,
    callerAudienceFact: "coordinator",
    capability: { resumeInjection: true, mode: "boundary-note" },
    seedQuestions: [goldenQuestions()[0] as ReturnType<typeof makeQuestion>],
  });

export const goldenAnswerRun = async () => {
  const machineHarness = answerHarness();
  const humanHarness = answerHarness();
  try {
    const machine = await machineHarness.run(["answer", "q-golden-1", "--choice", "2"]);
    const human = await humanHarness.run(["answer", "q-golden-1", "--choice", "2"], {
      json: false,
    });
    return { machine: machine.stdout, human: human.stdout };
  } finally {
    machineHarness.cleanup();
    humanHarness.cleanup();
  }
};
