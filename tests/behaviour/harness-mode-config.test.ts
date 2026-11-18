/**
 * TC-HARNESS-009 — mode origin and unknown-value refusal (M-04).
 *
 * The mode is a declared value with an observable origin; an unknown value is
 * refused rather than defaulted; ambient state cannot select a mode.
 */
import { describe, expect, test } from "bun:test";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import { defaultsFor } from "../../packages/core/src/config/defaults";
import { resolveHarnessSettings } from "../../packages/core/src/config/harness";
import {
  type ConfigNodeOrigins,
  type ConfigValue,
  DEFAULT_HARNESS_MODE,
  HARNESS_MODE_SURFACES,
  HARNESS_MODES,
} from "../../packages/core/src/contracts/index";
import { resolveHarnessMode } from "../../packages/core/src/domain/index";
import { MODE_AMBIENT_CANARY, MODE_FIXTURES } from "../fixtures/harness/mode";

const valuesWith = (mode: unknown): Record<string, ConfigValue> => {
  const values = defaultsFor(PRODUCTION_CATALOG) as unknown as Record<string, ConfigValue>;
  const harness = { ...(values.harness as Record<string, unknown>) };
  if (mode === undefined) delete harness.mode;
  else harness.mode = mode;
  values.harness = harness as ConfigValue;
  return values;
};

const CONFIGURED_ORIGINS: ConfigNodeOrigins = {
  "harness.mode": { layer: "file", file: "config.yaml", line: 3 },
};

describe("TC-HARNESS-009 mode origin and refusal", () => {
  test("each configuration shape resolves as declared", () => {
    for (const fixture of MODE_FIXTURES) {
      const values = valuesWith(fixture.declared);
      const origins = fixture.configured ? CONFIGURED_ORIGINS : {};
      const resolved = resolveHarnessSettings(values, origins);
      if (fixture.expected === "config.value.invalid") {
        expect(resolved.ok, fixture.id).toBe(false);
        if (!resolved.ok) {
          expect(resolved.error.code, fixture.id).toBe("config.value.invalid");
          expect(resolved.error.key, fixture.id).toBe("harness.mode");
        }
        continue;
      }
      expect(resolved.ok, fixture.id).toBe(true);
      if (resolved.ok) {
        expect(resolved.value.mode, fixture.id).toBe(DEFAULT_HARNESS_MODE);
        expect(resolved.value.modeOrigin, fixture.id).toBe(fixture.expected);
      }
    }
  });

  test("the vocabulary is exactly the three observed surfaces, each with a declared surface", () => {
    expect(HARNESS_MODES).toHaveLength(3);
    for (const mode of HARNESS_MODES) {
      expect(Object.hasOwn(HARNESS_MODE_SURFACES, mode), mode).toBe(true);
      expect(HARNESS_MODE_SURFACES[mode].length).toBeGreaterThan(0);
    }
    expect(Object.keys(HARNESS_MODE_SURFACES).sort()).toEqual([...HARNESS_MODES].sort());
  });

  test("ambient state cannot select a mode", () => {
    const previous = process.env[MODE_AMBIENT_CANARY.variable];
    process.env[MODE_AMBIENT_CANARY.variable] = MODE_AMBIENT_CANARY.value;
    try {
      const resolved = resolveHarnessSettings(valuesWith(undefined));
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.value.mode).toBe(DEFAULT_HARNESS_MODE);
        expect(resolved.value.modeOrigin).toBe("defaults");
      }
      const direct = resolveHarnessMode({ declared: undefined });
      expect(direct.ok).toBe(true);
      if (direct.ok) expect(direct.mode).toBe(DEFAULT_HARNESS_MODE);
    } finally {
      if (previous === undefined) delete process.env[MODE_AMBIENT_CANARY.variable];
      else process.env[MODE_AMBIENT_CANARY.variable] = previous;
    }
  });

  test("an unknown or unavailable mode classifies without defaulting", () => {
    const unknown = resolveHarnessMode({ declared: "daemon" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.code).toBe("config.value.invalid");
      expect(unknown.field).toBe("harness.mode");
      expect(unknown.summary).not.toContain(DEFAULT_HARNESS_MODE);
    }
    const empty = resolveHarnessMode({ declared: "" });
    expect(empty.ok).toBe(false);
  });
});
