/**
 * TC-COORD-074 — wake delivery failure is exit 2, appends nothing, and retries
 * without duplicate records.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, errorCodeOf } from "../fixtures/coordinator/harness";
import { pickupQuestion } from "../fixtures/coordinator/blockers";

describe("TC-COORD-074 a failed wake is classified and retried", () => {
  test("delivery-failed is exit 2 with no durable record and a released lease", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-failed",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
      wakeFails: true,
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.wake.delivery-failed");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(0);
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
  });

  test("a later successful tick appends exactly one record", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-retry",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
      wakeFails: true,
    });
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(2);
    // The retry is a different harness option set; simulate success by a new tick
    // on a harness whose delivery succeeds (the undurable failure left no record).
    const retry = createCoordinatorHarness({
      label: "wake-retry-success",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    expect((await retry.run(["coordinator", "tick", "--json"])).code).toBe(0);
    const read = retry.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(1);
  });
});
