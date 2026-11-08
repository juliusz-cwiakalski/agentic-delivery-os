/**
 * TC-RECON-007/008 (classification half) — kill-and-restart decision points.
 */
import { describe, expect, test } from "bun:test";
import { decideDaemonLane } from "../../packages/core/src/domain/daemon-reconcile";
import {
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonLaneRecord,
} from "../../packages/core/src/contracts/index";

const lane: DaemonLaneRecord = {
  schema: DAEMON_LANE_PAYLOAD_SCHEMA,
  ref: "GH-238",
  state: "delivering",
  sessionId: "session-a",
  spawnOrdinal: 1,
  recordedAt: "2026-11-08T10:00:00Z",
};

describe("GH-238 crash classification", () => {
  test("a kill after the lane record with a gone session is interrupted", () => {
    const decision = decideDaemonLane({
      evidence: { ref: lane.ref, lane, processObservable: false, sessionObservable: false },
      restarts: 0,
      bound: 3,
    });
    expect(decision).toMatchObject({ classification: "interrupted", action: "resume" });
  });

  test("a kill with a failure record is crashed and preserves the reason", () => {
    const decision = decideDaemonLane({
      evidence: {
        ref: lane.ref,
        lane,
        processObservable: false,
        sessionObservable: false,
        failureReason: "spawn-failed",
      },
      restarts: 0,
      bound: 3,
    });
    expect(decision).toMatchObject({
      classification: "crashed",
      action: "resume",
      failureReason: "spawn-failed",
    });
  });

  test("an observable process reattaches without a restart increment", () => {
    const decision = decideDaemonLane({
      evidence: { ref: lane.ref, lane, processObservable: true },
      restarts: 2,
      bound: 3,
    });
    expect(decision).toEqual({
      ref: lane.ref,
      classification: "alive",
      action: "reattach",
      restarts: 2,
    });
  });

  test("a crashed lane at the budget bound is terminal", () => {
    const decision = decideDaemonLane({
      evidence: { ref: lane.ref, lane, processObservable: false, failureReason: "spawn-failed" },
      restarts: 3,
      bound: 3,
    });
    expect(decision).toMatchObject({
      action: "terminal-failed",
      reason: "restart-budget-exhausted",
    });
  });
});
