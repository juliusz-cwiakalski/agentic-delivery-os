/**
 * TC-COORD-075 — a new top question after an answered one wakes normally.
 */
import { describe, expect, test } from "bun:test";
import { answer, pickupQuestion, question } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";

describe("TC-COORD-075 the one-wake rule is per question", () => {
  test("an answered head is replaced by a new rank-1 question that wakes", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-next",
      questions: [pickupQuestion("q-first")],
      session: { liveness: "alive" },
    });
    expect(dataOf(await harness.run(["coordinator", "tick", "--json"])).wake?.questionId).toBe(
      "q-first",
    );
    harness.seedAnswer(answer({ questionId: "q-first" }));
    harness.seedQuestion(question({ id: "q-second", askedAt: "1970-01-01T00:05:00.000Z" }));
    const data = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(data.wake?.outcome).toBe("woken");
    expect(data.wake?.questionId).toBe("q-second");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes.map((record) => record.questionId)).toEqual(["q-first", "q-second"]);
  });
});
