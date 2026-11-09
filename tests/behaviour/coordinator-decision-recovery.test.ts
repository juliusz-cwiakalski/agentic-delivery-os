/**
 * TC-COORD-024 — a mid-iteration kill resumes/respawns without re-executing
 * closed-out work.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  seedIteration,
} from "../fixtures/coordinator/harness";
import { answer } from "../fixtures/coordinator/blockers";

const seedClosedOut = (harness: ReturnType<typeof createCoordinatorHarness>) => {
  harness.appendRaw({
    kind: "merge.transaction",
    recordKey: "merge.transaction:GH-999",
    payload: {
      schemaId: "delivery.merge.transaction.v1",
      changeRef: "GH-999",
      state: "landed",
    },
  });
  harness.seedAnswer(answer({ questionId: "q-closed" }));
};

describe("TC-COORD-024 a killed mid-iteration resumes without re-execution", () => {
  test("closed-out merge and answer artifacts remain and are not duplicated", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-recovery",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    seedClosedOut(harness);
    seedIteration(harness, { sessionId: "session-1" });
    const before = harness.store.readRecords();
    if (!before.ok) throw new Error("read failed");
    const mergesBefore = before.value.records.filter((record) => record.kind === "merge.transaction").length;
    const answersBefore = before.value.records.filter((record) => record.kind === "blocker.answer").length;

    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);

    const after = harness.store.readRecords();
    if (!after.ok) throw new Error("read failed");
    expect(after.value.records.filter((record) => record.kind === "merge.transaction")).toHaveLength(
      mergesBefore,
    );
    expect(after.value.records.filter((record) => record.kind === "blocker.answer")).toHaveLength(
      answersBefore,
    );
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const decision = read.iterations.find((record) => record.decision !== "none");
    expect(decision?.decision).toBe("resume-context");
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1]);
  });

  test("a context-limited prior session respawns without re-executing closed work", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-recovery-spawn",
      session: { liveness: "absent", sessionId: "session-1", contextTokens: 100_000 },
    });
    seedClosedOut(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const decision = read.iterations.find((record) => record.decision !== "none");
    expect(decision?.decision).toBe("spawn-fresh");
    expect(decision?.reason).toBe("context-pressure");
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1]);
  });

  test("the recovery consumes exactly one ordinal", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-recovery-ordinal",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts).toHaveLength(1);
    expect(read.restarts[0]?.ordinal).toBe(1);
  });
});
