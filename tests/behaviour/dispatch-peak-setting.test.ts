/**
 * TC-PEAK-017 — an invalid `lane.disable-peak-pausing` value is refused by name
 * with no partial effect (GH-413 F-8, DM-6, DEC-2, NFR-8).
 *
 * The dispatch admission arm lands with the watch composition in plan phase 3;
 * this phase pins the configuration refusal at the resolver boundary.
 */
import { describe, expect, test } from "bun:test";
import { resolveConfig, resolveLaneSettings } from "../../packages/core/src/index";
import { DISPATCH_DISABLE_PEAK_PAUSING_KEY } from "../../packages/core/src/contracts/index";
import { laneSource } from "../fixtures/config/lane";

const resolveLane = (lane: unknown) => {
  const resolved = resolveConfig({ sources: [laneSource(lane as never)] });
  if (!resolved.ok) return { ok: false as const, error: resolved.error };
  const settings = resolveLaneSettings(resolved.value.values, resolved.value.origins);
  return settings.ok ? { ok: true as const, lane: settings.value } : { ok: false as const, error: settings.error };
};

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

  test("the refusal reuses the delivered configuration identity, adding no error row", () => {
    const resolved = resolveLane({
      "liveness-interval": 30000,
      "restart-budget": 3,
      "disable-peak-pausing": "yes",
    });
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error.code).not.toBe("dispatch.resume-parked");
  });
});
