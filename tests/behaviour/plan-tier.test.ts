/**
 * TC-DPLAN-004, TC-DPLAN-005, TC-DPLAN-006 — the ceremony tier is echoed from
 * plan data, an absent tier is never defaulted, an unknown tier is classified,
 * and tier phase sets/triggers round-trip as inert data.
 */
import { describe, expect, test } from "bun:test";
import { validateYamlFixture } from "../fixtures/plan/harness/index";

describe("TC-DPLAN-004 tier echoed verbatim", () => {
  test("each plan echoes its own declared tier and phase set", () => {
    const full = validateYamlFixture("GH-306", "valid/tier-full.yaml");
    const lite = validateYamlFixture("GH-306", "valid/tier-lite.yaml");
    expect(full.verdict).toBe("valid");
    expect(lite.verdict).toBe("valid");
    expect(full.tier).toBe("full");
    expect(lite.tier).toBe("lite");
    expect(full.perPhase.every((phase) => phase.tier === "full")).toBe(true);
    expect(lite.perPhase.every((phase) => phase.tier === "lite")).toBe(true);
    expect(full.tierDeclaration?.phases).toEqual([1, 2, 3, 4]);
    expect(lite.tierDeclaration?.phases).toEqual([1]);
  });

  test("a tier-less plan is classified, never defaulted to a built-in set", () => {
    const verdict = validateYamlFixture("GH-306", "invalid/missing-tier.yaml");
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.tier).toBeUndefined();
    expect(verdict.errors.some((error) => error.field === "tier")).toBe(true);
    expect(verdict.perPhase.every((phase) => phase.tier === "")).toBe(true);
  });
});

describe("TC-DPLAN-005 unknown tier", () => {
  test("an unknown tier is rejected with plan.tier.unknown naming tier.name", () => {
    const verdict = validateYamlFixture("GH-306", "invalid/unknown-tier.yaml");
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    const error = verdict.errors.find((entry) => entry.code === "plan.tier.unknown");
    expect(error?.field).toBe("tier.name");
    expect(error?.detail).toBe("minimal");
    expect(verdict.tier).toBeUndefined();
  });
});

describe("TC-DPLAN-006 tier data is inert", () => {
  test("phase sets and escalation triggers round-trip unchanged and complete", () => {
    const verdict = validateYamlFixture("GH-306", "valid/tier-full.yaml");
    expect(verdict.tierDeclaration).toEqual({
      name: "full",
      phases: [1, 2, 3, 4],
      escalationTriggers: ["owner-approval", "architecture-review"],
    });
  });

  test("no escalation-trigger outcome appears in the verdict", () => {
    const verdict = validateYamlFixture("GH-306", "valid/tier-full.yaml");
    const payload = JSON.stringify(verdict);
    expect(payload).not.toContain("triggered");
    expect(payload).not.toContain("evaluated");
  });
});
