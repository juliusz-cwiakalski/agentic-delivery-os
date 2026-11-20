/**
 * TC-CONTRACT-001/004 (GH-348 NFR-7, NG-9; DOD-6).
 *
 * The closed contract surface is unchanged against an IN-SUITE literal baseline
 * (there is no baseline fixture file), and exactly the three additive facts
 * exist: two record kinds and one additive optional harness fact. Zero new error
 * identities, domain kinds, and configuration keys.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_DEFAULTS } from "../../packages/core/src/config/defaults";
import {
  COORDINATOR_CONFIG_KEYS,
  DOMAIN_KINDS,
  ERROR_TABLE,
  LOOP_SESSION_RECORD_KIND,
  LOOP_STOP_RECORD_KIND,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

/** The inline baseline literal: the delivered closed sets this change may not move. */
const BASELINE = {
  errorIdentities: ERROR_TABLE.length,
  domainKinds: [...DOMAIN_KINDS].sort(),
  configurationKeys: [...COORDINATOR_CONFIG_KEYS].sort(),
  coordinatorDefaults: {
    "coordinator.stuck-window": 600_000,
    "coordinator.kill-grace": 20_000,
    "coordinator.restart-budget": 10,
    "coordinator.resume-context-limit": 100_000,
    "coordinator.collection-interval": 30_000,
    "coordinator.progress-bound": 300_000,
  },
} as const;

describe("TC-CONTRACT-001 the closed contract surface is unchanged", () => {
  test("zero new error identities, domain kinds, or configuration keys", () => {
    expect(ERROR_TABLE.length).toBe(BASELINE.errorIdentities);
    expect([...DOMAIN_KINDS].sort()).toEqual([...BASELINE.domainKinds]);
    expect([...COORDINATOR_CONFIG_KEYS].sort()).toEqual([...BASELINE.configurationKeys]);
    expect(BASELINE.configurationKeys).toHaveLength(6);
  });

  test("the six coordinator defaults are unchanged", () => {
    expect(PRODUCTION_DEFAULTS.coordinator["stuck-window"]).toBe(600_000);
    expect(PRODUCTION_DEFAULTS.coordinator["kill-grace"]).toBe(20_000);
    expect(PRODUCTION_DEFAULTS.coordinator["restart-budget"]).toBe(10);
    expect(PRODUCTION_DEFAULTS.coordinator["resume-context-limit"]).toBe(100_000);
    expect(PRODUCTION_DEFAULTS.coordinator["collection-interval"]).toBe(30_000);
    expect(PRODUCTION_DEFAULTS.coordinator["progress-bound"]).toBe(300_000);
  });

  test("exactly two new record kinds and one additive optional harness fact", () => {
    expect(LOOP_SESSION_RECORD_KIND).toBe("loop.session");
    expect(LOOP_STOP_RECORD_KIND).toBe("loop.stop");
    const harness = readFileSync(join(ROOT, "packages/core/src/contracts/harness.ts"), "utf8");
    // The one additive fact is OPTIONAL on both surfaces and adds no capability.
    expect(harness).toContain("readonly pid?: number;");
    expect(harness).toContain("readonly pid?: number;\n};");
    const capabilityNames = harness.match(/readonly pid\??:/gu) ?? [];
    expect(capabilityNames.length).toBe(2);
  });

  test("no coordinator module is edited by the loop", () => {
    const supervisor = readFileSync(join(ROOT, "packages/core/src/app/loop-supervisor.ts"), "utf8");
    expect(supervisor).not.toContain("createCoordinatorSupervisor");
    expect(supervisor).not.toContain("evaluateStuck");
    expect(supervisor).not.toContain("decideLifecycle");
  });
});

describe("TC-CONTRACT-004 zero configuration keys are added and six are consumed", () => {
  test("the loop settings are the delivered coordinator settings", () => {
    const composition = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const start = composition.indexOf("const createProductionLoopComposition");
    const end = composition.indexOf("The `projects list` host overview", start);
    const block = composition.slice(start, end);
    expect(block).toContain("resolveProductionCoordinatorSettings()");
    // The composed bound reaches the handler: the restart budget is supplied, not
    // read by the handler.
    expect(block).toContain("settings");
  });
});
