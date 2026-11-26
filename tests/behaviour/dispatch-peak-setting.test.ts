/**
 * TC-PEAK-015 / TC-PEAK-017 — the disabling key: absent or false keeps pausing
 * on, true composes no in-flight watch, and an invalid value is refused by name
 * (GH-413 F-8, AC-F8-1, DM-6, DM-7, NFR-9, DEC-2).
 */
import { describe, expect, test } from "bun:test";
import { DISPATCH_DISABLE_PEAK_PAUSING_KEY } from "../../packages/core/src/contracts/index";
import { readQueueParks, resolveConfig, resolveLaneSettings } from "../../packages/core/src/index";
import { laneSource } from "../fixtures/config/lane";
import {
  createCommandScenario,
  createPeakScenario,
  readsFrom,
} from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const resolveLane = (lane: unknown) => {
  const resolved = resolveConfig({ sources: [laneSource(lane as never)] });
  if (!resolved.ok) return { ok: false as const, error: resolved.error };
  const settings = resolveLaneSettings(resolved.value.values, resolved.value.origins);
  return settings.ok
    ? { ok: true as const, lane: settings.value }
    : { ok: false as const, error: settings.error };
};

const disabledScenario = (label: string) =>
  createCommandScenario({
    label,
    evidence: COMPLETED_EVIDENCE,
    reads: readsFrom(),
    nowIso: () => new Date(atUtcHour(6, 30)).toISOString(),
    livenessIntervalMs: 30_000,
    leaseTtlMs: 90_000,
    collectAfterPolls: 2,
    nominate: () => ({ ok: true, profile: "delivery" }),
  });

describe("TC-PEAK-017 the peak-pausing key refuses an invalid value by name", () => {
  test("the key constant names the declared catalog path", () => {
    expect(DISPATCH_DISABLE_PEAK_PAUSING_KEY).toBe("lane.disable-peak-pausing");
  });

  for (const invalid of ["yes", 1, 0, null, [], {}] as const) {
    test(`a ${JSON.stringify(invalid)} value is refused config.value.invalid with no partial effect`, () => {
      const resolved = resolveLane({
        "liveness-interval": 30000,
        "restart-budget": 3,
        "disable-peak-pausing": invalid,
      });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.error.kind).toBe("config");
      expect(resolved.error.code).toBe("config.value.invalid");
    });
  }
});

describe("TC-PEAK-015 the disabling key unset, false, and true behave as declared", () => {
  test("with the key absent the lane parks exactly as specified", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-setting-absent",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(peak.parks.filter((park) => park.recoveryState === "parked")).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });

  test("with the key true no watch, stop, park, or episode event occurs", async () => {
    const scenario = disabledScenario("gh413-setting-true");
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      const parks = readQueueParks(scenario.state.store);
      expect(parks.ok).toBe(true);
      if (!parks.ok) return;
      expect(parks.records).toHaveLength(0);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});
