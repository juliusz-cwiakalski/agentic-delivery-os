/**
 * TC-COORD-040 (adapter half) — identity verification, TERM, grace, conditional
 * KILL, and the closed outcome over the delivered `DaemonProcessPort`. The
 * adapter appends no coordinator record and runs no budget check.
 */
import { describe, expect, test } from "bun:test";
import {
  createNodeProcessPort,
  killCoordinatorProcess,
} from "../../packages/adapters/src/daemon/index";
import { readCoordinatorRecords } from "../../packages/core/src/state/index";
import { createCoordinatorHarness, seedIteration } from "../fixtures/coordinator/harness";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";
import { COORDINATOR_ID, makeCoordinatorStore } from "../fixtures/coordinator/states";

const PID = 4242;
const START = 1_700_000_000_000;

const harness = (options: Parameters<typeof createRecordingProcessPort>[0] = {}) => {
  const recorder = createRecordingProcessPort({
    startTimes: { [PID]: START },
    ...options,
  });
  const waits: number[] = [];
  const run = (
    overrides: {
      processStartTimeMs?: number;
      graceMs?: number;
      capabilities?: Parameters<typeof killCoordinatorProcess>[0]["capabilities"];
    } = {},
  ) =>
    killCoordinatorProcess({
      port: recorder.port,
      identity: { pid: PID, processStartTimeMs: overrides.processStartTimeMs ?? START },
      graceMs: overrides.graceMs ?? 20_000,
      wait: async (ms) => {
        waits.push(ms);
      },
      capabilities: overrides.capabilities ?? recorder.capabilities,
    });
  return { recorder, waits, run };
};

describe("TC-COORD-040 kill verifies identity then TERM, grace, conditional KILL", () => {
  test("a tree that exits during the grace is terminated with one TERM", async () => {
    const { recorder, waits, run } = harness({ alive: { [PID]: false } });
    const result = await run();
    expect(result).toEqual({ outcome: "terminated" });
    expect(recorder.signals).toEqual([{ pid: PID, signal: "SIGTERM" }]);
    expect(waits).toEqual([20_000]);
  });

  test("a tree still alive after the grace is forced with TERM then KILL", async () => {
    const { recorder, waits, run } = harness({ alive: { [PID]: true } });
    const result = await run();
    expect(result).toEqual({ outcome: "forced" });
    expect(recorder.signals).toEqual([
      { pid: PID, signal: "SIGTERM" },
      { pid: PID, signal: "SIGKILL" },
    ]);
    expect(waits).toEqual([20_000]);
  });

  test("a refused signal is a classified failure, never a success", async () => {
    const { recorder, run } = harness({ signalFails: true });
    const result = await run();
    expect(result).toEqual({ outcome: "failed", failureReason: null });
    expect(recorder.signals).toHaveLength(0);
  });

  test("an absent start-time identity capability is a gap before TERM", async () => {
    const { recorder, waits, run } = harness({
      declared: { startTimeIdentity: false },
      alive: { [PID]: true },
    });
    const result = await run();
    expect(result).toEqual({ outcome: "capability-gap", missing: "start-time-identity" });
    expect(recorder.signals).toHaveLength(0);
    expect(waits).toHaveLength(0);
  });

  test("a missing alive capability is a gap with no signal", async () => {
    const { recorder, run } = harness({ declared: { alive: false } });
    expect(await run()).toEqual({ outcome: "capability-gap", missing: "alive" });
    expect(recorder.signals).toHaveLength(0);
  });

  test("a missing kill-with-grace capability is a gap with no signal", async () => {
    const { recorder, run } = harness({ declared: { killWithGrace: false } });
    expect(await run()).toEqual({ outcome: "capability-gap", missing: "kill-with-grace" });
    expect(recorder.signals).toHaveLength(0);
  });

  test("the adapter composes no record and runs no budget check", async () => {
    const { store } = makeCoordinatorStore("kill-grace-no-append");
    const { run } = harness({ alive: { [PID]: true } });
    const result = await run();
    expect(result.outcome).toBe("forced");
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.verifiedEmpty).toBe(true);
  });
});

/**
 * TC-COORD-040 (composition half) — the supervisor composes the two-phase
 * `coordinator.stuck` append and the budget check after the adapter returns.
 */
describe("TC-COORD-040 the supervisor composes the two-phase outcome and budget", () => {
  const composed = (label: string, alive: Record<number, boolean | null>) =>
    createCoordinatorHarness({ label, session: { liveness: "alive" }, alive });

  test("a terminated kill appends verdict then outcome, then one restart", async () => {
    const harness = composed("kill-grace-composed", { 4242: false });
    seedIteration(harness);
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck.map((record) => record.phase)).toEqual(["verdict", "outcome"]);
    expect(read.stuck[0]?.killOutcome).toBe("not-attempted");
    expect(read.stuck[1]?.killOutcome).toBe("terminated");
    expect(new Set(read.stuck.map((record) => record.stuckId)).size).toBe(1);
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1]);
    expect(read.restarts[0]?.reason).toBe("stuck-artifact-evidence");
  });

  test("a forced kill records forced and then restarts", async () => {
    const harness = composed("kill-grace-forced", { 4242: true });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.stuck[1]?.killOutcome).toBe("forced");
    expect(harness.process.signals.map((signal) => signal.signal)).toEqual(["SIGTERM", "SIGKILL"]);
    expect(read.restarts).toHaveLength(1);
  });

  test("the budget is checked only after the outcome append", async () => {
    const harness = composed("kill-grace-order", { 4242: false });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    const raw = harness.store.readRecords();
    if (!raw.ok) throw new Error("read failed");
    const kinds = raw.value.records
      .filter((record) => ["coordinator.stuck", "coordinator.restart"].includes(record.kind))
      .map((record) => record.kind);
    expect(kinds).toEqual(["coordinator.stuck", "coordinator.stuck", "coordinator.restart"]);
  });

  test("the production node process port implements the start-time identity source (F-06)", () => {
    const port = createNodeProcessPort();
    expect(typeof port.startTimeMs).toBe("function");
    const observed = port.startTimeMs?.(process.pid);
    if (process.platform === "linux") {
      // `/proc/<pid>/stat` plus `btime` resolves a real epoch-millisecond start.
      expect(typeof observed).toBe("number");
      expect(Number.isInteger(observed ?? 0)).toBe(true);
      expect(observed ?? 0).toBeGreaterThan(1_000_000_000_000);
      expect(observed ?? 0).toBeLessThanOrEqual(Date.now());
    } else {
      // The documented non-Linux fallback is the absent capability.
      expect(observed).toBeUndefined();
    }
  });

  test("no quiet record exists beyond the lease pair and the action records", async () => {
    const harness = composed("kill-grace-quiet", { 4242: false });
    seedIteration(harness);
    await harness.run(["coordinator", "tick", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences.map((record) => record.action)).toEqual(["acquired", "released"]);
  });
});
