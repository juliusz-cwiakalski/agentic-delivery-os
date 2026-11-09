/**
 * The pure join-or-resume-or-spawn decision (GH-241 F-2, DEC-7; AC-F2-1..6).
 *
 * Every input is injected fact data: no session read, clock, environment, or
 * model call happens here. The decision records the reason and the ordinal
 * consumption that the caller persists before applying the effect.
 */
import type { CoordinatorDecisionKind, CoordinatorIterationReason } from "#contracts";

/** The recorded prior-session facts the decision reads. */
export type CoordinatorPriorSession = {
  /** Whether the prior session produced a clean completion record. */
  readonly completedCleanly: boolean;
  /** Whether the delivered harness session port declares a working resume. */
  readonly resumable: boolean;
  /** The recorded context token count, or `null` when it was never sourced. */
  readonly contextTokens: number | null;
};

/** The decision inputs; every value is injected, none is read ambiently. */
export type CoordinatorLifecycleFacts = {
  /** The recorded session is alive right now. */
  readonly live: boolean;
  /** The prior session facts, or `null` when there is no prior session. */
  readonly prior: CoordinatorPriorSession | null;
  /** The delivered harness session port declares resume. */
  readonly resumeDeclared: boolean;
  /** The resolved `coordinator.resume-context-limit` policy value. */
  readonly contextLimit: number;
};

/** One recorded decision: the kind, its closed reason, and ordinal accounting. */
export type CoordinatorLifecycleDecision = {
  readonly kind: CoordinatorDecisionKind;
  readonly reason: CoordinatorIterationReason;
  /** The number of restart ordinals the decision consumes (`0` or `1`). */
  readonly consumesOrdinal: 0 | 1;
};

/**
 * Decide exactly one lifecycle action.
 *
 * `join-live` attaches and consumes none. `resume-context` requires an unclean,
 * resumable prior session whose known context is below the limit, and consumes
 * one recovery ordinal. `spawn-fresh` consumes one ordinal for the three
 * recovery reasons and none for `initial-start` / `clean-iteration-end`.
 */
export const decideLifecycle = (facts: CoordinatorLifecycleFacts): CoordinatorLifecycleDecision => {
  if (facts.live) {
    return { kind: "join-live", reason: "live-session", consumesOrdinal: 0 };
  }
  const prior = facts.prior;
  if (prior === null) {
    return { kind: "spawn-fresh", reason: "initial-start", consumesOrdinal: 0 };
  }
  if (prior.completedCleanly) {
    return { kind: "spawn-fresh", reason: "clean-iteration-end", consumesOrdinal: 0 };
  }
  if (prior.contextTokens === null) {
    return { kind: "spawn-fresh", reason: "context-unknown", consumesOrdinal: 1 };
  }
  if (prior.contextTokens >= facts.contextLimit) {
    return { kind: "spawn-fresh", reason: "context-pressure", consumesOrdinal: 1 };
  }
  if (!prior.resumable || !facts.resumeDeclared) {
    // An undeclared or unavailable harness resume is a decision input, never an
    // error identity (DEC-7, DEC-11).
    return { kind: "spawn-fresh", reason: "session-interrupted", consumesOrdinal: 1 };
  }
  return { kind: "resume-context", reason: "session-interrupted", consumesOrdinal: 1 };
};

/** Whether the decision spawns, resumes, or attaches (the effect selector). */
export const lifecycleEffect = (
  decision: CoordinatorLifecycleDecision,
): "attach" | "resume" | "spawn" => {
  if (decision.kind === "join-live") return "attach";
  if (decision.kind === "resume-context") return "resume";
  return "spawn";
};
