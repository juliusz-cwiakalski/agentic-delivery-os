/**
 * TC-COORD-070 — strict `isCoordinatorPickup` wakes only rank-1 open coordinator
 * questions; an absent status counts as open.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";
import {
  ownerQuestion,
  pickupQuestion,
  secondCoordinatorQuestion,
} from "../fixtures/coordinator/blockers";

describe("TC-COORD-070 strict pickup wakes only a rank-1 open coordinator question", () => {
  test("an absent-status rank-1 coordinator head is a pickup", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-pickup",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.wake?.outcome).toBe("woken");
    expect(data.wake?.questionId).toBe("q-pickup");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(1);
    expect(read.wakes[0]?.outcome).toBe("woken");
    expect(read.wakes[0]?.askedAt).toBe("1970-01-01T00:00:01.000Z");
  });

  test("an owner-audience head is no-pickup", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-owner",
      questions: [ownerQuestion()],
      session: { liveness: "alive" },
    });
    const data = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(data.wake).toBeNull();
    const read = harness.records();
    if (read.ok) expect(read.wakes).toHaveLength(0);
  });

  test("a rank-2 coordinator question behind an owner head is no-pickup", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-second",
      questions: [ownerQuestion(), secondCoordinatorQuestion()],
      session: { liveness: "alive" },
    });
    const data = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(data.wake).toBeNull();
  });

  test("no question is no-pickup and appends nothing", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-none",
      session: { liveness: "alive" },
    });
    const data = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(data.wake).toBeNull();
    const read = harness.records();
    if (read.ok) expect(read.wakes).toHaveLength(0);
  });

  test("an answered question is never a pickup", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-answered",
      questions: [pickupQuestion()],
      answers: [],
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
    expect(data.wake).toBeNull();
  });
});
