/**
 * TC-COORD-087 — a second identical tick appends no duplicate action record
 * (only its lease pair) and performs no destructive action.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, seedIteration } from "../fixtures/coordinator/harness";

describe("TC-COORD-087 a repeated tick is idempotent", () => {
  test("two quiet ticks append two lease pairs and nothing else", async () => {
    const harness = createCoordinatorHarness({
      label: "idempotency-quiet",
      session: { liveness: "alive" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual([
      "acquired",
      "released",
      "acquired",
      "released",
    ]);
    // Two live collection cycles each record one `join-live` iteration; no
    // action record is duplicated.
    expect(read.iterations).toHaveLength(2);
    expect(read.iterations.every((record) => record.decision === "join-live")).toBe(true);
    expect(read.restarts).toHaveLength(0);
    expect(read.stuck).toHaveLength(0);
    expect(read.wakes).toHaveLength(0);
    expect(harness.process.killCalls).toBe(0);
  });

  test("a repeated stuck tick appends no duplicate verdict or outcome", async () => {
    const harness = createCoordinatorHarness({
      label: "idempotency-stuck",
      session: { liveness: "alive" },
      alive: { 4242: false },
    });
    seedIteration(harness, { recordedAt: new Date(0).toISOString() });
    await harness.run(["coordinator", "tick", "--json"]);
    const killsAfterFirst = harness.process.killCalls;
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.filter((record) => record.phase === "verdict")).toHaveLength(1);
    expect(read.stuck.filter((record) => record.phase === "outcome")).toHaveLength(1);
    expect(harness.process.killCalls).toBe(killsAfterFirst);
  });

  test("a repeated wake never duplicates its record", async () => {
    const harness = createCoordinatorHarness({
      label: "idempotency-wake",
      session: { liveness: "alive" },
    });
    harness.seedQuestion({
      schemaId: "delivery.blocker.question.v1",
      id: "q-idem",
      type: "decision-needed",
      audience: "coordinator",
      lane: "coordinator",
      ref: null,
      question: "Which delivery?",
      options: ["continue"],
      askedAt: "1970-01-01T00:00:01.000Z",
    });
    await harness.run(["coordinator", "tick", "--json"]);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(1);
  });

  test("a repeated stop request is idempotent on a released lease", async () => {
    const harness = createCoordinatorHarness({ label: "idempotency-stop" });
    const first = await harness.run(["coordinator", "stop", "--json"]);
    const second = await harness.run(["coordinator", "stop", "--json"]);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences).toHaveLength(0);
  });
});
