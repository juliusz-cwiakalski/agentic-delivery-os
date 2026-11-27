/**
 * GH-346 TC-INST-104 — every conformance gate fails by name on an injected fixture.
 *
 * One mutant per gate, driven over a temporary tree or an injected copy: the
 * family count and tail, a help entry, the reference page and its page-root
 * mapping, and the coverage inventory in both directions. A gate that cannot name
 * its fixture is a gap, not a pass.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allHelpEntries, type HelpEntry } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";

const ROOT = process.cwd();
const COVERAGE = "tests/fixtures/help-guide/coverage.json";
const M1 = "doc/planning/oss-tooling/milestones/m1/commands";
const M2 = "doc/planning/oss-tooling/milestones/m2/commands";
const M4 = "doc/planning/oss-tooling/milestones/m4/commands";

const withTempTree = <T>(body: (root: string) => T): T => {
  const root = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-conformance-mutant-"));
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

type Coverage = { commands: string[]; referencePages: string[] };

const readCoverage = (root: string): Coverage =>
  JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as Coverage;

const writeCoverage = (root: string, coverage: Coverage): void => {
  writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
};

/** The family comparator the conformance case asserts, exported for its mutant. */
export const familyViolations = (actual: readonly string[]): readonly string[] => {
  const failures: string[] = [];
  const expected = [...PROMPT_REQUIRED_COMMANDS];
  if (actual.length !== 29) failures.push(`count ${actual.length} != 29`);
  for (const name of expected) if (!actual.includes(name)) failures.push(`missing ${name}`);
  for (const name of actual) if (!expected.includes(name)) failures.push(`undeclared ${name}`);
  if (actual.at(-1) !== "push") failures.push("tail is not push");
  if (actual.at(-2) !== "provider") failures.push("provider is not immediately before push");
  if (actual.at(-3) !== "loop") failures.push("loop is not immediately before provider");
  if (actual.at(-4) !== "install") failures.push("install is not immediately before loop");
  return failures;
};

/** The install family's help entries, in the order the gate names them. */
const INSTALL_HELP_PATHS = [
  "install",
  "install migrate",
  "install status",
  "install rollback",
  "install uninstall",
  "install purge",
] as const;

/**
 * The help-entry conformance rule, over an injected entry list: the family and
 * each of its five subcommands must resolve their own static entry.
 */
export const installHelpViolations = (entries: readonly HelpEntry[]): readonly string[] => {
  const failures: string[] = [];
  for (const expected of INSTALL_HELP_PATHS) {
    if (!entries.some((entry) => entry.path.join(" ") === expected)) {
      failures.push(`missing help entry ${expected}`);
    }
  }
  const count = entries.filter((entry) => entry.path[0] === "install").length;
  if (count !== INSTALL_HELP_PATHS.length) {
    failures.push(`install help entries ${String(count)} != ${String(INSTALL_HELP_PATHS.length)}`);
  }
  return failures;
};

describe("TC-INST-104 each conformance gate fails by name on an injected fixture", () => {
  test("the family count and tail mutants fail by name", () => {
    expect(familyViolations(PROMPT_REQUIRED_COMMANDS)).toEqual([]);
    expect(familyViolations(PROMPT_REQUIRED_COMMANDS.slice(0, 27))).toContain("missing provider");
    expect(familyViolations([...PROMPT_REQUIRED_COMMANDS, "doctor"])).toContain(
      "undeclared doctor",
    );
    expect(familyViolations([...PROMPT_REQUIRED_COMMANDS].reverse())).toContain(
      "tail is not push",
    );
    // The `loop` removal control keeps its named failure (DOD-8) at the merged
    // count, and the `provider` removal control keeps its own.
    const withoutLoop = PROMPT_REQUIRED_COMMANDS.filter((name) => name !== "loop");
    expect(familyViolations(withoutLoop)).toContain("missing loop");
    expect(familyViolations(withoutLoop)).toContain("count 28 != 29");
    const withoutProvider = PROMPT_REQUIRED_COMMANDS.filter((name) => name !== "provider");
    expect(familyViolations(withoutProvider)).toContain("missing provider");
    expect(familyViolations(withoutProvider)).toContain("count 28 != 29");
  });

  test("the help-entry mutant names the missing entry", () => {
    // The delivered inventory is green.
    expect(installHelpViolations(allHelpEntries())).toEqual([]);
    // A fixture with one subcommand's entry removed fails by name, and the
    // family count is asserted independently of the filter that built it.
    const withoutPurge = allHelpEntries().filter(
      (entry) => entry.path.join(" ") !== "install purge",
    );
    expect(installHelpViolations(withoutPurge)).toContain("missing help entry install purge");
    const withoutRollback = allHelpEntries().filter(
      (entry) => entry.path.join(" ") !== "install rollback",
    );
    expect(installHelpViolations(withoutRollback)).toContain("install help entries 5 != 6");
  });

  test("a missing page, a page without --version, and an M1-placed page all fail by name", () => {
    withTempTree((root) => {
      rmSync(join(root, M4, "install.md"), { force: true });
      expect(
        runHelpGuideCoverage(root).some(
          (failure) =>
            failure.id === "install" && failure.detail.includes("m4/commands/install.md"),
        ),
      ).toBe(true);

      cpSync(join(ROOT, M4, "install.md"), join(root, M4, "install.md"));
      const page = join(root, M4, "install.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      expect(
        runHelpGuideCoverage(root).some(
          (failure) => failure.id === "install" && failure.detail.includes("--version"),
        ),
      ).toBe(true);

      cpSync(join(ROOT, M4, "install.md"), join(root, M1, "install.md"));
      rmSync(join(root, M4, "install.md"), { force: true });
      expect(runHelpGuideCoverage(root).some((failure) => failure.id === "install")).toBe(true);
    });
  });

  test("the coverage inventory fails in both directions", () => {
    withTempTree((root) => {
      const coverage = readCoverage(root);
      writeCoverage(root, {
        ...coverage,
        commands: coverage.commands.filter((command) => command !== "install"),
      });
      expect(runHelpGuideCoverage(root).some((failure) => failure.id === "install")).toBe(true);

      writeCoverage(root, {
        ...readCoverage(ROOT),
        commands: [...readCoverage(ROOT).commands, "doctor"],
      });
      expect(
        runHelpGuideCoverage(root).some((failure) =>
          failure.detail.includes("non-prompt-required"),
        ),
      ).toBe(true);

      writeCoverage(root, {
        ...readCoverage(ROOT),
        referencePages: readCoverage(ROOT).referencePages.filter(
          (page) => !page.endsWith("m4/commands/install.md"),
        ),
      });
      expect(runHelpGuideCoverage(root).some((failure) => failure.id === "install")).toBe(true);
    });
  });

  test("the delivered tree stays green", () => {
    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
    expect(familyViolations(PROMPT_REQUIRED_COMMANDS)).toEqual([]);
  });
});
