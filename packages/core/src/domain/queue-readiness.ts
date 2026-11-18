/**
 * The scheduler readiness pass (GH-237 F-2, AC-F2-1, AC-F3-1(a), D-5).
 *
 * The delivered six-condition model is reused verbatim: the same ids, order,
 * tri-state, and evidence vocabulary come from `contracts/queue-ready`. Only
 * three sources are strengthened where the scheduler has better truth:
 * `deps-satisfied` consumes tracker relations union declared edges, `repo-free`
 * consumes active-lease facts, and `tier-known` prefers a validated plan tier.
 * Every source that failed, was not attempted, is unavailable, or is unresolved
 * yields `unknown`, never `satisfied`.
 */

import {
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_OWNER_ATTENTION_LABELS,
  QUEUE_READY_TIER_LABELS,
  type QueueActiveLease,
  type QueueBlocking,
  type QueueParkCause,
  type QueueParkRecord,
  type QueueRankClass,
  type QueueReadyBlockingCondition,
  type QueueReadyCloseClass,
  type QueueReadyCondition,
  type QueueReadyEvidence,
  type QueueReadyReason,
  type QueueWeightClass,
  type QueueWeightClassSource,
  type OwnerHoldFact,
} from "#contracts";
import type { QueueGraphFold } from "./queue-graph.js";

/** One plan artifact fact for one entry. */
export type QueuePlanFact =
  | { readonly state: "valid"; readonly tier?: string; readonly weightClass?: string }
  | { readonly state: "absent" }
  | {
      readonly state: "invalid";
      readonly code:
        | "plan.schema.invalid"
        | "plan.artifact.missing"
        | "plan.format.legacy-markdown";
    };

/** One work-item observation for one entry. */
export type QueueWorkItemFact =
  | {
      readonly state: "observed";
      readonly deliveryState: string;
      readonly labels: readonly string[];
      readonly blockedBy: readonly string[];
    }
  | { readonly state: "unobserved" };

/** One CI fact for one entry's head. */
export type QueueCiFact =
  | {
      readonly state: "available";
      readonly result: "succeeded" | "failed" | "pending" | "canceled" | "none";
    }
  | {
      readonly state: "unavailable";
      readonly reason:
        | "read-failed"
        | "credential-unavailable"
        | "commit-unresolved"
        | "not-configured";
    };

/** One provider-availability fact for the pass. */
export type QueueProviderFact =
  | { readonly state: "available" }
  | {
      readonly state: "unavailable";
      readonly reason:
        | "chain-parked"
        | "no-enabled-entry"
        | "all-entries-parked"
        | "config-invalid"
        | "chain-unresolved"
        | "not-configured"
        | "read-failed";
    };

/** The close-association class reused from the delivered classification. */
export type QueueCloseFact = "merge-ready" | "in-review" | "none" | "unknown";

/** The resolved park evaluation injected into one pass (produced in Phase 5). */
export type QueueParkEvaluationState = "none" | "active" | "resumable" | "stuck";

export type QueueParkEvaluation = {
  readonly state: QueueParkEvaluationState;
  readonly cause?: QueueParkCause;
  readonly recheckMs?: number;
  readonly lastEvaluatedAt?: string;
  readonly expiresAt?: string;
  readonly clearObservedAt?: string;
};

/** One deploy-expectation fact resolved from the producer's own configuration. */
export type QueueDeployExpectation =
  | { readonly state: "declared"; readonly steps: readonly string[] }
  | { readonly state: "not-declared" }
  | {
      readonly state: "unknown";
      readonly reason: "root-unresolved" | "root-collision" | "config-missing" | "config-invalid";
    };

/** One deploy verdict fact for one producer ref. */
export type QueueDeployVerdictFact = {
  readonly verdict: "verified" | "unknown" | "failed";
  readonly code?: string;
  readonly reason?: string;
};

/** The injected deploy facts for one pass. */
export type QueueDeployFacts = {
  readonly expectations: Readonly<Record<string, QueueDeployExpectation>>;
  readonly verdicts: Readonly<Record<string, QueueDeployVerdictFact>>;
  readonly maxReads?: number;
};

/** Everything one scheduling pass consumes; every fact is injected. */
export type QueueSchedulerFacts = {
  readonly nowIso: string;
  readonly nowMs: number;
  readonly fold: QueueGraphFold;
  readonly plans: Readonly<Record<string, QueuePlanFact>>;
  readonly workItems: Readonly<Record<string, QueueWorkItemFact>>;
  readonly ci: Readonly<Record<string, QueueCiFact>>;
  readonly provider: QueueProviderFact;
  readonly leases: readonly QueueActiveLease[];
  readonly parkEvaluations: Readonly<Record<string, QueueParkEvaluation>>;
  readonly parkRecords: readonly QueueParkRecord[];
  readonly close: Readonly<Record<string, QueueCloseFact>>;
  readonly deploy: QueueDeployFacts;
  readonly runner: string;
  /** The injected owner hold; absent means inactive. */
  readonly ownerHold?: OwnerHoldFact;
};

/** The readiness result for one entry. */
export type QueueReadiness = {
  readonly conditions: readonly QueueReadyCondition[];
  readonly blockingConditions: readonly QueueReadyBlockingCondition[];
  readonly ready: boolean;
};

const SOURCE = {
  tracker: "tracker",
  localContext: "local-context",
  ci: "ci",
  providerConfig: "provider-config",
  providerParks: "provider-parks",
  repositoryBinding: "repository-binding",
  changes: "changes",
} as const;

const evidence = (
  source: QueueReadyEvidence["source"],
  reason: QueueReadyReason,
  detail?: string,
): QueueReadyEvidence => (detail === undefined ? { source, reason } : { source, reason, detail });

const clampDetail = (value: string): string =>
  value.length <= 160 ? value : `${value.slice(0, 159)}+`;

const withDetail = (record: QueueReadyEvidence): QueueReadyEvidence =>
  record.detail === undefined ? record : { ...record, detail: clampDetail(record.detail) };

const isDone = (state: string): boolean => state === "done" || state === "canceled";

const observed = (facts: QueueSchedulerFacts, ref: string): QueueWorkItemFact | undefined =>
  facts.workItems[ref];

const depsCondition = (
  facts: QueueSchedulerFacts,
  ref: string,
  item: QueueWorkItemFact | undefined,
): QueueReadyCondition => {
  const targets = new Set<string>();
  const trackerUnknown = item?.state !== "observed";
  if (item?.state === "observed") {
    for (const target of item.blockedBy) targets.add(target);
  }
  const entry = facts.fold.entries.find((candidate) => candidate.ref === ref);
  for (const producer of entry?.edges ?? []) targets.add(producer);
  const counts = { done: 0, open: 0, unknown: 0 };
  for (const target of [...targets].sort()) {
    const targetItem = observed(facts, target);
    if (targetItem === undefined || targetItem.state !== "observed") {
      counts.unknown += 1;
      continue;
    }
    if (isDone(targetItem.deliveryState)) counts.done += 1;
    else counts.open += 1;
  }
  const detail = `done:${counts.done}; open:${counts.open}; unknown:${counts.unknown}`;
  if (targets.size === 0) {
    if (trackerUnknown) {
      return {
        id: "deps-satisfied",
        state: "unknown",
        evidence: [evidence(SOURCE.tracker, "work-item-unobserved")],
      };
    }
    return {
      id: "deps-satisfied",
      state: "satisfied",
      evidence: [evidence(SOURCE.tracker, "no-blocked-dependencies")],
    };
  }
  if (counts.open > 0) {
    return {
      id: "deps-satisfied",
      state: "unsatisfied",
      evidence: [evidence(SOURCE.tracker, "dependency-open", detail)],
    };
  }
  if (trackerUnknown || counts.unknown > 0) {
    return {
      id: "deps-satisfied",
      state: "unknown",
      evidence: [evidence(SOURCE.tracker, "dependency-unobserved", detail)],
    };
  }
  return {
    id: "deps-satisfied",
    state: "satisfied",
    evidence: [evidence(SOURCE.tracker, "dependencies-done", detail)],
  };
};

const repoFreeCondition = (facts: QueueSchedulerFacts, ref: string): QueueReadyCondition => {
  const entry = facts.fold.entries.find((candidate) => candidate.ref === ref);
  if (entry?.repository === undefined) {
    return {
      id: "repo-free",
      state: "unknown",
      evidence: [evidence(SOURCE.repositoryBinding, "addressing-unresolved")],
    };
  }
  const lease = facts.leases.find((candidate) => candidate.repository === entry.repository);
  if (lease === undefined) {
    return {
      id: "repo-free",
      state: "satisfied",
      evidence: [evidence(SOURCE.localContext, "no-active-change", `repo:${entry.repository}`)],
    };
  }
  if (lease.ref === ref) {
    return {
      id: "repo-free",
      state: "satisfied",
      evidence: [
        evidence(
          SOURCE.localContext,
          "candidate-is-active",
          `repo:${entry.repository}; lease:${lease.leaseId}`,
        ),
      ],
    };
  }
  return {
    id: "repo-free",
    state: "unsatisfied",
    evidence: [
      evidence(
        SOURCE.localContext,
        "other-active-change",
        `repo:${entry.repository}; holder:${lease.holder}; lease:${lease.leaseId}`,
      ),
    ],
  };
};

const recognizedLabels = (
  labels: readonly string[],
  declared: readonly string[],
): readonly string[] => {
  const matches: string[] = [];
  for (const label of labels) {
    const token = declared.find((entry) => entry.toLowerCase() === label.toLowerCase());
    if (token !== undefined && !matches.includes(token)) matches.push(token);
  }
  return matches;
};

const tierCondition = (
  facts: QueueSchedulerFacts,
  ref: string,
  item: QueueWorkItemFact | undefined,
): QueueReadyCondition => {
  const plan = facts.plans[ref];
  if (plan?.state === "invalid") {
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence(SOURCE.changes, "config-invalid", `plan:${plan.code}`)],
    };
  }
  if (plan?.state === "valid") {
    if (plan.tier !== undefined && plan.tier.length > 0) {
      return {
        id: "tier-known",
        state: "satisfied",
        evidence: [evidence(SOURCE.changes, "tier-label", `tier:plan; tier:${plan.tier}`)],
      };
    }
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence(SOURCE.changes, "tier-absent", "tier:plan; none")],
    };
  }
  if (item?.state !== "observed") {
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence(SOURCE.tracker, "work-item-unobserved")],
    };
  }
  const matches = recognizedLabels(item.labels, QUEUE_READY_TIER_LABELS);
  if (matches.length === 0) {
    return {
      id: "tier-known",
      state: "unknown",
      evidence: [evidence(SOURCE.tracker, "tier-absent", "tier:priority-label; none")],
    };
  }
  if (matches.length === 1) {
    return {
      id: "tier-known",
      state: "satisfied",
      evidence: [
        evidence(SOURCE.tracker, "tier-label", `tier:priority-label; label:${matches[0] ?? ""}`),
      ],
    };
  }
  const sorted = [...matches].sort();
  return {
    id: "tier-known",
    state: "unsatisfied",
    evidence: [
      evidence(SOURCE.tracker, "tier-conflict", `tier:priority-label; labels:${sorted.join(",")}`),
    ],
  };
};

const ownerGateCondition = (item: QueueWorkItemFact | undefined): QueueReadyCondition => {
  if (item?.state !== "observed") {
    return {
      id: "no-owner-gate",
      state: "unknown",
      evidence: [evidence(SOURCE.tracker, "work-item-unobserved")],
    };
  }
  const matches = recognizedLabels(item.labels, QUEUE_READY_OWNER_ATTENTION_LABELS);
  if (matches.length === 0) {
    return {
      id: "no-owner-gate",
      state: "satisfied",
      evidence: [evidence(SOURCE.tracker, "no-owner-labels")],
    };
  }
  return {
    id: "no-owner-gate",
    state: "unsatisfied",
    evidence: [
      evidence(SOURCE.tracker, "owner-labels", `owner-labels:${[...matches].sort().join(",")}`),
    ],
  };
};

const ciCondition = (fact: QueueCiFact | undefined): QueueReadyCondition => {
  if (fact === undefined) {
    return {
      id: "ci-healthy",
      state: "unknown",
      evidence: [evidence(SOURCE.ci, "signal-unavailable")],
    };
  }
  if (fact.state === "unavailable") {
    const reason: QueueReadyReason =
      fact.reason === "credential-unavailable"
        ? "credential-unavailable"
        : fact.reason === "commit-unresolved"
          ? "commit-unresolved"
          : fact.reason === "not-configured"
            ? "signal-unavailable"
            : "read-failed";
    return {
      id: "ci-healthy",
      state: "unknown",
      evidence: [evidence(SOURCE.ci, reason)],
    };
  }
  const reason: QueueReadyReason =
    fact.result === "succeeded"
      ? "ci-succeeded"
      : fact.result === "failed"
        ? "ci-failed"
        : fact.result === "pending"
          ? "ci-pending"
          : fact.result === "canceled"
            ? "ci-canceled"
            : "ci-none";
  return {
    id: "ci-healthy",
    state: fact.result === "succeeded" ? "satisfied" : "unsatisfied",
    evidence: [evidence(SOURCE.ci, reason, `result:${fact.result}`)],
  };
};

const providerCondition = (fact: QueueProviderFact): QueueReadyCondition => {
  if (fact.state === "available") {
    return {
      id: "provider-available",
      state: "satisfied",
      evidence: [evidence(SOURCE.providerParks, "no-active-park", "provider:available")],
    };
  }
  const unsatisfiedReasons = new Set(["chain-parked", "no-enabled-entry", "all-entries-parked"]);
  if (unsatisfiedReasons.has(fact.reason)) {
    return {
      id: "provider-available",
      state: "unsatisfied",
      evidence: [
        evidence(SOURCE.providerParks, fact.reason as QueueReadyReason, `provider:${fact.reason}`),
      ],
    };
  }
  return {
    id: "provider-available",
    state: "unknown",
    evidence: [evidence(SOURCE.providerConfig, "signal-unavailable", `provider:${fact.reason}`)],
  };
};

/** Evaluate the delivered six conditions with scheduler sources for one entry. */
export const evaluateQueueReadiness = (facts: QueueSchedulerFacts, ref: string): QueueReadiness => {
  const item = observed(facts, ref);
  const conditions: QueueReadyCondition[] = [
    depsCondition(facts, ref, item),
    repoFreeCondition(facts, ref),
    tierCondition(facts, ref, item),
    ownerGateCondition(item),
    ciCondition(facts.ci[ref]),
    providerCondition(facts.provider),
  ].map((condition) => ({
    id: condition.id,
    state: condition.state,
    evidence: condition.evidence.map(withDetail),
  }));
  const blockingConditions = conditions
    .filter((condition) => condition.state !== "satisfied")
    .map((condition) => ({ id: condition.id, state: condition.state }));
  return { conditions, blockingConditions, ready: blockingConditions.length === 0 };
};

/** The delivered condition order, re-exported for structural assertions. */
export const QUEUE_SCHEDULER_CONDITION_ORDER = QUEUE_READY_CONDITION_ORDER;

/** One entry's schedule facts: cheap projections resolved before readiness. */
export type QueueEntryCheapFacts = {
  readonly ref: string;
  readonly repository?: string;
  readonly rankClass?: QueueRankClass;
  readonly priority: number;
  readonly weightClass: QueueWeightClass;
  readonly weightClassSource: QueueWeightClassSource;
  readonly closeClass: QueueReadyCloseClass;
  readonly blocking: readonly QueueBlocking[];
};

/** The shared close-class mapping used by rank and the read projection. */
export const closeClassOf = (close: QueueCloseFact): QueueReadyCloseClass => {
  if (close === "merge-ready") return "merge-ready";
  if (close === "in-review") return "review-pending";
  if (close === "unknown") return "unknown";
  return "new-start";
};
