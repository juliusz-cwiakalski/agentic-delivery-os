/**
 * TC-COORD-035 — all-unknown or an unreadable required store yields
 * `unevaluable`, exit 2, no action.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedIteration,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-035 an unreadable required store is unevaluable", () => {
  test("a torn blocker ledger yields one verdict, exit 2, and no kill", async () => {
    const harness = createCoordinatorHarness({
      label: "unevaluable",
      session: { liveness: "alive" },
      alive: { 4242: false },
    });
    seedIteration(harness);
    harness.appendRaw({
      kind: "blocker.question",
      recordKey: "blockers.corrupt",
      payload: { schemaId: "delivery.blocker.question.v1", id: "broken" },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toMatch(/^state\.store\./);
    expect(harness.process.killCalls).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck).toHaveLength(1);
    expect(read.stuck[0]?.verdict).toBe("unevaluable");
    expect(read.stuck[0]?.phase).toBe("verdict");
    expect(read.stuck[0]?.killOutcome).toBe("not-attempted");
    expect(read.restarts).toHaveLength(0);
  });

  test("the unevaluable verdict is never followed by an outcome", async () => {
    const harness = createCoordinatorHarness({ label: "unevaluable-two", session: { liveness: "alive" } });
    seedIteration(harness);
    harness.appendRaw({
      kind: "blocker.question",
      recordKey: "blockers.corrupt",
      payload: { schemaId: "delivery.blocker.question.v1", id: "broken" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.some((record) => record.phase === "outcome")).toBe(false);
  });

  test("a replay of the same unevaluable verdict appends nothing", async () => {
    const harness = createCoordinatorHarness({ label: "unevaluable-replay", session: { liveness: "alive" } });
    seedIteration(harness);
    harness.appendRaw({
      kind: "blocker.question",
      recordKey: "blockers.corrupt",
      payload: { schemaId: "delivery.blocker.question.v1", id: "broken" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.filter((record) => record.phase === "verdict")).toHaveLength(1);
  });
});
