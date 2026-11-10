/**
 * TC-COORD-074 — wake delivery failure is exit 2, appends nothing, and retries
 * without duplicate records.
 */
import { describe, expect, test } from "bun:test";
import { pickupQuestion } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, errorCodeOf } from "../fixtures/coordinator/harness";

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

  test("a later successful tick on the same state appends exactly one record", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-retry",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
      wakeFails: true,
    });
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(2);
    const failedRead = harness.records();
    if (!failedRead.ok) throw new Error("read failed");
    expect(failedRead.wakes).toHaveLength(0);
    harness.setWakeFails(false);
    expect((await harness.run(["coordinator", "tick", "--json"])).code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(1);
  });
});
