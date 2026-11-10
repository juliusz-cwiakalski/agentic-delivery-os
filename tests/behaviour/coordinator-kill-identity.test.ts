/**
 * TC-COORD-045 — a PID/start-time identity mismatch sends no signal and records
 * `identity-mismatch`.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  errorCodeOf,
  seedIteration,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-045 identity mismatch sends no signal", () => {
  test("a mismatched start time records identity-mismatch and exit 2", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-identity",
      session: { liveness: "alive", pid: 4242, processStartTimeMs: 2_000 },
      alive: { 4242: true },
    });
    harness.process.setStartTime(4242, 9_999);
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.session.kill-failed");
    expect(harness.process.signals).toHaveLength(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck[1]?.killOutcome).toBe("failed");
    expect(read.stuck[1]?.killFailureReason).toBe("identity-mismatch");
  });

  test("a matching identity proceeds with TERM", async () => {
    const harness = createCoordinatorHarness({
      label: "kill-identity-match",
      session: { liveness: "alive", pid: 4242, processStartTimeMs: 2_000 },
      alive: { 4242: false },
    });
    harness.process.setStartTime(4242, 2_000);
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.process.signals).toEqual([{ pid: 4242, signal: "SIGTERM" }]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck[1]?.killOutcome).toBe("terminated");
    expect(read.stuck[1]?.killFailureReason).toBeNull();
  });
});
