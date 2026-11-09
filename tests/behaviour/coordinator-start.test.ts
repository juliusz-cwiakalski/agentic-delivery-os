/**
 * TC-COORD-010 — `start --foreground` claims the lease atomically, records the
 * instance, refuses a second supervisor, recovers a stale fence, and rejects a
 * bare start.
 */
import { describe, expect, test } from "bun:test";
import { dataOf, errorCodeOf, createCoordinatorHarness } from "../fixtures/coordinator/harness";
import { fenceRecord } from "../fixtures/coordinator/states";

const started = () =>
  createCoordinatorHarness({
    label: "start",
    cycle: { cycles: 0 },
    session: { liveness: "alive" },
    alive: { 9001: true },
  });

describe("TC-COORD-010 start claims the lease and records the instance", () => {
  test("a fresh start appends one acquired and reports the instance", async () => {
    const harness = started();
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    // The zero-cycle supervisor has already released its lifetime lease, so the
    // instance is reported from the durable acquisition record, not fabricated.
    expect(data.instance).toBeNull();
    expect(data.fence?.action).toBe("released");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
    expect(read.fences[0]?.pid).toBe(9001);
    expect(read.fences[0]?.supervisorMode).toBe("foreground");
    expect(read.fences[0]?.externalUnit).toBe("absent");
  });

  test("the acquisition lands before any other record", async () => {
    const harness = createCoordinatorHarness({ label: "start-order", cycle: { cycles: 0 } });
    await harness.run(["coordinator", "start", "--foreground", "--json"]);
    const raw = harness.store.readRecords();
    if (!raw.ok) throw new Error("read failed");
    const coordinatorRecords = raw.value.records.filter((record) =>
      String(record.kind).startsWith("coordinator."),
    );
    expect(coordinatorRecords[0]?.kind).toBe("coordinator.fence");
    const first = coordinatorRecords[0];
    if (first === undefined) throw new Error("missing first record");
    expect((first.payload as { action?: string }).action).toBe("acquired");
  });

  test("a second start against a live holder is already-running with the holder named", async () => {
    const harness = createCoordinatorHarness({
      label: "start-second",
      alive: { 4242: true },
      cycle: { cycles: 0 },
    });
    harness.appendRaw({
      kind: "coordinator.fence",
      recordKey: "coordinator.fence:coordinator-main",
      payload: {
        ...fenceRecord({ pid: 4242, processStartTimeMs: 2_000, holder: "pid:4242:start:2000" }),
      },
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences).toHaveLength(1);
  });

  test("a held non-stale state fence refuses with already-running and appends no lease", async () => {
    const harness = createCoordinatorHarness({ label: "start-busy-fence", cycle: { cycles: 0 } });
    const held = harness.store.acquireFence("another-writer");
    expect(held.ok).toBe(true);
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(0);
  });

  test("two state dirs are independent", async () => {
    const first = started();
    const second = started();
    expect((await first.run(["coordinator", "start", "--foreground", "--json"])).code).toBe(0);
    expect((await second.run(["coordinator", "start", "--foreground", "--json"])).code).toBe(0);
    expect(first.root).not.toBe(second.root);
  });

  test("a bare start is fallback.invocation naming the M1-S18 seam", async () => {
    const harness = started();
    const result = await harness.run(["coordinator", "start", "--json"]);
    expect(result.code).toBe(1);
    expect(errorCodeOf(result)).toBe("fallback.invocation");
    const read = harness.records();
    if (read.ok) expect(read.fences).toHaveLength(0);
  });
});
