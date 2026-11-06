/**
 * Pure freshness-envelope evaluation (GH-225 F-2, DEC-3, DEC-8, NFR-5).
 *
 * The envelope is: the record exists and is readable; its age satisfies the
 * declared bound with the declared comparator (at-bound is stale); the recorded
 * head SHA equals the current head; the recorded gate-set identity equals the
 * effective one. A missing, torn, unreadable, or schema-incompatible state is
 * the state-unverified class (exit 2); a stale-but-readable verification is a
 * stale refusal (exit 1).
 */
import {
  MERGE_FRESHNESS_COMPARATOR,
  MERGE_GATE_FRESHNESS_DEFAULT_SECONDS,
  type MergeGateSetIdentity,
  type MergeGateVerificationRecord,
  type OwnerGateSlaComparator,
} from "#contracts";

/** Why the verification state is not consumable (state-unverified class). */
export type MergeVerificationStateReason = "absent" | "torn" | "unreadable" | "incompatible";

/** Why a readable verification no longer passes the envelope (gates-stale). */
export type MergeFreshnessVoidingReason = "age" | "head-sha" | "gate-set";

/** Set-identity delta evidence. */
export type MergeGateSetDelta = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
};

/** One envelope evaluation. */
export type MergeFreshnessEvaluation =
  | { readonly ok: true; readonly ageMs: number }
  | {
      readonly ok: false;
      readonly kind: "state-unverified";
      readonly reason: MergeVerificationStateReason;
    }
  | {
      readonly ok: false;
      readonly kind: "stale";
      readonly reason: MergeFreshnessVoidingReason;
      readonly ageMs: number;
      readonly boundMs: number;
      readonly recordedSha: string;
      readonly currentSha: string;
      readonly setDelta?: MergeGateSetDelta;
    };

/** The declared bound in milliseconds. */
export const mergeFreshnessBoundMs = (boundSeconds: number): number =>
  Math.max(0, Math.trunc(boundSeconds)) * 1000;

/** Evaluate the declared comparator against the age (at-bound stale for `>=`). */
export const isStaleAge = (
  ageMs: number,
  boundMs: number,
  comparator: OwnerGateSlaComparator = MERGE_FRESHNESS_COMPARATOR,
): boolean => (comparator === ">=" ? ageMs >= boundMs : ageMs > boundMs);

const parseIsoMs = (value: string): number | undefined => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Compute the recorded verification's age; an unparseable time is unreadable. */
export const mergeVerificationAgeMs = (
  record: MergeGateVerificationRecord,
  nowMs: number,
): number | undefined => {
  const verifiedAt = parseIsoMs(record.verifiedAt);
  if (verifiedAt === undefined) return undefined;
  return Math.max(0, nowMs - verifiedAt);
};

/** The set-identity delta between the recorded and effective identities. */
export const mergeGateSetDelta = (
  recorded: MergeGateSetIdentity,
  effective: MergeGateSetIdentity,
): MergeGateSetDelta => {
  const recordedIds = new Set(recorded.ids);
  const effectiveIds = new Set(effective.ids);
  return {
    added: effective.ids.filter((id) => !recordedIds.has(id)),
    removed: recorded.ids.filter((id) => !effectiveIds.has(id)),
  };
};

const sameSetIdentity = (
  recorded: MergeGateSetIdentity,
  effective: MergeGateSetIdentity,
): boolean =>
  recorded.schemaVersion === effective.schemaVersion &&
  recorded.ids.length === effective.ids.length &&
  recorded.ids.every((id, index) => id === effective.ids[index]);

/** The declared default bound in seconds. */
export const mergeDefaultFreshnessSeconds = (): number => MERGE_GATE_FRESHNESS_DEFAULT_SECONDS;

/** Evaluate the freshness envelope over one injected verification read. */
export const evaluateMergeFreshness = (input: {
  readonly record: MergeGateVerificationRecord | undefined;
  readonly stateReason?: MergeVerificationStateReason;
  readonly nowMs: number;
  readonly boundSeconds: number;
  readonly comparator: OwnerGateSlaComparator;
  readonly currentHeadSha: string;
  readonly effectiveGateSet: MergeGateSetIdentity;
}): MergeFreshnessEvaluation => {
  if (input.record === undefined) {
    return {
      ok: false,
      kind: "state-unverified",
      reason: input.stateReason ?? "absent",
    };
  }
  const ageMs = mergeVerificationAgeMs(input.record, input.nowMs);
  if (ageMs === undefined) {
    return { ok: false, kind: "state-unverified", reason: "unreadable" };
  }
  const boundMs = mergeFreshnessBoundMs(input.boundSeconds);
  const recordedSha = input.record.headSha;
  const currentSha = input.currentHeadSha;
  if (isStaleAge(ageMs, boundMs, input.comparator)) {
    return {
      ok: false,
      kind: "stale",
      reason: "age",
      ageMs,
      boundMs,
      recordedSha,
      currentSha,
      setDelta: mergeGateSetDelta(input.record.gateSet, input.effectiveGateSet),
    };
  }
  if (recordedSha !== currentSha) {
    return {
      ok: false,
      kind: "stale",
      reason: "head-sha",
      ageMs,
      boundMs,
      recordedSha,
      currentSha,
      setDelta: mergeGateSetDelta(input.record.gateSet, input.effectiveGateSet),
    };
  }
  if (!sameSetIdentity(input.record.gateSet, input.effectiveGateSet)) {
    return {
      ok: false,
      kind: "stale",
      reason: "gate-set",
      ageMs,
      boundMs,
      recordedSha,
      currentSha,
      setDelta: mergeGateSetDelta(input.record.gateSet, input.effectiveGateSet),
    };
  }
  return { ok: true, ageMs };
};
