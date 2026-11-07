/**
 * Park evaluation policy (GH-237 F-8, DM-5, DM-6, DM-14, C-3, C-7,
 * AC-F8-1, AC-F8-2, NFR-5).
 *
 * Two distinct closed sets are never conflated: the condition-type set a pass
 * re-evaluates (`provider-window`, `provider-quota`, `preemption`) and the cause
 * set explaining why the lease was released (`provider-window`,
 * `provider-quota`, `preempted-for-close-item`), with the declared one-to-one
 * pairing. A window clears at its absolute expiry; quota clears when the
 * provider is observed available; preemption clears when the preempting lease is
 * released and the entry is ready again. A durable `clear-observed` marker with
 * no later `recovered` record is the stuck condition; reads never append.
 */

import {
  QUEUE_PARK_CAUSE_CONDITION_PAIRS,
  QUEUE_PARK_RECHECK_DEFAULTS,
  QUEUE_STUCK_PARK_FINDING_CODE,
  type QueueFinding,
  type QueueParkCause,
  type QueueParkCondition,
  type QueueParkConditionType,
  type QueueParkRecord,
  type QueueParkRecoveryState,
} from "#contracts";
import type { QueueParkEvaluation } from "./queue-readiness.js";

/** Resolve the paired condition type for one cause (never interchangeable). */
export const conditionTypeForCause = (cause: QueueParkCause): QueueParkConditionType => {
  const pair = QUEUE_PARK_CAUSE_CONDITION_PAIRS.find((candidate) => candidate.cause === cause);
  return pair?.conditionType ?? "provider-window";
};

/** Build the typed evaluable condition for one cause. */
export const parkConditionForCause = (
  cause: QueueParkCause,
  input: { readonly expiresAt?: string } = {},
): QueueParkCondition => {
  const conditionType = conditionTypeForCause(cause);
  if (conditionType === "provider-window") {
    return { type: "provider-window", expiresAt: input.expiresAt ?? "" };
  }
  return { type: conditionType };
};

/** The default recheck interval for one condition type. */
export const defaultParkRecheckMs = (conditionType: QueueParkConditionType): number =>
  QUEUE_PARK_RECHECK_DEFAULTS[conditionType];

/** Observation gap in integer milliseconds, never negative. */
export const observationGapMs = (previousEvaluatedAt: string, nowMs: number): number => {
  const parsed = Date.parse(previousEvaluatedAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(nowMs - parsed));
};

/** The latest park record per canonical ref, sorted by ref. */
export const latestParkRecords = (
  records: readonly QueueParkRecord[],
): readonly QueueParkRecord[] => {
  const latest = new Map<string, QueueParkRecord>();
  for (const record of records) latest.set(record.ref, record);
  return [...latest.values()].sort((left, right) =>
    left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0,
  );
};

/** Context a pass injects while re-evaluating parks. */
export type QueueParkContext = {
  readonly providerAvailable: boolean;
  readonly leaseHeldRepositories: readonly string[];
};

/** Evaluate one latest park record; reads never append. */
export const evaluateParkRecord = (
  record: QueueParkRecord,
  nowMs: number,
  context: QueueParkContext,
): QueueParkEvaluation => {
  if (record.recoveryState === "released" || record.recoveryState === "recovered") {
    return { state: "none" };
  }
  if (record.recoveryState === "clear-observed") {
    // The durable marker without a later `recovered` record is the stuck class.
    return {
      state: "stuck",
      cause: record.cause,
      recheckMs: record.recheckMs,
      ...(record.condition.type === "provider-window"
        ? { expiresAt: record.condition.expiresAt }
        : {}),
      ...(record.clearObservedAt === undefined ? {} : { clearObservedAt: record.clearObservedAt }),
    };
  }
  const base = {
    cause: record.cause,
    recheckMs: record.recheckMs,
    ...(record.condition.type === "provider-window"
      ? { expiresAt: record.condition.expiresAt }
      : {}),
    ...(record.clearObservedAt === undefined ? {} : { clearObservedAt: record.clearObservedAt }),
  };
  let cleared: boolean;
  switch (record.conditionType) {
    case "provider-window": {
      const expiry = Date.parse(record.condition.type === "provider-window" ? record.condition.expiresAt : "");
      cleared = Number.isFinite(expiry) && nowMs >= expiry;
      break;
    }
    case "provider-quota":
      cleared = context.providerAvailable;
      break;
    case "preemption":
      cleared = !context.leaseHeldRepositories.includes(record.repository ?? "");
      break;
  }
  return cleared ? { state: "resumable", ...base } : { state: "active", ...base };
};

/** The per-pass park evaluation map plus the report-only stuck findings. */
export type QueueParkPass = {
  readonly evaluations: Readonly<Record<string, QueueParkEvaluation>>;
  readonly records: readonly QueueParkRecord[];
  readonly findings: readonly QueueFinding[];
};

/** Evaluate every latest park record in one deterministic pass. */
export const evaluateParkPass = (
  records: readonly QueueParkRecord[],
  nowMs: number,
  context: QueueParkContext,
): QueueParkPass => {
  const latest = latestParkRecords(records);
  const evaluations: Record<string, QueueParkEvaluation> = {};
  const findings: QueueFinding[] = [];
  for (const record of latest) {
    const evaluation = evaluateParkRecord(record, nowMs, context);
    evaluations[record.ref] = evaluation;
    if (evaluation.state === "stuck") {
      findings.push({
        code: QUEUE_STUCK_PARK_FINDING_CODE,
        severity: "warning",
        ref: record.ref,
        ...(record.repository === undefined ? {} : { repository: record.repository }),
        detail: `park:${record.cause}; clearObservedAt:${record.clearObservedAt ?? "none"}`,
      });
    }
  }
  return { evaluations, records: latest, findings };
};

/** Build a new active park record. */
export const createParkRecord = (input: {
  readonly ref: string;
  readonly repository?: string;
  readonly cause: QueueParkCause;
  readonly condition: QueueParkCondition;
  readonly recheckMs: number;
  readonly evaluatedAt: string;
  readonly recordedAt: string;
}): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: input.ref,
  ...(input.repository === undefined ? {} : { repository: input.repository }),
  cause: input.cause,
  conditionType: conditionTypeForCause(input.cause),
  condition: input.condition,
  recheckMs: input.recheckMs,
  evaluatedAt: input.evaluatedAt,
  recoveryState: "parked",
  recordedAt: input.recordedAt,
});

const transition = (
  record: QueueParkRecord,
  input: {
    readonly recoveryState: QueueParkRecoveryState;
    readonly nowIso: string;
    readonly evaluatedAt: string;
    readonly clearObservedAt?: string;
    readonly clearedAt?: string;
    readonly recoveredAt?: string;
    readonly gapMs?: number;
  },
): QueueParkRecord => ({
  ...record,
  recoveryState: input.recoveryState,
  evaluatedAt: input.evaluatedAt,
  recordedAt: input.nowIso,
  ...(input.clearObservedAt === undefined ? {} : { clearObservedAt: input.clearObservedAt }),
  ...(input.clearedAt === undefined ? {} : { clearedAt: input.clearedAt }),
  ...(input.recoveredAt === undefined ? {} : { recoveredAt: input.recoveredAt }),
  ...(input.gapMs === undefined ? {} : { observationGapMs: input.gapMs }),
});

/** The durable prior-pass clear observation, appended before recovery. */
export const clearObservedRecord = (
  record: QueueParkRecord,
  input: { readonly nowIso: string; readonly nowMs: number },
): QueueParkRecord =>
  transition(record, {
    recoveryState: "clear-observed",
    nowIso: input.nowIso,
    evaluatedAt: input.nowIso,
    clearObservedAt: input.nowIso,
    gapMs: observationGapMs(record.evaluatedAt, input.nowMs),
  });

/** The recovered record that supersedes the clear-observed marker. */
export const recoveredRecord = (
  record: QueueParkRecord,
  input: { readonly nowIso: string; readonly nowMs: number },
): QueueParkRecord =>
  transition(record, {
    recoveryState: "recovered",
    nowIso: input.nowIso,
    evaluatedAt: input.nowIso,
    ...(record.clearObservedAt === undefined ? {} : { clearObservedAt: record.clearObservedAt }),
    clearedAt: record.clearObservedAt ?? input.nowIso,
    recoveredAt: input.nowIso,
    gapMs: observationGapMs(record.evaluatedAt, input.nowMs),
  });

/** The released record a `queue release --park` append lands. */
export const releasedParkRecord = (
  record: QueueParkRecord,
  input: { readonly nowIso: string },
): QueueParkRecord =>
  transition(record, {
    recoveryState: "released",
    nowIso: input.nowIso,
    evaluatedAt: input.nowIso,
  });
