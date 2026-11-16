/**
 * TC-STEER-060/063 — steer is the twenty-third prompt-required family, composed
 * unconditionally and advertised, with every family-count pin moved and no other
 * family changed.
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
import { BASE_FAMILIES, MOUNTED_FAMILIES } from "../fixtures/steer/mounting";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

const PINNING_FILES = [
  "tests/structure/entrypoint-bin.test.ts",
  "tests/structure/board-mounting.test.ts",
  "tests/structure/events-production-composition.test.ts",
  "tests/structure/dispatch-attempts-composition.test.ts",
  "tests/structure/daemon-production-composition.test.ts",
  "tests/behaviour/repos-help.test.ts",
  "tests/behaviour/board-help.test.ts",
  "tests/behaviour/events-mount-help.test.ts",
  "tests/behaviour/ceremony-cli.test.ts",
] as const;

/** The declared non-count residual: the queue-ready control-matrix count. */
const NON_COUNT_RESIDUAL = "tests/behaviour/queue-ready-negative-controls.test.ts";

const familyLines = (help: string): readonly string[] =>
  help.split("\n").filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line));

describe("TC-STEER-060 steer is the twenty-third prompt-required family", () => {
  test("the mounted set is the captured 22-entry base plus steer, count 23", () => {
    expect(BASE_FAMILIES).toHaveLength(22);
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([...MOUNTED_FAMILIES]);
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(23);
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "steer")).toHaveLength(1);
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("steer");
  });

  test("root --help lists steer as the last family line among 23 families", () => {
    const help = renderRootHelp(SYNTHETIC_BRAND);
    const families = familyLines(help);
    expect(families).toHaveLength(23);
    expect(families.at(-1)?.trimStart().startsWith("steer  ")).toBe(true);
    for (const family of BASE_FAMILIES) {
      expect(families.some((line) => line.trimStart().startsWith(`${family}  `))).toBe(true);
    }
  });

  test("every family-count pin reads 23 and no stale 22 remains outside the declared residual", () => {
    const failures: string[] = [];
    for (const file of PINNING_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      if (/toHaveLength\(22\)/u.test(text)) failures.push(`${file}: stale family-count pin 22`);
      if (!/toHaveLength\(23\)|\.toBe\(\s*23\s*,?\s*\)/su.test(text)) {
        failures.push(`${file}: no family-count pin 23`);
      }
    }
    expect(failures).toEqual([]);
    // The queue-ready control-matrix literal 22 is explicitly not a family pin.
    const residual = readFileSync(join(ROOT, NON_COUNT_RESIDUAL), "utf8");
    expect(residual).toContain("toHaveLength(22)");
    expect(residual).toContain("negativeControls");
  });

  test("the production composer produces a steer handler and answers over an empty store", async () => {
    const base = makeBaseDirectory("steer-mounting");
    const checkout = createRepository(base, "mounting-checkout");
    mkdirSync(join(checkout, ".ai/local"), { recursive: true });
    const harness = createProductionProjectsHarness({
      label: "steer-mounting",
      workingDirectory: checkout,
    });
    try {
      const list = await harness.run(["steer", "list", "--json"]);
      expect(list.exitCode).toBe(0);
      const data = list.envelope?.data as Record<string, unknown> | undefined;
      expect(data?.schemaVersion).toBe("delivery.steer.v1");
      expect(data?.queued).toEqual([]);
      expect(data?.landed).toEqual([]);
      expect(data?.expired).toEqual([]);
    } finally {
      harness.dispose();
      removeDirectoryTree(base);
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("TC-STEER-063 the mount changes no other family", () => {
  test("every delivered family keeps its help entry and order, with steer appended", () => {
    for (const family of MOUNTED_FAMILIES) {
      expect(helpEntryFor([family])).toBeDefined();
    }
    const families = allHelpEntries()
      .filter((entry) => entry.path.length === 1)
      .map((entry) => entry.path[0]);
    expect([...families].sort()).toEqual([...MOUNTED_FAMILIES].sort());
    expect(families.at(-1)).toBe("steer");
  });

  test("the delivered families' help text carries no steering line", () => {
    for (const entry of allHelpEntries()) {
      if (entry.path[0] === "steer") continue;
      const text = JSON.stringify(entry);
      expect(text).not.toContain("steering note");
    }
  });
});
