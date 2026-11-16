/**
 * TC-CEREMONY-051 — tier neutrality is structural: exactly the two delivered
 * phase-set sources are consumed, no phase-set literal is restated, no tier name
 * outside `full`/`lite` exists, and a planted hardcoded default set fails the
 * same scan.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PLAN_KNOWN_TIERS,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
} from "../../packages/core/src/contracts/index";
import { evaluateCeremonyTier } from "../../packages/core/src/domain/index";

const ROOT = process.cwd();
const TIER_FILE = "packages/core/src/domain/ceremony-tier.ts";
const PHASE_IDS = [
  "clarify_scope",
  "specification",
  "test_planning",
  "delivery_planning",
  "dor_check",
  "delivery",
  "system_spec_update",
  "review_fix",
  "quality_gates",
  "dod_check",
  "pr_creation",
];

/** A phase-set literal restates at least two canonical phase ids as data. */
export const hardcodedPhaseSetViolations = (text: string): readonly string[] => {
  const present = PHASE_IDS.filter((id) => text.includes(`"${id}"`));
  return present.length >= 2 ? present : [];
};

describe("TC-CEREMONY-051 the tier mapping is single-sourced", () => {
  test("exactly the two delivered sources are consumed", () => {
    const text = readFileSync(join(ROOT, TIER_FILE), "utf8");
    expect(text).toContain("PLAN_KNOWN_TIERS");
    expect(text).toContain("PM_NOTES_REQUIRED_PHASES_BY_VARIANT");
    expect([...PLAN_KNOWN_TIERS]).toEqual(["full", "lite"]);
    expect(Object.keys(PM_NOTES_REQUIRED_PHASES_BY_VARIANT).sort()).toEqual(["full", "lite"]);
  });

  test("no canonical phase id literal exists in the tier engine", () => {
    expect(hardcodedPhaseSetViolations(readFileSync(join(ROOT, TIER_FILE), "utf8"))).toEqual([]);
  });

  test("a planted hardcoded default set fails the same scan", () => {
    const mutant = `${readFileSync(join(ROOT, TIER_FILE), "utf8")}\nconst DEFAULT = ["clarify_scope", "delivery"];\n`;
    expect(hardcodedPhaseSetViolations(mutant).length).toBeGreaterThan(0);
  });

  test("no ceremony module restates a phase set", () => {
    const domainDir = join(ROOT, "packages/core/src/domain");
    const ceremonyFiles = readdirSync(domainDir)
      .filter((name) => name.startsWith("ceremony-"))
      .map((name) => join(domainDir, name));
    for (const file of ceremonyFiles) {
      const text = readFileSync(file, "utf8");
      expect(hardcodedPhaseSetViolations(text), file).toEqual([]);
    }
  });

  test("no third tier name is accepted or emitted", () => {
    for (const name of ["basic", "standard", "enterprise", "medium"]) {
      const verdict = evaluateCeremonyTier({
        plan: { tier: { name } },
        variant: "full",
      });
      expect(verdict.effectiveTier).toBe("full");
      expect(verdict.findings[0]?.kind).toBe("tier-mismatch");
    }
  });
});
