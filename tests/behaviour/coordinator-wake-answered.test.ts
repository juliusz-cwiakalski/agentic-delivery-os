/**
 * TC-COORD-072 — a question answered between ranking and wake yields
 * `answered-before-wake` and appends nothing.
 */
import { describe, expect, test } from "bun:test";
import { evaluateWake } from "../../packages/core/src/domain/index";
import { pickupQuestion } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";

describe("TC-COORD-072 answered-before-wake is a tick result", () => {
  test("the domain evaluation reports answered-before-wake with no persistence", () => {
    const head = pickupQuestion();
    const evaluation = evaluateWake({
      coordinatorId: "coordinator-main",
      ranked: [{ id: head.id, rank: 1, audience: head.audience, askedAt: head.askedAt }],
      answeredQuestionIds: [head.id],
      woken: [],
      delivered: true,
    });
    expect(evaluation.outcome).toBe("answered-before-wake");
    expect(evaluation.persists).toBe(false);
  });

  test("an answered question never ranks, so the tick reports no wake", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-answered-before",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    harness.seedAnswer({
      schemaId: "delivery.blocker.answer.v1",
      questionId: "q-pickup",
      answeringAudience: "coordinator",
      choice: "continue",
      answeredAt: "1970-01-01T00:00:20.000Z",
      applied: false,
      laneResume: {
        mode: "boundary-note",
        sessionReentry: false,
        capabilitySource: "adapter-declared",
      },
    });
    const data = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(data.wake?.outcome).toBe("no-pickup");
    expect(data.wake?.questionId).toBeNull();
    const read = harness.records();
    if (read.ok) expect(read.wakes).toHaveLength(0);
  });
});
