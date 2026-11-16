/**
 * TC-CEREMONY-057 — the delivered surfaces stay unchanged and the excluded
 * surfaces are absent: the retro pipeline's grammar and registry status, the
 * closeout steps, the plan tier contract, and the measurement values are
 * untouched; no metrics, action registry, pack, scheduler, event topic, or MCP
 * ceremony surface was delivered.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLOSEOUT_STEP_IDS,
  ERROR_TABLE,
  PLAN_KNOWN_TIERS,
  RETRO_LEVELS,
  RETRO_IMPLEMENTED_LEVELS,
} from "../../packages/core/src/contracts/index";
import { readCommittedLog } from "../fixtures/ceremony/comparison/baseline";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-CEREMONY-057 delivered surfaces are unchanged", () => {
  test("the retro pipeline keeps its change-only grammar and level statuses", () => {
    expect([...RETRO_IMPLEMENTED_LEVELS]).toEqual(["change"]);
    expect(RETRO_LEVELS.map((level) => [level.name, level.status])).toEqual([
      ["change", "implemented"],
      ["session", "declared"],
      ["incident", "declared"],
      ["window", "declared"],
      ["project", "declared"],
      ["fleet", "declared"],
    ]);
    const retroCommand = read("packages/cli/src/commands/retro.ts");
    expect(retroCommand).not.toContain("ceremony");
    expect(retroCommand).toContain("RETRO_IMPLEMENTED_LEVELS");
  });

  test("the closeout transaction keeps its twelve declared steps", () => {
    expect([...CLOSEOUT_STEP_IDS]).toHaveLength(12);
    expect(read("packages/core/src/domain/closeout.ts")).not.toContain("ceremony");
  });

  test("the plan tier contract and the committed metric values are unchanged", () => {
    expect([...PLAN_KNOWN_TIERS]).toEqual(["full", "lite"]);
    const log = readCommittedLog();
    const row = log.metrics.find((metric) => metric.id === "MET-CEREMONY-SHARE");
    expect(row?.value).toBe(0.406648);
    expect(row?.status).toBe("PARTIAL");
    expect(log.comparisons).toHaveLength(1);
    expect(log.metrics.filter((metric) => metric.id === "MET-CEREMONY-SHARE")).toHaveLength(1);
  });

  test("the error table grew by exactly the two ceremony rows", () => {
    expect(ERROR_TABLE.filter((entry) => entry.domainKind === "ceremony")).toHaveLength(2);
    expect(ERROR_TABLE).toHaveLength(138);
  });

  test("the brief command and its render contract are untouched by ceremony", () => {
    expect(read("packages/cli/src/commands/brief.ts")).not.toContain("ceremony");
    expect(read("packages/core/src/contracts/brief.ts")).not.toContain("ceremony");
  });
});

describe("TC-CEREMONY-057 excluded surfaces are absent", () => {
  test("no metrics command, action registry, pack, scheduler, or MCP ceremony surface exists", () => {
    expect(existsSync(join(ROOT, "packages/cli/src/commands/metrics.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "packages/core/src/domain/retro-actions.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "packages/core/src/domain/ceremony-pack.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "packages/core/src/domain/ceremony-scheduler.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "packages/mcp/src/ceremony.ts"))).toBe(false);
    expect(read("packages/core/src/contracts/taxonomy.ts")).not.toContain("ceremony");
  });

  test("no event topic or MCP tool names a ceremony", () => {
    const taxonomy = read("packages/core/src/contracts/taxonomy.ts");
    expect(taxonomy).not.toContain("ceremony");
    const mcpFiles = read("packages/mcp/src/index.ts");
    expect(mcpFiles).not.toContain("ceremony");
  });
});
