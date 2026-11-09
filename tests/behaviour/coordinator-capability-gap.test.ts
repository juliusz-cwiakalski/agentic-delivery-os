/**
 * TC-COORD-044 — missing process-port capabilities are a classified gap and the
 * four capability owners stay distinct.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedIteration,
} from "../fixtures/coordinator/harness";
import {
  appendCoordinatorIteration,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import {
  iterationRecord,
  makeCoordinatorStore,
  COORDINATOR_ID,
} from "../fixtures/coordinator/states";

describe("TC-COORD-044 the four capability owners stay distinct", () => {
  test("an absent start-time identity at kill time is a gap before TERM", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-kill",
      session: { liveness: "alive" },
      alive: { 4242: false },
      declared: { startTimeIdentity: false },
    });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.process.capability-gap");
    expect(harness.process.signals).toHaveLength(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    // The verdict was recorded before the kill; no outcome follows.
    expect(read.stuck.map((record) => record.phase)).toEqual(["verdict"]);
  });

  test("a harness resume absence selects spawn-fresh with no error identity", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-resume",
      session: { liveness: "absent", resumeDeclared: false },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.iterations[0]?.reason).toBe("session-interrupted");
    expect(read.iterations[0]?.decision).toBe("spawn-fresh");
  });

  test("a harness spawn refusal is the delivered harness identity at exit 1", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-spawn",
      spawnFails: true,
      session: { sessionId: null, liveness: "absent", contextTokens: null },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("harness.spawn.refused");
  });

  test("an absent progress source is an unknown evidence class, not an error", async () => {
    const harness = createCoordinatorHarness({
      label: "gap-progress",
      session: { liveness: "alive" },
      progress: { newTurn: "unknown", observedAtMs: null },
    });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck[0]?.verdict).toBe("stuck");
    expect(read.stuck[0]?.evidence).toContain("newTurn=unknown");
  });

  test("the history and iteration records remain additive under the same schema", () => {
    const { store } = makeCoordinatorStore("gap-additive");
    const appended = appendCoordinatorIteration(store, "writer", iterationRecord());
    expect(appended.ok).toBe(true);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
  });
});
