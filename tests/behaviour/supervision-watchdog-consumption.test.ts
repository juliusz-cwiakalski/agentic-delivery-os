/**
 * TC-SUP-031 / TC-SUP-032 — an absent signal source contributes `unknown`
 * (never a coerced zero) and the delivered prefill-safe and signals-absent
 * verdicts are reused through one declared mapping (GH-295 AC-F4-1, DEC-1,
 * DEC-5, NFR-1).
 */
import { describe, expect, test } from "bun:test";
import {
  type DaemonLaneLivenessClassification,
  SUPERVISION_STATE_FROM_DAEMON_LIVENESS,
  SUPERVISION_STATES,
  WATCHDOG_STALL_HEARTBEAT_MS,
} from "../../packages/core/src/contracts/index";
import { classifyLaneProgress } from "../../packages/core/src/domain/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedHeartbeat, seedLane, seedLaneRecord } from "../fixtures/supervise/records";

describe("TC-SUP-031 present-but-zero corroborates; absent contributes unknown", () => {
  test("an aged heartbeat with zero artifact progress corroborates a stall", () => {
    const harness = createSupervisionHarness({ label: "present-zero" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(WATCHDOG_STALL_HEARTBEAT_MS + 1) });
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const lane = result.report.lanes.find((entry) => entry.ref === LANE_REF);
      expect(lane?.classification).toBe("stalled");
      expect(lane?.evidence.some((item) => item.code === "artifact-heartbeat-aged")).toBe(true);
      expect(lane?.evidence.some((item) => item.code === "artifact-flat")).toBe(true);
      expect(lane?.heartbeat).toBeDefined();
    } finally {
      harness.remove();
    }
  });

  test("an absent signal source reads unknown with evidence of absence and no zero", () => {
    const harness = createSupervisionHarness({ label: "absent-source" });
    try {
      // No heartbeat source exists in this scope at all: one lane advances on
      // artifacts alone (progressing) and keeps the scope readable; the other
      // has no source of any kind and must read unknown, never a coerced zero.
      seedLane(harness.seed, LANE_REF);
      seedLaneRecord(harness.seed, { offsetMs: -60_000, lastCompletedPhase: "4" });
      seedLane(harness.seed, "GH-297");
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.lanes.find((lane) => lane.ref === LANE_REF)?.classification).toBe(
        "progressing",
      );
      const entry = result.report.lanes.find((lane) => lane.ref === "GH-297");
      expect(entry?.classification).toBe("unknown");
      expect(entry?.heartbeat).toBeUndefined();
      expect(JSON.stringify(entry)).not.toContain('"heartbeat":0');
      expect(entry?.evidence.some((item) => item.code === "artifact-source-absent")).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-032 one declared mapping reuses the delivered verdict family", () => {
  test("every delivered classification projects to a declared tri-state", () => {
    const cases: readonly {
      readonly input: Parameters<typeof classifyLaneProgress>[0];
      readonly expected: DaemonLaneLivenessClassification;
    }[] = [
      { input: { tokenDelta: 1, traffic: 0 }, expected: "progressing" },
      { input: { tokenDelta: 0, traffic: 1 }, expected: "progressing" },
      { input: { tokenDelta: 0, traffic: 0, prefillOrResume: true }, expected: "progressing" },
      { input: { tokenDelta: 0, traffic: 0, corroborated: true }, expected: "stalled" },
      { input: { tokenDelta: 0, traffic: 0 }, expected: "unknown" },
    ];
    for (const item of cases) {
      const delivered = classifyLaneProgress(item.input);
      expect(delivered, JSON.stringify(item.input)).toBe(item.expected);
      expect(SUPERVISION_STATES).toContain(SUPERVISION_STATE_FROM_DAEMON_LIVENESS[delivered]);
    }
    // The mapping is injective on the delivered set: no two verdicts collapse
    // to one tri-state in a way that would hide the delivered answer.
    expect(SUPERVISION_STATE_FROM_DAEMON_LIVENESS.progressing).toBe("progressing");
    expect(SUPERVISION_STATE_FROM_DAEMON_LIVENESS.stalled).toBe("stalled");
    expect(SUPERVISION_STATE_FROM_DAEMON_LIVENESS.unknown).toBe("unknown");
  });
});
