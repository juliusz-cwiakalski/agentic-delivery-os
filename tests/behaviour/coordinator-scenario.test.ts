/**
 * TC-COORD-091 — SC-M1-25 end to end over the in-process CLI and a fake process
 * harness: context pressure decision, artifact-evidence stuck detection, kill
 * with grace and restart within budget, wake within one cycle, and loud
 * exhaustion escalation.
 */
import { describe, expect, test } from "bun:test";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { pickupQuestion } from "../fixtures/coordinator/blockers";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedIteration,
  seedRestart,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-091 SC-M1-25 end to end", () => {
  test("context pressure, stuck kill, wake, and escalation compose in one world", async () => {
    const harness = createCoordinatorHarness({
      label: "scenario-m1-25",
      session: {
        liveness: "absent",
        sessionId: "session-1",
        contextTokens: 100_000,
      },
      alive: { 4242: false },
    });

    // 1. Context pressure records spawn-fresh and consumes one ordinal.
    const pressured = await harness.run(["coordinator", "tick", "--json"]);
    expect(pressured.code).toBe(0);
    let read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const decision = read.iterations.find((record) => record.decision !== "none");
    expect(decision?.decision).toBe("spawn-fresh");
    expect(decision?.reason).toBe("context-pressure");
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1]);

    // 2. A top-of-digest coordinator question wakes the next iteration.
    harness.seedQuestion(pickupQuestion("q-scenario"));
    const woken = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(woken.wake?.outcome).toBe("woken");
    expect(woken.wake?.questionId).toBe("q-scenario");

    // 3. An old expectation with no artifact advance is stuck, killed, and
    //    restarted within budget. A live session keeps the expectation active.
    harness.setSessionFacts({ liveness: "alive" });
    seedIteration(harness, { recordedAt: new Date(0).toISOString() });
    harness.clock.value += 1_000_000;
    const stuck = await harness.run(["coordinator", "tick", "--json"]);
    expect(stuck.code).toBe(0);
    read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.map((record) => record.phase)).toEqual(["verdict", "outcome"]);
    expect(read.stuck[1]?.killOutcome).toBe("terminated");
    expect(read.restarts.length).toBeGreaterThanOrEqual(2);
    expect(read.restarts[read.restarts.length - 1]?.reason).toBe("stuck-artifact-evidence");

    // 4. Restart exhaustion escalates to the owner brief exactly once.
    harness.setSessionFacts({ liveness: "absent" });
    const existing = read.restarts.length;
    for (let ordinal = existing + 1; ordinal <= 10; ordinal += 1) {
      seedRestart(harness, { ordinal });
    }
    const exhausted = await harness.run(["coordinator", "tick", "--json"]);
    expect(exhausted.code).toBe(1);
    expect(errorCodeOf(exhausted)).toBe("coordinator.restart-budget-exhausted");
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    const escalation = ledger.value.questions.filter(
      (question) => question.ref === "coordinator-main#epoch-1",
    );
    expect(escalation).toHaveLength(1);
    expect(escalation[0]?.type).toBe("decision-needed");
    expect(escalation[0]?.audience).toBe("owner");
    read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(1);

    // 5. A later tick is the idempotent exhausted-escalated success.
    const settled = await harness.run(["coordinator", "tick", "--json"]);
    expect(settled.code).toBe(0);
    expect(dataOf(settled).escalation.state).toBe("exhausted-escalated");
  });

  test("the transition record is classified and never silent", async () => {
    const harness = createCoordinatorHarness({
      label: "scenario-classified",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    const first = await harness.run(["coordinator", "tick", "--json"]);
    expect(first.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    for (const restart of read.restarts) {
      expect([
        "stuck-artifact-evidence",
        "session-interrupted",
        "context-pressure",
        "context-unknown",
      ]).toContain(restart.reason);
    }
  });
});
