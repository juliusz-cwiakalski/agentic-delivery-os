/**
 * GH-346 TC-INST-100..103 — the declared conformance surface.
 *
 * The prompt-required set is exactly 27 by name and order with `loop` last and
 * `install` immediately before it; every lifecycle entry has a full static
 * help entry; the M4 reference page exists and the page-root mapping resolves it;
 * and the coverage inventory agrees in both directions. A count is asserted
 * exactly, never as a floor.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allHelpEntries } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";

const ROOT = process.cwd();
const M4_PAGE = "doc/planning/oss-tooling/milestones/m4/commands/install.md";
const INSTALL_ENTRIES = [
  "install",
  "install status",
  "install rollback",
  "install uninstall",
  "install purge",
] as const;

const coverage = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/help-guide/coverage.json"), "utf8"),
) as { readonly commands: readonly string[]; readonly referencePages: readonly string[] };

describe("TC-INST-100 the composed set is exactly 27 by name and order", () => {
  test("loop is last and install is immediately before it", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(27);
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("loop");
    expect(PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("install");
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "install")).toHaveLength(1);
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([
      "status",
      "brief",
      "queue",
      "lanes",
      "blockers",
      "phase",
      "commit",
      "lint",
      "plan",
      "verify",
      "merge",
      "closeout",
      "spend",
      "retro",
      "dispatch",
      "coordinator",
      "daemon",
      "projects",
      "repos",
      "events",
      "board",
      "ceremony",
      "steer",
      "metrics",
      "supervise",
      "install",
      "loop",
    ]);
  });

  test("a missing family, an undeclared family, and a reordered tail fail by name", () => {
    const comparator = (actual: readonly string[]): string[] => {
      const failures: string[] = [];
      const expected = [...PROMPT_REQUIRED_COMMANDS];
      if (actual.length !== expected.length) failures.push(`count ${actual.length} != 27`);
      for (const name of expected) if (!actual.includes(name)) failures.push(`missing ${name}`);
      for (const name of actual) if (!expected.includes(name)) failures.push(`undeclared ${name}`);
      if (actual.at(-1) !== "loop") failures.push("tail is not loop");
      if (actual.at(-2) !== "install") failures.push("install is not immediately before loop");
      return failures;
    };
    expect(comparator([...PROMPT_REQUIRED_COMMANDS])).toEqual([]);
    expect(comparator(PROMPT_REQUIRED_COMMANDS.slice(0, 26))).toContain("missing loop");
    expect(comparator([...PROMPT_REQUIRED_COMMANDS, "doctor"])).toContain("undeclared doctor");
    expect(comparator([...PROMPT_REQUIRED_COMMANDS].reverse())).toContain("tail is not loop");
  });
});

describe("TC-INST-101 every lifecycle entry has a full static-inventory help entry", () => {
  test("the family and its four subcommands each carry the five declared sections", () => {
    for (const expected of INSTALL_ENTRIES) {
      const entry = allHelpEntries().find((candidate) => candidate.path.join(" ") === expected);
      expect({ expected, found: entry !== undefined }).toEqual({ expected, found: true });
      expect(entry?.usage.length).toBeGreaterThan(0);
      expect(entry?.examples.length).toBeGreaterThan(0);
      expect(entry?.seeAlso).toEqual([M4_PAGE]);
    }
    expect(allHelpEntries().filter((entry) => entry.path[0] === "install")).toHaveLength(5);
  });

  test("every example parses against its own definition", async () => {
    const { createInstallCommandDefinition } = await import(
      "../../packages/cli/src/commands/install"
    );
    const { resolveBrandIdentity } = await import("../../packages/core/src/branding");
    const brand = resolveBrandIdentity({ workingName: "jaiship" });
    if (!brand.ok) throw new Error("brand");
    const { createInstallRuntime, createInstallScratch } = await import("../fixtures/install/home");
    const scratch = createInstallScratch("conformance-examples");
    try {
      const definition = createInstallCommandDefinition(
        createInstallRuntime({ scratch, runningArtifactPath: "/nonexistent/artifact" }),
      );
      for (const entry of allHelpEntries().filter((candidate) => candidate.path[0] === "install")) {
        for (const example of entry.examples) {
          const tokens = example.split(" ").slice(1);
          expect(tokens[0]).toBe("install");
          for (const token of tokens) {
            if (token.startsWith("--") && token !== "--json") {
              expect(
                definition.flags?.includes(token) || definition.requiresValue?.includes(token),
              ).toBe(true);
            }
          }
        }
      }
      expect(definition.positionals).toEqual({ max: 1 });
      expect(definition.flags).toEqual([
        "--add-to-path",
        "--migrate",
        "--dry-run",
        "--stop-daemon",
        "--yes",
      ]);
      expect(definition.requiresValue).toEqual(["--shell-profile"]);
      expect(brand.value.binaryName).toBe("jaiship");
    } finally {
      scratch.dispose();
    }
  });
});

describe("TC-INST-102 the M4 reference page exists and the mapping resolves it", () => {
  test("the page carries both self-description flags and the mapping finds it", () => {
    const page = readFileSync(join(ROOT, M4_PAGE), "utf8");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
    expect(page.toLowerCase()).toContain("install");
    expect(
      existsSync(join(ROOT, "doc/planning/oss-tooling/milestones/m1/commands/install.md")),
    ).toBe(false);
    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
  });
});

describe("TC-INST-103 the coverage inventory agrees in both directions", () => {
  test("the command rows are exactly the prompt-required set and every page exists", () => {
    expect([...coverage.commands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());
    expect(coverage.referencePages).toContain(M4_PAGE);
    for (const page of coverage.referencePages) {
      expect({ page, exists: existsSync(join(ROOT, page)) }).toEqual({ page, exists: true });
    }
  });

  test("a non-prompt-required row and a missing page both fail", () => {
    const failures: string[] = [];
    const declared = new Set(coverage.commands);
    for (const name of PROMPT_REQUIRED_COMMANDS) {
      if (!declared.has(name)) failures.push(`missing command ${name}`);
    }
    for (const name of declared) {
      if (!(PROMPT_REQUIRED_COMMANDS as readonly string[]).includes(name)) {
        failures.push(`non-prompt-required ${name}`);
      }
    }
    if (!coverage.referencePages.includes(M4_PAGE)) failures.push(`missing page ${M4_PAGE}`);
    expect(failures).toEqual([]);
    expect(
      [...coverage.commands.filter((name) => name !== "install"), "doctor"].some(
        (name) => !(PROMPT_REQUIRED_COMMANDS as readonly string[]).includes(name),
      ),
    ).toBe(true);
  });
});
