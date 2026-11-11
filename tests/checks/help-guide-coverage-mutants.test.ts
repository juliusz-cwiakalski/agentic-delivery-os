/**
 * TC-HELP-002 — a mutated coverage matrix fails and names the missing
 * obligation.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";

const ROOT = process.cwd();
const COVERAGE = "tests/fixtures/help-guide/coverage.json";
const COMMANDS = "doc/planning/oss-tooling/milestones/m1/commands";
const M2_COMMANDS = "doc/planning/oss-tooling/milestones/m2/commands";

const tempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "gh242-help-"));
  cpSync(join(ROOT, COMMANDS), join(root, COMMANDS), { recursive: true });
  cpSync(join(ROOT, M2_COMMANDS), join(root, M2_COMMANDS), { recursive: true });
  cpSync(join(ROOT, COVERAGE), join(root, COVERAGE));
  return root;
};

describe("TC-HELP-002 coverage mutants", () => {
  test("a missing command row fails naming the command", () => {
    const root = tempRoot();
    try {
      const coverage = JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as {
        commands: string[];
        referencePages: string[];
      };
      coverage.commands = coverage.commands.filter((command) => command !== "merge");
      writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
      const failures = runHelpGuideCoverage(root);
      expect(failures.map((failure) => failure.id)).toContain("merge");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a page stripped of --help fails naming the page", () => {
    const root = tempRoot();
    try {
      const page = join(root, COMMANDS, "merge.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--help", "help"));
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some((failure) => failure.id === "merge" && failure.detail.includes("--help")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a page lacking --version fails naming the page", () => {
    const root = tempRoot();
    try {
      const page = join(root, COMMANDS, "status.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some((failure) => failure.id === "status" && failure.detail.includes("--version")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
