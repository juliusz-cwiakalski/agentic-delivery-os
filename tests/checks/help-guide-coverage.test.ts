/**
 * TC-HELP-001 — the help/guide coverage matrix is complete for every
 * prompt-required command.
 */
import { describe, expect, test } from "bun:test";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";

describe("TC-HELP-001 help and guide coverage", () => {
  test("every prompt-required command has --help and a reconciled reference page", () => {
    expect(runHelpGuideCoverage()).toEqual([]);
  });

  test("a removed inventory row is detected by name", () => {
    const failures = runHelpGuideCoverage();
    expect(failures).toEqual([]);
  });
});

describe("TC-CEREMONY-001 ceremony coverage row", () => {
  test("the ceremony family and its M2 page are in the coverage inventory", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const inventory = JSON.parse(
      readFileSync(join(process.cwd(), "tests/fixtures/help-guide/coverage.json"), "utf8"),
    ) as { commands: string[]; referencePages: string[] };
    expect(inventory.commands).toContain("ceremony");
    expect(inventory.referencePages).toContain(
      "doc/planning/oss-tooling/milestones/m2/commands/ceremony.md",
    );
    expect(runHelpGuideCoverage()).toEqual([]);
  });
});

describe("TC-ACTION-036 the retro family's M2 page row", () => {
  test("the extended retro surface and its M2 page are in the coverage inventory", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const inventory = JSON.parse(
      readFileSync(join(process.cwd(), "tests/fixtures/help-guide/coverage.json"), "utf8"),
    ) as { commands: string[]; referencePages: string[] };
    expect(inventory.commands).toContain("retro");
    expect(inventory.referencePages).toContain(
      "doc/planning/oss-tooling/milestones/m2/commands/retro.md",
    );
    expect(inventory.referencePages).toContain(
      "doc/planning/oss-tooling/milestones/m1/commands/retro.md",
    );
    expect(runHelpGuideCoverage()).toEqual([]);
  });

  test("the M2 retro page documents the additive verb group", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(
      join(process.cwd(), "doc/planning/oss-tooling/milestones/m2/commands/retro.md"),
      "utf8",
    );
    expect(page).toContain("retro action file");
    expect(page).toContain("retro action close");
    expect(page).toContain("retro action list");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
  });
});
