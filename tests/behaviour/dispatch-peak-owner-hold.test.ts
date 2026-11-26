/**
 * TC-PEAK-021 — an active owner hold changes nothing about the watch: the lane
 * still parks, the hold writes no park record, and the resume waits for the
 * hold to clear with the park record byte-unchanged (GH-413 F-11, AC-F11-1).
 */
import { describe, expect, test } from "bun:test";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

describe("TC-PEAK-021 the owner hold does not change the watch or the park", () => {
  test("the lane parks under the hold and resumes once the hold clears", async () => {
    const untilMs = atUtcHour(10);
    let peakRef: { readonly clock: { nowMs: () => number } } | undefined;
    const { peak, scenario } = createPeakScenario({
      label: "gh413-owner-hold",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      holdActive: () => (peakRef === undefined ? true : peakRef.clock.nowMs() < untilMs + 60_000),
    });
    peakRef = peak;
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      const parked = peak.parks.filter((park) => park.recoveryState === "parked");
      expect(parked).toHaveLength(1);
      const recovered = peak.parks.find((park) => park.recoveryState === "recovered");
      expect(recovered).toBeDefined();
      // The hold wrote no park of its own: one parked and one recovered record.
      expect(peak.parks).toHaveLength(2);
      expect(Date.parse(recovered?.recoveredAt ?? "")).toBeGreaterThanOrEqual(untilMs + 60_000);
      expect(peak.resumed()).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});
