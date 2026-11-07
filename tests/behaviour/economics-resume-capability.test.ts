/**
 * TC-ECON-043 — resume economics is capability-driven and fail-closed. An
 * absent declaration is unsupported, a declared-but-gapped capability refuses
 * naming the gap, and incomplete session evidence refuses naming the missing
 * fact; a fabricated zero re-pay is never admitted.
 */
import { describe, expect, test } from "bun:test";
import type {
  EconomicsResumeCapabilityDeclaration,
  EconomicsResumeDecision,
} from "../../packages/core/src/contracts/index";
import {
  evaluateResumeEconomics,
  isEconomicalRepay,
  type ResumeEconomicsDeps,
} from "../../packages/core/src/domain/index";
import {
  createMemoryResumeStore,
  sessionEvidence,
  type MemoryResumeStore,
} from "../fixtures/economics/cases";

const depsFor = (
  store: MemoryResumeStore,
  capability: EconomicsResumeCapabilityDeclaration | undefined,
): ResumeEconomicsDeps => ({
  store: store.port,
  budget: { readRestartBudget: () => 3 },
  capability,
  now: () => "2026-11-07T12:00:00Z",
  runId: "run-capability",
});

const input = {
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: sessionEvidence(),
};

const attempt = (
  capability: EconomicsResumeCapabilityDeclaration | undefined,
  evidence = sessionEvidence(),
): { decision: EconomicsResumeDecision; store: MemoryResumeStore } => {
  const store = createMemoryResumeStore();
  return {
    store,
    decision: evaluateResumeEconomics(depsFor(store, capability), {
      ...input,
      evidence,
    }),
  };
};

describe("TC-ECON-043 resume economics is capability-driven and fail-closed", () => {
  test("a declared attach capability continues without spawning or consuming an ordinal", () => {
    const { decision, store } = attempt({ modes: ["attach-continue"] });
    expect(decision.outcome).toBe("attach-continue");
    if (decision.outcome !== "attach-continue") return;
    expect(decision.ordinalConsumed).toBe(false);
    expect(decision.sessionId).toBe("ses_fixture_1");
    expect(store.state.appends).toBe(0);
  });

  test("an absent capability declaration is unsupported, never attach-capable", () => {
    const { decision, store } = attempt(undefined);
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("harness.capability.gap");
    expect(decision.corpus).toContain("capability=attach-continue");
    expect(store.state.appends).toBe(0);
  });

  test("a declared-but-gapped capability refuses naming the gap with zero invocations", () => {
    const { decision, store } = attempt({
      modes: ["attach-continue"],
      attachGap: "harness-unsupported",
    });
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("harness.capability.gap");
    expect(decision.reason).toContain("harness-unsupported");
    expect(decision.corpus).toContain("capability=harness-unsupported");
    expect(store.state.appends).toBe(0);
    expect(store.state.reads).toBe(0);
  });

  test("incomplete session evidence refuses naming the missing fact and never fabricates 0", () => {
    const unreadableTokens = attempt(
      { modes: ["prompt-reentry"] },
      sessionEvidence({ tokensReadable: false }),
    );
    expect(unreadableTokens.decision.outcome).toBe("refuse");
    if (unreadableTokens.decision.outcome === "refuse") {
      expect(unreadableTokens.decision.code).toBe("harness.telemetry.extraction-failed");
      expect(unreadableTokens.decision.corpus).toContain("field=token-facts");
    }
    expect(unreadableTokens.store.state.appends).toBe(0);

    const unreadableCost = attempt(
      { modes: ["prompt-reentry"] },
      sessionEvidence({ costReadable: false }),
    );
    expect(unreadableCost.decision.outcome).toBe("refuse");
    if (unreadableCost.decision.outcome === "refuse") {
      expect(unreadableCost.decision.corpus).toContain("field=cost");
    }

    const missingRepay = evaluateResumeEconomics(
      depsFor(createMemoryResumeStore(), { modes: ["prompt-reentry"] }),
      {
        ...input,
        evidence: { sessionId: "ses_fixture_1", treeRoot: "ses_fixture_1", tokensReadable: true },
      },
    );
    expect(missingRepay.outcome).toBe("refuse");
    if (missingRepay.outcome === "refuse") {
      expect(missingRepay.corpus).toContain("field=repayTokens");
      expect(missingRepay.corpus).not.toContain("repayTokens=0");
    }
  });

  test("the undefined-capability-defaults-to-attach mutant fails the fail-closed control", () => {
    // Mutant: treat an absent declaration as attach-capable.
    const mutant = (capability: EconomicsResumeCapabilityDeclaration | undefined) =>
      capability === undefined || capability.modes.includes("attach-continue")
        ? "attach-continue"
        : "prompt-reentry";
    expect(mutant(undefined)).toBe("attach-continue");
    const { decision } = attempt(undefined);
    expect(decision.outcome).not.toBe("attach-continue");
  });

  test("the economical classification is strict at the boundary", () => {
    expect(isEconomicalRepay({ repayTokens: 100, uniqueProgressTokens: 100 })).toBe(true);
    expect(isEconomicalRepay({ repayTokens: 101, uniqueProgressTokens: 100 })).toBe(false);
    expect(isEconomicalRepay({ repayTokens: 1, uniqueProgressTokens: 0 })).toBe(false);
    expect(isEconomicalRepay({ repayTokens: 1, uniqueProgressTokens: undefined })).toBe(false);
  });
});
