/**
 * TC-COORD-018 — the instance identity is folded from the latest lease by ledger
 * sequence; no separate instance record exists.
 */
import { describe, expect, test } from "bun:test";
import {
  COORDINATOR_RECORD_KINDS,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import {
  createCoordinatorHarness,
  dataOf,
  seedLease,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-018 the instance identity folds from the latest lease", () => {
  test("exactly six record kinds exist and no separate instance record", () => {
    expect(COORDINATOR_RECORD_KINDS).toHaveLength(6);
    expect(COORDINATOR_RECORD_KINDS).not.toContain("coordinator.instance");
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
  });

  test("the latest lease by ledger sequence is the instance identity", async () => {
    const harness = createCoordinatorHarness({ label: "instance-fold" });
    // Two records share recordedAt; only ledger order can decide.
    seedLease(harness, {
      action: "acquired",
      instanceId: "instance-old",
      pid: 1111,
      holder: "pid:1111:start:1000",
      recordedAt: "1970-01-01T00:00:00.000Z",
    });
    seedLease(harness, {
      action: "stop-requested",
      instanceId: "instance-new",
      pid: 2222,
      holder: "pid:2222:start:2000",
      recordedAt: "1970-01-01T00:00:00.000Z",
    });
    const status = await harness.run(["coordinator", "status", "--json"]);
    const data = dataOf(status);
    expect(data.instance?.instanceId).toBe("instance-new");
    expect(data.instance?.pid).toBe(2222);
    expect(data.instance?.startedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(data.fence?.action).toBe("stop-requested");
  });

  test("a takeover folds to the new instance with the previous holder", async () => {
    const harness = createCoordinatorHarness({ label: "instance-takeover", alive: { 4242: false } });
    seedLease(harness, {
      action: "acquired",
      instanceId: "instance-dead",
      recordedAt: new Date(0).toISOString(),
    });
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const takeover = read.fences.find((record) => record.action === "stale-takeover");
    expect(takeover?.instanceId).not.toBe("instance-dead");
    expect(takeover?.previousHolder).toBe("pid:4242:start:2000");
  });

  test("a released latest record leaves no instance", async () => {
    const harness = createCoordinatorHarness({ label: "instance-released" });
    seedLease(harness, { action: "released", recordedAt: new Date(0).toISOString() });
    const data = dataOf(await harness.run(["coordinator", "status", "--json"]));
    expect(data.instance).toBeNull();
    expect(data.fence?.action).toBe("released");
  });
});
