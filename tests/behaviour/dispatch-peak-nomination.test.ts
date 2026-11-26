/**
 * TC-PEAK-031 — every active lane record the invocation appends carries the
 * nomination, so a latest-wins read always finds it (GH-413 F-2, AC-F2-3, DM-2,
 * DEC-16).
 */
import { describe, expect, test } from "bun:test";
import { readDispatchLanes } from "../../packages/core/src/app/dispatch-ledger";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

describe("TC-PEAK-031 every active lane record carries the nomination", () => {
  test("the first acquisition and the post-park resume both record providerProfile", async () => {
    const { scenario } = createPeakScenario({
      label: "gh413-nomination",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      const lanes = readDispatchLanes(scenario.state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      const active = lanes.records.filter((record) => record.state === "active");
      expect(active.length).toBeGreaterThanOrEqual(2);
      for (const record of active) {
        expect(record.providerProfile).toBe("delivery");
      }
    } finally {
      scenario.dispose();
    }
  });

  test("a lane record without a stored nomination is never fabricated", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-nomination-absent",
      startMs: atUtcHour(11),
      rules: { ...RULES_BY_PROFILE },
      nomination: "no-window-profile",
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      const lanes = readDispatchLanes(scenario.state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      for (const record of lanes.records.filter((entry) => entry.state === "active")) {
        expect(record.providerProfile).toBe("no-window-profile");
      }
      expect(peak.parks).toHaveLength(0);
    } finally {
      scenario.dispose();
    }
  });
});
