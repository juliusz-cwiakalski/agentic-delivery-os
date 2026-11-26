/**
 * TC-PEAK-022 — per-profile isolation: only the lane nominated to the profile
 * whose window is open parks and resumes (GH-413 F-11, F-2, AC-F11-2).
 */
import { describe, expect, test } from "bun:test";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

describe("TC-PEAK-022 only the open-window profile parks", () => {
  test("the open-window lane parks and the no-window lane keeps running", async () => {
    const open = createPeakScenario({
      label: "gh413-isolation-open",
      startMs: atUtcHour(7),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    const closed = createPeakScenario({
      label: "gh413-isolation-closed",
      startMs: atUtcHour(7),
      rules: { ...RULES_BY_PROFILE },
      nomination: "no-window-profile",
    });
    try {
      const openRun = await open.scenario.invoke(["dispatch", "GH-413", "--json"]);
      const closedRun = await closed.scenario.invoke(["dispatch", "GH-414", "--json"]);
      expect(openRun.exit).toBe(0);
      expect(closedRun.exit).toBe(0);
      expect(open.peak.parks.filter((park) => park.cause === "peak-window")).toHaveLength(2);
      expect(closed.peak.stopCalls).toHaveLength(0);
      expect(closed.peak.parks).toHaveLength(0);
      expect(open.peak.resumed()).toBe(1);
      expect(closed.peak.resumed()).toBe(0);
    } finally {
      open.scenario.dispose();
      closed.scenario.dispose();
    }
  });
});
