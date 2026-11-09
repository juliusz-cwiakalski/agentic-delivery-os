/**
 * TC-COORD-073 — the wake uses the live/resume/spawn path and records the
 * question and iteration.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";
import { pickupQuestion } from "../fixtures/coordinator/blockers";

describe("TC-COORD-073 the wake records the question and iteration", () => {
  for (const liveness of ["alive", "absent"] as const) {
    test(`a ${liveness} session is woken and one record lands`, async () => {
      const harness = createCoordinatorHarness({
        label: `wake-path-${liveness}`,
        questions: [pickupQuestion()],
        session: { liveness },
      });
      const result = await harness.run(["coordinator", "tick", "--json"]);
      expect(result.code).toBe(0);
      const data = dataOf(result);
      expect(data.wake?.outcome).toBe("woken");
      expect(data.wake?.questionId).toBe("q-pickup");
      expect(data.wake?.iterationId).not.toBeNull();
      expect(harness.counters.wakes).toBe(1);
      const read = harness.records();
      if (!read.ok) throw new Error("read failed");
      expect(read.wakes[0]?.iterationId).toBe(data.wake?.iterationId);
      expect(read.iterations.some((record) => record.trigger === "wake")).toBe(true);
    });
  }

  test("the wake is one collection cycle after the question qualifies", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-latency",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    // Nothing wakes before the tick; the next tick wakes exactly once.
    expect(dataOf(await harness.run(["coordinator", "status", "--json"])).wake).toBeNull();
    expect(dataOf(await harness.run(["coordinator", "tick", "--json"])).wake?.outcome).toBe(
      "woken",
    );
  });
});
