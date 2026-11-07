/**
 * Resume economics classification and the two production compositions
 * (GH-235 F-3, F-4, DEC-3, DEC-7, D-10, D-13).
 *
 * Pure over injected ports: a durable record port and a budget-policy port.
 * Both the supervised-style and one-shot-style compositions delegate admission
 * to the SAME imported gate function, so a single seam decides restarts, and no
 * composition declares a spawn, kill, steer, or restart-execution capability.
 * Precedence (DEC-7): a past-budget attempt is always refused with the budget
 * reason, evaluated before economics, so exactly one identity is emitted.
 */
import {
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXIT_REFUSAL,
  ECONOMICS_EXIT_UNAVAILABLE,
  type EconomicsBudgetPolicyPort,
  type EconomicsExhaustionRecord,
  type EconomicsResumeCapabilityDeclaration,
  type EconomicsResumeComposition,
  type EconomicsResumeCompositionMode,
  type EconomicsResumeDecision,
  type EconomicsResumeInput,
  type EconomicsResumeStorePort,
  type EconomicsRestartRecord,
} from "#contracts";
import { evaluateRestartBudget } from "./economics-budget.js";
import {
  economicsReferenceFor,
  formatCapabilityGapEvidence,
  formatIncompleteEvidence,
  formatUneconomicalEvidence,
  formatUnevaluableEvidence,
} from "./economics-evidence.js";

/** The injected dependencies of a resume composition (data only). */
export type ResumeEconomicsDeps = {
  readonly store: EconomicsResumeStorePort;
  readonly budget: EconomicsBudgetPolicyPort;
  /** An absent declaration is unsupported; never an assumed attach capability. */
  readonly capability: EconomicsResumeCapabilityDeclaration | undefined;
  readonly now: () => string;
  /** The run identity carried on the restart and terminal records. */
  readonly runId: string;
};

const refuseCapabilityGap = (
  input: EconomicsResumeInput,
  capability: string,
): EconomicsResumeDecision => ({
  outcome: "refuse",
  code: "harness.capability.gap",
  exitCode: ECONOMICS_EXIT_REFUSAL,
  reason: `resume capability ${capability} is not declared as attach-and-continue`,
  corpus: formatCapabilityGapEvidence({
    reason: "harness.capability.gap",
    capability,
    sessionId: input.evidence.sessionId,
  }),
});

const refuseIncomplete = (
  input: EconomicsResumeInput,
  field: string,
  detail: string,
): EconomicsResumeDecision => ({
  outcome: "refuse",
  code: "harness.telemetry.extraction-failed",
  exitCode: ECONOMICS_EXIT_REFUSAL,
  reason: `resume economics cannot be evaluated: ${detail}`,
  corpus: formatIncompleteEvidence({
    reason: "harness.telemetry.extraction-failed",
    field,
    workItemRef: input.workItemRef,
  }),
});

const repayTotalOf = (input: EconomicsResumeInput): number | undefined =>
  input.evidence.repayTokens === undefined
    ? undefined
    : input.evidence.repayTokens.inputTokens + input.evidence.repayTokens.outputTokens;

/** Whether the measured re-pay fits inside the observed unique progress. */
export const isEconomicalRepay = (input: {
  readonly repayTokens: number;
  readonly uniqueProgressTokens: number | null | undefined;
}): boolean =>
  typeof input.uniqueProgressTokens === "number" &&
  input.uniqueProgressTokens > 0 &&
  input.repayTokens <= input.uniqueProgressTokens;

const restartRecordFor = (
  deps: ResumeEconomicsDeps,
  input: EconomicsResumeInput,
  ordinal: number,
): EconomicsRestartRecord => ({
  schemaId: "delivery.economics.restart.v1",
  workItemRef: input.workItemRef,
  runId: deps.runId,
  sessionId: input.evidence.sessionId,
  ordinal,
  reason: input.reason,
  ...(input.evidence.repayTokens === undefined
    ? {}
    : {
        repayTokens: {
          inputTokens: input.evidence.repayTokens.inputTokens,
          outputTokens: input.evidence.repayTokens.outputTokens,
        },
      }),
  ...(input.evidence.observedUniqueProgressTokens === undefined
    ? {}
    : { observedUniqueProgressTokens: input.evidence.observedUniqueProgressTokens }),
  recordedAt: deps.now(),
});

const exhaustionRecordFor = (
  deps: ResumeEconomicsDeps,
  input: EconomicsResumeInput,
  restarts: number,
): EconomicsExhaustionRecord => ({
  schemaId: "delivery.economics.exhaustion.v1",
  workItemRef: input.workItemRef,
  runId: deps.runId,
  reason: "dispatch.restart-budget-exceeded",
  restarts,
  historyRef: economicsReferenceFor(input.workItemRef),
  terminal: true,
  options: [...ECONOMICS_EXHAUSTION_OPTIONS],
  recordedAt: deps.now(),
});

/**
 * Classify one resume attempt. Exactly one decision leaves this function; the
 * budget gate is evaluated first, so an exhausted delivery can never reach the
 * economics branch.
 */
export const evaluateResumeEconomics = (
  deps: ResumeEconomicsDeps,
  input: EconomicsResumeInput,
): EconomicsResumeDecision => {
  const capability = deps.capability;
  if (capability === undefined) return refuseCapabilityGap(input, "attach-continue");
  if (capability.attachGap !== undefined) return refuseCapabilityGap(input, capability.attachGap);
  if (capability.modes.includes("attach-continue")) {
    return {
      outcome: "attach-continue",
      mode: "attach-continue",
      sessionId: input.evidence.sessionId,
      treeRoot: input.evidence.treeRoot,
      ordinalConsumed: false,
      evidence: `attach-and-continue used for session ${input.evidence.sessionId}; prefill not re-paid`,
    };
  }

  if (input.evidence.tokensReadable === false) {
    return refuseIncomplete(input, "token-facts", "the session token facts are unreadable");
  }
  if (input.evidence.costReadable === false) {
    return refuseIncomplete(input, "cost", "the session cost figure is unreadable");
  }
  const repay = repayTotalOf(input);
  if (repay === undefined) {
    return refuseIncomplete(input, "repayTokens", "the prefill re-pay token fact is missing");
  }

  const recordsRead = deps.store.readDeliveryRecords(input.workItemRef);
  if (!recordsRead.ok) {
    return {
      outcome: "unevaluable",
      code: recordsRead.code,
      exitCode:
        recordsRead.code === "state.permission.denied"
          ? ECONOMICS_EXIT_REFUSAL
          : ECONOMICS_EXIT_UNAVAILABLE,
      reason: `the delivery's economics records are unevaluable: ${recordsRead.code}`,
      corpus: formatUnevaluableEvidence({
        reason: recordsRead.code,
        workItemRef: input.workItemRef,
      }),
    };
  }

  const gate = evaluateRestartBudget({
    workItemRef: input.workItemRef,
    bound: deps.budget.readRestartBudget(input.workItemRef),
    records: recordsRead.restarts,
  });
  if (gate.outcome === "unevaluable") {
    return {
      outcome: "unevaluable",
      code: gate.code,
      exitCode: gate.exitCode,
      reason: `the restart budget is unevaluable: ${gate.code}`,
      corpus: gate.corpus,
    };
  }
  if (gate.outcome === "refuse-budget") {
    // D-10: the first refusal that observes exhaustion appends the single
    // terminal record; later refusals re-read the same terminal truth.
    deps.store.ensureExhaustionRecord(exhaustionRecordFor(deps, input, gate.count));
    return {
      outcome: "refuse",
      code: "dispatch.restart-budget-exceeded",
      exitCode: ECONOMICS_EXIT_REFUSAL,
      reason: "the delivery's restart budget is exhausted; the restart is refused before any spawn",
      corpus: gate.corpus,
    };
  }

  if (
    !isEconomicalRepay({
      repayTokens: repay,
      uniqueProgressTokens: input.evidence.observedUniqueProgressTokens,
    })
  ) {
    return {
      outcome: "refuse",
      code: "dispatch.resume-uneconomical",
      exitCode: ECONOMICS_EXIT_REFUSAL,
      reason: "the resume path would re-pay prefill and is uneconomical",
      corpus: formatUneconomicalEvidence({
        reason: "dispatch.resume-uneconomical",
        repayTokens: repay,
        workItemRef: input.workItemRef,
      }),
    };
  }

  const record = restartRecordFor(deps, input, gate.nextOrdinal);
  const appended = deps.store.appendRestartEvent(record);
  if (!appended.ok) {
    return {
      outcome: "unevaluable",
      code: appended.code,
      exitCode:
        appended.code === "state.permission.denied"
          ? ECONOMICS_EXIT_REFUSAL
          : ECONOMICS_EXIT_UNAVAILABLE,
      reason: `the restart event did not land: ${appended.code}`,
      corpus: formatUnevaluableEvidence({
        reason: appended.code,
        workItemRef: input.workItemRef,
      }),
    };
  }
  return {
    outcome: "admit-restart",
    record,
    evidence: `restart ordinal ${record.ordinal} recorded with re-pay ${String(repay)} tokens`,
  };
};

const composition = (
  mode: EconomicsResumeCompositionMode,
  deps: ResumeEconomicsDeps,
): EconomicsResumeComposition => ({
  mode,
  attempt: (input) => evaluateResumeEconomics(deps, input),
});

/** The supervised-style resume composition (daemon-shaped, exercised in-process). */
export const createSupervisedResumeComposition = (
  deps: ResumeEconomicsDeps,
): EconomicsResumeComposition => composition("supervised", deps);

/** The one-shot resume composition (state-only; no daemon or live supervisor). */
export const createOneShotResumeComposition = (
  deps: ResumeEconomicsDeps,
): EconomicsResumeComposition => composition("one-shot", deps);
