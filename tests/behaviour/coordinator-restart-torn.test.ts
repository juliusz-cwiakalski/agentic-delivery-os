/**
 * TC-COORD-055 — a torn/gapped ordinal is unevaluable, never count `0`.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedRestart,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-055 a gapped ordinal is unevaluable", () => {
  test("ordinals 1 and 3 yield the state identity at exit 2 with no count 0", async () => {
    const harness = createCoordinatorHarness({
      label: "restart-torn",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    seedRestart(harness, { ordinal: 1 });
    seedRestart(harness, { ordinal: 3 });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("state.store.torn");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts).toHaveLength(2);
    expect(harness.counters.spawns).toBe(0);
  });

  test("a torn ordinal is never rendered as zero restarts", async () => {
    const harness = createCoordinatorHarness({
      label: "restart-torn-status",
      session: { liveness: "absent", sessionId: "session-1" },
    });
    seedRestart(harness, { ordinal: 2 });
    const data = await harness.run(["coordinator", "status", "--json"]);
    expect(data.code).toBe(0);
    const json = data.json as { data?: { restarts?: { count?: number } } };
    expect(json.data?.restarts?.count).toBe(1);
  });
});
