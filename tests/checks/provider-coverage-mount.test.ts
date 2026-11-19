/**
 * GH-350 TC-CONFORM-006 — the mounted family's help and coverage agree in both
 * directions, non-vacuously after the mount.
 *
 * The declarative prompt-required set, the static help inventory, the coverage
 * fixture and the page-root mapping are read directly; the mutant arms drive
 * temp copies of the tree so a dropped command row, a dropped reference-page
 * row, a stripped `--version`, and a missing help entry each fail by name. The
 * delivered coverage gate and reference-page parity suites are re-run as
 * unedited controls (AC-F8-4).
 */
import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HelpEntry } from "../../packages/cli/src/help";
import { allHelpEntries, renderHelp } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const COVERAGE = "tests/fixtures/help-guide/coverage.json";
const M1 = "doc/planning/oss-tooling/milestones/m1/commands";
const M2 = "doc/planning/oss-tooling/milestones/m2/commands";
const M4 = "doc/planning/oss-tooling/milestones/m4/commands";
const PROVIDER_PAGE = `${M1}/provider.md`;

const PROVIDER_PATHS = [
  "provider",
  "provider resolve",
  "provider quota",
  "provider parks list",
  "provider profile resolve",
  "provider watch status",
  "provider simulate",
  "provider migrate legacy",
] as const;

type Coverage = { commands: string[]; referencePages: string[] };

const readCoverage = (root: string): Coverage =>
  JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as Coverage;

const withTempTree = <T>(body: (root: string) => T): T => {
  const root = mkdtempSync(join(ROOT, "tmp/tmpdir/gh350-coverage-mount-"));
  try {
    for (const directory of [M1, M2, M4]) {
      cpSync(join(ROOT, directory), join(root, directory), { recursive: true });
    }
    cpSync(join(ROOT, COVERAGE), join(root, COVERAGE));
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const writeCoverage = (root: string, coverage: Coverage): void => {
  writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
};

/** The eight help surfaces the family declares, in their declared order. */
const providerEntries = (entries: readonly HelpEntry[]): readonly HelpEntry[] =>
  entries.filter((entry) => entry.path[0] === "provider");

const helpViolations = (entries: readonly HelpEntry[]): string[] => {
  const failures: string[] = [];
  const family = providerEntries(entries);
  const found = family.map((entry) => entry.path.join(" "));
  for (const path of PROVIDER_PATHS) {
    if (!found.includes(path)) failures.push(`missing help entry ${path}`);
  }
  if (family.length !== PROVIDER_PATHS.length) {
    failures.push(`provider help entries ${String(family.length)} != 8`);
  }
  for (const entry of family) {
    if (entry.usage.length === 0) failures.push(`${entry.path.join(" ")}: no usage`);
    if (entry.options.length === 0) failures.push(`${entry.path.join(" ")}: no options`);
    if (entry.examples.length === 0) failures.push(`${entry.path.join(" ")}: no examples`);
    if (entry.seeAlso.length !== 1 || entry.seeAlso[0] !== PROVIDER_PAGE) {
      failures.push(`${entry.path.join(" ")}: see-also is not the M1 provider page`);
    }
  }
  return failures;
};

describe("TC-CONFORM-006 the mounted family's help and coverage agree in both directions", () => {
  test("the family is declared and the coverage inventory carries both rows", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toContain("provider");
    const coverage = readCoverage(ROOT);
    expect(coverage.commands).toContain("provider");
    expect(coverage.referencePages).toContain(PROVIDER_PAGE);
  });

  test("every mounted family has a coverage row and every row belongs to a mounted family", () => {
    const coverage = readCoverage(ROOT);
    const declared = new Set<string>(PROMPT_REQUIRED_COMMANDS);
    const missing = [...declared].filter((name) => !coverage.commands.includes(name));
    const undeclared = coverage.commands.filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
    expect(undeclared).toEqual([]);
    expect([...coverage.commands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());
  });

  test("the eight help surfaces carry the five sections and the M1 pointer", () => {
    expect(helpViolations(allHelpEntries())).toEqual([]);
    const family = providerEntries(allHelpEntries());
    expect(family.map((entry) => entry.path.join(" "))).toEqual([...PROVIDER_PATHS]);
    for (const entry of family) {
      const rendered = renderHelp(entry, SYNTHETIC_BRAND);
      for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
        expect(rendered).toContain(section);
      }
    }
  });

  test("the page-root mapping serves the M1 page and no M4 provider page exists", () => {
    expect(existsSync(join(ROOT, PROVIDER_PAGE))).toBe(true);
    expect(existsSync(join(ROOT, M4, "provider.md"))).toBe(false);
    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
  });

  test("the reference page carries both required self-description flags", () => {
    const page = readFileSync(join(ROOT, PROVIDER_PAGE), "utf8");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
    expect(page.toLowerCase()).toContain("provider");
  });
});

describe("TC-CONFORM-006 the both-directions proof is non-vacuous", () => {
  test("a dropped provider command row fails by name", () => {
    withTempTree((root) => {
      const coverage = readCoverage(root);
      writeCoverage(root, {
        ...coverage,
        commands: coverage.commands.filter((command) => command !== "provider"),
      });
      expect(
        runHelpGuideCoverage(root).some(
          (failure) =>
            failure.id === "provider" &&
            failure.detail.includes("missing from the coverage inventory"),
        ),
      ).toBe(true);
    });
  });

  test("a dropped provider reference-page row fails by name", () => {
    withTempTree((root) => {
      const coverage = readCoverage(root);
      writeCoverage(root, {
        ...coverage,
        referencePages: coverage.referencePages.filter((page) => page !== PROVIDER_PAGE),
      });
      expect(
        runHelpGuideCoverage(root).some(
          (failure) =>
            failure.id === "provider" && failure.detail.includes("missing from referencePages"),
        ),
      ).toBe(true);
    });
  });

  test("a coverage row for an unmounted family fails in the reverse direction", () => {
    withTempTree((root) => {
      const coverage = readCoverage(root);
      writeCoverage(root, { ...coverage, commands: [...coverage.commands, "doctor"] });
      expect(
        runHelpGuideCoverage(root).some((failure) =>
          failure.detail.includes("inventory names a non-prompt-required command"),
        ),
      ).toBe(true);
    });
  });

  test("a page stripped of --version and a missing help entry each fail by name", () => {
    withTempTree((root) => {
      const page = join(root, PROVIDER_PAGE);
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      expect(
        runHelpGuideCoverage(root).some(
          (failure) => failure.id === "provider" && failure.detail.includes("--version"),
        ),
      ).toBe(true);
    });
    const withoutWatch = allHelpEntries().filter(
      (entry) => entry.path.join(" ") !== "provider watch status",
    );
    expect(helpViolations(withoutWatch)).toContain("missing help entry provider watch status");
    expect(helpViolations(withoutWatch)).toContain("provider help entries 7 != 8");
  });

  test("the delivered controls read the same fixture unchanged", () => {
    // The two control suites are unedited: both import the delivered checker
    // and iterate the inventory. The delivered tree stays green.
    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
    expect(readCoverage(ROOT).commands).toContain("provider");
  });
});
