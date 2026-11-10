/**
 * TC-COORD-073 — the wake uses the live/resume/spawn path and records the
 * question and iteration.
 *
 * The lifecycle decision already applies the resume/spawn recovery for a
 * non-live session in the same cycle, so the wake that follows is a live
 * observation and never a second recovery (NF-04).
 */
import { describe, expect, test } from "bun:test";
import { pickupQuestion } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";

describe("TC-COORD-073 the wake records the question and iteration", () => {
  test("a live session wakes with the live effect and one record lands", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-path-alive",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.wake?.outcome).toBe("woken");
    expect(data.wake?.questionId).toBe("q-pickup");
    expect(data.wake?.iterationId).not.toBeNull();
    expect(data.wake?.effect).toBe("live");
    expect(harness.counters.wakes).toBe(1);
    expect(harness.session.wakeEffects).toEqual(["live"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes[0]?.iterationId).toBe(data.wake?.iterationId);
    expect(read.iterations.some((record) => record.trigger === "wake")).toBe(true);
  });

  for (const scenario of [
    { label: "resume", session: { liveness: "absent" as const } },
    {
      label: "spawn",
      session: { liveness: "absent" as const, contextTokens: 100_000 },
    },
  ]) {
    test(`a non-live ${scenario.label} path recovers once and the wake is a live no-op`, async () => {
      const harness = createCoordinatorHarness({
        label: `wake-path-${scenario.label}-recovered`,
        questions: [pickupQuestion()],
        session: scenario.session,
        applyMakesAlive: true,
      });
      const beforeResumes = harness.counters.resumes;
      const beforeSpawns = harness.counters.spawns;

      const first = await harness.run(["coordinator", "tick", "--json"]);
      expect(first.code).toBe(0);
      const data = dataOf(first);
      expect(data.wake?.outcome).toBe("woken");
      expect(data.wake?.questionId).toBe("q-pickup");
      expect(data.wake?.iterationId).not.toBeNull();
      // The lifecycle recovery is the cycle's single resume/spawn effect.
      expect(
        harness.counters.resumes - beforeResumes + (harness.counters.spawns - beforeSpawns),
      ).toBe(1);
      // The wake itself is a live observation, not a second recovery.
      expect(data.wake?.effect).toBe("live");
      expect(harness.session.wakeEffects).toEqual(["live"]);

      // The next tick sees a live session and an already-woken question: it
      // neither recovers the session again nor issues another wake.
      const second = await harness.run(["coordinator", "tick", "--json"]);
      expect(second.code).toBe(0);
      expect(
        harness.counters.resumes - beforeResumes + (harness.counters.spawns - beforeSpawns),
      ).toBe(1);
      expect(harness.session.wakeEffects).toEqual(["live"]);
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
