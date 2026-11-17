/**
 * GH-309 TC-GRPREG-001 (repos half) — `repos` is registered at the root
 * listing with a family/verb help entry, a reference page, coverage inventory
 * rows, composition, and the flat error rows.
 *
 * The mount unit is one indivisible unit: the prompt set, the help entries, the
 * page, the coverage inventory, the composition, and the error rows are
 * asserted together, because leaving any one out makes the surface advertised
 * but unreachable (or reachable but undiscoverable).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_REQUIRED_COMMANDS,
  runEntrypoint,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import { allHelpEntries, renderHelp } from "../../packages/cli/src/help";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";
import { createHostFixture, stateOverrideVariable } from "../fixtures/projects/state-scope";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const COVERAGE = "tests/fixtures/help-guide/coverage.json";
const M2_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/repos.md";
const PROJECTS_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/projects.md";

const helpEntry = (path: readonly string[]) =>
  allHelpEntries().find((entry) => entry.path.join(" ") === path.join(" "));

describe("TC-GRPREG-001 repos is reachable from the root listing", () => {
  test("root --help shows repos beside projects, with family and verb help", async () => {
    const host = createHostFixture("repos-help-surface");
    rmSync(host.hostRoot, { recursive: true, force: true });
    const brand = resolveBrandIdentity({ workingName: "delivery-os" });
    if (!brand.ok) throw new Error("brand resolution failed");
    const environment = {
      HOME: host.home,
      [stateOverrideVariable(brand.value)]: host.hostRoot,
    };
    let compositions = 0;
    try {
      const run = async (argv: readonly string[]) => {
        const stdout = bufferSink();
        const stderr = bufferSink();
        const exitCode = await runEntrypoint(argv, {
          streams: { stdout, stderr },
          environment,
          configuredWorkingName: "delivery-os",
          composeProgram: () => {
            compositions += 1;
            throw new Error("help must not compose the program");
          },
          clock: { now: () => 1 },
          newRunId: () => "run-repos-help",
        });
        return { exitCode, stdout: stdout.value, stderr: stderr.value };
      };

      const root = await run(["--help"]);
      expect(root.exitCode).toBe(0);
      const commandsBlock = root.stdout.slice(root.stdout.indexOf("\nCommands:\n"));
      const families = commandsBlock
        .split("\n")
        .filter((line) => /^ {2}\S+ {2}\S/u.test(line))
        .map((line) => (line.trim().split(/\s+/u)[0] ?? "").trim());
      expect(families).toHaveLength(25);
      expect(families).toContain("projects");
      expect(families).toContain("repos");
      expect(Math.abs(families.indexOf("repos") - families.indexOf("projects"))).toBe(1);

      const family = await run(["repos", "--help"]);
      expect(family.exitCode).toBe(0);
      expect(family.stdout).toContain("repos");
      expect(family.stdout).toContain("list");
      const verb = await run(["repos", "list", "--help"]);
      expect(verb.exitCode).toBe(0);
      expect(verb.stdout).toContain("repos list");
      expect(compositions).toBe(0);
      expect(existsSync(host.hostRoot)).toBe(false);
    } finally {
      host.dispose();
    }
  });

  test("the mount unit: prompt set, help entries, page, coverage, errors, and composition", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toContain("repos");
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "repos")).toHaveLength(1);

    for (const path of [["repos"], ["repos", "list"]] as const) {
      const entry = helpEntry(path);
      expect(entry, path.join(" ")).toBeDefined();
      expect(entry?.examples.length ?? 0).toBeGreaterThan(0);
      const rendered = renderHelp(entry as NonNullable<typeof entry>, SYNTHETIC_BRAND);
      expect(rendered).toContain("Exit codes:");
      expect(rendered).toContain("See also:");
      expect(rendered).toContain(M2_PAGE);
    }
    expect(helpEntry(["projects"])?.seeAlso).toContain(PROJECTS_PAGE);

    const coverage = JSON.parse(readFileSync(join(ROOT, COVERAGE), "utf8")) as {
      readonly commands: readonly string[];
      readonly referencePages: readonly string[];
    };
    expect(coverage.commands).toContain("repos");
    expect(coverage.referencePages).toContain(M2_PAGE);
    expect([...coverage.commands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());

    const page = readFileSync(join(ROOT, M2_PAGE), "utf8");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
    expect(page).toContain("Delivered (M2-S18)");
    expect(page).toContain("repos.registry-corrupt");

    const rows = ERROR_TABLE.filter((row) => row.domainKind === "repos");
    expect(rows.map((row) => row.code)).toEqual([
      "repos.identity-unreadable",
      "repos.registry-corrupt",
      "repos.state-unavailable",
    ]);

    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const checkout = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh309-repos-compose-"));
    const home = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh309-repos-home-"));
    mkdirSync(join(checkout, ".git"), { recursive: true });
    mkdirSync(home, { recursive: true });
    const composer = createProductionComposer({
      environment: { HOME: home },
      cwd: checkout,
      homeDirectory: home,
      workingName: "delivery-os",
    });
    const program = composer(SYNTHETIC_BRAND, { command: "status", groupScoped: false });
    rmSync(checkout, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    expect(program.commands.repos).toBeDefined();
    expect(selectPromptRequiredProgram(program).commands.repos).toBeDefined();

    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
  });
});
