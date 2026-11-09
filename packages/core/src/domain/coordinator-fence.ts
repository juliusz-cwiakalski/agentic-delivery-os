/**
 * The append-only instance lease fold and the liveness-first claim decision
 * (GH-241 F-8, DEC-6; AC-F1-1/4, AC-F8-1..7).
 *
 * The lease is folded from the latest `coordinator.fence` record by ledger
 * sequence only. Liveness is decided before age: `alive=true` holds regardless
 * of age, `alive=false` is takeover-eligible, a declared probe that returns no
 * answer falls back to 2x`collection-interval`, and an undeclared capability is
 * a fail-closed capability gap. Lease age is the injected now minus the
 * acquisition record time; a later `stop-requested` never re-anchors it.
 */
import {
  COORDINATOR_LEASE_HELD_ACTIONS,
  COORDINATOR_REGIME,
  type CoordinatorFenceAction,
  type CoordinatorFenceRecord,
  type CoordinatorLeaseLivenessState,
  type CoordinatorSupervisorMode,
} from "#contracts";

/** The folded lease: the latest action and its acquisition identity. */
export type CoordinatorLease = {
  readonly action: CoordinatorFenceAction;
  readonly instanceId: string;
  readonly holder: string;
  readonly pid: number;
  readonly processStartTimeMs: number;
  readonly supervisorMode: CoordinatorSupervisorMode;
  readonly externalUnit: "absent";
  /** The acquisition record time (epoch ms), anchor for the lease age. */
  readonly acquisitionAtMs: number | null;
  readonly previousHolder: string | null;
  readonly fenceAgeMs: number | null;
};

/** The injected fold input: records in ledger order plus a time resolver. */
export type CoordinatorLeaseFoldInput = {
  readonly records: readonly CoordinatorFenceRecord[];
  /** Resolve a record's `recordedAt` to epoch ms (injected; no clock here). */
  readonly recordedAtMs: (recordedAt: string) => number | null;
};

/**
 * Fold the lease from the latest record by ledger sequence.
 *
 * The instance's `startedAt` is its acquisition record's time, so a later
 * `stop-requested` or `released` never re-anchors the age.
 */
export const foldCoordinatorLease = (input: CoordinatorLeaseFoldInput): CoordinatorLease | null => {
  let latest: CoordinatorFenceRecord | null = null;
  let acquisition: CoordinatorFenceRecord | null = null;
  for (const record of input.records) {
    latest = record;
    if (record.action === "acquired" || record.action === "stale-takeover") {
      acquisition = record;
    }
  }
  if (latest === null) return null;
  const acquisitionMs = acquisition === null ? null : input.recordedAtMs(acquisition.recordedAt);
  return {
    action: latest.action,
    instanceId: latest.instanceId,
    holder: latest.holder,
    pid: latest.pid,
    processStartTimeMs: latest.processStartTimeMs,
    supervisorMode: latest.supervisorMode,
    externalUnit: latest.externalUnit,
    acquisitionAtMs: acquisitionMs,
    previousHolder: latest.previousHolder,
    fenceAgeMs: latest.fenceAgeMs,
  };
};

/** The injected claim facts. */
export type CoordinatorClaimFacts = {
  readonly lease: CoordinatorLease | null;
  /** `true`/`false` from the declared probe, or `null` when it answered nothing. */
  readonly alive: boolean | null;
  /** Whether the process port declares the alive capability at claim time. */
  readonly aliveDeclared: boolean;
  /** The injected current time in epoch milliseconds. */
  readonly nowMs: number;
  /** The resolved `coordinator.collection-interval` policy value. */
  readonly collectionIntervalMs: number;
};

/** One claim decision. */
export type CoordinatorClaimDecision =
  | { readonly kind: "capability-gap"; readonly missing: "alive" }
  | { readonly kind: "acquire" }
  | {
      readonly kind: "takeover";
      readonly previousHolder: string;
      readonly fenceAgeMs: number | null;
    }
  | {
      readonly kind: "refuse";
      readonly holder: string;
      readonly liveness: CoordinatorLeaseLivenessState;
    };

/** The lease age in milliseconds (`null` when the acquisition time is unknown). */
export const leaseAgeMs = (lease: CoordinatorLease, nowMs: number): number | null =>
  lease.acquisitionAtMs === null ? null : Math.max(0, nowMs - lease.acquisitionAtMs);

/** The 2x`collection-interval` age-fallback bound. */
export const ageFallbackBoundMs = (collectionIntervalMs: number): number =>
  COORDINATOR_REGIME.collectionBoundMultiplier * collectionIntervalMs;

/**
 * Decide whether this claim acquires, takes over, is refused, or fails closed.
 *
 * An undeclared alive capability is a capability gap before any age reasoning.
 * A released/absent lease is acquirable. A held lease refuses while the holder
 * is alive; a dead holder is takeover-eligible; a declared-but-unanswered probe
 * takes over only past the age fallback and otherwise refuses.
 */
export const decideCoordinatorClaim = (facts: CoordinatorClaimFacts): CoordinatorClaimDecision => {
  if (!facts.aliveDeclared) return { kind: "capability-gap", missing: "alive" };
  const lease = facts.lease;
  if (lease === null || lease.action === "released") return { kind: "acquire" };
  const held = (COORDINATOR_LEASE_HELD_ACTIONS as readonly string[]).includes(lease.action);
  if (!held) return { kind: "acquire" };
  if (facts.alive === true) {
    return { kind: "refuse", holder: lease.holder, liveness: "held" };
  }
  const age = leaseAgeMs(lease, facts.nowMs);
  if (facts.alive === false) {
    return { kind: "takeover", previousHolder: lease.holder, fenceAgeMs: age };
  }
  const bound = ageFallbackBoundMs(facts.collectionIntervalMs);
  if (age !== null && age > bound) {
    return { kind: "takeover", previousHolder: lease.holder, fenceAgeMs: age };
  }
  return { kind: "refuse", holder: lease.holder, liveness: "held" };
};
