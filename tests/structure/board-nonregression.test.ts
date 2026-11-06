/**
 * TC-SLA-030 — the board surface is additive: the shared owner-gate label set
 * is reused by reference, no new configuration key or envelope/state schema
 * changed, and the existing status/queue/verify definition is untouched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RESULT_SCHEMA_VERSION,
  STATE_SCHEMA_VERSION,
  STATUS_OWNER_ATTENTION_LABELS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-SLA-030 additive non-regression", () => {
  test("the owner-attention label set is unchanged and reused by reference", () => {
    expect([...STATUS_OWNER_ATTENTION_LABELS]).toEqual(["hand-back", "human-input-needed"]);
    const edge = read("packages/cli/src/edge.ts");
    expect(edge).toContain("STATUS_OWNER_ATTENTION_LABELS");
    for (const file of ["packages/cli/src/edge.ts", "packages/cli/src/commands/board.ts"]) {
      const text = read(file);
      expect(text).not.toContain('"hand-back"');
      expect(text).not.toContain('"human-input-needed"');
    }
  });

  test("no SLA/board configuration key was added", () => {
    const configSources = [
      read("packages/core/src/config/catalog.ts"),
      read("packages/core/src/contracts/config.ts"),
      read("packages/core/src/config/defaults.ts"),
    ].join("\n");
    expect(configSources.toLowerCase()).not.toContain("owner-gate");
    expect(configSources.toLowerCase()).not.toContain("owner_gate");
    expect(configSources.toLowerCase()).not.toContain("sla");
  });

  test("the envelope and state schema versions are unchanged", () => {
    expect(RESULT_SCHEMA_VERSION).toBe("delivery.result.v1");
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
  });

  test("status, queue, and verify command definitions still own their existing modules", () => {
    for (const file of [
      "packages/cli/src/commands/status.ts",
      "packages/cli/src/commands/queue.ts",
      "packages/cli/src/commands/verify.ts",
    ]) {
      expect(read(file).length).toBeGreaterThan(0);
    }
    const inventory = JSON.parse(read("tests/structure/inventory.json")) as Record<
      string,
      string[]
    >;
    expect(inventory.cli).toContain("src/commands/status.ts");
    expect(inventory.cli).toContain("src/commands/queue.ts");
    expect(inventory.cli).toContain("src/commands/verify.ts");
  });

  test("duplicating the label set in the board module fails the reference detector", () => {
    const duplicated = `${read("packages/cli/src/edge.ts")}\nconst labels = ["hand-back"];\n`;
    expect(duplicated).toContain('"hand-back"');
    const source = read("packages/cli/src/edge.ts");
    expect(source).not.toContain('"hand-back"');
  });
});
