/**
 * Dependency and deploy gating over injected facts (GH-237 F-6, C-6, DEC-13,
 * AC-F6-1, AC-F6-2).
 *
 * A consumer is not eligible while its producer is unresolved. Once the
 * producer has landed, a repository that declares deploy expectations must have
 * a `verified` deploy verdict; unknown, failed, an unreadable trace, or an
 * exhausted three-read budget holds the dependent at `deploy-unverified` and is
 * never green. Expectations are resolved from the producer's own configuration
 * bound to its recorded key, never from the invocation's configuration, so an
 * unresolvable or colliding root is `unknown`, never `not-declared`.
 */

import type { QueueDeployEvidence } from "#contracts";
import type {
  QueueDeployFacts,
  QueueDeployVerdictFact,
  QueueSchedulerFacts,
} from "./queue-readiness.js";

/** The default bound on deploy verdict reads per pass (NFR-6). */
export const QUEUE_DEPLOY_READ_BUDGET = 3 as const;

/** The mutable per-pass deploy gate state (memoized, bounded). */
export type QueueDeployGateState = {
  reads: number;
  readonly maxReads: number;
  readonly memo: Map<string, QueueDeployOutcome>;
};

/** One deploy gate outcome. */
export type QueueDeployOutcome =
  | { readonly ok: true; readonly evidence: QueueDeployEvidence }
  | { readonly ok: false; readonly evidence: QueueDeployEvidence; readonly reason: string };

/** Create the per-pass gate state; the budget defaults to three reads. */
export const createDeployGateState = (facts: QueueDeployFacts): QueueDeployGateState => ({
  reads: 0,
  maxReads: facts.maxReads ?? QUEUE_DEPLOY_READ_BUDGET,
  memo: new Map(),
});

const verdictOf = (
  facts: QueueDeployFacts,
  producerRef: string,
): QueueDeployVerdictFact => facts.verdicts[producerRef] ?? { verdict: "unknown" };

/**
 * Evaluate the deploy gate for one producer ref, memoized per producer and
 * bounded per pass. An overflow is `deploy-unverified` with the named
 * `read-budget-exhausted` reason.
 */
export const evaluateDeployGate = (
  facts: QueueDeployFacts,
  state: QueueDeployGateState,
  producerRef: string,
): QueueDeployOutcome => {
  const memoized = state.memo.get(producerRef);
  if (memoized !== undefined) return memoized;
  if (state.reads >= state.maxReads) {
    const overflow: QueueDeployOutcome = {
      ok: false,
      reason: "read-budget-exhausted",
      evidence: { verdict: "unknown", reason: "read-budget-exhausted" },
    };
    state.memo.set(producerRef, overflow);
    return overflow;
  }
  state.reads += 1;
  const expectation = facts.expectations[producerRef];
  let outcome: QueueDeployOutcome;
  if (expectation === undefined || expectation.state === "unknown") {
    const reason =
      expectation === undefined ? "config-missing" : (expectation.reason as string);
    outcome = {
      ok: false,
      reason: `expectation-unknown:${reason}`,
      evidence: { verdict: "unknown", reason },
    };
  } else if (expectation.state === "not-declared") {
    outcome = { ok: true, evidence: { verdict: "not-declared" } };
  } else {
    const verdict = verdictOf(facts, producerRef);
    if (verdict.verdict === "verified") {
      outcome = {
        ok: true,
        evidence: {
          verdict: "verified",
          ...(verdict.code === undefined ? {} : { code: verdict.code }),
        },
      };
    } else {
      outcome = {
        ok: false,
        reason: verdict.reason ?? `deploy-${verdict.verdict}`,
        evidence: {
          verdict: verdict.verdict,
          ...(verdict.code === undefined ? {} : { code: verdict.code }),
          ...(verdict.reason === undefined ? {} : { reason: verdict.reason }),
        },
      };
    }
  }
  state.memo.set(producerRef, outcome);
  return outcome;
};

/** The producer landing observation: landed, not landed, or unresolved. */
export const producerLanding = (
  facts: QueueSchedulerFacts,
  producerRef: string,
): "landed" | "not-landed" | "unresolved" => {
  const item = facts.workItems[producerRef];
  if (item === undefined || item.state !== "observed") return "unresolved";
  return item.deliveryState === "done" || item.deliveryState === "canceled"
    ? "landed"
    : "not-landed";
};

/** One dependent-action gate result. */
export type QueueDependencyGateOutcome =
  | { readonly ok: true; readonly deploy: QueueDeployEvidence | undefined }
  | {
      readonly ok: false;
      readonly reason: "dependency-open" | "dependency-unobserved" | "producer-not-landed" | "deploy-unverified";
      readonly deploy: QueueDeployEvidence | undefined;
    };

/**
 * Evaluate one consumer-to-producer dependency gate. A producer with no queue
 * entry is `dependency-unobserved`; an unlanded producer is
 * `producer-not-landed`; a landed producer with declared expectations requires
 * a verified deploy verdict.
 */
export const evaluateDependencyGate = (
  facts: QueueSchedulerFacts,
  state: QueueDeployGateState,
  producerRef: string,
): QueueDependencyGateOutcome => {
  const consumerEntry = facts.fold.entries.find((entry) => entry.ref === producerRef);
  if (consumerEntry === undefined) {
    return { ok: false, reason: "dependency-unobserved", deploy: undefined };
  }
  const landing = producerLanding(facts, producerRef);
  if (landing === "unresolved") {
    return { ok: false, reason: "dependency-unobserved", deploy: undefined };
  }
  if (landing === "not-landed") {
    return { ok: false, reason: "producer-not-landed", deploy: undefined };
  }
  const deploy = evaluateDeployGate(facts.deploy, state, producerRef);
  if (!deploy.ok) {
    return { ok: false, reason: "deploy-unverified", deploy: deploy.evidence };
  }
  return { ok: true, deploy: deploy.evidence };
};

/** The deploy gate evidence as it rides on an action. */
export const deployEvidenceOf = (
  outcome: QueueDependencyGateOutcome,
): QueueDeployEvidence | undefined => outcome.deploy;
