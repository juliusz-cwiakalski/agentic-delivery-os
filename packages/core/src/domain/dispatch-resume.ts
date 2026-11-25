/**
 * The pure resume and dispatch-admission policy (GH-239 F-3; AC-F3-1..AC-F3-4).
 *
 * Resume-mode selection, phase-ledger continuity, restart admission (delegated
 * to the delivered restart-budget gate with the bound supplied as data), and
 * resume economics are pure functions. They never spawn, never append, and
 * never choose an exit literal.
 */
import {
  DELIVERY_RESULT_TOKENS,
  type DispatchResumeMode,
  ECONOMICS_RESTART_SCHEMA_ID,
  type EconomicsRestartRecord,
  HARNESS_OUTCOMES,
} from "#contracts";
import { evaluateRestartBudget } from "./economics-budget.js";
import { laneWorktreeBranch } from "./lane-worktree-plan.js";

/** `f` failed, `mr` max-restarts, `su` state-unverified. */
const [, , , , f, , mr, su] = DELIVERY_RESULT_TOKENS;
const O_FAILED = HARNESS_OUTCOMES[2];

/** The selected resume mode and its recorded cost facts. */
export type DispatchResumePlan = {
  readonly mode: DispatchResumeMode;
  readonly prefillCostAcknowledged: boolean;
  /** The completed phases that must not be re-executed. */
  readonly skipCompletedPhases: readonly string[];
  /** Attach-and-continue consumes no restart ordinal. */
  readonly consumesRestartOrdinal: boolean;
};

/**
 * Plan the resume: an adapter with resume injection attaches and continues;
 * otherwise the lane is re-entered with a prompt and the prefill re-pay is
 * acknowledged in the record and output.
 */
export const planDispatchResume = (input: {
  readonly adapterSupportsResumeInjection: boolean;
  readonly completedPhases: readonly string[];
}): DispatchResumePlan => {
  const mode: DispatchResumeMode = input.adapterSupportsResumeInjection
    ? "attach-continue"
    : "resume-prompt-reentry";
  return {
    mode,
    prefillCostAcknowledged: mode === "resume-prompt-reentry",
    skipCompletedPhases: [...input.completedPhases],
    consumesRestartOrdinal: mode === "resume-prompt-reentry",
  };
};

/**
 * The caller scope of a restart admission (GH-347 AC-F3-2, AC-F6-6, DEC-5).
 *
 * `budget-consulting` (the DEFAULT) consults the persisted bound and refuses at
 * or above it; `operator-resume` admits regardless of the bound because an
 * operator resume is guidance, not an automatic restart. The default keeps
 * today's refusing behaviour, so no caller can silently begin admitting.
 */
export const DISPATCH_RESTART_SCOPES = ["budget-consulting", "operator-resume"] as const;

export type DispatchRestartScope = (typeof DISPATCH_RESTART_SCOPES)[number];

/** The restart-admission decision (the delivered gate with a data bound). */
export type DispatchRestartDecision =
  | {
      readonly admitted: true;
      readonly count: number;
      readonly bound: number;
      readonly nextOrdinal: number;
    }
  | {
      readonly admitted: false;
      readonly reason: "dispatch.restart-budget-exceeded";
      readonly count: number;
      readonly bound: number;
      readonly terminal: true;
      readonly escalation: "restart-budget-exhausted";
    };

/**
 * Admit or refuse one restart. A zero/absent bound means the lane policy is not
 * composed and admission is unbounded; at or above a positive bound the attempt
 * is refused with the terminal marker and no requeue.
 */
export const admitDispatchRestart = (input: {
  readonly count: number;
  readonly bound: number;
  /** Absent keeps the budget-consulting scope (today's refusing behaviour). */
  readonly scope?: DispatchRestartScope;
}): DispatchRestartDecision => {
  // The operator resume is guidance, never an automatic restart: it never
  // consults the persisted budget and charges no ordinal.
  if (input.scope === "operator-resume") {
    return { admitted: true, count: input.count, bound: input.bound, nextOrdinal: input.count };
  }
  // A zero/absent bound means the lane policy is not composed: admission is
  // unbounded and the delivered gate is not consulted.
  if (input.bound <= 0) {
    return { admitted: true, count: input.count, bound: input.bound, nextOrdinal: input.count + 1 };
  }
  // Delegate to the one delivered restart-budget gate; the count is supplied as
  // the ordinal-bearing record history, so no second predicate exists here.
  const records: readonly EconomicsRestartRecord[] = Array.from(
    { length: input.count },
    (_, index) =>
      ({
        schemaId: ECONOMICS_RESTART_SCHEMA_ID,
        workItemRef: "dispatch",
        runId: "dispatch",
        sessionId: "dispatch",
        ordinal: index + 1,
        reason: "session-interrupted",
        recordedAt: "1970-01-01T00:00:00.000Z",
      }) satisfies EconomicsRestartRecord,
  );
  const verdict = evaluateRestartBudget({
    workItemRef: "dispatch",
    bound: input.bound,
    records,
  });
  if (verdict.outcome === "admit") {
    return {
      admitted: true,
      count: verdict.count,
      bound: input.bound,
      nextOrdinal: verdict.nextOrdinal,
    };
  }
  return {
    admitted: false,
    reason: "dispatch.restart-budget-exceeded",
    count: input.count,
    bound: input.bound,
    terminal: true,
    escalation: "restart-budget-exhausted",
  };
};

/** The resume-economics verdict. */
export type DispatchResumeEconomics =
  | {
      readonly admitted: true;
      readonly mode: DispatchResumeMode;
      readonly consumesRestartOrdinal: boolean;
    }
  | {
      readonly admitted: false;
      readonly code: "dispatch.resume-uneconomical" | "dispatch.state-unverified";
      readonly mode: DispatchResumeMode;
    };

/**
 * Evaluate resume economics. Attach-and-continue always admits and consumes no
 * ordinal; an uneconomical re-entry is refused; unreadable cost facts are
 * refused as unevaluable rather than admitted.
 */
export const evaluateDispatchResumeEconomics = (input: {
  readonly mode: DispatchResumeMode;
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
}): DispatchResumeEconomics => {
  if (input.mode === "attach-continue") {
    return { admitted: true, mode: input.mode, consumesRestartOrdinal: false };
  }
  if (
    input.prefillCost === undefined ||
    input.prefillCost === null ||
    input.uniqueProgress === undefined ||
    input.uniqueProgress === null
  ) {
    return { admitted: false, code: "dispatch.state-unverified", mode: input.mode };
  }
  if (input.prefillCost > input.uniqueProgress) {
    return { admitted: false, code: "dispatch.resume-uneconomical", mode: input.mode };
  }
  return { admitted: true, mode: input.mode, consumesRestartOrdinal: true };
};

/** The token/outcome pair each admission refusal records (Appendix G). */
export const admissionRefusalPair = (
  code:
    | "dispatch.restart-budget-exceeded"
    | "dispatch.resume-uneconomical"
    | "dispatch.state-unverified",
): {
  readonly token: (typeof DELIVERY_RESULT_TOKENS)[number];
  readonly outcome: typeof O_FAILED;
  readonly comparisonReason: "dispatch-session-family" | "comparison-source-unavailable";
} => {
  if (code === "dispatch.restart-budget-exceeded") {
    return { token: mr, outcome: O_FAILED, comparisonReason: "dispatch-session-family" };
  }
  return {
    token: code === "dispatch.state-unverified" ? su : f,
    outcome: O_FAILED,
    comparisonReason: "comparison-source-unavailable",
  };
};

/* ------------------------------------------------------------------------- */
/* GH-404 F-4 — the worktree resume rules. One worktree per work item; the   */
/* context-less lane resumes exactly as today (DEC-8). Pure over injected    */
/* facts; no provisioning, no I/O.                                           */
/* ------------------------------------------------------------------------- */

/** The lane's worktree branch, derived from the work item ref. */
export { laneWorktreeBranch };

/** The resume plan for a lane's recorded worktree context (F-4, DEC-8). */
export type LaneWorktreeResumePlan =
  | {
      readonly kind: "reuse";
      readonly worktreePath: string;
      /** The branch the worktree must be on: the lane's own worktree branch. */
      readonly branch: string;
    }
  | {
      /** The context-less shape: resume exactly as today in the invoking checkout (DEC-8). */
      readonly kind: "in-checkout";
    }
  | {
      readonly kind: "lane-error";
      readonly reason: "worktree-missing" | "branch-mismatch";
      readonly detail: string;
    };

/**
 * Verify the lane's recorded worktree for one resume (F-4, NFR-3, DEC-8).
 *
 * A record with no worktree context plans today's in-checkout shape and never
 * provisions a worktree. A recorded worktree that is missing or has moved off
 * the lane's branch is a lane error naming the problem — never a silent
 * re-provision and never a second worktree.
 */
export const planLaneWorktreeResume = (input: {
  /** The lane record's additive worktree context; absent is the context-less shape. */
  readonly worktreePath?: string;
  readonly ref: string;
  /** Whether the recorded worktree exists at its recorded path (injected observation). */
  readonly worktreePresent: boolean;
  /** The branch the worktree is currently on (injected observation; absent when missing). */
  readonly worktreeBranch?: string;
}): LaneWorktreeResumePlan => {
  if (input.worktreePath === undefined) return { kind: "in-checkout" };
  const expectedBranch = laneWorktreeBranch(input);
  if (!input.worktreePresent) {
    return {
      kind: "lane-error",
      reason: "worktree-missing",
      detail:
        `the lane worktree ${input.worktreePath} recorded for ${input.ref} is missing ` +
        `(expected branch ${expectedBranch}); restore it or close the lane out — resume never re-provisions`,
    };
  }
  if (input.worktreeBranch !== expectedBranch) {
    return {
      kind: "lane-error",
      reason: "branch-mismatch",
      detail:
        `the lane worktree ${input.worktreePath} recorded for ${input.ref} is on ` +
        `${input.worktreeBranch === undefined ? "no branch (detached)" : input.worktreeBranch}, ` +
        `not the lane branch ${expectedBranch}; resume never moves or re-provisions a worktree`,
    };
  }
  return { kind: "reuse", worktreePath: input.worktreePath, branch: expectedBranch };
};
