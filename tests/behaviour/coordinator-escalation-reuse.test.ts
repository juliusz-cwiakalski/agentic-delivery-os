/**
 * TC-COORD-065 — escalation is idempotent by coordinator-and-epoch and reuses
 * the open owner question.
 */
import { describe, expect, test } from "bun:test";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { answer, escalationQuestion } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, seedRestart } from "../fixtures/coordinator/harness";

describe("TC-COORD-065 the escalation reuses the open owner question", () => {
  test("an existing open question for the same ref is reused, not duplicated", async () => {
    const harness = createCoordinatorHarness({
      label: "escalation-reuse",
      session: { liveness: "absent", sessionId: "session-1" },
      questions: [escalationQuestion("coordinator-main", "epoch-1", "q-existing")],
    });
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
    await harness.run(["coordinator", "tick", "--json"]);
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(1);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion[0]?.escalationQuestionId).toBe("q-existing");
  });

  test("an answered escalation never publishes a second question (F-12)", async () => {
    const harness = createCoordinatorHarness({
      label: "escalation-answered-then-tick",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(1);
    const firstRead = harness.records();
    if (!firstRead.ok) throw new Error("read failed");
    const questionId = firstRead.exhaustion[0]?.escalationQuestionId;
    if (questionId === undefined) throw new Error("missing question id");
    harness.seedAnswer(answer({ questionId, answeringAudience: "owner" }));
    const second = await harness.run(["coordinator", "tick", "--json"]);
    expect(second.code).toBe(0);
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(1);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(1);
    expect(read.exhaustion[0]?.escalationQuestionId).toBe(questionId);
  });

  test("a question for a different epoch is not reused", async () => {
    const harness = createCoordinatorHarness({
      label: "escalation-reuse-other-epoch",
      session: { liveness: "absent", sessionId: "session-1" },
      questions: [escalationQuestion("coordinator-main", "epoch-9", "q-other-epoch")],
    });
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
    await harness.run(["coordinator", "tick", "--json"]);
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(2);
    const refs = ledger.value.questions.map((question) => question.ref).sort();
    expect(refs).toEqual(["coordinator-main#epoch-1", "coordinator-main#epoch-9"]);
  });
});
