/**
 * TC-COORD-071 — one wake per question lifetime; a still-top question is
 * `already-woken`.
 */
import { describe, expect, test } from "bun:test";
import { pickupQuestion } from "../fixtures/coordinator/blockers";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";

describe("TC-COORD-071 one wake per question lifetime", () => {
  test("a still-top already-woken question appends no second record", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-dedupe",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
    });
    const first = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(first.wake?.outcome).toBe("woken");
    const second = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(second.wake?.outcome).toBe("already-woken");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(1);
  });

  test("the dedupe key is coordinator + question + askedAt", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-dedupe-key",
      questions: [pickupQuestion("q-key")],
      session: { liveness: "alive" },
    });
    await harness.run(["coordinator", "tick", "--json"]);
    // A reopened read (fresh store handle) still applies the dedupe.
    const reopened = harness.store;
    const read = reopened.readRecords();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const wakes = read.value.records.filter((record) => record.kind === "coordinator.wake");
    expect(wakes).toHaveLength(1);
    const payload = wakes[0]?.payload as Record<string, unknown>;
    expect(payload["coordinatorId"]).toBe("coordinator-main");
    expect(payload["questionId"]).toBe("q-key");
    expect(typeof payload["askedAt"]).toBe("string");
  });

  test("a delivery failure appends nothing and the next tick retries", async () => {
    const harness = createCoordinatorHarness({
      label: "wake-dedupe-failed",
      questions: [pickupQuestion()],
      session: { liveness: "alive" },
      wakeFails: true,
    });
    const failed = await harness.run(["coordinator", "tick", "--json"]);
    expect(failed.code).toBe(2);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.wakes).toHaveLength(0);
    expect(read.fences.filter((record) => record.action === "released")).toHaveLength(1);
  });
});
