/**
 * Pure waiver authorization (GH-225 F-5, DEC-5, DEC-11, RSK-4).
 *
 * A declaration names a gate and an authorizer. The named gate must carry a
 * declared class; the authorizer must satisfy that class's declared policy
 * (never-merge classes: the provider-resolved owner principal). An unresolvable
 * principal never authorizes. Authorization is deterministic per (record,
 * class policy) and records nothing; recording is the transaction's act.
 */
import {
  MERGE_MAX_REASON_CHARS,
  MERGE_WAIVER_SCHEMA,
  type MergeGateEntry,
  type MergeWaiverDeclaration,
  type MergeWaiverRecord,
  type OwnerGateSlaPolicy,
} from "#contracts";

/** Why a declaration is refused; every case shares `merge.waiver-unauthorized`. */
export type MergeWaiverRefusalReason =
  | "non-waivable-gate"
  | "unresolvable-principal"
  | "unauthorized-principal";

/** One authorization verdict (a record to append, or a classified refusal). */
export type MergeWaiverVerdict =
  | {
      readonly ok: true;
      readonly record: MergeWaiverRecord;
      readonly gateClass: string;
    }
  | {
      readonly ok: false;
      readonly code: "merge.waiver-unauthorized";
      readonly gateId: string;
      readonly gateClass: string | undefined;
      readonly authorizer: string;
      readonly reason: MergeWaiverRefusalReason;
    };

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

/** The bounded declared reason, or undefined when absent/empty. */
const boundedReason = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : clamp(trimmed, MERGE_MAX_REASON_CHARS);
};

/**
 * Authorize one override declaration against the declared class policy.
 *
 * `ownerPrincipal` is the provider-resolved repository identity; undefined means
 * unresolvable and therefore never authorizes a never-merge class.
 */
export const authorizeMergeWaiver = (input: {
  readonly declaration: MergeWaiverDeclaration;
  readonly changeRef: string;
  readonly entry: MergeGateEntry | undefined;
  readonly policy: OwnerGateSlaPolicy;
  readonly ownerPrincipal: string | undefined;
  readonly authorizedAt: string;
}): MergeWaiverVerdict => {
  const { declaration, entry, policy } = input;
  const gateClass = entry?.class;
  if (gateClass === undefined) {
    return {
      ok: false,
      code: "merge.waiver-unauthorized",
      gateId: declaration.gateId,
      gateClass: undefined,
      authorizer: declaration.authorizer,
      reason: "non-waivable-gate",
    };
  }
  const row = policy.rows.find((candidate) => candidate.class === gateClass);
  if (row === undefined) {
    return {
      ok: false,
      code: "merge.waiver-unauthorized",
      gateId: declaration.gateId,
      gateClass,
      authorizer: declaration.authorizer,
      reason: "non-waivable-gate",
    };
  }
  const authorizer = declaration.authorizer;
  if (typeof authorizer !== "string" || authorizer.trim().length === 0) {
    return {
      ok: false,
      code: "merge.waiver-unauthorized",
      gateId: declaration.gateId,
      gateClass,
      authorizer,
      reason: "unresolvable-principal",
    };
  }
  if (row.waiverAuthorization === "owner-authored") {
    const owner = input.ownerPrincipal;
    if (owner === undefined || owner.trim().length === 0) {
      return {
        ok: false,
        code: "merge.waiver-unauthorized",
        gateId: declaration.gateId,
        gateClass,
        authorizer,
        reason: "unresolvable-principal",
      };
    }
    if (owner !== authorizer) {
      return {
        ok: false,
        code: "merge.waiver-unauthorized",
        gateId: declaration.gateId,
        gateClass,
        authorizer,
        reason: "unauthorized-principal",
      };
    }
  }
  const reason = boundedReason(declaration.reason);
  return {
    ok: true,
    gateClass,
    record: {
      schema: MERGE_WAIVER_SCHEMA,
      changeRef: input.changeRef,
      gateId: declaration.gateId,
      gateClass,
      authorizer,
      authorizedAt: input.authorizedAt,
      ...(reason === undefined ? {} : { reason }),
    },
  };
};

/** The newest waiver record per gate id (append-only history, last wins). */
export const newestWaiverByGate = (
  records: readonly MergeWaiverRecord[],
): ReadonlyMap<string, MergeWaiverRecord> => {
  const map = new Map<string, MergeWaiverRecord>();
  for (const record of records) map.set(record.gateId, record);
  return map;
};

/** The recorded waiver's authorizer for a gate, if any. */
export const recordedWaiverAuthorizer = (
  records: readonly MergeWaiverRecord[],
  gateId: string,
): string | undefined => newestWaiverByGate(records).get(gateId)?.authorizer;
