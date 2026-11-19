/**
 * Deterministic subscription-first chain resolution (GH-182 F-2, DM-7; GH-350
 * adds the budget skip reason and the no-paid-escalation rule).
 *
 * Declared order only; validation has already rejected cost-order, duplicate,
 * and unknown-reference violations. Every non-selected entry carries exactly
 * one reason from the closed nine-value set according to the pinned precedence.
 * A paid entry is selectable only under the delivered eligibility rule AND when
 * no subscription entry is PARKED for `budget-exhausted`; a ticket-scope budget
 * crossing is a failed entry, so it never blocks a later eligible paid entry.
 */
import {
  type AnnouncementCode,
  type CombinedProviderCondition,
  type ParkCause,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_CONDITION_TIE_ORDER,
  type ProviderChain,
  type ProviderConditionKind,
  type ProviderDecision,
  type ProviderDescriptor,
  type ProviderErrorCode,
  type ProviderParkEvidence,
  type ProviderSkippedEntry,
  type ProviderSkipReason,
} from "#contracts";
import { createParkRecord } from "./parks.js";

export type ChainEntryState = {
  readonly descriptor: ProviderDescriptor;
  readonly condition: CombinedProviderCondition;
};

export type ChainResolutionOutcome =
  | {
      readonly ok: true;
      readonly decision: ProviderDecision;
      readonly skipped: readonly ProviderSkippedEntry[];
    }
  | {
      readonly ok: false;
      readonly errorCode: ProviderErrorCode;
      readonly announcementCode?: AnnouncementCode;
      readonly detail: string;
    };

export type ChainResolutionInput = {
  readonly chain: ProviderChain;
  readonly states: Readonly<Record<string, ChainEntryState>>;
  readonly nowMs: number;
};

const asConditionKind = (cause: ParkCause): ProviderConditionKind | undefined =>
  (PROVIDER_CONDITION_KINDS as readonly string[]).includes(cause)
    ? (cause as ProviderConditionKind)
    : undefined;

/**
 * The chain park's evidence unions the contributing entries' own evidence (the
 * only emitted object that can carry both a `timezone` and a budget field),
 * first contributor winning a shared key so the result is deterministic for a
 * declared chain order.
 */
const mergedContributingEvidence = (
  contributing: readonly ChainEntryState[],
): ProviderParkEvidence => {
  const merged: Record<string, unknown> = {};
  for (const state of contributing) {
    if (state.condition.status !== "parked") continue;
    for (const [key, value] of Object.entries(state.condition.evidence)) {
      if (value !== undefined && merged[key] === undefined) merged[key] = value;
    }
  }
  return merged as ProviderParkEvidence;
};

/** The terminal detail for a failed entry; a budget crossing names its own facts. */
const failureDetail = (failed: ChainEntryState): string => {
  if (failed.condition.status !== "failed") {
    return `provider ${failed.descriptor.name} cannot produce an honest resume time`;
  }
  const evidence = failed.condition.evidence;
  if (failed.condition.cause === "budget-exhausted") {
    return (
      `provider ${failed.descriptor.name} crossed budget ${evidence.budgetName ?? "?"} ` +
      `(${evidence.budgetScope ?? "?"}, ${evidence.budgetBasis ?? "?"} ` +
      `${String(evidence.budgetMeasured ?? 0)} of ${String(evidence.budgetCeiling ?? 0)}); ` +
      `the ceiling cannot reopen`
    );
  }
  return `provider ${failed.descriptor.name} cannot produce an honest resume time`;
};

const skipReason = (entry: ChainEntryState, chain: ProviderChain): ProviderSkipReason => {
  if (!entry.descriptor.enabled) return "disabled";
  // A parked entry's cause and a failed entry's condition kind both map to the
  // entry-specific skip reason; a failed quota verdict is `quota-exhausted`.
  if (entry.condition.status !== "clear") {
    return asConditionKind(entry.condition.cause) ?? "shadowed";
  }
  if (entry.descriptor.class === "pay-per-token" && !chain.allowPaidFallback) {
    return "paid-fallback-not-allowed";
  }
  return "shadowed";
};

/** Resolve one validated chain from already-evaluated entry states. */
export const resolveProviderChain = (input: ChainResolutionInput): ChainResolutionOutcome => {
  const { chain, states, nowMs } = input;
  const peakBlocked = chain.entries.some((name) => {
    const state = states[name];
    return (
      state?.descriptor.enabled &&
      state.descriptor.class === "subscription" &&
      state.condition.status === "parked" &&
      state.condition.cause === "peak-window"
    );
  });
  // A parked budget is the operator's own ceiling: nothing relieves it, so no
  // paid capacity is selectable while a subscription entry is parked for it.
  const budgetBlocked = chain.entries.some((name) => {
    const state = states[name];
    return (
      state?.descriptor.enabled &&
      state.descriptor.class === "subscription" &&
      state.condition.status === "parked" &&
      state.condition.cause === "budget-exhausted"
    );
  });

  const eligible = (name: string): boolean => {
    const state = states[name];
    if (state === undefined) return false;
    if (!state.descriptor.enabled || state.condition.status !== "clear") return false;
    if (state.descriptor.class === "subscription") return true;
    return chain.allowPaidFallback && !peakBlocked && !budgetBlocked;
  };

  // A failed entry (quota exhausted with no honest reset) does not abort the
  // walk (F-2/AC-F2-6): it is reported as `quota-exhausted`, creates no park,
  // and later eligible entries are considered.
  const failed = chain.entries
    .map((name) => states[name])
    .find(
      (state): state is ChainEntryState =>
        state !== undefined && state.condition.status === "failed",
    );

  const selectedName = chain.entries.find(eligible);
  if (selectedName !== undefined) {
    const selected = states[selectedName] as ChainEntryState;
    const skipped: ProviderSkippedEntry[] = chain.entries
      .filter((name) => name !== selectedName)
      .map((name) => {
        const state = states[name] as ChainEntryState;
        return { providerName: name, reason: skipReason(state, chain) };
      });
    return {
      ok: true,
      decision: {
        kind: "selected",
        chainName: chain.name,
        providerName: selected.descriptor.name,
        costClass: selected.descriptor.class,
      },
      skipped,
    };
  }

  const contributing = chain.entries
    .map((name) => states[name] as ChainEntryState | undefined)
    .filter(
      (state): state is ChainEntryState =>
        state !== undefined && state.descriptor.enabled && state.condition.status === "parked",
    );
  if (contributing.length === 0) {
    if (failed !== undefined && failed.condition.status === "failed") {
      return {
        ok: false,
        errorCode: failed.condition.errorCode,
        announcementCode: failed.condition.announcementCode,
        detail: failureDetail(failed),
      };
    }
    return {
      ok: false,
      errorCode: "provider.outage",
      detail: "no chain entry can supply a future resume time",
    };
  }
  const determining = contributing.reduce((earliest, candidate) =>
    candidate.condition.status === "parked" &&
    earliest.condition.status === "parked" &&
    candidate.condition.expiresAtMs < earliest.condition.expiresAtMs
      ? candidate
      : earliest,
  );
  if (determining.condition.status !== "parked") {
    return {
      ok: false,
      errorCode: "provider.outage",
      detail: "chain park has no contributing provider expiry",
    };
  }
  const conditions = [
    ...new Set(
      contributing.flatMap((state) =>
        state.condition.status === "parked" ? state.condition.conditions : [],
      ),
    ),
  ].sort(
    (left, right) =>
      PROVIDER_CONDITION_TIE_ORDER.indexOf(left) - PROVIDER_CONDITION_TIE_ORDER.indexOf(right),
  );
  const park = createParkRecord({
    subjectKind: "chain",
    subjectName: chain.name,
    cause: "chain-exhausted",
    conditions,
    createdAtMs: nowMs,
    expiresAtMs: determining.condition.expiresAtMs,
    evidence: {
      ...mergedContributingEvidence(contributing),
      chainName: chain.name,
      conditionKinds: conditions,
      waitSeconds: Math.max(0, Math.floor((determining.condition.expiresAtMs - nowMs) / 1_000)),
    },
  });
  const skipped: ProviderSkippedEntry[] = chain.entries.map((name) => {
    const state = states[name] as ChainEntryState;
    return { providerName: name, reason: skipReason(state, chain) };
  });
  return {
    ok: true,
    decision: { kind: "parked", chainName: chain.name, park },
    skipped,
  };
};
