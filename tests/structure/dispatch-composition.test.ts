/**
 * TC-MERGE-004 (phase 4) — the production dispatch composition exposes only the
 * declared dispatch ports: no merge executor, merge port, or merge invocation is
 * present, and a source-level merge import fails the structural check.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const ROOT = process.cwd();

describe("TC-MERGE-004 the production composition has no reachable merge port", () => {
  test("the composition type declares no merge member", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    const start = source.indexOf("export type DispatchComposition = {");
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf("};", start);
    const block = source.slice(start, end);
    expect(block.length).toBeGreaterThan(0);
    expect(block.toLowerCase().includes("merge")).toBe(false);
    for (const expected of [
      "harnesses",
      "descriptor",
      "readTruth",
      "claimLease",
      "releaseLease",
      "evidenceClass",
    ]) {
      expect(block).toContain(expected);
    }
  });

  test("the runtime declares only the run surface and fires no merge", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      expect(Object.keys(scenario.runtime)).toEqual(["run"]);
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(scenario.calls.merge).toBe(0);
      expect(Object.keys(run.envelope?.data ?? {})).not.toContain("merge");
    } finally {
      scenario.dispose();
    }
  });

  test("a source-level merge import added to the composition would be caught by the boundary rule", () => {
    const config = readFileSync(join(ROOT, ".dependency-cruiser.cjs"), "utf8");
    const rule = config.slice(config.indexOf('name: "dispatch-merge-absence"'));
    expect(rule).toContain("cli/src/commands/merge");
    expect(rule).toContain("domain/merge-");
  });
});
