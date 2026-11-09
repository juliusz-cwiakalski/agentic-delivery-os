/**
 * TC-COORD-080 — the six coordinator config keys own their defaults and domains;
 * invalid input reuses the delivered configuration identities.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCTION_CATALOG,
  resolveConfig,
  resolveCoordinatorSettings,
} from "../../packages/core/src/index";
import {
  BOUNDARY_SOURCE,
  coordinatorSource,
  INVALID_COORDINATOR_CASES,
  VALID_COORDINATOR_SOURCE,
  ZERO_BUDGET_SOURCE,
} from "../fixtures/config/coordinator";

const ROOT = process.cwd();

const resolveCoordinator = (input?: Parameters<typeof resolveConfig>[0]) => {
  const resolved = resolveConfig(input);
  if (!resolved.ok) return { ok: false as const, error: resolved.error };
  const coordinator = resolveCoordinatorSettings(resolved.value.values, resolved.value.origins);
  return coordinator.ok
    ? {
        ok: true as const,
        coordinator: coordinator.value,
        origins: resolved.value.origins,
        values: resolved.value.values,
      }
    : { ok: false as const, error: coordinator.error };
};

describe("TC-COORD-080 the coordinator keys own defaults and domains", () => {
  test("an absent branch resolves the six declared defaults with defaults origins", () => {
    const resolved = resolveCoordinator();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.coordinator).toEqual({
      stuckWindowMs: 600_000,
      killGraceMs: 20_000,
      restartBudget: 10,
      resumeContextLimit: 100_000,
      collectionIntervalMs: 30_000,
      progressBoundMs: 300_000,
    });
    for (const key of [
      "coordinator.stuck-window",
      "coordinator.kill-grace",
      "coordinator.restart-budget",
      "coordinator.resume-context-limit",
      "coordinator.collection-interval",
      "coordinator.progress-bound",
    ]) {
      expect(resolved.origins[key], key).toMatchObject({ layer: "defaults" });
    }
  });

  test("explicit values resolve with their source origins", () => {
    const resolved = resolveCoordinator({ sources: [VALID_COORDINATOR_SOURCE] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.coordinator).toEqual({
      stuckWindowMs: 120_000,
      killGraceMs: 5_000,
      restartBudget: 4,
      resumeContextLimit: 50_000,
      collectionIntervalMs: 15_000,
      progressBoundMs: 60_000,
    });
    expect(resolved.origins["coordinator.stuck-window"]).toMatchObject({
      layer: "project-committed",
    });
  });

  test("the boundary values are legal", () => {
    const resolved = resolveCoordinator({ sources: [BOUNDARY_SOURCE] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.coordinator.stuckWindowMs).toBe(1);
    expect(resolved.coordinator.restartBudget).toBe(0);
    expect(resolved.coordinator.progressBoundMs).toBe(1);
  });

  test("every invalid case reuses the delivered identity and names the key", () => {
    for (const invalid of INVALID_COORDINATOR_CASES) {
      const resolved = resolveCoordinator({ sources: [coordinatorSource(invalid.coordinator)] });
      expect(resolved.ok, invalid.id).toBe(false);
      if (resolved.ok) continue;
      expect(resolved.error.code, invalid.id).toBe(invalid.code);
      expect(resolved.error.key, invalid.id).toBe(invalid.key);
    }
  });

  test("the branch declares exactly six keys and no cross-key alias", () => {
    expect(PRODUCTION_CATALOG.coordinator.type).toBe("object");
    const branch = PRODUCTION_CATALOG.coordinator;
    if (branch.type !== "object") throw new Error("coordinator branch must be an object");
    expect(Object.keys(branch.fields).sort()).toEqual([
      "collection-interval",
      "kill-grace",
      "progress-bound",
      "restart-budget",
      "resume-context-limit",
      "stuck-window",
    ]);
    const defaults = readFileSync(join(ROOT, "packages/core/src/config/defaults.ts"), "utf8");
    const coordinatorDefaults = defaults.slice(
      defaults.indexOf("coordinator: {"),
      defaults.indexOf("daemon: {"),
    );
    for (const alias of ["lane.restart-budget", "lane.liveness-interval", "heartbeat-cycle"]) {
      expect(coordinatorDefaults).not.toContain(alias);
    }
  });

  test("zero budget is a valid admit-no-restarts policy", () => {
    const resolved = resolveCoordinator({ sources: [ZERO_BUDGET_SOURCE] });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.coordinator.restartBudget).toBe(0);
  });

  test("no decision module carries a default or bound literal", () => {
    for (const file of [
      "packages/core/src/domain/coordinator-lifecycle.ts",
      "packages/core/src/domain/coordinator-evidence.ts",
      "packages/core/src/domain/coordinator-admission.ts",
      "packages/core/src/domain/coordinator-fence.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const literal of ["600_000", "600000", "20_000", "20000", "100_000", "100000", "300_000", "300000"]) {
        expect(text.includes(literal), `${file} must not hardcode ${literal}`).toBe(false);
      }
    }
  });
});
