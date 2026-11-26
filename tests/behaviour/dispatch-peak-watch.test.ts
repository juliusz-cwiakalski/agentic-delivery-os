/**
 * TC-PEAK-002 / TC-PEAK-004 / TC-PEAK-005 — the dispatch-owned watch parks a
 * mid-iteration window, does not exempt a chain-first-no-window nomination, and
 * never stops a lane whose nominated profile declares no window (GH-413 F-1,
 * F-2, AC-F1-2, AC-F2-1, AC-F2-2).
 */
import { describe, expect, test } from "bun:test";
import {
  createCommandScenario,
  createPeakFixture,
  readsFrom,
} from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const scenarioWithPeak = (
  label: string,
  startMs: number,
  rules: Readonly<Record<string, unknown>>,
  nomination: string,
) => {
  const peak = createPeakFixture({
    startMs,
    rules: rules as never,
  });
  const scenario = createCommandScenario({
    label,
    evidence: COMPLETED_EVIDENCE,
    reads: readsFrom(),
    nowIso: peak.clock.iso,
    livenessIntervalMs: 30_000,
    leaseTtlMs: 90_000,
    collectAfterPolls: 2,
    livenessOf: (poll) => ({
      readings: [
        { kind: "session-traffic", status: "sourced", value: poll, observedAt: peak.clock.iso() },
        { kind: "process", status: "sourced", value: poll, observedAt: peak.clock.iso() },
      ],
    }),
    nominate: () => ({ ok: true, profile: nomination }),
    peak: peak.peak,
    waitForCadence: peak.waitForCadence,
  });
  peak.setOnStop(() => scenario.scripted.finishCollect());
  return { peak, scenario };
};

describe("TC-PEAK-002 a window that opens while the lane runs parks and resumes", () => {
  test("the first observation inside the window parks exactly once and the lane resumes", async () => {
    const { peak, scenario } = scenarioWithPeak(
      "gh413-watch-mid",
      atUtcHour(6, 30),
      RULES_BY_PROFILE,
      "delivery",
    );
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(peak.stopCalls).toHaveLength(1);
      const parked = peak.parks.filter((park) => park.recoveryState === "parked");
      expect(parked).toHaveLength(1);
      expect(parked[0]?.cause).toBe("peak-window");
      expect(parked[0]?.until).toBe("2026-11-12T10:00:00.000Z");
      expect(peak.parks.filter((park) => park.recoveryState === "recovered")).toHaveLength(1);
      expect(peak.resumed()).toBe(1);
      expect(peak.reentered()).toHaveLength(0);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-004 the chain's first entry does not exempt a later nominated profile", () => {
  test("a base profile with no windows still parks the lane nominated to delivery", async () => {
    const { peak, scenario } = scenarioWithPeak(
      "gh413-watch-chain",
      atUtcHour(7),
      { ...RULES_BY_PROFILE, "chain-base": undefined },
      "delivery",
    );
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      const parked = peak.parks.filter((park) => park.recoveryState === "parked");
      expect(parked).toHaveLength(1);
      expect(parked[0]?.providerProfile).toBe("delivery");
      const firstLane = scenario.state.store.readRecords();
      expect(firstLane.ok).toBe(true);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-005 a profile with no peakWindows is never stopped", () => {
  test("the lane runs through other profiles' open windows with no stop or park", async () => {
    const { peak, scenario } = scenarioWithPeak(
      "gh413-watch-no-window",
      atUtcHour(7),
      RULES_BY_PROFILE,
      "no-window-profile",
    );
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(peak.stopCalls).toHaveLength(0);
      expect(peak.parks.filter((park) => park.cause === "peak-window")).toHaveLength(0);
      expect(peak.resumed()).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
