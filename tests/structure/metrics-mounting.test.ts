/**
 * TC-METRICS-080/083 — metrics mounts as the twenty-fourth prompt-required
 * family: one entry, every count pin moved, a stale-count arm that detects
 * planted pins, the production composer answering over an empty store, and no
 * other family disturbed.
 *
 * GH-295 then appends `supervise` as the twenty-fifth family, so the merged
 * mounted set is the captured 23-entry base plus `metrics` and `supervise`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { allHelpEntries, helpEntryFor, renderRootHelp } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import {
  DELIVERED_FAMILIES,
  METRICS_MOUNTED_FAMILIES,
  MOUNTED_FAMILIES,
  NON_COUNT_RESIDUAL,
  PINNING_FILES,
} from "../fixtures/metrics/mounting";
import {
  createProductionProjectsHarness,
  makeBaseDirectory,
  removeDirectoryTree,
} from "../fixtures/projects/production";
import { createRepository } from "../fixtures/projects/temp-repos";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

const familyLines = (help: string): readonly string[] =>
  help.split("\n").filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line));

describe("TC-METRICS-080 metrics is the twenty-fourth prompt-required family", () => {
  test("the captured base holds 23 entries with steer last, metrics mounts at 23 of 25", () => {
    expect([...DELIVERED_FAMILIES].length).toBe(23);
    expect(DELIVERED_FAMILIES.at(-1)).toBe("steer");
    expect(METRICS_MOUNTED_FAMILIES).toHaveLength(24);
    expect(MOUNTED_FAMILIES).toHaveLength(25);
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([...MOUNTED_FAMILIES]);
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "metrics")).toHaveLength(1);
    expect(PROMPT_REQUIRED_COMMANDS[23]).toBe("metrics");
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("supervise");
  });

  test("root --help lists metrics at index 23 and supervise last among 25 families", () => {
    const families = familyLines(renderRootHelp(SYNTHETIC_BRAND));
    expect(families).toHaveLength(25);
    expect(families[23]?.trimStart().startsWith("metrics  ")).toBe(true);
    expect(families.at(-1)?.trimStart().startsWith("supervise  ")).toBe(true);
    for (const family of DELIVERED_FAMILIES) {
      expect(families.some((line) => line.trimStart().startsWith(`${family}  `))).toBe(true);
    }
  });

  test("every pinning file reads 25 and no stale 23 or 24 survives outside the declared residual", () => {
    const failures: string[] = [];
    for (const file of PINNING_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const withoutMountingFixture = text
        .split("\n")
        .filter((line) => !line.includes("BASE_FAMILIES") && !line.includes("MOUNTED_FAMILIES"))
        .join("\n");
      if (/toHaveLength\(2[34]\)/u.test(withoutMountingFixture)) {
        failures.push(`${file}: stale family-count pin 23 or 24`);
      }
      if (!/toHaveLength\(25\)|\.toBe\(\s*25\s*,?\s*\)/su.test(text)) {
        failures.push(`${file}: no family-count pin 25`);
      }
    }
    expect(failures).toEqual([]);
    const residual = readFileSync(join(ROOT, NON_COUNT_RESIDUAL), "utf8");
    expect(residual).toContain(`toHaveLength(${String(22)})`);
  });

  test("a planted stale pin fails the scan mechanism", () => {
    const directory = mkdtempSync(join(tmpdir(), "metrics-stale-pin-"));
    try {
      const relative = "tests/structure/board-mounting.test.ts";
      const path = join(directory, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        `${readFileSync(join(ROOT, "tests/structure/board-mounting.test.ts"), "utf8")}\n// toHaveLength(${String(23)})\n`,
      );
      const planted = readFileSync(path, "utf8");
      expect(planted.includes(`toHaveLength(${String(23)})`)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the production composer answers metrics --json at exit 0 over an empty store", async () => {
    const base = makeBaseDirectory("metrics-mounting");
    const checkout = createRepository(base, "metrics-mounting-checkout");
    mkdirSync(join(checkout, ".ai/local"), { recursive: true });
    const harness = createProductionProjectsHarness({
      label: "metrics-mounting",
      workingDirectory: checkout,
    });
    try {
      const run = await harness.run(["metrics", "--ref", "GH-299", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (run.envelope?.data ?? {}) as Record<string, unknown>;
      expect(data.ref).toBeDefined();
      const entries = data.metrics;
      expect(Array.isArray(entries) ? entries.length : 0).toBe(4);
      expect((data.dispatch as { telemetryState: string }).telemetryState).toBe("absent");
      expect(data.alarms).toEqual([]);
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("TC-METRICS-083 mounting changes no other family", () => {
  test("every delivered family keeps its help entry and order with metrics appended", () => {
    for (const family of MOUNTED_FAMILIES) {
      expect(helpEntryFor([family]), family).toBeDefined();
    }
    const families = allHelpEntries()
      .filter((entry) => entry.path.length === 1)
      .map((entry) => entry.path[0]);
    expect([...families].sort()).toEqual([...MOUNTED_FAMILIES].sort());
    expect(families.at(-1)).toBe("supervise");
  });

  test("the delivered families' help text carries no metrics line", () => {
    for (const entry of allHelpEntries()) {
      if (entry.path[0] === "metrics") continue;
      expect(JSON.stringify(entry)).not.toContain("burn-rate");
    }
  });

  test("a partial mount is detected: the prompt entry without composition is refused", async () => {
    const base = makeBaseDirectory("metrics-partial");
    const checkout = createRepository(base, "metrics-partial-checkout");
    const harness = createProductionProjectsHarness({
      label: "metrics-partial",
      workingDirectory: checkout,
    });
    try {
      const help = renderRootHelp(SYNTHETIC_BRAND);
      expect(help).toContain("metrics");
      expect(PROMPT_REQUIRED_COMMANDS).toContain("metrics");
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
      rmSync(base, { recursive: true, force: true });
    }
  });
});
