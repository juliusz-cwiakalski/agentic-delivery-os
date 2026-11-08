/**
 * The pure startup-reconciliation classification engine (GH-238 F-8; DM-3,
 * DM-4; AC-F8-1..AC-F8-3; Appendix H steps 3-8).
 *
 * For every in-flight lane, classify exactly once from injected artifact
 * evidence: alive (observable), interrupted (gone with no failure record), or
 * crashed (failure recorded). Insufficient evidence is held and re-evaluated,
 * never guessed. The engine uses the delivered restart-budget gate and invents
 * no second counter.
 */
import type { DaemonLaneClassification, DaemonLaneRecord } from "#contracts";

export type DaemonLaneEvidence = {
  readonly ref: string;
  readonly lane: DaemonLaneRecord;
  /** Whether the recorded operating-system process is observable. */
  readonly processObservable?: boolean;
  /** Whether the harness session is observable. */
  readonly sessionObservable?: boolean;
  /** A durable failure record's reason, when one exists. */
  readonly failureReason?: string;
  /** The last completed phase from the delivered ledger. */
  readonly lastCompletedPhase?: string;
  /** False when an evidence source is unreadable or absent. */
  readonly evidenceComplete?: boolean;
};

export type DaemonLaneDecision = {
  readonly ref: string;
  readonly classification?: DaemonLaneClassification;
  readonly action: "reattach" | "resume" | "hold" | "terminal-failed";
  readonly restarts: number;
  readonly nextRestartOrdinal?: number;
  readonly resumeFromPhase?: string;
  readonly reason?: "evidence-insufficient" | "restart-budget-exhausted" | string;
  readonly failureReason?: string;
};

const nextPhase = (phase: string | undefined): string | undefined => {
  if (phase === undefined || !/^\d+$/u.test(phase)) return undefined;
  return String(Number.parseInt(phase, 10) + 1);
};

/**
 * Classify one lane and decide its action. `restarts` is the durable count from
 * the delivered economics records; `bound` is the resolved restart budget.
 */
export const decideDaemonLane = (input: {
  readonly evidence: DaemonLaneEvidence;
  readonly restarts: number;
  readonly bound: number;
}): DaemonLaneDecision => {
  const { evidence } = input;
  const known =
    evidence.evidenceComplete !== false &&
    (evidence.processObservable !== undefined ||
      evidence.sessionObservable !== undefined ||
      evidence.failureReason !== undefined);
  if (!known) {
    return {
      ref: evidence.ref,
      action: "hold",
      restarts: input.restarts,
      reason: "evidence-insufficient",
    };
  }
  const observable = evidence.processObservable === true || evidence.sessionObservable === true;
  const classification: DaemonLaneClassification = observable
    ? "alive"
    : evidence.failureReason !== undefined
      ? "crashed"
      : "interrupted";
  if (classification === "alive") {
    return {
      ref: evidence.ref,
      classification,
      action: "reattach",
      restarts: input.restarts,
    };
  }
  if (input.restarts >= input.bound) {
    return {
      ref: evidence.ref,
      classification,
      action: "terminal-failed",
      restarts: input.restarts,
      reason: "restart-budget-exhausted",
      ...(evidence.failureReason === undefined ? {} : { failureReason: evidence.failureReason }),
    };
  }
  const resumeFromPhase = nextPhase(evidence.lastCompletedPhase);
  return {
    ref: evidence.ref,
    classification,
    action: "resume",
    restarts: input.restarts,
    nextRestartOrdinal: input.restarts + 1,
    ...(resumeFromPhase === undefined ? {} : { resumeFromPhase }),
    ...(evidence.failureReason === undefined ? {} : { failureReason: evidence.failureReason }),
  };
};
