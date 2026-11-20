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
const M4_COMMANDS = "doc/planning/oss-tooling/milestones/m4/commands";

const tempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "gh242-help-"));
  cpSync(join(ROOT, COMMANDS), join(root, COMMANDS), { recursive: true });
  cpSync(join(ROOT, M2_COMMANDS), join(root, M2_COMMANDS), { recursive: true });
  cpSync(join(ROOT, M4_COMMANDS), join(root, M4_COMMANDS), { recursive: true });
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

describe("TC-ACTION-036 the M2 retro page participates in the parity guard", () => {
  test("stripping --help from the M2 retro page fails naming retro", () => {
    const root = tempRoot();
    try {
      const page = join(root, M2_COMMANDS, "retro.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--help", "help"));
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some((failure) => failure.id === "retro" && failure.detail.includes("--help")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removing the M2 retro row from the inventory fails naming retro", () => {
    const root = tempRoot();
    try {
      const coverage = JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as {
        commands: string[];
        referencePages: string[];
      };
      coverage.referencePages = coverage.referencePages.filter(
        (page) => page !== "doc/planning/oss-tooling/milestones/m2/commands/retro.md",
      );
      writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
      const failures = runHelpGuideCoverage(root);
      expect(failures.some((failure) => failure.id === "retro")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("GH-346 TC-INST-104 the M4 install page participates in the same guard", () => {
  test("a missing M4 install page fails naming install and the page", () => {
    const root = tempRoot();
    try {
      rmSync(join(root, M4_COMMANDS, "install.md"), { force: true });
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some(
          (failure) =>
            failure.id === "install" && failure.detail.includes("m4/commands/install.md"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the page stripped of --version fails naming install", () => {
    const root = tempRoot();
    try {
      const page = join(root, M4_COMMANDS, "install.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some(
          (failure) => failure.id === "install" && failure.detail.includes("--version"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a page placed under the M1 snapshot root does not serve the family", () => {
    const root = tempRoot();
    try {
      cpSync(join(root, M4_COMMANDS, "install.md"), join(root, COMMANDS, "install.md"));
      rmSync(join(root, M4_COMMANDS, "install.md"), { force: true });
      const failures = runHelpGuideCoverage(root);
      expect(failures.some((failure) => failure.id === "install")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("dropping the install row from the inventory fails naming install", () => {
    const root = tempRoot();
    try {
      const coverage = JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as {
        commands: string[];
        referencePages: string[];
      };
      coverage.commands = coverage.commands.filter((command) => command !== "install");
      writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
      const failures = runHelpGuideCoverage(root);
      expect(failures.some((failure) => failure.id === "install")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("GH-350 TC-MOUNT-010 the M1 provider page and row participate in the same guard", () => {
  test("dropping the provider row from the inventory fails naming provider", () => {
    const root = tempRoot();
    try {
      const coverage = JSON.parse(readFileSync(join(root, COVERAGE), "utf8")) as {
        commands: string[];
        referencePages: string[];
      };
      coverage.commands = coverage.commands.filter((command) => command !== "provider");
      writeFileSync(join(root, COVERAGE), JSON.stringify(coverage));
      const failures = runHelpGuideCoverage(root);
      expect(failures.some((failure) => failure.id === "provider")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the page stripped of --version fails naming provider", () => {
    const root = tempRoot();
    try {
      const page = join(root, COMMANDS, "provider.md");
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      const failures = runHelpGuideCoverage(root);
      expect(
        failures.some(
          (failure) => failure.id === "provider" && failure.detail.includes("--version"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
