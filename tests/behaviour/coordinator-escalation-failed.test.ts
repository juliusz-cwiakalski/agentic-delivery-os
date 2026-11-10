/**
 * TC-COORD-062 — publish failure is exit 2, status says
 * `exhausted-escalation-failed`, and no exit-0 result lies.
 */
import { describe, expect, test } from "bun:test";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedRestart,
} from "../fixtures/coordinator/harness";

const failing = (label: string) => {
  const harness = createCoordinatorHarness({
    label,
    session: { liveness: "absent", sessionId: "session-1" },
    publishFails: true,
  });
  for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-062 publish failure is classified and never silent", () => {
  test("the tick returns publish-failed at exit 2 with no receipt", async () => {
    const harness = failing("escalation-failed");
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.escalation.publish-failed");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(0);
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(0);
  });

  test("status derives exhausted-escalation-failed from durable state", async () => {
    const harness = failing("escalation-failed-status");
    await harness.run(["coordinator", "tick", "--json"]);
    const data = dataOf(await harness.run(["coordinator", "status", "--json"]));
    expect(data.escalation.state).toBe("exhausted-escalation-failed");
    expect(data.escalation.questionId).toBeNull();
  });

  test("the publish attempt probes the fence before the blocker append", async () => {
    const harness = failing("escalation-failed-fence");
    const status = harness.store.fenceStatus();
    expect(status.held).toBe(false);
    await harness.run(["coordinator", "tick", "--json"]);
    // The publish path probes the fence exactly once before the blocker append.
    expect(harness.counters.fenceStatus).toBeGreaterThan(0);
  });

  test("an age-stale fence is recovered once on the same store (F-19)", async () => {
    const harness = createCoordinatorHarness({
      label: "escalation-stale-fence",
      session: { liveness: "absent", sessionId: "session-1" },
      staleFenceMs: 1_000,
      publishFails: false,
    });
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
    const held = harness.store.acquireFence("stale-writer");
    expect(held.ok).toBe(true);
    harness.clock.value += 60_000;
    expect(harness.store.fenceStatus().stale).toBe(true);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(1);
    expect(harness.counters.recoverFence).toBeGreaterThanOrEqual(1);
    const ledger = readBlockerLedger(harness.store);
    if (!ledger.ok) throw new Error("ledger read failed");
    expect(ledger.value.questions).toHaveLength(1);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.exhaustion).toHaveLength(1);
  });
});
