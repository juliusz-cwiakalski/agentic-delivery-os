/**
 * TC-PSCAN-005 — every conformance rule has a failing mutant, and the scan is
 * deterministic with zero ambient reads.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runPromptConformance, scanPromptText } from "../../scripts/checks/prompt-conformance";

const ROOT = process.cwd();
const MUTANTS = "tests/fixtures/prompt-inventory/mutants";

const mutantFiles = (): readonly string[] => {
  try {
    return readdirSync(join(ROOT, MUTANTS))
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
};

describe("TC-PSCAN-005 mutants fail by rule", () => {
  test("every mutant file is rejected with a named rule", () => {
    const mutants = mutantFiles();
    expect(mutants.length).toBeGreaterThanOrEqual(4);
    const failures: string[] = [];
    for (const name of mutants) {
      const text = readFileSync(join(ROOT, MUTANTS, name), "utf8");
      const findings = scanPromptText(`${MUTANTS}/${name}`, text);
      if (findings.length === 0) failures.push(`${name}: no finding`);
      for (const finding of findings) {
        if (finding.rule.length === 0) failures.push(`${name}: unnamed rule`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the live scan is deterministic and clean on repeat", () => {
    const first = runPromptConformance();
    const second = runPromptConformance();
    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  test("the scan is non-vacuous: a synthetic raw-git mutant fails", () => {
    const findings = scanPromptText("mutant.md", 'Run git commit -m "x" and git add -A.');
    expect(findings.map((finding) => finding.rule)).toContain("git.no-raw-write");
  });
});
