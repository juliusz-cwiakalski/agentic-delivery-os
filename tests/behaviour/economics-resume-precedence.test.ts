/**
 * TC-ECON-042 — budget refusal precedes economics and the two reasons stay
 * distinct. The four-cell precedence matrix runs through the same production
 * resume entry point; refusals append nothing and never combine identities.
 */
import { describe, expect, test } from "bun:test";
import type {
  EconomicsResumeCapabilityDeclaration,
  EconomicsResumeDecision,
} from "../../packages/core/src/contracts/index";
import {
  createOneShotResumeComposition,
  createSupervisedResumeComposition,
  evaluateResumeEconomics,
  type ResumeEconomicsDeps,
} from "../../packages/core/src/domain/index";
import {
  createMemoryResumeStore,
  RESUME_PRECEDENCE_CASES,
  restartRecord,
  sessionEvidence,
  type MemoryResumeStore,
} from "../fixtures/economics/cases";

const PROMPT_REENTRY: EconomicsResumeCapabilityDeclaration = { modes: ["prompt-reentry"] };

const depsFor = (
  store: MemoryResumeStore,
  bound: number,
  capability: EconomicsResumeCapabilityDeclaration = PROMPT_REENTRY,
): ResumeEconomicsDeps => ({
  store: store.port,
  budget: { readRestartBudget: () => bound },
  capability,
  now: () => "2026-11-07T12:00:00Z",
  runId: "run-precedence",
});

const attempt = (
  deps: ResumeEconomicsDeps,
  cell: (typeof RESUME_PRECEDENCE_CASES)[number],
): EconomicsResumeDecision =>
  evaluateResumeEconomics(deps, {
    workItemRef: "GH-235",
    runId: "run-precedence",
    reason: "session-interrupted",
    evidence: sessionEvidence({
      repayTokens: { inputTokens: cell.repayTokens, outputTokens: 0 },
      observedUniqueProgressTokens: cell.uniqueProgressTokens,
    }),
  });

describe("TC-ECON-042 the four precedence cells through one resume entry point", () => {
  for (const cell of RESUME_PRECEDENCE_CASES) {
    test(`${cell.cell} classifies ${cell.expectedIdentity ?? cell.expectedOutcome}`, () => {
      const records = Array.from({ length: cell.restartCount }, (_, index) =>
        restartRecord({ ordinal: index + 1 }),
      );
      const store = createMemoryResumeStore({ restarts: records });
      const decision = attempt(depsFor(store, cell.bound), cell);
      expect(decision.outcome).toBe(cell.expectedOutcome);
      if (decision.outcome === "refuse") {
        expect(decision.code).toBe(cell.expectedIdentity);
        expect(decision.exitCode).toBe(cell.expectedExit);
      }
      if (decision.outcome === "admit-restart") {
        expect(decision.record.ordinal).toBe(cell.restartCount + 1);
      }
      expect(store.state.appends).toBe(cell.expectedAppends);
      expect(store.state.restarts).toHaveLength(cell.restartCount + cell.expectedAppends);
    });
  }

  test("a past-budget attempt is always refused with the budget reason before economics", () => {
    for (const repayTokens of [1, 10_000]) {
      const store = createMemoryResumeStore({
        restarts: [1, 2, 3].map((ordinal) => restartRecord({ ordinal })),
      });
      const decision = evaluateResumeEconomics(depsFor(store, 3), {
        workItemRef: "GH-235",
        runId: "run-precedence",
        reason: "session-interrupted",
        evidence: sessionEvidence({
          repayTokens: { inputTokens: repayTokens, outputTokens: 0 },
          observedUniqueProgressTokens: 1_000_000,
        }),
      });
      expect(decision.outcome).toBe("refuse");
      if (decision.outcome !== "refuse") return;
      expect(decision.code).toBe("dispatch.restart-budget-exceeded");
      expect(decision.corpus).toContain("reason=dispatch.restart-budget-exceeded");
      expect(decision.corpus).not.toContain("dispatch.resume-uneconomical");
      expect(store.state.appends).toBe(0);
      expect(store.state.exhaustionAppends).toBe(1);
    }
  });

  test("exactly one identity per attempt and one envelope: no combined error", () => {
    const store = createMemoryResumeStore({
      restarts: [1, 2, 3].map((ordinal) => restartRecord({ ordinal })),
    });
    const decision = attempt(depsFor(store, 3), RESUME_PRECEDENCE_CASES[3]!);
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("dispatch.restart-budget-exceeded");
    const identities = new Set(JSON.stringify(decision).match(/dispatch\.[a-z-]+/g) ?? []);
    expect([...identities]).toEqual(["dispatch.restart-budget-exceeded"]);
  });

  test("the two identities resolve to distinct rows with distinct remediation hints", async () => {
    const { resolveAppErrorCode } = await import("../../packages/cli/src/classify");
    const budget = resolveAppErrorCode("dispatch.restart-budget-exceeded");
    const economics = resolveAppErrorCode("dispatch.resume-uneconomical");
    expect(budget.ok && economics.ok).toBe(true);
    if (!budget.ok || !economics.ok) return;
    expect(budget.entry.remediationHint).not.toBe(economics.entry.remediationHint);
    expect(budget.entry.code).not.toBe(economics.entry.code);
  });

  test("both production compositions classify the four cells identically", () => {
    for (const cell of RESUME_PRECEDENCE_CASES) {
      const records = Array.from({ length: cell.restartCount }, (_, index) =>
        restartRecord({ ordinal: index + 1 }),
      );
      const supervisedStore = createMemoryResumeStore({ restarts: records });
      const oneShotStore = createMemoryResumeStore({ restarts: records });
      const input = {
        workItemRef: "GH-235",
        runId: "run-precedence",
        reason: "session-interrupted" as const,
        evidence: sessionEvidence({
          repayTokens: { inputTokens: cell.repayTokens, outputTokens: 0 },
          observedUniqueProgressTokens: cell.uniqueProgressTokens,
        }),
      };
      const supervised = createSupervisedResumeComposition(depsFor(supervisedStore, cell.bound));
      const oneShot = createOneShotResumeComposition(depsFor(oneShotStore, cell.bound));
      expect(supervised.mode).toBe("supervised");
      expect(oneShot.mode).toBe("one-shot");
      const left = supervised.attempt(input);
      const right = oneShot.attempt(input);
      expect(left.outcome).toBe(right.outcome);
      if (left.outcome === "refuse" && right.outcome === "refuse") {
        expect(left.code).toBe(right.code);
        expect(left.corpus).toBe(right.corpus);
      }
    }
  });
});
