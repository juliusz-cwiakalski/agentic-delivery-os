/**
 * TC-COORD-040 (adapter half) — identity verification, TERM, grace, conditional
 * KILL, and the closed outcome over the delivered `DaemonProcessPort`. The
 * adapter appends no coordinator record and runs no budget check.
 */
import { describe, expect, test } from "bun:test";
import { killCoordinatorProcess } from "../../packages/adapters/src/daemon/index";
import { readCoordinatorRecords } from "../../packages/core/src/state/index";
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
  const run = (overrides: {
    processStartTimeMs?: number;
    graceMs?: number;
    capabilities?: Parameters<typeof killCoordinatorProcess>[0]["capabilities"];
  } = {}) =>
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
