/**
 * GH-288 TC-PROJ-029 and TC-PROJ-030 — reachability and the mount unit.
 *
 * Help and version are served from the static inventory: the composer is never
 * invoked, no state, git, configuration, or network read happens, and no host
 * root is created. The mount unit is asserted in one place, because the coverage
 * gate and the parity test both pin set equality with the prompt-required set.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const M1_COMMANDS = "doc/planning/oss-tooling/milestones/m1/commands";
const M2_COMMANDS = "doc/planning/oss-tooling/milestones/m2/commands";
const M2_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/projects.md";

const helpEntry = (path: readonly string[]) =>
  allHelpEntries().find((entry) => entry.path.join(" ") === path.join(" "));

describe("TC-PROJ-029 projects is reachable from the built help surface", () => {
  test("help and version exit 0 with no composition, no state read, and no state written", async () => {
    const host = createHostFixture("help-surface");
    // The host root must not exist yet, so any creation is observable.
    rmSync(host.hostRoot, { recursive: true, force: true });
    const brand = resolveBrandIdentity({ workingName: "delivery-os" });
    if (!brand.ok) throw new Error("brand resolution failed");
    const environment = {
      HOME: host.home,
      [stateOverrideVariable(brand.value)]: host.hostRoot,
    };
    let compositions = 0;
    try {
      expect(existsSync(host.hostRoot)).toBe(false);
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
          newRunId: () => "run-help",
        });
        return { exitCode, stdout: stdout.value, stderr: stderr.value };
      };

      const root = await run(["--help"]);
      expect(root.exitCode).toBe(0);
      expect(root.stdout).toContain("projects");
      const family = await run(["projects", "--help"]);
      expect(family.exitCode).toBe(0);
      expect(family.stdout).toContain("projects");
      expect(family.stdout).toContain("list");
      const verb = await run(["projects", "list", "--help"]);
      expect(verb.exitCode).toBe(0);
      expect(verb.stdout).toContain("projects list");
      const version = await run(["--version"]);
      expect(version.exitCode).toBe(0);
      expect(version.stdout).toContain("delivery-os");

      expect(compositions).toBe(0);
      expect(existsSync(host.hostRoot)).toBe(false);
      expect(readdirSync(host.home)).toEqual([]);

      // The subprocess cell: the real bin path, same environment, same absence.
      for (const argv of [["--version"], ["projects", "--help"]]) {
        const spawned = spawnSync("bun", ["packages/cli/bin/delivery-os.ts", ...argv], {
          cwd: ROOT,
          env: { ...process.env, ...environment },
          encoding: "utf8",
        });
        expect(spawned.status, spawned.stderr).toBe(0);
        expect(spawned.stdout.length).toBeGreaterThan(0);
        expect(existsSync(host.hostRoot)).toBe(false);
        // Bun's own runtime cache is not this product's state; nothing else appears.
        expect(readdirSync(host.home).filter((name) => name !== ".bun")).toEqual([]);
      }
    } finally {
      host.dispose();
    }
  });
});

describe("TC-PROJ-030 the mount unit lands as one indivisible unit", () => {
  test("prompt set, help entries, page, inventory, error rows, and definition are all present", () => {
    // 1. The prompt set.
    expect(PROMPT_REQUIRED_COMMANDS).toContain("projects");

    // 2. Root and family/verb help entries with an example and the exit block.
    for (const path of [["projects"], ["projects", "list"]] as const) {
      const entry = helpEntry(path);
      expect(entry, path.join(" ")).toBeDefined();
      expect(entry?.examples.length ?? 0).toBeGreaterThan(0);
      const rendered = renderHelp(entry as NonNullable<typeof entry>, SYNTHETIC_BRAND);
      expect(rendered).toContain("Exit codes:");
      expect(rendered).toContain("See also:");
      expect(rendered).toContain(M2_PAGE);
    }

    // 3. The coverage inventory: row plus the per-command M2 page root.
    const coverage = JSON.parse(readFileSync(join(ROOT, COVERAGE), "utf8")) as {
      readonly commands: readonly string[];
      readonly referencePages: readonly string[];
    };
    expect(coverage.commands).toContain("projects");
    expect(coverage.referencePages).toContain(M2_PAGE);
    expect([...coverage.commands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());

    // 4. The reference page documents both flags and keeps its proposed status.
    const page = readFileSync(join(ROOT, M2_PAGE), "utf8");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
    expect(page).toContain("Status: Proposed (M2)");

    // 5. Exactly three error rows under the one new kind.
    const rows = ERROR_TABLE.filter((row) => row.domainKind === "projects");
    expect(rows.map((row) => row.code)).toEqual([
      "projects.identity-unreadable",
      "projects.registry-corrupt",
      "projects.state-unavailable",
    ]);

    // 6. The composed program carries the definition and the restriction keeps it.
    //    The checkout is temporary: composition must never run in this repository.
    mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
    const checkout = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-help-compose-"));
    const home = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-help-home-"));
    mkdirSync(join(checkout, ".git"), { recursive: true });
    mkdirSync(home, { recursive: true });
    const composer = createProductionComposer({
      environment: { HOME: home },
      cwd: checkout,
      homeDirectory: home,
      workingName: "delivery-os",
    });
    const program = composer(SYNTHETIC_BRAND, { command: "status" });
    rmSync(checkout, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    expect(program.commands.projects).toBeDefined();
    const restricted = selectPromptRequiredProgram(program);
    expect(restricted.commands.projects).toBeDefined();

    // 7. The coverage gate is green with set equality in both directions.
    expect(runHelpGuideCoverage(ROOT)).toEqual([]);
  });

  test("the mutants still detect a removed inventory row and a page missing --version", () => {
    const copy = (): string => {
      mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
      const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-help-mutants-"));
      cpSync(join(ROOT, M1_COMMANDS), join(root, M1_COMMANDS), { recursive: true });
      cpSync(join(ROOT, M2_COMMANDS), join(root, M2_COMMANDS), { recursive: true });
      cpSync(join(ROOT, COVERAGE), join(root, COVERAGE));
      return root;
    };
    const removedRow = copy();
    try {
      const inventory = JSON.parse(readFileSync(join(removedRow, COVERAGE), "utf8")) as {
        commands: string[];
        referencePages: string[];
      };
      inventory.commands = inventory.commands.filter((command) => command !== "projects");
      writeFileSync(join(removedRow, COVERAGE), JSON.stringify(inventory));
      expect(runHelpGuideCoverage(removedRow).map((failure) => failure.id)).toContain("projects");
    } finally {
      rmSync(removedRow, { recursive: true, force: true });
    }
    const strippedPage = copy();
    try {
      const page = join(strippedPage, M2_PAGE);
      writeFileSync(page, readFileSync(page, "utf8").replaceAll("--version", "version"));
      const failures = runHelpGuideCoverage(strippedPage);
      expect(
        failures.some(
          (failure) => failure.id === "projects" && failure.detail.includes("--version"),
        ),
      ).toBe(true);
    } finally {
      rmSync(strippedPage, { recursive: true, force: true });
    }
  });
});
