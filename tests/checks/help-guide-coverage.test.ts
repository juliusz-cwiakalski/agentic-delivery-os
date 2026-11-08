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
