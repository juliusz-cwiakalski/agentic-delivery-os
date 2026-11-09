/**
 * TC-COORD-041 — a failed kill is classified at exit 2 and never claims success.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedIteration,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-041 a failed kill is classified, never silent success", () => {
  test("the outcome record lands with killOutcome failed and exit 2", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-failed",
      session: { liveness: "alive" },
      alive: { 4242: false },
      signalFails: true,
    });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.session.kill-failed");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.map((record) => record.phase)).toEqual(["verdict", "outcome"]);
    expect(read.stuck[1]?.killOutcome).toBe("failed");
    expect(read.stuck[1]?.killFailureReason).toBeNull();
  });

  test("no restart record is appended after a failed kill", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-failed-no-restart",
      session: { liveness: "alive" },
      alive: { 4242: false },
      signalFails: true,
    });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts).toHaveLength(0);
  });

  test("the failed kill is not retried forever within one tick", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-failed-no-retry",
      session: { liveness: "alive" },
      alive: { 4242: false },
      signalFails: true,
    });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.process.killCalls).toBeGreaterThanOrEqual(1);
  });
});
