/**
 * TC-COORD-086 — identical facts render byte-identical data and text with no
 * ambient inputs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createCoordinatorHarness } from "../fixtures/coordinator/harness";

const ROOT = process.cwd();

const coordinatorSources = (): string[] => {
  const files: string[] = [];
  for (const tier of [
    "packages/core/src/domain",
    "packages/core/src/state",
    "packages/cli/src/commands",
    "packages/cli/src/output",
  ]) {
    for (const entry of readdirSync(join(ROOT, tier))) {
      if (entry.startsWith("coordinator") && entry.endsWith(".ts")) files.push(`${tier}/${entry}`);
    }
  }
  return files;
};

describe("TC-COORD-086 identical facts render identical bytes", () => {
  test("two identical roots produce byte-identical data and text", async () => {
    const first = createCoordinatorHarness({
      label: "determinism-a",
      session: { liveness: "alive" },
    });
    const second = createCoordinatorHarness({
      label: "determinism-b",
      session: { liveness: "alive" },
    });
    const firstJson = await first.run(["coordinator", "tick", "--json"]);
    const secondJson = await second.run(["coordinator", "tick", "--json"]);
    const normalize = (text: string): string =>
      text.split(first.root).join("<root>").split(second.root).join("<root>");
    expect(normalize(firstJson.stdout)).toBe(normalize(secondJson.stdout));
    const firstText = await first.run(["coordinator", "tick"]);
    const secondText = await second.run(["coordinator", "tick"]);
    expect(firstText.stdout).toBe(secondText.stdout);
  });

  test("a fresh instance and a reopened store agree", async () => {
    const harness = createCoordinatorHarness({ label: "determinism-reopen" });
    const first = await harness.run(["coordinator", "status", "--json"]);
    const second = await harness.run(["coordinator", "status", "--json"]);
    expect(first.stdout).toBe(second.stdout);
  });

  test("no coordinator source reads an ambient clock, randomness, or environment", () => {
    const violations: string[] = [];
    for (const file of coordinatorSources()) {
      const text = readFileSync(join(ROOT, file), "utf8");
      if (file.includes("/commands/") || file.includes("/output/")) continue;
      for (const marker of ["Date.now", "Math.random", "process.env", "performance.now"]) {
        if (text.includes(marker)) violations.push(`${file}: ${marker}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("the deterministic paths make no model call", () => {
    for (const file of coordinatorSources()) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const marker of ["@delivery-os/adapters/inference", "inference.", "model("]) {
        expect(text.includes(marker), `${file} must not call a model`).toBe(false);
      }
    }
  });
});
