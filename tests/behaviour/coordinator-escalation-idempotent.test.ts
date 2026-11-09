/**
 * TC-COORD-061 — a repeated exhausted tick is idempotent and leaves the original
 * question open.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, dataOf, seedRestart } from "../fixtures/coordinator/harness";
import { readBlockerLedger } from "../../packages/core/src/state/index";

const exhausted = (label: string) => {
  const harness = createCoordinatorHarness({
    label,
    session: { liveness: "absent", sessionId: "session-1" },
  });
  for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-061 a repeated exhausted tick is idempotent", () => {
  test("the second tick is exhausted-escalated at exit 0 with no duplicates", async () => {
    const harness = exhausted("escalation-idempotent");
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(1);
    const second = await harness.run(["coordinator", "tick", "--json"]);
    expect(second.code).toBe(0);
    const data = dataOf(second);
    expect(data.escalation.state).toBe("exhausted-escalated");
    expect(data.escalation.questionId).not.toBeNull();

    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(1);
    expect(ledger.value.answers).toHaveLength(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(1);
  });

  test("status reports exhausted-escalated with the question id", async () => {
    const harness = exhausted("escalation-idempotent-status");
    await harness.run(["coordinator", "tick", "--json"]);
    const data = dataOf(await harness.run(["coordinator", "status", "--json"]));
    expect(data.escalation.state).toBe("exhausted-escalated");
    expect(data.escalation.questionId).not.toBeNull();
  });
});
