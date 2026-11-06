/**
 * TC-BLK-025..028 (behaviour halves) — answer as data with the recorded
 * `laneResume` projection, zero session touch, the capability-absent fallback
 * with a visible prefill cost, and the v0 `applied: false` posture.
 */
import { describe, expect, test } from "bun:test";
import {
  buildBlockerAnswerData,
  projectBlockerLaneResume,
} from "../../packages/core/src/domain/blockers";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";

const laneL2 = () =>
  makeQuestion({
    id: "q-l2",
    type: "decision-needed",
    audience: "coordinator",
    lane: "L2",
    options: ["full", "lite+escalation"],
  });

const answerAsCoordinator = async (
  capability: Parameters<typeof projectBlockerLaneResume>[0],
  question = laneL2(),
) => {
  const harness = createBlockersHarness({
    callerAudienceFact: "coordinator",
    capability,
    seedQuestions: [question],
  });
  try {
    const before = harness.ledgerBytes();
    const run = await harness.run(["answer", question.id, "--choice", "2"]);
    return {
      harness,
      run,
      before,
      after: harness.ledgerBytes(),
      read: harness.read(),
      sessionId: harness.session.id,
      sessionCalls: harness.session.calls,
    };
  } finally {
    harness.cleanup();
  }
};

describe("TC-BLK-025 SC-M1-13 round-trip without session re-entry", () => {
  test("boundary-note records the answer as data and touches no session", async () => {
    const result = await answerAsCoordinator({ resumeInjection: true, mode: "boundary-note" });
    const { run } = result;
    expect(run.exitCode).toBe(0);
    expect(run.data).toMatchObject({
      answered: "q-l2",
      audience: "coordinator",
      choice: "lite+escalation",
      applied: false,
      laneResume: {
        mode: "boundary-note",
        sessionReentry: false,
        capabilitySource: "adapter-declared",
      },
    });
    expect(run.data).not.toHaveProperty("choiceIndex");
    expect(result.read.answers).toHaveLength(1);
    expect(result.read.answers[0]?.questionId).toBe("q-l2");
    expect(result.read.answers[0]?.laneResume.mode).toBe("boundary-note");
    expect(result.sessionCalls).toEqual([]);
    expect(result.sessionId).toBe("sess-1");
    expect(result.after.subarray(0, result.before.length).equals(result.before)).toBe(true);
  });

  test("attach-continue records attach semantics without attaching", async () => {
    const result = await answerAsCoordinator({ resumeInjection: true, mode: "attach-continue" });
    expect(result.run.exitCode).toBe(0);
    expect(result.run.data).toMatchObject({
      laneResume: {
        mode: "attach-continue",
        sessionReentry: false,
        capabilitySource: "adapter-declared",
      },
    });
    expect(result.sessionCalls).toEqual([]);
  });

  test("the question is answered by derivation and excluded from --open", async () => {
    const harness = createBlockersHarness({
      callerAudienceFact: "coordinator",
      capability: { resumeInjection: true, mode: "boundary-note" },
      seedQuestions: [laneL2()],
    });
    try {
      expect((await harness.run(["answer", "q-l2", "--choice", "1"])).exitCode).toBe(0);
      const open = await harness.run(["list", "--open"]);
      expect(open.data?.questions).toEqual([]);
      const all = await harness.run(["list"]);
      const questions = all.data?.questions as Record<string, unknown>[] | undefined;
      expect(questions?.[0]?.status).toBe("answered");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-BLK-026 capability-declared modes", () => {
  test("both declared modes are deterministic and data-driven", async () => {
    for (const mode of ["boundary-note", "attach-continue"]) {
      const first = await answerAsCoordinator({ resumeInjection: true, mode }, laneL2());
      const second = await answerAsCoordinator({ resumeInjection: true, mode }, laneL2());
      expect(first.run.data?.laneResume).toEqual(second.run.data?.laneResume);
      const laneResume = first.run.data?.laneResume as Record<string, unknown> | undefined;
      expect(laneResume?.mode).toBe(mode);
    }
  });

  test("no preferred mode records the stable boundary-note default", async () => {
    const result = await answerAsCoordinator({ resumeInjection: true });
    expect(result.run.data?.laneResume).toMatchObject({
      mode: "boundary-note",
      sessionReentry: false,
      capabilitySource: "adapter-declared",
    });
    expect(projectBlockerLaneResume({ resumeInjection: true })).toEqual(
      projectBlockerLaneResume({ resumeInjection: true }),
    );
  });

  test("the projection is independent of question type", async () => {
    const result = await answerAsCoordinator(
      { resumeInjection: true, mode: "boundary-note" },
      makeQuestion({ id: "q-x", type: "external-wait", audience: "coordinator", options: [] }),
    );
    // The text channel answer is exercised separately; the projection itself is type-independent.
    expect(projectBlockerLaneResume({ resumeInjection: true, mode: "boundary-note" })).toEqual({
      mode: "boundary-note",
      sessionReentry: false,
      capabilitySource: "adapter-declared",
    });
    expect(result.sessionCalls).toEqual([]);
  });
});

describe("TC-BLK-027 capability-absent fallback", () => {
  test("false and absent capabilities record resume-prompt-reentry with prefill cost", async () => {
    for (const capability of [{ resumeInjection: false }, undefined]) {
      const projection = projectBlockerLaneResume(capability);
      expect(projection).toEqual({
        mode: "resume-prompt-reentry",
        sessionReentry: true,
        capabilitySource: "capability-absent",
        prefillCost: "full-context-reprefill",
      });
    }
    const result = await answerAsCoordinator({ resumeInjection: false });
    expect(result.run.data).toMatchObject({
      applied: false,
      laneResume: {
        mode: "resume-prompt-reentry",
        sessionReentry: true,
        capabilitySource: "capability-absent",
        prefillCost: "full-context-reprefill",
      },
    });
    const human = await createBlockersHarness({
      callerAudienceFact: "coordinator",
      capability: { resumeInjection: false },
      seedQuestions: [laneL2()],
    });
    try {
      const run = await human.run(["answer", "q-l2", "--choice", "1"], { json: false });
      expect(run.stdout).toContain("resume-prompt-reentry");
      expect(run.stdout).toContain("prefillCost=full-context-reprefill");
      expect(human.session.calls).toEqual([]);
    } finally {
      human.cleanup();
    }
  });

  test("declared modes carry no prefill marker", () => {
    for (const capability of [
      { resumeInjection: true, mode: "boundary-note" },
      { resumeInjection: true, mode: "attach-continue" },
    ]) {
      expect(projectBlockerLaneResume(capability)).not.toHaveProperty("prefillCost");
    }
  });
});

describe("TC-BLK-028 v0 recorded-versus-applied posture", () => {
  const requireV0 = (data: unknown): void => {
    if (typeof data !== "object" || data === null) throw new Error("data missing");
    if ((data as Record<string, unknown>).applied !== false) {
      throw new Error("v0 answer must record applied:false");
    }
  };

  test("the envelope, record, and human line all declare applied:false", async () => {
    const result = await answerAsCoordinator({ resumeInjection: true, mode: "boundary-note" });
    expect(result.run.data?.applied).toBe(false);
    expect(result.read.answers[0]?.applied).toBe(false);
    requireV0(result.run.data);
    expect(result.run.data).not.toHaveProperty("sessionId");
    const human = await createBlockersHarness({
      callerAudienceFact: "coordinator",
      capability: { resumeInjection: true, mode: "boundary-note" },
      seedQuestions: [laneL2()],
    });
    try {
      const run = await human.run(["answer", "q-l2", "--choice", "1"], { json: false });
      expect(run.stdout).toContain("applied=false");
      expect(run.stdout).not.toMatch(/resumed/i);
    } finally {
      human.cleanup();
    }
  });

  test("an applied:true mutation fails the v0 assertion by name", () => {
    const record = {
      schemaId: "delivery.blocker.answer.v1",
      questionId: "q-1",
      answeringAudience: "owner",
      choice: "a",
      answeredAt: "2026-11-06T12:00:00Z",
      applied: false,
      laneResume: projectBlockerLaneResume(undefined),
    } as const;
    const data = buildBlockerAnswerData(record);
    requireV0(data);
    expect(() => requireV0({ ...data, applied: true })).toThrow("applied:false");
  });
});
