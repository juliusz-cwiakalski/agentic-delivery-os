/**
 * TC-COORD-042 — the kill target is the recorded handle and pid only; no name,
 * pattern, or shell-interpolated command exists on the path.
 */
import { describe, expect, test } from "bun:test";
import { killCoordinatorProcess } from "../../packages/adapters/src/daemon/index";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";

const PID = 5150;
const START = 1_700_000_111_000;

describe("TC-COORD-042 the kill target is the recorded handle only", () => {
  test("only the recorded pid receives signals, even with a hostile session handle", async () => {
    const recorder = createRecordingProcessPort({
      startTimes: { [PID]: START },
      alive: { [PID]: true },
    });
    const hostileHandle = "session; rm -rf / && $(pkill node)";
    const result = await killCoordinatorProcess({
      port: recorder.port,
      identity: { pid: PID, processStartTimeMs: START },
      graceMs: 1,
      wait: async () => undefined,
      // The handle is never a parameter of the kill path.
      ...({ sessionHandle: hostileHandle } as object),
    });
    expect(result.outcome).toBe("forced");
    expect(recorder.signals.map((entry) => entry.pid)).toEqual([PID, PID]);
    expect(JSON.stringify(recorder.signals)).not.toContain("rm -rf");
    expect(hostileHandle).toContain("pkill");
  });

  test("a mismatched identity sends no signal to the recorded pid", async () => {
    const recorder = createRecordingProcessPort({
      startTimes: { [PID]: START + 1 },
      alive: { [PID]: true },
    });
    const result = await killCoordinatorProcess({
      port: recorder.port,
      identity: { pid: PID, processStartTimeMs: START },
      graceMs: 1,
      wait: async () => undefined,
    });
    expect(result).toEqual({ outcome: "failed", failureReason: "identity-mismatch" });
    expect(recorder.signals).toHaveLength(0);
  });

  test("no kill occurs for a different pid that is alive", async () => {
    const recorder = createRecordingProcessPort({
      startTimes: { [PID]: START },
      alive: { [PID]: false, [PID + 1]: true },
    });
    const result = await killCoordinatorProcess({
      port: recorder.port,
      identity: { pid: PID, processStartTimeMs: START },
      graceMs: 1,
      wait: async () => undefined,
    });
    expect(result.outcome).toBe("terminated");
    expect(recorder.signals.map((entry) => entry.pid)).toEqual([PID]);
    expect(recorder.signals.some((entry) => entry.pid === PID + 1)).toBe(false);
  });
});
