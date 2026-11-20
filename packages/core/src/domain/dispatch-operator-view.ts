/**
 * The pure lane-view and operator-fold arithmetic (GH-354 F-1, F-3; DM-1, DM-5,
 * DM-6; DEC-2, DEC-5).
 *
 * Two normative rules live here and nowhere else:
 *   1. the repository filter is applied to the lane records BEFORE the
 *      newest-per-ref fold, because `dispatch.lanes:<ref>` carries no
 *      repository component (API-6);
 *   2. `marker` mirrors the durable lane state and `delivering`/`stale` are
 *      derived from the tri-state advisory probe, where `unknown` never asserts
 *      staleness (DEC-2).
 */
import {
  DISPATCH_MAX_DELIVERING_REFS,
  type DispatchDeliveringData,
  type DispatchLaneRecord,
  type DispatchMarkerState,
  type DispatchOperatorLaneFacts,
  type DispatchOperatorMarker,
  type DispatchOperatorProbe,
  type DispatchOperatorRefsTruncation,
  type DispatchProbeVerdict,
  type DispatchStatusData,
} from "#contracts";

/** The marker name derived from a lane state; absent when no record exists. */
export const operatorMarkerOf = (state: DispatchMarkerState): DispatchOperatorMarker =>
  state === "active" || state === "terminal" ? state : "absent";

/** One derived lane verdict: the fold's whole decision for one ref. */
export type OperatorLaneVerdict = {
  readonly delivering: boolean;
  readonly stale: boolean;
  readonly marker: DispatchOperatorMarker;
  readonly probe: DispatchOperatorProbe;
};

/**
 * Derive the delivering/stale/marker/probe quadruple.
 *
 * A terminal record is never stale, whatever the probe says; an absent ref
 * reports `not-applicable`; `unknown` keeps the durable active state standing.
 */
export const operatorLaneVerdictOf = (
  state: DispatchMarkerState,
  probe: DispatchProbeVerdict | undefined,
): OperatorLaneVerdict => {
  if (state !== "active" && state !== "terminal") {
    return { delivering: false, stale: false, marker: "absent", probe: "not-applicable" };
  }
  const observed: DispatchOperatorProbe = probe ?? "unknown";
  if (state === "terminal") {
    return { delivering: false, stale: false, marker: "terminal", probe: observed };
  }
  const stale = observed === "dead";
  return { delivering: !stale, stale, marker: "active", probe: observed };
};

/** Project one lane record to the answer's lane facts (no new field). */
export const operatorLaneFactsOf = (record: DispatchLaneRecord): DispatchOperatorLaneFacts => ({
  attemptId: record.attemptId,
  harness: record.harnessKind,
  iterationOrdinal: record.iterationOrdinal,
  restartsConsumed: record.restartsConsumed,
  ownerStartedAt: record.owner.startedAt,
  ...(record.lastToken === undefined ? {} : { lastToken: record.lastToken }),
  ...(record.lastOutcome === undefined ? {} : { lastOutcome: record.lastOutcome }),
  recordedAt: record.recordedAt,
});

/**
 * Filter the lane records to one repository, then fold to the newest record per
 * ref. Append order is the ledger's order, so the last matching record wins.
 */
export const operatorLanesInRepository = (
  records: readonly DispatchLaneRecord[],
  repository: string,
): readonly DispatchLaneRecord[] => {
  const byRef = new Map<string, DispatchLaneRecord>();
  for (const record of records) {
    if (record.repository !== repository) continue;
    byRef.set(record.ref, record);
  }
  return [...byRef.values()].sort((left, right) => left.ref.localeCompare(right.ref, "en"));
};

/** The newest record for one `(repository, ref)`, after the same filter. */
export const operatorLaneFor = (
  records: readonly DispatchLaneRecord[],
  repository: string,
  ref: string,
): DispatchLaneRecord | undefined => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && record.repository === repository && record.ref === ref) {
      return record;
    }
  }
  return undefined;
};

/** The declared 20-ref bound and its single truncation fact. */
export const boundDeliveringRefs = (
  refs: readonly string[],
): { readonly refs: readonly string[]; readonly truncation?: DispatchOperatorRefsTruncation } => {
  if (refs.length <= DISPATCH_MAX_DELIVERING_REFS) return { refs: [...refs] };
  return {
    refs: refs.slice(0, DISPATCH_MAX_DELIVERING_REFS),
    truncation: {
      bound: DISPATCH_MAX_DELIVERING_REFS,
      omitted: refs.length - DISPATCH_MAX_DELIVERING_REFS,
    },
  };
};

/** Build one `status` payload from an already-read lane record and its probe. */
export const buildStatusData = (input: {
  readonly ref: string;
  readonly repository: string;
  readonly record: DispatchLaneRecord | undefined;
  readonly probe: DispatchProbeVerdict | undefined;
}): DispatchStatusData => {
  const record = input.record;
  const verdict = operatorLaneVerdictOf(record?.state, input.probe);
  return {
    query: "status",
    ref: input.ref,
    repository: input.repository,
    delivering: verdict.delivering,
    stale: verdict.stale,
    marker: verdict.marker,
    probe: verdict.probe,
    pid: record === undefined ? null : record.owner.processId,
    sessionId: record === undefined ? null : record.sessionId,
    lane: record === undefined ? null : operatorLaneFactsOf(record),
  };
};

/** Build the per-ref `is-delivering` payload; no `refs` list on this form. */
export const buildRefDeliveringData = (input: {
  readonly ref: string;
  readonly repository: string;
  readonly record: DispatchLaneRecord | undefined;
  readonly probe: DispatchProbeVerdict | undefined;
}): DispatchDeliveringData => ({
  query: "is-delivering",
  delivering: operatorLaneVerdictOf(input.record?.state, input.probe).delivering,
  repository: input.repository,
  ref: input.ref,
});

/** Build the repository-wide `is-delivering` payload with its bounded ref list. */
export const buildRepositoryDeliveringData = (input: {
  readonly repository: string;
  readonly refs: readonly string[];
}): DispatchDeliveringData => {
  const bounded = boundDeliveringRefs(input.refs);
  return {
    query: "is-delivering",
    delivering: bounded.refs.length > 0,
    repository: input.repository,
    ref: null,
    refs: bounded.refs,
    ...(bounded.truncation === undefined ? {} : { truncation: bounded.truncation }),
  };
};
