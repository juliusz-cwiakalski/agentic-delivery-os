/**
 * TC-COORD-011 — `stop` is a recorded request, reports `requested`/`not-running`,
 * and is idempotent without a supervisor.
 */
import { describe, expect, test } from "bun:test";
import {
  type CoordinatorHarnessOptions,
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
} from "../fixtures/coordinator/harness";
import { fenceRecord, T0 } from "../fixtures/coordinator/states";

const seedHeld = (
  options: CoordinatorHarnessOptions & {
    readonly action?: "acquired" | "stop-requested";
    readonly recordedAt?: string;
    readonly pid?: number;
  } = {},
) => {
  const harness = createCoordinatorHarness({ label: "stop", ...options });
  harness.appendRaw({
    kind: "coordinator.fence",
    recordKey: "coordinator.fence:coordinator-main",
    payload: {
      ...fenceRecord({
        action: options.action ?? "acquired",
        pid: options.pid ?? 4242,
        processStartTimeMs: 2_000,
        holder: `pid:${options.pid ?? 4242}:start:2000`,
        recordedAt: options.recordedAt ?? T0,
      }),
    },
  });
  return harness;
};

describe("TC-COORD-011 stop is a recorded request", () => {
  test("a live holder receives one stop-requested and no release", async () => {
    const harness = seedHeld({ alive: { 4242: true } });
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.requested).toBe(true);
    expect(data.released).toBe(false);
    expect(data.state).toBe("requested");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "stop-requested"]);
  });

  test("an old-but-live holder is still requested (age never overrides alive)", async () => {
    const harness = seedHeld({
      alive: { 4242: true },
      recordedAt: new Date(0).toISOString(),
    });
    harness.clock.value += 30 * 24 * 60 * 60 * 1000;
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(0);
    expect(dataOf(result).state).toBe("requested");
  });

  test("a dead holder is not-running and nothing is appended", async () => {
    const harness = seedHeld({ alive: { 4242: false } });
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.state).toBe("not-running");
    expect(data.requested).toBe(false);
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(1);
  });

  test("a released latest record is not-running even with a live pid", async () => {
    const harness = createCoordinatorHarness({ label: "stop-released", alive: { 4242: true } });
    harness.appendRaw({
      kind: "coordinator.fence",
      recordKey: "coordinator.fence:coordinator-main",
      payload: { ...fenceRecord({ action: "released" }) },
    });
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(0);
    expect(dataOf(result).state).toBe("not-running");
  });

  test("a declared-but-unanswered probe uses the age fallback", async () => {
    const young = seedHeld({ alive: { 4242: null } });
    expect(dataOf(await young.run(["coordinator", "stop", "--json"])).state).toBe("requested");
    const old = seedHeld({ alive: { 4242: null }, recordedAt: new Date(0).toISOString() });
    old.clock.value += 10 * 60 * 1000;
    expect(dataOf(await old.run(["coordinator", "stop", "--json"])).state).toBe("not-running");
  });

  test("an undeclared alive capability is a gap, never not-running", async () => {
    const harness = seedHeld({ declared: { alive: false } });
    const result = await harness.run(["coordinator", "stop", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.process.capability-gap");
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(1);
  });

  test("stop never releases another process's handle", async () => {
    const harness = seedHeld({ alive: { 4242: true } });
    const held = harness.store.acquireFence("live-holder");
    expect(held.ok).toBe(true);
    await harness.run(["coordinator", "stop", "--json"]);
    expect(harness.store.fenceStatus().held).toBe(true);
    const read = harness.records();
    if (read.ok) expect(read.fences.some((record) => record.action === "released")).toBe(false);
  });

  test("stop on a fresh state dir is idempotent at exit 0", async () => {
    const harness = createCoordinatorHarness({ label: "stop-fresh" });
    const first = await harness.run(["coordinator", "stop", "--json"]);
    const second = await harness.run(["coordinator", "stop", "--json"]);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(dataOf(second).state).toBe("not-running");
  });
});
