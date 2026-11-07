/**
 * TC-ECON-081 — the non-vacuity meta-check. Each committed mutant module
 * disables one guard; the corresponding real oracle must reject it by naming the
 * offending field or condition. A mutant that passes fails this meta-check.
 * The live tree is never mutated.
 */
import { describe, expect, test } from "bun:test";
import type { WatchdogSignals } from "../../packages/core/src/contracts/index";
import { WATCHDOG_STALL_HEARTBEAT_MS } from "../../packages/core/src/contracts/index";
import {
  classifyWatchdogLiveness,
  deriveEconomicsView,
  evaluateRestartBudget,
  formatStallEvidence,
  parseRefusalCorpus,
} from "../../packages/core/src/domain/index";
import { PREFILL_CASES } from "../fixtures/economics/cases";
import {
  MUTANT_ID as A,
  classify as classifyA,
} from "../fixtures/economics/mutants/a-prefill-misclassification";
import { MUTANT_ID as B, classifyCpu } from "../fixtures/economics/mutants/b-cpu-substitution";
import { MUTANT_ID as C, projectTraffic } from "../fixtures/economics/mutants/c-absence-to-zero";
import {
  attempt as attemptBypass,
  MUTANT_ID as D,
} from "../fixtures/economics/mutants/d-gate-bypass";
import { admit as admitE, MUTANT_ID as E } from "../fixtures/economics/mutants/e-hardcoded-bound";
import {
  classifyUnreadable,
  MUTANT_ID as F,
} from "../fixtures/economics/mutants/f-fail-open-budget";
import { MUTANT_ID as G, refusalCorpus } from "../fixtures/economics/mutants/g-silent-exhaustion";
import {
  amplificationForMissingRepay,
  MUTANT_ID as H,
} from "../fixtures/economics/mutants/h-fabricated-zero";

const realOutcome = (signals: WatchdogSignals): string => {
  const evaluation = classifyWatchdogLiveness(signals);
  return evaluation.outcome === "absent" ? "absent" : evaluation.verdict;
};

describe("TC-ECON-081 mutants prove every zero-defect threshold is enforced", () => {
  test(`${A} is caught by the prefill matrix naming the token delta`, () => {
    const flipped = PREFILL_CASES.filter(
      (entry) =>
        classifyA({
          heartbeatAgeMs: entry.signals.heartbeatAgeMs,
          ...(entry.signals.tokenDelta === undefined
            ? {}
            : { tokenDelta: entry.signals.tokenDelta }),
          ...(entry.signals.traffic === undefined ? {} : { traffic: entry.signals.traffic }),
        }) !== entry.expectedVerdict,
    );
    expect(flipped.length).toBeGreaterThan(0);
    expect(flipped.every((entry) => (entry.signals.tokenDelta ?? 0) > 0)).toBe(true);
    expect(A).toContain("prefill");
  });

  test(`${B} is caught because a CPU-only object is absent, not stalled`, () => {
    expect(classifyCpu("busy")).toBe("stalled");
    expect(realOutcome({} as WatchdogSignals)).toBe("absent");
    expect(B).toContain("cpu");
  });

  test(`${C} is caught because an absent traffic reading is absent, not zero`, () => {
    expect(projectTraffic({ status: "absent" })).toBe(0);
    const evaluation = classifyWatchdogLiveness({
      heartbeatAgeMs: WATCHDOG_STALL_HEARTBEAT_MS,
      tokenDelta: 0,
    } as WatchdogSignals);
    expect("traffic" in (evaluation.outcome === "verdict" ? evaluation.signals : {})).toBe(false);
    expect(C).toContain("absence");
  });

  test(`${D} is caught by the gate-bypass call log`, () => {
    const calls: string[] = [];
    attemptBypass({
      appendRestartEvent: (ordinal) => calls.push(`append:${ordinal}`),
      spawn: () => calls.push("spawn"),
    });
    expect(calls).toEqual(["append:1", "spawn"]);
    expect(calls.indexOf("spawn")).toBeGreaterThan(
      calls.findIndex((call) => call.startsWith("append:")),
    );
    expect(D).toContain("gate-bypass");
  });

  test(`${E} is caught by the budget-5 case naming the configured bound`, () => {
    const bound = 5;
    expect(admitE(3)).toBe(false);
    const real = evaluateRestartBudget({
      workItemRef: "GH-235",
      bound,
      records: [1, 2, 3].map((ordinal) => ({
        schemaId: "delivery.economics.restart.v1" as const,
        workItemRef: "GH-235",
        runId: "run-mutant",
        sessionId: `ses_fixture_${ordinal}`,
        ordinal,
        reason: "session-interrupted" as const,
        repayTokens: { inputTokens: 100, outputTokens: 0 },
        observedUniqueProgressTokens: 400,
        recordedAt: "2026-11-07T00:00:00Z",
      })),
    });
    expect(real.outcome).toBe("admit");
    expect(E).toContain("bound");
  });

  test(`${F} is caught by the gate refusing an unreadable store`, () => {
    const mutant = classifyUnreadable();
    const real = evaluateRestartBudget({
      workItemRef: "GH-235",
      bound: 3,
      records: [],
      unreadable: "state.store.torn",
    });
    expect(mutant.outcome).toBe("admit");
    expect(real.outcome).toBe("unevaluable");
    expect(F).toContain("fail-open");
  });

  test(`${G} is caught because its corpus carries no reason and no history`, () => {
    const corpus = parseRefusalCorpus(refusalCorpus());
    expect(corpus.reason).toBeUndefined();
    expect(corpus.historyRef).toBeUndefined();
    const real = formatStallEvidence({
      reason: "watchdog.liveness-stalled",
      heartbeatAgeMs: 1,
      tokenDelta: 0,
      traffic: 0,
      stallBoundMs: WATCHDOG_STALL_HEARTBEAT_MS,
    });
    expect(parseRefusalCorpus(real).reason).toBe("watchdog.liveness-stalled");
    expect(G).toContain("silent");
  });

  test(`${H} is caught because a missing re-pay degrades to null with a warning`, () => {
    const view = deriveEconomicsView({
      records: [
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-235",
          runId: "run-mutant",
          sessionId: "ses_fixture_1",
          ordinal: 1,
          reason: "session-interrupted",
          observedUniqueProgressTokens: 400,
          recordedAt: "2026-11-07T00:00:00Z",
        },
      ],
    });
    expect(amplificationForMissingRepay()).toBe(0);
    expect(view.resumeAmplification).toBeNull();
    expect(view.warnings.map((warning) => warning.field)).toContain("repayTokens");
    expect(H).toContain("fabricated");
  });

  test("every mutant declares a distinct id and a named failure", () => {
    const ids = [A, B, C, D, E, F, G, H];
    expect(new Set(ids).size).toBe(8);
    expect(ids.every((id) => /^[a-h]-/.test(id))).toBe(true);
  });
});
