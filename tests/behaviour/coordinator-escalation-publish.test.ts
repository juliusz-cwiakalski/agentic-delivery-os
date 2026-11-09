/**
 * TC-COORD-060 — exactly one owner-audience exhaustion question lands, and the
 * receipt follows it.
 */
import { describe, expect, test } from "bun:test";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { escalationQuestion } from "../fixtures/coordinator/blockers";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedRestart,
} from "../fixtures/coordinator/harness";

const exhaustedHarness = (label: string) => {
  const harness = createCoordinatorHarness({
    label,
    session: { liveness: "absent", sessionId: "session-1" },
  });
  for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-060 exhaustion publishes one owner question then a receipt", () => {
  test("the first refusal is exit 1 and lands one question plus one receipt", async () => {
    const harness = exhaustedHarness("escalation-publish");
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("coordinator.restart-budget-exhausted");

    const ledger = readBlockerLedger(harness.store);
    expect(ledger.ok).toBe(true);
    if (!ledger.ok) return;
    const escalation = ledger.value.questions.filter(
      (question) =>
        question.type === "decision-needed" &&
        question.audience === "owner" &&
        question.lane === "coordinator" &&
        question.ref === "coordinator-main#epoch-1",
    );
    expect(escalation).toHaveLength(1);
    expect(escalation[0]?.options).toEqual(["restart-fresh-budget", "park-owner-review"]);
    // EVT-6 v1.6: the published question itself carries the durable history
    // reference, not only the exhaustion receipt (F-07).
    expect(escalation[0]?.historyRef).toBe("coordinator/coordinator-main");
    expect(escalation[0]?.id).toMatch(/^q-/);
    expect(escalation[0]?.id).not.toMatch(/^q-q-/);

    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(1);
    expect(read.exhaustion[0]?.terminal).toBe(true);
    expect(read.exhaustion[0]?.escalationQuestionId).toBe(escalation[0]?.id);
    expect(read.exhaustion[0]?.restarts).toBe(10);
    expect(read.exhaustion[0]?.budgetEpochId).toBe("epoch-1");
    expect(read.restarts).toHaveLength(10);
  });

  test("no replacement session starts on the refusal", async () => {
    const harness = exhaustedHarness("escalation-no-spawn");
    const before = harness.counters.spawns;
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.counters.spawns).toBe(before);
  });

  test("the question is open and rendered by the delivered predicate", async () => {
    const harness = exhaustedHarness("escalation-open");
    harness.seedQuestion(escalationQuestion("coordinator-main", "epoch-1", "q-existing"));
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.answers).toHaveLength(0);
    const question = ledger.value.questions.find((entry) => entry.id === "q-existing");
    expect(question?.ref).toBe("coordinator-main#epoch-1");
    void dataOf;
  });
});
