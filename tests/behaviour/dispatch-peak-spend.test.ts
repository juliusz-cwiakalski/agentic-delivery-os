/**
 * TC-PEAK-023 / TC-PEAK-024 — the window-scoped zero-spend reading is a
 * falsifiable positive zero over present telemetry and a classified absence
 * otherwise (GH-413 F-12, AC-F12-1, AC-F12-2, NFR-3).
 */
import { describe, expect, test } from "bun:test";
import type { TelemetryStepRecord } from "../../packages/core/src/contracts/index";
import { SPEND_WINDOW_BASIS } from "../../packages/core/src/contracts/spend";
import { windowSpendEvidence } from "../../packages/core/src/domain/spend";

const PARK = "2026-11-12T06:30:20.000Z";
const END = "2026-11-12T10:00:00.000Z";

let ordinal = 0;
const step = (instant: string, calls = 1): TelemetryStepRecord => {
  ordinal += 1;
  return {
    schemaId: "delivery.telemetry.step.v1",
    storageVersion: "v2",
    workItemRef: "GH-413",
    runId: `run-${ordinal}`,
    sessionId: `session-${ordinal}`,
    harnessKind: "opencode",
    harnessVersion: "1.0.0",
    treeRoot: null,
    model: "model-a",
    ticket: "GH-413",
    repository: "github.com/example/repo",
    lane: "GH-413",
    agentRole: "coder",
    tokens: { input: 10, output: 10, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    calls,
    cost: null,
    startedAt: instant,
    finishedAt: instant,
    warnings: [],
    capturedAt: instant,
  };
};

const evidenceOf = (steps: readonly TelemetryStepRecord[]) =>
  windowSpendEvidence({
    steps,
    ref: "GH-413",
    providerProfile: "delivery",
    from: PARK,
    through: END,
  });

describe("TC-PEAK-023 the parked interval reads a positive zero over present telemetry", () => {
  test("no attributable call reads zero with the named basis", () => {
    const evidence = evidenceOf([step("2026-11-12T08:00:00.000Z", 0)]);
    expect(evidence.telemetryState).toBe("present");
    expect(evidence.billableCalls).toBe(0);
    expect(evidence.basis).toBe(SPEND_WINDOW_BASIS);
    expect(evidence.billableCalls).toBe(0);
  });

  test("absent telemetry is a classified absence, never a fabricated zero", () => {
    const evidence = evidenceOf([]);
    expect(evidence.telemetryState).not.toBe("present");
    expect(evidence.billableCalls).toBeUndefined();
  });
});

describe("TC-PEAK-024 a seeded mid-window call makes the zero claim fail", () => {
  test("a call inside the interval and at either inclusive boundary is counted", () => {
    for (const instant of ["2026-11-12T08:00:00.000Z", PARK, END]) {
      const evidence = evidenceOf([step(instant)]);
      expect(evidence.billableCalls, instant).toBeGreaterThan(0);
    }
  });
});
