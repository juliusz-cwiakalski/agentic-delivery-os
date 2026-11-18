/**
 * TC-HARNESS-004 / TC-HARNESS-005 — the version verdict matrix and the
 * pinned-data window (V-01..V-15).
 *
 * The table is data (tests/fixtures/harness/version.ts); this suite iterates it
 * so parse acceptance and rejection cannot drift apart. The window is pinned
 * data: no configuration value widens or narrows acceptance.
 */
import { describe, expect, test } from "bun:test";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import { defaultsFor } from "../../packages/core/src/config/defaults";
import { resolveHarnessSettings } from "../../packages/core/src/config/harness";
import type { ConfigValue } from "../../packages/core/src/contracts/index";
import {
  evaluateHarnessVersion,
  harnessVersionInWindow,
  normalizeHarnessVersion,
} from "../../packages/core/src/domain/index";
import { VERSION_TABLE } from "../fixtures/harness/version";

const identityOf = (requirement: string): string | undefined => {
  if (requirement === "refuse-unsupported") return "harness.version.unsupported";
  if (requirement === "refuse-unknown") return "harness.version.unknown";
  return undefined;
};

describe("TC-HARNESS-004 version verdict matrix", () => {
  test("every table row normalizes, classifies, and projects exactly as declared", () => {
    expect(VERSION_TABLE.length).toBeGreaterThan(0);
    for (const row of VERSION_TABLE) {
      const evaluation = evaluateHarnessVersion(row.raw);
      const normalized = normalizeHarnessVersion(row.raw);
      expect(normalized, row.id).toBe(row.normalized ?? undefined);
      expect(evaluation.verdict, row.id).toBe(row.verdict);
      expect(evaluation.observedVersion, row.id).toBe(row.normalized);
      expect(identityOf(evaluation.requirement), row.id).toBe(row.identity ?? undefined);
      expect(evaluation.requirement === "proceed" ? 0 : 1, row.id).toBe(row.exit);
    }
  });

  test("both minor lines and both immediate outsides are represented", () => {
    const raw = VERSION_TABLE.map((row) => row.raw);
    for (const inside of ["opencode v2.3.0", "opencode v2.3.2", "opencode v2.2.5"]) {
      expect(raw).toContain(inside);
      expect(evaluateHarnessVersion(inside).verdict).toBe("inside");
    }
    for (const outside of ["opencode v2.1.7", "opencode v2.4.0"]) {
      expect(raw).toContain(outside);
      expect(evaluateHarnessVersion(outside).verdict).toBe("outside");
    }
  });

  test("prefix-shaped near-misses parse but are outside, never inside by prefix", () => {
    for (const near of ["opencode v2.20.0", "opencode v12.2.5"]) {
      const evaluation = evaluateHarnessVersion(near);
      expect(evaluation.verdict, near).toBe("outside");
      expect(evaluation.observedVersion, near).toBe(near.split("v")[1]);
      expect(evaluation.requirement).toBe("refuse-unsupported");
    }
  });

  test("the stamped version is never the raw line and never carries a v prefix", () => {
    for (const row of VERSION_TABLE.filter((entry) => entry.normalized !== null)) {
      const evaluation = evaluateHarnessVersion(row.raw);
      const stamped = evaluation.observedVersion;
      expect(stamped, row.id).not.toBeNull();
      expect(String(stamped).startsWith("v"), row.id).toBe(false);
      expect(String(stamped), row.id).not.toContain("opencode");
      expect(String(stamped), row.id).not.toContain("\n");
    }
  });
});

describe("TC-HARNESS-005 the window is pinned data", () => {
  const baseValues = (): Record<string, ConfigValue> =>
    defaultsFor(PRODUCTION_CATALOG) as unknown as Record<string, ConfigValue>;

  test("the shipped configuration resolves and the pinned verdicts hold", () => {
    const resolved = resolveHarnessSettings(baseValues());
    expect(resolved.ok).toBe(true);
    expect(evaluateHarnessVersion("opencode v2.3.2").verdict).toBe("inside");
    expect(evaluateHarnessVersion("opencode v2.1.7").verdict).toBe("outside");
  });

  test("an invented window-shaped configuration key changes acceptance in neither direction", () => {
    for (const invented of [
      { window: "2.4" },
      { supportedWindow: ["2.1"], versionWindow: { minors: ["2.1"] } },
    ]) {
      const values = baseValues();
      const harness = values.harness as Record<string, unknown>;
      values.harness = { ...harness, ...invented } as ConfigValue;
      const resolved = resolveHarnessSettings(values);
      // The typed layer either refuses the unknown key upstream or ignores it;
      // either way acceptance is unchanged here.
      expect(evaluateHarnessVersion("opencode v2.3.2").verdict).toBe("inside");
      expect(evaluateHarnessVersion("opencode v2.1.7").verdict).toBe("outside");
      if (resolved.ok) {
        expect(resolved.value.mode).toBe("per-invocation-private-server");
      }
    }
  });

  test("the window comparison reads the window data, not a literal", () => {
    // V-18: widened data flips an out-of-window line.
    expect(evaluateHarnessVersion("opencode v2.4.0").verdict).toBe("outside");
    expect(evaluateHarnessVersion("opencode v2.4.0", ["2.4", "2.3", "2.2"]).verdict).toBe("inside");
    // V-19: unbounded data accepts, while the production constant still refuses.
    expect(evaluateHarnessVersion("opencode v9.9.9", ["9.9"]).verdict).toBe("inside");
    expect(evaluateHarnessVersion("opencode v9.9.9").verdict).toBe("outside");
    expect(harnessVersionInWindow("2.3.2")).toBe(true);
    expect(harnessVersionInWindow("2.4.0")).toBe(false);
    expect(harnessVersionInWindow("9.9.9")).toBe(false);
  });
});
