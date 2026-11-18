/**
 * TC-CEREMONY-033..037 and TC-CEREMONY-051 (behaviour half) — the single-source
 * tier mapping: pinned sets element for element, variant authority, canonical
 * plan-phase narrowing, the five evidence-gated escalation triggers, and the
 * verbatim `unevaluated` finding.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type PlanTierDeclaration,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
} from "../../packages/core/src/contracts/index";
import {
  type CeremonyTierEvidence,
  evaluateCeremonyTier,
} from "../../packages/core/src/domain/index";

type TierCase = {
  id: string;
  declaredTier: string;
  variant: "full" | "lite";
  phases?: number[];
  triggers?: string[];
  evidence?: Record<string, boolean>;
  expectedTier: "full" | "lite";
  expectedSource: string;
  expectedFindings: string[];
  expectedEscalations?: number;
};

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/ceremony/tier/cases.json"), "utf8"),
) as TierCase[];

const runCase = (entry: TierCase) => {
  const tier: PlanTierDeclaration = {
    name: entry.declaredTier,
    ...(entry.phases === undefined ? {} : { phases: entry.phases }),
    ...(entry.triggers === undefined ? {} : { escalationTriggers: entry.triggers }),
  };
  const evidence = (entry.evidence ?? {}) as Partial<CeremonyTierEvidence>;
  return evaluateCeremonyTier({
    plan: { tier },
    variant: entry.variant,
    evidence: {
      "phase-reopen": evidence["phase-reopen"] ?? false,
      "dor-rework": evidence["dor-rework"] ?? false,
      "review-rework": evidence["review-rework"] ?? false,
      "gate-failure": evidence["gate-failure"] ?? false,
      "owner-escalation": evidence["owner-escalation"] ?? false,
    },
  });
};

describe("TC-CEREMONY-033 the pinned lite and full sets are imported element for element", () => {
  test("T-01 full uses the delivered full set verbatim", () => {
    const entry = cases.find((candidate) => candidate.id === "T-01");
    if (entry === undefined) throw new Error("T-01 missing");
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe("full");
    expect(verdict.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full]);
    expect(verdict.phaseSetSource).toBe("PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full");
    expect(verdict.findings).toEqual([]);
  });

  test("T-02 lite uses the delivered six-phase set verbatim", () => {
    const entry = cases.find((candidate) => candidate.id === "T-02");
    if (entry === undefined) throw new Error("T-02 missing");
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe("lite");
    expect(verdict.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite]);
    expect(verdict.phaseSet).toHaveLength(6);
    expect(verdict.phaseSet).not.toContain("test_planning");
  });
});

describe("TC-CEREMONY-034 the variant governs a disagreement", () => {
  test.each(["T-03", "T-04"])("%s reports tier-mismatch and never blocks", (id) => {
    const entry = cases.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`${id} missing`);
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe(entry.variant);
    expect(verdict.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT[entry.variant]]);
    expect(verdict.findings.map((finding) => finding.kind)).toEqual(["tier-mismatch"]);
    expect(verdict.findings[0]?.subject).toContain(entry.declaredTier);
    expect(verdict.findings[0]?.subject).toContain(entry.variant);
  });
});

describe("TC-CEREMONY-035 the five escalation triggers are evidence-gated", () => {
  test("T-07 escalates on recorded evidence and names trigger plus evidence", () => {
    const entry = cases.find((candidate) => candidate.id === "T-07");
    if (entry === undefined) throw new Error("T-07 missing");
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe("full");
    expect(verdict.phaseSet).toEqual([...PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full]);
    expect(verdict.escalations).toHaveLength(1);
    expect(verdict.escalations[0]).toMatchObject({
      trigger: "review-rework",
      evidence: "recorded:review-rework",
    });
    expect(verdict.escalationTriggers[0]?.state).toBe("matched");
  });

  test("T-08 does not escalate on a mere declaration", () => {
    const entry = cases.find((candidate) => candidate.id === "T-08");
    if (entry === undefined) throw new Error("T-08 missing");
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe("lite");
    expect(verdict.escalations).toEqual([]);
    expect(verdict.escalationTriggers[0]?.state).toBe("unmatched");
  });

  test("T-10 every closed trigger is evaluable; all five with evidence escalate", () => {
    const entry = cases.find((candidate) => candidate.id === "T-10");
    if (entry === undefined) throw new Error("T-10 missing");
    const verdict = runCase(entry);
    expect(verdict.effectiveTier).toBe("full");
    expect(verdict.escalations).toHaveLength(5);
    expect(verdict.escalationTriggers.every((trigger) => trigger.state === "matched")).toBe(true);
  });

  test("a sixth undeclared trigger is never silently accepted", () => {
    const verdict = evaluateCeremonyTier({
      plan: { tier: { name: "lite", escalationTriggers: ["owner-mood"] } },
      variant: "lite",
    });
    expect(verdict.escalationTriggers[0]?.state).toBe("unevaluated");
    expect(verdict.escalations).toEqual([]);
  });
});

describe("TC-CEREMONY-036 an unknown trigger is reported verbatim as unevaluated", () => {
  test("T-09 keeps the string and never treats it as false or drops it", () => {
    const entry = cases.find((candidate) => candidate.id === "T-09");
    if (entry === undefined) throw new Error("T-09 missing");
    const verdict = runCase(entry);
    expect(verdict.escalationTriggers).toEqual([{ trigger: "owner-mood", state: "unevaluated" }]);
    expect(verdict.findings).toEqual([
      expect.objectContaining({ kind: "unevaluated-trigger", subject: "owner-mood" }),
    ]);
  });
});

describe("TC-CEREMONY-037 plan tier.phases narrows within the canonical eleven", () => {
  test("T-05 applies the declared subset in canonical order", () => {
    const entry = cases.find((candidate) => candidate.id === "T-05");
    if (entry === undefined) throw new Error("T-05 missing");
    const verdict = runCase(entry);
    expect(verdict.phaseSet).toEqual(["clarify_scope", "dor_check", "system_spec_update"]);
    expect(verdict.phaseSetSource).toBe("plan.tier.phases");
  });

  test("T-06 reports the non-canonical id and does not apply it", () => {
    const entry = cases.find((candidate) => candidate.id === "T-06");
    if (entry === undefined) throw new Error("T-06 missing");
    const verdict = runCase(entry);
    expect(verdict.phaseSet).toEqual(["clarify_scope"]);
    expect(verdict.findings).toEqual([
      expect.objectContaining({ kind: "unresolved-phase", subject: "99" }),
    ]);
  });
});
