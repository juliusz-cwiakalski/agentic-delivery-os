/**
 * TC-COORD-052 — at/above the bound no replacement starts, the refusal is exit
 * 1, and escalation runs.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedRestart,
} from "../fixtures/coordinator/harness";

const atBound = (label: string) => {
  const harness = createCoordinatorHarness({
    label,
    session: { liveness: "absent", sessionId: "session-1" },
  });
  for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-052 at the bound no replacement starts", () => {
  test("the refusal is exit 1 with the history reference and no new restart", async () => {
    const harness = atBound("restart-exhausted");
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("coordinator.restart-budget-exhausted");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts).toHaveLength(10);
    expect(read.exhaustion).toHaveLength(1);
    expect(read.exhaustion[0]?.historyRef).toBe("coordinator/coordinator-main");
    // F-09: the failure result itself carries the history reference.
    expect(result.json?.error).toMatchObject({ code: "coordinator.restart-budget-exhausted" });
    expect((result.json?.error as { summary?: string } | undefined)?.summary).toContain(
      "historyRef=coordinator/coordinator-main",
    );
    expect(harness.counters.spawns).toBeGreaterThanOrEqual(0);
  });

  test("no replacement session starts at the bound", async () => {
    const harness = atBound("restart-exhausted-no-spawn");
    const before = harness.counters.spawns;
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.counters.spawns).toBe(before);
  });

  test("an owner question is published by the refusal", async () => {
    const harness = atBound("restart-exhausted-question");
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion[0]?.escalationQuestionId).toMatch(/^q-/);
  });
});
