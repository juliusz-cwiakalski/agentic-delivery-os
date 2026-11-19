/**
 * TC-SUP-096 — supervise is the twenty-fifth prompt-required family, composed
 * unconditionally and advertised, with every family-count pin moved in the same
 * commit and no stale pin left (GH-295 AC-F1-1, F-1; test plan §4.3 mounting).
 *
 * GH-299 landed `metrics` as the twenty-fourth family first, so the merged
 * mounted set is the captured 23-entry base plus `metrics` and `supervise`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { allHelpEntries, helpEntryFor, renderRootHelp } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import {
  createProductionProjectsHarness,
  makeBaseDirectory,
  removeDirectoryTree,
} from "../fixtures/projects/production";
import { createRepository } from "../fixtures/projects/temp-repos";
import { BASE_FAMILIES, MOUNTED_FAMILIES } from "../fixtures/supervise/mounting";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

const PINNING_FILES = [
  "tests/structure/entrypoint-bin.test.ts",
  "tests/structure/board-mounting.test.ts",
  "tests/structure/events-production-composition.test.ts",
  "tests/structure/dispatch-attempts-composition.test.ts",
  "tests/structure/daemon-production-composition.test.ts",
  "tests/structure/steer-mounting.test.ts",
  "tests/structure/metrics-mounting.test.ts",
  "tests/behaviour/repos-help.test.ts",
  "tests/behaviour/board-help.test.ts",
  "tests/behaviour/events-mount-help.test.ts",
  "tests/behaviour/entrypoint-two-bins.test.ts",
  "tests/behaviour/ceremony-cli.test.ts",
] as const;

const familyLines = (help: string): readonly string[] =>
  help.split("\n").filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line));

describe("TC-SUP-096 supervise is the twenty-fifth prompt-required family", () => {
  test("the mounted set is the captured 23-entry base plus metrics, supervise, install, and provider, count 27", () => {
    expect(BASE_FAMILIES).toHaveLength(23);
    expect(MOUNTED_FAMILIES).toEqual([
      ...BASE_FAMILIES,
      "metrics",
      "supervise",
      "install",
      "provider",
    ]);
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([...MOUNTED_FAMILIES]);
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(27);
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "supervise")).toHaveLength(1);
    expect(PROMPT_REQUIRED_COMMANDS.at(-4)).toBe("metrics");
    expect(PROMPT_REQUIRED_COMMANDS.at(-3)).toBe("supervise");
    expect(PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("install");
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("provider");
  });

  test("root --help lists install at the penultimate family line among 27 families, with provider last and supervise still the twenty-fifth", () => {
    const help = renderRootHelp(SYNTHETIC_BRAND);
    const families = familyLines(help);
    expect(families).toHaveLength(27);
    expect(families.at(-3)?.trimStart().startsWith("supervise  ")).toBe(true);
    expect(families.at(-2)?.trimStart().startsWith("install  ")).toBe(true);
    expect(families.at(-1)?.trimStart().startsWith("provider  ")).toBe(true);
    for (const family of BASE_FAMILIES) {
      expect(families.some((line) => line.trimStart().startsWith(`${family}  `))).toBe(true);
    }
  });

  test("every family-count pin reads 27 and no stale 23, 24, 25, or 26 remains", () => {
    const failures: string[] = [];
    for (const file of PINNING_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      // The captured base constants live in the mounting fixtures, not a pin file.
      const withoutMountingFixture = text
        .split("\n")
        .filter((line) => !line.includes("BASE_FAMILIES") && !line.includes("MOUNTED_FAMILIES"))
        .join("\n");
      if (/toHaveLength\(2[3456]\)/u.test(withoutMountingFixture)) {
        failures.push(`${file}: stale family-count pin 23, 24, 25, or 26`);
      }
      if (!/toHaveLength\(27\)|\.toBe\(\s*27\s*,?\s*\)/su.test(text)) {
        failures.push(`${file}: no family-count pin 27`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the production composer produces a supervise handler that answers over an empty store", async () => {
    const base = makeBaseDirectory("supervise-mounting");
    const checkout = createRepository(base, "mounting-checkout");
    mkdirSync(join(checkout, ".ai/local"), { recursive: true });
    const harness = createProductionProjectsHarness({
      label: "supervise-mounting",
      workingDirectory: checkout,
    });
    try {
      const run = await harness.run(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = run.envelope?.data as Record<string, unknown> | undefined;
      expect(data?.schemaVersion).toBe("delivery.supervision.v1");
      expect(data?.lanes).toEqual([]);
      expect(data?.supervisors).toEqual([]);
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("TC-SUP-096 the mount changes no other family", () => {
  test("every delivered family keeps its help entry and order, with supervise appended", () => {
    for (const family of MOUNTED_FAMILIES) {
      expect(helpEntryFor([family])).toBeDefined();
    }
    const families = allHelpEntries()
      .filter((entry) => entry.path.length === 1)
      .map((entry) => entry.path[0]);
    expect([...families].sort()).toEqual([...MOUNTED_FAMILIES].sort());
    expect(families.at(-1)).toBe("provider");
  });

  test("the delivered families' help text carries no supervision line", () => {
    for (const entry of allHelpEntries()) {
      if (entry.path[0] === "supervise") continue;
      const text = JSON.stringify(entry);
      expect(text).not.toContain("supervisor battery");
    }
  });
});
