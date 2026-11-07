/**
 * Pure lease policy for the one-shot scheduling step (GH-237 F-3, F-4, DM-4,
 * DM-6, DEC-2, AC-F3-1(b), AC-F4-1, AC-F4-2, AC-F4-3, NFR-3, NFR-4).
 *
 * `repo-exclusive` is the only implemented scope and the normalized repository
 * key is the contention domain. A lease is stale when its heartbeat age is at
 * or beyond the TTL (inclusive); a takeover is always evidenced, and a live
 * lease is never taken over. The claim pre-fence gate evaluates the five
 * non-exclusivity readiness conditions and parks; the in-fence verified lease
 * read owns the exclusivity outcome, so a live holder is a lease conflict and
 * never a precondition refusal.
 */

import {
  QUEUE_DEFAULT_LEASE_TTL_MS,
  QUEUE_MIN_RENEWAL_MS,
  type QueueActiveLease,
  type QueueBlockingReason,
  type QueueLeaseRecord,
  type QueueLeaseScope,
  type QueueParkedReason,
} from "#contracts";
import { evaluateQueueReadiness, type QueueSchedulerFacts } from "./queue-readiness.js";

/** The single implemented lease scope. */
export const DEFAULT_LEASE_SCOPE: QueueLeaseScope = "repo-exclusive";

/** The declared scope every delivered path acquires. */
export const claimScope = (): QueueLeaseScope => DEFAULT_LEASE_SCOPE;

/** Deterministic lease identity: repository, holder, and acquisition instant. */
export const makeLeaseId = (repository: string, holder: string, acquiredAt: string): string =>
  `${repository}#${holder}@${acquiredAt}`;

/** Heartbeat age in integer milliseconds, never negative. */
export const leaseHeartbeatAgeMs = (heartbeatAt: string, nowMs: number): number => {
  const parsed = Date.parse(heartbeatAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(nowMs - parsed));
};

/** A lease is stale at or beyond the TTL: the bound is inclusive. */
export const isLeaseStale = (heartbeatAgeMs: number, ttlMs: number): boolean =>
  heartbeatAgeMs >= ttlMs;

/** Renewal cadence is one third of the TTL, at least one second, never a key. */
export const renewalCadenceMs = (ttlMs: number): number =>
  Math.max(QUEUE_MIN_RENEWAL_MS, Math.floor(ttlMs / 3));

/** The earliest takeover-eligible instant as an ISO string. */
export const earliestTakeoverAtIso = (
  lease: Pick<QueueLeaseRecord, "heartbeatAt" | "ttlMs">,
): string => {
  const heartbeat = Date.parse(lease.heartbeatAt);
  if (!Number.isFinite(heartbeat)) return lease.heartbeatAt;
  return new Date(heartbeat + lease.ttlMs).toISOString();
};

const TERMINAL_OPERATIONS = new Set(["released"]);

/**
 * Fold the verified lease history into at most one active lease per repository.
 *
 * The latest operation per repository governs. A duplicate acquisition for one
 * (repository, holder, acquisition) is a corrupted history, signalled by
 * `undefined` so callers fail closed instead of inventing a holder.
 */
export const foldActiveLeases = (
  records: readonly QueueLeaseRecord[],
  nowMs: number,
): readonly QueueActiveLease[] | undefined => {
  const latest = new Map<string, QueueLeaseRecord>();
  const acquisitions = new Set<string>();
  for (const record of records) {
    if (record.operation === "acquired" || record.operation === "taken-over") {
      const key = `${record.repository}\u0000${record.holder}\u0000${record.acquiredAt}`;
      if (acquisitions.has(key)) return undefined;
      acquisitions.add(key);
    }
    latest.set(record.repository, record);
  }
  const active: QueueActiveLease[] = [];
  for (const [repository, record] of latest) {
    if (TERMINAL_OPERATIONS.has(record.operation)) continue;
    active.push({
      leaseId: record.leaseId,
      repository,
      holder: record.holder,
      ref: record.ref,
      runner: record.runner,
      weightClass: record.weightClass,
      scope: record.scope,
      acquiredAt: record.acquiredAt,
      heartbeatAt: record.heartbeatAt,
      ttlMs: record.ttlMs,
      heartbeatAgeMs: leaseHeartbeatAgeMs(record.heartbeatAt, nowMs),
      ...(record.takeover === undefined ? {} : { takeover: record.takeover }),
    });
  }
  return active.sort((left, right) => (left.repository < right.repository ? -1 : 1));
};

/** One live holder's conflict identity, as the refusal projects it. */
export type QueueLeaseConflict = {
  readonly holder: string;
  readonly leaseId: string;
  readonly acquiredAt: string;
  readonly heartbeatAgeMs: number;
  readonly earliestTakeoverAt: string;
};

/** Project the conflict identity for a live lease held by another holder. */
export const leaseConflict = (lease: QueueActiveLease): QueueLeaseConflict => ({
  holder: lease.holder,
  leaseId: lease.leaseId,
  acquiredAt: lease.acquiredAt,
  heartbeatAgeMs: lease.heartbeatAgeMs,
  earliestTakeoverAt: new Date(
    Date.parse(lease.heartbeatAt) + lease.ttlMs,
  ).toISOString(),
});

/** The pre-fence claim precondition result. */
export type QueueClaimPrecondition =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "queue.precondition.unmet" | "queue.park-condition-stuck";
      readonly reason: QueueBlockingReason | QueueParkedReason;
      readonly detail?: string;
    };

const reasonForCi = (reason: string | undefined): QueueBlockingReason => {
  switch (reason) {
    case "ci-failed":
      return "ci-failed";
    case "ci-pending":
      return "ci-pending";
    case "ci-canceled":
      return "ci-canceled";
    case "ci-none":
      return "ci-none";
    default:
      return "ci-unknown";
  }
};

const reasonForProvider = (reason: string | undefined): QueueBlockingReason => {
  switch (reason) {
    case "chain-parked":
      return "provider-chain-parked";
    case "no-enabled-entry":
      return "provider-no-enabled-entry";
    case "all-entries-parked":
      return "provider-all-entries-parked";
    default:
      return "provider-unknown";
  }
};

/**
 * Evaluate the pre-fence claim gate: parks first, then the five non-exclusivity
 * readiness conditions. `repo-free` is deliberately excluded — repository
 * exclusivity is decided only by the verified in-fence lease read.
 */
export const evaluateClaimPreconditions = (
  facts: QueueSchedulerFacts,
  ref: string,
  options: { readonly outrankedBy?: string; readonly weightHeldBy?: string } = {},
): QueueClaimPrecondition => {
  const park = facts.parkEvaluations[ref];
  if (park?.state === "stuck") {
    return {
      ok: false,
      code: "queue.park-condition-stuck",
      reason: "park-condition-stuck",
      detail: `park:${park.cause ?? "unknown"}`,
    };
  }
  if (park?.state === "active") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: `parked:${park.cause ?? "provider-window"}`,
      detail: `recheck:${park.recheckMs ?? 0}`,
    };
  }
  const readiness = evaluateQueueReadiness(facts, ref);
  const condition = (id: string) => readiness.conditions.find((candidate) => candidate.id === id);
  const deps = condition("deps-satisfied");
  if (deps !== undefined && deps.state !== "satisfied") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: deps.state === "unknown" ? "dependency-unobserved" : "dependency-open",
      ...(deps.evidence[0]?.detail === undefined ? {} : { detail: deps.evidence[0].detail }),
    };
  }
  const tier = condition("tier-known");
  if (tier !== undefined && tier.state !== "satisfied") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: "tier-unknown",
      ...(tier.evidence[0]?.detail === undefined ? {} : { detail: tier.evidence[0].detail }),
    };
  }
  const owner = condition("no-owner-gate");
  if (owner !== undefined && owner.state !== "satisfied") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: "owner-gate",
      ...(owner.evidence[0]?.detail === undefined ? {} : { detail: owner.evidence[0].detail }),
    };
  }
  const ci = condition("ci-healthy");
  if (ci !== undefined && ci.state !== "satisfied") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: reasonForCi(ci.evidence[0]?.reason),
      ...(ci.evidence[0]?.detail === undefined ? {} : { detail: ci.evidence[0].detail }),
    };
  }
  const provider = condition("provider-available");
  if (provider !== undefined && provider.state !== "satisfied") {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: reasonForProvider(provider.evidence[0]?.reason),
      ...(provider.evidence[0]?.detail === undefined ? {} : { detail: provider.evidence[0].detail }),
    };
  }
  if (options.outrankedBy !== undefined) {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: "outranked",
      detail: `outranked-by:${options.outrankedBy}`,
    };
  }
  if (options.weightHeldBy !== undefined) {
    return {
      ok: false,
      code: "queue.precondition.unmet",
      reason: "weight-class",
      detail: `held-by:${options.weightHeldBy}`,
    };
  }
  return { ok: true };
};

/** The shipped lease TTL, re-exported for callers that inject no config. */
export const defaultLeaseTtlMs = (): number => QUEUE_DEFAULT_LEASE_TTL_MS;
