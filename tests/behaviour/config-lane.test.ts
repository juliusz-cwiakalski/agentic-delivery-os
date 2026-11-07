/**
 * TC-ECON-070 — the lane configuration keys own their defaults and semantics.
 * TC-ECON-071 — invalid lane configuration reuses the existing identities.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCTION_CATALOG,
  resolveConfig,
  resolveLaneSettings,
} from "../../packages/core/src/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import {
  INVALID_LANE_CASES,
  laneSource,
  VALID_LANE_SOURCE,
  ZERO_BUDGET_SOURCE,
} from "../fixtures/config/lane";

const ROOT = process.cwd();

const resolveLane = (sources?: Parameters<typeof resolveConfig>[0]) => {
  const resolved = resolveConfig(sources);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };
  const lane = resolveLaneSettings(resolved.value.values, resolved.value.origins);
  return lane.ok
    ? { ok: true as const, lane: lane.value, origins: resolved.value.origins, values: resolved.value.values }
    : { ok: false as const, error: lane.error };
};

describe("TC-ECON-070 the lane keys own their defaults and semantics", () => {
  test("an absent branch resolves 30000 ms and 3 restarts with defaults origins", () => {
    const resolved = resolveLane();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.lane).toEqual({ livenessIntervalMs: 30000, restartBudget: 3 });
    expect(resolved.origins["lane.liveness-interval"]).toMatchObject({ layer: "defaults" });
    expect(resolved.origins["lane.restart-budget"]).toMatchObject({ layer: "defaults" });
  });

  test("explicit values resolve with their source origins", () => {
    const resolved = resolveLane({ sources: [VALID_LANE_SOURCE] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.lane).toEqual({ livenessIntervalMs: 15000, restartBudget: 5 });
    expect(resolved.origins["lane.liveness-interval"]).toMatchObject({
      layer: "project-committed",
      file: "fixtures/project-committed.yaml",
    });
    expect(resolved.origins["lane.restart-budget"]).toMatchObject({ layer: "project-committed" });
  });

  test("the key paths are the declared spellings with units", () => {
    const resolved = resolveLane();
    if (!resolved.ok) return;
    expect(Object.hasOwn(resolved.values, "lane")).toBe(true);
    const branch = resolved.values.lane as Record<string, unknown>;
    expect(Object.keys(branch).sort()).toEqual(["liveness-interval", "restart-budget"]);
    expect(PRODUCTION_CATALOG.lane.type).toBe("object");
  });

  test("the interval is policy data: no scheduler is started and the module stays pure", () => {
    const resolved = resolveLane();
    if (!resolved.ok) return;
    const policy = { cadenceMs: resolved.lane.livenessIntervalMs };
    expect(policy.cadenceMs).toBe(30000);
    const catalog = readFileSync(join(ROOT, "packages/core/src/config/catalog.ts"), "utf8");
    for (const token of ["setInterval", "setTimeout", "node:timers"]) {
      expect(catalog).not.toContain(token);
    }
  });

  test("each default is declared once in the defaults layer and nowhere else", () => {
    const defaults = readFileSync(join(ROOT, "packages/core/src/config/defaults.ts"), "utf8");
    expect(defaults.match(/"liveness-interval": 30000/g)).toHaveLength(1);
    expect(defaults.match(/"restart-budget": 3/g)).toHaveLength(1);
    const catalog = readFileSync(join(ROOT, "packages/core/src/config/catalog.ts"), "utf8");
    expect(catalog).not.toContain('"liveness-interval": 30000');
    expect(catalog).not.toContain('"restart-budget": 3');
  });

  test("the existing configuration suites' keys keep their values and origins", () => {
    const resolved = resolveLane();
    if (!resolved.ok) return;
    expect(resolved.origins.harness?.layer).toBe("defaults");
    expect(resolved.origins.commit?.layer).toBe("defaults");
    expect(resolved.origins.merge?.layer).toBe("defaults");
  });
});

describe("TC-ECON-071 invalid lane configuration reuses existing identities", () => {
  for (const invalid of INVALID_LANE_CASES) {
    test(`${invalid.id} classifies ${invalid.code}`, () => {
      const resolved = resolveLane({ sources: [laneSource(invalid.lane)] });
      if (resolved.ok) {
        // The semantic layer catches integer-domain violations the schema admits.
        expect(invalid.key).not.toBe("lane");
        return;
      }
      expect(resolved.error.kind).toBe("config");
      expect(resolved.error.code).toBe(invalid.code);
    });
  }

  test("integer-domain invalid values classify at the declared key", () => {
    for (const invalid of INVALID_LANE_CASES.filter((entry) => entry.key.includes("."))) {
      const resolved = resolveLane({ sources: [laneSource(invalid.lane)] });
      expect(resolved.ok, invalid.id).toBe(false);
      if (resolved.ok) continue;
      expect(resolved.error.code, invalid.id).toBe("config.value.invalid");
      expect(resolved.error.key, invalid.id).toBe(invalid.key);
    }
  });

  test("no new configuration identity is added to the error table", () => {
    expect(ERROR_TABLE.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
  });

  test("invalid input never silently falls back to the default", () => {
    const resolved = resolveLane({ sources: [laneSource(INVALID_LANE_CASES[9]!.lane)] });
    expect(resolved.ok).toBe(false);
  });

  test("budget 0 is valid (not in the invalid matrix) and a valid control resolves", () => {
    const zero = resolveLane({ sources: [ZERO_BUDGET_SOURCE] });
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.lane.restartBudget).toBe(0);
    const control = resolveLane({ sources: [VALID_LANE_SOURCE] });
    expect(control.ok).toBe(true);
    if (!control.ok) return;
    expect(control.lane.restartBudget).toBe(5);
    expect(control.lane.livenessIntervalMs).toBe(15000);
  });
});
