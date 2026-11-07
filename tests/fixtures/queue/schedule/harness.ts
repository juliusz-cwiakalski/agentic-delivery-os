/**
 * Shared scheduler-fact builders for the GH-237 behaviour suites.
 *
 * Every suite injects facts; nothing reads the wall clock, network, or live
 * tree. A case states only the delta it exercises; the builders fill a fully
 * satisfiable default.
 */
import {
  QUEUE_ENTRY_SCHEMA,
  type QueueActiveLease,
  type QueueParkRecord,
  type QueueReadyCloseClass,
} from "../../../../packages/core/src/contracts/index";
import {
  canonicalQueueRef,
  foldQueueGraph,
} from "../../../../packages/core/src/domain/queue-graph";
import type {
  QueueCiFact,
  QueueCloseFact,
  QueueDeployFacts,
  QueueParkEvaluation,
  QueuePlanFact,
  QueueProviderFact,
  QueueSchedulerFacts,
  QueueWorkItemFact,
} from "../../../../packages/core/src/domain/queue-readiness";

export const NOW_ISO = "2026-11-07T10:00:00Z";
export const NOW_MS = Date.parse(NOW_ISO);
export const REPO_A = "github.com/owner/repo-alpha";
export const REPO_B = "github.com/owner/repo-beta";
export const ROOT_A = "/work/repo-alpha";
export const ROOT_B = "/work/repo-beta";
export const RUNNER = "runner-a";

export type EntrySpec = {
  readonly ref: string;
  readonly repository?: string;
  readonly repositoryRoot?: string;
  readonly priority?: number;
  readonly edges?: readonly string[];
  readonly plan?: QueuePlanFact;
  readonly workItem?: QueueWorkItemFact;
  readonly ci?: QueueCiFact;
  readonly close?: QueueCloseFact;
  readonly park?: QueueParkEvaluation;
};

export type FactsOverrides = {
  readonly leases?: readonly QueueActiveLease[];
  readonly provider?: QueueProviderFact;
  readonly deploy?: QueueDeployFacts;
  readonly runner?: string;
  readonly parkRecords?: readonly QueueParkRecord[];
};

export const observed = (
  overrides: Partial<Extract<QueueWorkItemFact, { state: "observed" }>> = {},
): QueueWorkItemFact => ({
  state: "observed",
  deliveryState: overrides.deliveryState ?? "ready",
  labels: overrides.labels ?? ["priority:high"],
  blockedBy: overrides.blockedBy ?? [],
});

export const unobserved = (): QueueWorkItemFact => ({ state: "unobserved" });

export const ciSucceeded = (): QueueCiFact => ({ state: "available", result: "succeeded" });

export const ciFailed = (): QueueCiFact => ({ state: "available", result: "failed" });

export const ciUnreadable = (): QueueCiFact => ({ state: "unavailable", reason: "read-failed" });

export const rootFor = (repository: string | undefined): string | undefined => {
  if (repository === undefined) return undefined;
  if (repository === REPO_A) return ROOT_A;
  if (repository === REPO_B) return ROOT_B;
  return `/work/${repository.split("/").at(-1) ?? "repo"}`;
};

export const activeLease = (input: {
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly leaseId?: string;
  readonly runner?: string;
  readonly weightClass?: "standard" | "heavy";
  readonly heartbeatAgeMs?: number;
}): QueueActiveLease => ({
  leaseId: input.leaseId ?? `lease-${input.ref}`,
  repository: input.repository,
  holder: input.holder,
  ref: input.ref,
  runner: input.runner ?? RUNNER,
  weightClass: input.weightClass ?? "standard",
  scope: "repo-exclusive",
  acquiredAt: NOW_ISO,
  heartbeatAt: NOW_ISO,
  ttlMs: 90_000,
  heartbeatAgeMs: input.heartbeatAgeMs ?? 0,
});

/** Build one fully injected scheduler fact set. */
export const makeFacts = (
  specs: readonly EntrySpec[],
  overrides: FactsOverrides = {},
): QueueSchedulerFacts => {
  const entryRecords = specs.map((spec) => {
    const ref = canonicalQueueRef(spec.ref) ?? spec.ref;
    const repository = spec.repository;
    const root = spec.repositoryRoot ?? rootFor(repository);
    return {
      schema: QUEUE_ENTRY_SCHEMA,
      ref,
      ...(repository === undefined ? {} : { repository }),
      ...(root === undefined ? {} : { repositoryRoot: root }),
      priority: spec.priority ?? 100,
      recordedAt: NOW_ISO,
    };
  });
  const dependencyRecords = specs.flatMap((spec) => {
    const ref = canonicalQueueRef(spec.ref) ?? spec.ref;
    const edges = (spec.edges ?? []).map((edge) => canonicalQueueRef(edge) ?? edge);
    return edges.length === 0
      ? []
      : [{ schema: "delivery.queue.dependency.v1" as const, ref, edges, recordedAt: NOW_ISO }];
  });
  const fold = foldQueueGraph(entryRecords, dependencyRecords);
  const plans: Record<string, QueuePlanFact> = {};
  const workItems: Record<string, QueueWorkItemFact> = {};
  const ci: Record<string, QueueCiFact> = {};
  const close: Record<string, QueueCloseFact> = {};
  const parkEvaluations: Record<string, QueueParkEvaluation> = {};
  for (const spec of specs) {
    const ref = canonicalQueueRef(spec.ref) ?? spec.ref;
    plans[ref] = spec.plan ?? { state: "valid", tier: "full" };
    workItems[ref] = spec.workItem ?? observed();
    ci[ref] = spec.ci ?? ciSucceeded();
    close[ref] = spec.close ?? "none";
    if (spec.park !== undefined) parkEvaluations[ref] = spec.park;
  }
  return {
    nowIso: NOW_ISO,
    nowMs: NOW_MS,
    fold,
    plans,
    workItems,
    ci,
    provider: overrides.provider ?? { state: "available" },
    leases: overrides.leases ?? [],
    parkEvaluations,
    parkRecords: overrides.parkRecords ?? [],
    close,
    deploy: overrides.deploy ?? { expectations: {}, verdicts: {} },
    runner: overrides.runner ?? RUNNER,
  };
};

export const closeClasses = (): readonly QueueReadyCloseClass[] => [
  "merge-ready",
  "review-pending",
  "new-start",
  "unknown",
  "not-ready",
];
