/**
 * TC-CEREMONY-038 — tiered intake obligates only the ceremonies whose declared
 * `tiers` include the effective tier, and an explicit run of a non-obligated
 * ceremony still executes.
 */
import { describe, expect, test } from "bun:test";
import { BUILTIN_CEREMONY_DECLARATIONS } from "../../packages/core/src/contracts/index";
import { ceremonyTierIntake, evaluateCeremonyTier } from "../../packages/core/src/domain/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const liteVerdict = () =>
  evaluateCeremonyTier({ plan: { tier: { name: "lite" } }, variant: "lite" });

describe("TC-CEREMONY-038 tiered intake is the declared obligation", () => {
  test("lite obligates only the ceremonies whose tiers include lite", () => {
    const obligations = ceremonyTierIntake(BUILTIN_CEREMONY_DECLARATIONS, liteVerdict());
    const byId = new Map(obligations.map((entry) => [entry.ceremony, entry.obligated]));
    expect(byId.get("morning-brief")).toBe(true);
    expect(byId.get("retro-evidence-pass")).toBe(true);
    expect(byId.get("night-watch")).toBe(true);
    expect(byId.get("sprint-rollover")).toBe(false);
    expect(byId.get("testing-session-assessment")).toBe(false);
    expect(byId.get("decision-record-mirror-sync")).toBe(false);
  });

  test("an explicit run of a non-obligated ceremony still executes", () => {
    const prepared = prepareBuiltin("sprint-rollover");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
    } finally {
      prepared.harness.dispose();
    }
  });

  test("a matched escalation re-introduces the full-tier obligations", () => {
    const verdict = evaluateCeremonyTier({
      plan: { tier: { name: "lite", escalationTriggers: ["review-rework"] } },
      variant: "lite",
      evidence: {
        "phase-reopen": false,
        "dor-rework": false,
        "review-rework": true,
        "gate-failure": false,
        "owner-escalation": false,
      },
    });
    expect(verdict.effectiveTier).toBe("full");
    const obligations = ceremonyTierIntake(BUILTIN_CEREMONY_DECLARATIONS, verdict);
    expect(obligations.every((entry) => entry.obligated)).toBe(true);
  });
});
