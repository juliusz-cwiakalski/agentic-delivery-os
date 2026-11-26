/**
 * TC-PEAK-037 — a complete park and resume loses nothing, reuses the recorded
 * session, and keeps one active park (GH-413 F-5, AC-F5-1, NFR-4, DM-1, DM-9).
 */
import { describe, expect, test } from "bun:test";
import { readDispatchLanes } from "../../packages/core/src/app/dispatch-ledger";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

describe("TC-PEAK-037 a complete episode preserves the session and the work", () => {
  test("one spawn, one resume, one active park, and no second session", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-preservation",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
      expect(scenario.scripted.calls.filter((call) => call === "resume")).toHaveLength(1);
      const parked = peak.parks.filter((park) => park.cause === "peak-window");
      expect(parked.filter((park) => park.recoveryState === "parked")).toHaveLength(1);
      expect(parked.filter((park) => park.recoveryState === "recovered")).toHaveLength(1);
      const lanes = readDispatchLanes(scenario.state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      const sessions = new Set(lanes.records.map((record) => record.sessionId));
      expect(sessions.size).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});
