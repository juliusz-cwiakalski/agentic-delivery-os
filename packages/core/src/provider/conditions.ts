/**
 * Per-entry condition combination (GH-182 F-3/F-4, DM-8).
 *
 * Peak and quota facts are independent; the combined wait is the MAX and the
 * single cause is the condition determining the later expiry, with the fixed
 * tie order `peak-window` > `quota-exhausted` > `provider-outage` >
 * `credential-missing` > `credential-rejected`.
 */
import {
  type CombinedProviderCondition,
  PROVIDER_CONDITION_TIE_ORDER,
  type ProviderConditionKind,
  type ProviderConditionResult,
  type ProviderParkEvidence,
} from "#contracts";

const tieOrder = (kind: ProviderConditionKind): number =>
  PROVIDER_CONDITION_TIE_ORDER.indexOf(kind);

const orderedKinds = (kinds: readonly ProviderConditionKind[]): readonly ProviderConditionKind[] =>
  [...new Set(kinds)].sort((left, right) => tieOrder(left) - tieOrder(right));

const mergeEvidence = (conditions: readonly ProviderConditionResult[]): ProviderParkEvidence => {
  const merged: Record<string, unknown> = {};
  const ordered = [...conditions].sort((left, right) => {
    if (left.status === "clear" || right.status === "clear") return 0;
    return tieOrder(left.kind) - tieOrder(right.kind);
  });
  for (const condition of ordered) {
    if (condition.status === "clear") continue;
    for (const [key, value] of Object.entries(condition.evidence)) {
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged as ProviderParkEvidence;
};

/** Combine an entry's condition results into one clear/parked/failed state. */
export const combineProviderConditions = (
  conditions: readonly ProviderConditionResult[],
): CombinedProviderCondition => {
  const active = conditions.filter((condition) => condition.status !== "clear");
  if (active.length === 0) return { status: "clear" };
  const kinds = orderedKinds(active.map((condition) => condition.kind));

  const failed = active
    .filter(
      (condition): condition is Extract<ProviderConditionResult, { status: "failed" }> =>
        condition.status === "failed",
    )
    .sort((left, right) => tieOrder(left.kind) - tieOrder(right.kind));
  if (failed.length > 0) {
    const primary = failed[0] as Extract<ProviderConditionResult, { status: "failed" }>;
    return {
      status: "failed",
      cause: primary.kind,
      conditions: kinds,
      errorCode: primary.errorCode,
      announcementCode: primary.announcementCode,
      evidence: mergeEvidence(active),
    };
  }

  const parked = active.filter(
    (condition): condition is Extract<ProviderConditionResult, { status: "parked" }> =>
      condition.status === "parked",
  );
  const primary = parked.sort(
    (left, right) =>
      right.expiresAtMs - left.expiresAtMs || tieOrder(left.kind) - tieOrder(right.kind),
  )[0] as Extract<ProviderConditionResult, { status: "parked" }>;
  return {
    status: "parked",
    cause: primary.kind,
    conditions: kinds,
    waitSeconds: primary.waitSeconds,
    expiresAtMs: primary.expiresAtMs,
    announcementCode: primary.announcementCode,
    evidence: { ...mergeEvidence(active), conditionKinds: kinds, waitSeconds: primary.waitSeconds },
  };
};
