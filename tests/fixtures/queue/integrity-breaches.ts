/**
 * Typed queue-integrity breach and control builders (GH-349 F-6, TC-F6-001..012).
 *
 * Every property declared by F-6 is proved through the production composition;
 * no production input can violate a property that holds, so each control has one
 * of exactly two declared shapes (spec v1.3 F10; AC-F6-1):
 *
 *   - `derived-comparison` — an independent re-derivation of the delivered
 *     truth from the records, compared against what the surface reported.
 *   - `deliberately-broken-double` — a double typed against the production
 *     shape whose behaviour violates the property, so the same comparison fails
 *     naming the property. A type change is a compile error, never a silently
 *     passing no-op.
 *
 * Nothing here mutates a store, invokes a provider, or reads a clock: every
 * observation is captured from the production composition in the suite and the
 * breach is applied to a copy (derived) or produced by a typed double.
 */

import type { DispatchAdmissionRefusal } from "../../../packages/core/src/app/queue";
import type {
  CommandResultDetail,
  DeliveryStateAlias,
  QueueDependencyRecord,
  QueueIncidentRecord,
  QueueLeaseRecord,
  QueueParkRecord,
  QueueRemovalRecord,
  QueueTrackerRead,
  StateRecord,
} from "../../../packages/core/src/contracts/index";
import {
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  QUEUE_MAX_DETAIL_CHARS,
  QUEUE_PARK_CAUSES,
  QUEUE_REMOVAL_REASONS,
} from "../../../packages/core/src/contracts/index";

/* ------------------------------- the metric ------------------------------- */

/** The seven declared integrity properties, in the spec's order. */
export const QUEUE_INTEGRITY_PROPERTIES = [
  "claim-integrity",
  "park-integrity",
  "reconcile-integrity",
  "crud-integrity",
  "reason-bearing-removal",
  "single-flight",
  "append-position-presence",
] as const;

export type QueueIntegrityProperty = (typeof QUEUE_INTEGRITY_PROPERTIES)[number];

/** The two declared control shapes; a token assertion is neither. */
export const QUEUE_INTEGRITY_CONTROL_SHAPES = [
  "derived-comparison",
  "deliberately-broken-double",
] as const;

export type QueueIntegrityControlShape = (typeof QUEUE_INTEGRITY_CONTROL_SHAPES)[number];

/** The declared shape per property (reported as 7/7 with a shape each). */
export const QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY = {
  "claim-integrity": "deliberately-broken-double",
  "park-integrity": "deliberately-broken-double",
  "reconcile-integrity": "deliberately-broken-double",
  "crud-integrity": "derived-comparison",
  "reason-bearing-removal": "derived-comparison",
  "single-flight": "deliberately-broken-double",
  "append-position-presence": "derived-comparison",
} as const satisfies Record<QueueIntegrityProperty, QueueIntegrityControlShape>;

/** A control divergence; the message always names the property. */
export class QueueIntegrityControlFailure extends Error {
  readonly property: QueueIntegrityProperty;

  constructor(property: QueueIntegrityProperty, subject: string) {
    super(`${property}: ${subject}`);
    this.name = "QueueIntegrityControlFailure";
    this.property = property;
  }
}

/** Build the named failure a control throws when it detects a breach. */
export const queueIntegrityFailure = (
  property: QueueIntegrityProperty,
  subject: string,
): QueueIntegrityControlFailure => new QueueIntegrityControlFailure(property, subject);

/**
 * Assert that a control diverges on the injected breach. A control that
 * returns no divergence is a token assertion and is itself a failure (M98).
 */
export const assertControlDiverges = (
  property: QueueIntegrityProperty,
  subject: string | undefined,
): QueueIntegrityControlFailure => {
  if (subject === undefined) {
    throw queueIntegrityFailure(property, "control produced no divergence (token assertion)");
  }
  return queueIntegrityFailure(property, subject);
};

/* ----------------------------- 1. claim integrity ------------------------- */

export type ClaimIntegrityObservation = {
  readonly holder: string;
  readonly renewal: {
    readonly before: readonly QueueLeaseRecord[];
    readonly after: readonly QueueLeaseRecord[];
  };
  readonly takeover: {
    readonly leases: readonly QueueLeaseRecord[];
    readonly incidents: readonly QueueIncidentRecord[];
  };
  readonly sameRefRefusal: DispatchAdmissionRefusal | undefined;
  readonly crossRefRefusal: DispatchAdmissionRefusal | undefined;
};

const acquisitionIdentity = (record: QueueLeaseRecord): string =>
  `${record.repository}\u0000${record.holder}\u0000${record.acquiredAt}`;

/** Independent claim-integrity re-derivation over the delivered records. */
export const claimIntegrityDivergence = (
  observation: ClaimIntegrityObservation,
): string | undefined => {
  const added = observation.renewal.after.length - observation.renewal.before.length;
  if (added !== 1) return `renewal appended ${added} lease records; the declared sentence is one`;
  const prior = observation.renewal.before.at(-1);
  const renewed = observation.renewal.after.at(-1);
  if (renewed === undefined) return "renewal appended no lease record";
  if (renewed.operation !== "renewed") return `renewal appended operation ${renewed.operation}`;
  if (prior !== undefined && renewed.leaseId !== prior.leaseId) {
    return `renewal changed the lease id ${prior.leaseId} -> ${renewed.leaseId}`;
  }
  const acquisitions = new Set(
    observation.renewal.after
      .filter((record) => record.operation === "acquired" || record.operation === "taken-over")
      .map(acquisitionIdentity),
  );
  const acquisitionRecords = observation.renewal.after.filter(
    (record) => record.operation === "acquired" || record.operation === "taken-over",
  );
  if (acquisitions.size !== acquisitionRecords.length) {
    return "renewal duplicated an acquisition identity";
  }
  const takeover = observation.takeover.leases.at(-1);
  if (takeover?.operation !== "taken-over") {
    return `stale takeover operation ${takeover?.operation ?? "absent"}`;
  }
  if (takeover.takeover?.previousHolder !== observation.holder) {
    return `stale takeover evidence previousHolder ${takeover.takeover?.previousHolder ?? "absent"}`;
  }
  const incident = observation.takeover.incidents.at(-1);
  if (incident?.type !== "lease-stale-takeover") return "takeover incident absent";
  if (
    !incident.evidence.some(
      (entry) => entry.key === "previousHolder" && entry.value === observation.holder,
    )
  ) {
    return "takeover incident does not name the stale holder";
  }
  if (
    observation.sameRefRefusal?.code !== "queue.single-flight" ||
    observation.sameRefRefusal.holder !== observation.holder
  ) {
    return `same-ref refusal ${observation.sameRefRefusal?.code ?? "accepted"}/${
      observation.sameRefRefusal?.holder ?? "unnamed"
    }`;
  }
  const conflict = observation.crossRefRefusal;
  if (conflict?.code !== "queue.lease-conflict") {
    return `cross-ref refusal ${conflict?.code ?? "accepted"} is not queue.lease-conflict`;
  }
  if (conflict.summary?.includes(`holder:${observation.holder}`) !== true) {
    return "cross-ref refusal does not name the repository holder";
  }
  return undefined;
};

/** A lease double whose renewal path appends a second lease record (breach). */
export const brokenClaimRenewalDouble = (
  observation: ClaimIntegrityObservation,
): ClaimIntegrityObservation => {
  const renewed = observation.renewal.after.at(-1);
  if (renewed === undefined) throw new Error("the claim control needs a renewal record");
  return {
    ...observation,
    renewal: {
      ...observation.renewal,
      after: [...observation.renewal.after, { ...renewed }],
    },
  };
};

/* ------------------------------ 2. park integrity ------------------------- */

export type ParkRefusalObservation = {
  readonly label: string;
  readonly code: string;
  readonly summary: string;
};

export type ParkIntegrityObservation = {
  readonly ref: string;
  readonly operatorRefusals: readonly ParkRefusalObservation[];
  readonly operatorLedger: readonly QueueParkRecord[];
  readonly parksAfterRemoval: readonly QueueParkRecord[];
};

const BATTERY_ONLY_CAUSES: readonly string[] = ["liveness-stall"];
const EXPIRY_CARRYING_CAUSES: readonly string[] = ["provider-window", "peak-window"];

const activeParkRefs = (records: readonly QueueParkRecord[]): ReadonlySet<string> => {
  const active = new Map<string, QueueParkRecord>();
  for (const record of records) {
    if (record.recoveryState === "parked") {
      active.set(record.ref, record);
      continue;
    }
    if (record.recoveryState === "recovered" || record.recoveryState === "released") {
      active.delete(record.ref);
    }
  }
  return new Set(active.keys());
};

/** Independent park-integrity re-derivation over the delivered records. */
export const parkIntegrityDivergence = (
  observation: ParkIntegrityObservation,
): string | undefined => {
  const refusal = (label: string): ParkRefusalObservation | undefined =>
    observation.operatorRefusals.find((entry) => entry.label === label);
  const outOfVocabulary = refusal("out-of-vocabulary");
  if (outOfVocabulary?.code !== "input.value.rejected") {
    return `out-of-vocabulary cause refusal ${outOfVocabulary?.code ?? "accepted"}`;
  }
  const batteryOnly = refusal("battery-only");
  if (batteryOnly?.code !== "fallback.invocation") {
    return `battery-only cause refusal ${batteryOnly?.code ?? "accepted"}`;
  }
  if (
    !batteryOnly.summary.includes("liveness-stall") ||
    !batteryOnly.summary.includes("battery-only")
  ) {
    return "battery-only refusal does not name the cause";
  }
  const missingExpiry = refusal("missing-expiry");
  if (missingExpiry?.summary.includes("until-required") !== true) {
    return "provider-window without an expiry was not refused as until-required";
  }
  const forbiddenExpiry = refusal("forbidden-expiry");
  if (forbiddenExpiry?.summary.includes("until-unsupported") !== true) {
    return "owner-hold with an expiry was not refused as until-unsupported";
  }
  for (const record of observation.operatorLedger) {
    if (BATTERY_ONLY_CAUSES.includes(record.cause)) {
      return `operator path wrote battery-only cause ${record.cause}`;
    }
    if (record.cause === "owner-hold" && record.until !== undefined) {
      return "owner-hold park carries an expiry";
    }
    if (EXPIRY_CARRYING_CAUSES.includes(record.cause)) {
      if (record.condition.type !== "provider-window" || record.condition.expiresAt.trim() === "") {
        return `expiry-carrying cause ${record.cause} has no absolute expiry`;
      }
    }
  }
  const activeAfterRemoval = activeParkRefs(observation.parksAfterRemoval);
  if (activeAfterRemoval.has(observation.ref)) {
    return `removal left an active park for ${observation.ref}`;
  }
  return undefined;
};

/** A park-writer double that accepts the battery-only cause on the operator path. */
export const brokenParkWriterDouble = (
  observation: ParkIntegrityObservation,
): ParkIntegrityObservation => {
  const seeded = observation.operatorLedger.at(-1);
  const breached: QueueParkRecord = {
    schema: "delivery.queue.park.v1",
    ref: observation.ref,
    cause: "liveness-stall",
    conditionType: "provider-window",
    condition: { type: "provider-window", expiresAt: "2026-11-07T09:00:00Z" },
    recheckMs: 60_000,
    evaluatedAt: seeded?.evaluatedAt ?? "2026-11-07T10:00:00Z",
    recoveryState: "parked",
    recordedAt: seeded?.recordedAt ?? "2026-11-07T10:00:00Z",
  };
  return { ...observation, operatorLedger: [...observation.operatorLedger, breached] };
};

/* --------------------------- 3. reconcile integrity ----------------------- */

export type ReconcileExpectation = {
  readonly checked: number;
  readonly removed: readonly string[];
  readonly retained: readonly {
    readonly ref: string;
    readonly deliveryState: DeliveryStateAlias;
  }[];
  readonly unobserved: readonly string[];
  readonly truncated: boolean;
  readonly remainder: number;
};

export type ReconcileIntegrityObservation = {
  readonly payload: {
    readonly checked: number;
    readonly removed: readonly { readonly ref: string; readonly reason: string }[];
    readonly retained: readonly {
      readonly ref: string;
      readonly deliveryState: DeliveryStateAlias;
    }[];
    readonly unobserved: readonly string[];
    readonly truncated: boolean;
    readonly remainder: number;
  };
  readonly expected: ReconcileExpectation;
};

/** Independent reconcile-integrity re-derivation from the declared truth. */
export const reconcileIntegrityDivergence = (
  observation: ReconcileIntegrityObservation,
): string | undefined => {
  const { payload, expected } = observation;
  if (payload.checked !== expected.checked) {
    return `checked ${payload.checked}, declared ${expected.checked}`;
  }
  for (const entry of payload.removed) {
    const declaredRetained = expected.retained.find((candidate) => candidate.ref === entry.ref);
    if (declaredRetained !== undefined) {
      return `removed ${entry.ref}, declared retained ${declaredRetained.deliveryState}`;
    }
  }
  const removed = [...payload.removed.map((entry) => entry.ref)].sort();
  const declaredRemoved = [...expected.removed].sort();
  if (JSON.stringify(removed) !== JSON.stringify(declaredRemoved)) {
    return `removed ${removed.join(",") || "none"}, declared ${declaredRemoved.join(",") || "none"}`;
  }
  const retained = [...payload.retained]
    .map((entry) => `${entry.ref}:${entry.deliveryState}`)
    .sort();
  const declaredRetained = [...expected.retained]
    .map((entry) => `${entry.ref}:${entry.deliveryState}`)
    .sort();
  if (JSON.stringify(retained) !== JSON.stringify(declaredRetained)) {
    return `retained ${retained.join(",") || "none"}, declared ${
      declaredRetained.join(",") || "none"
    }`;
  }
  const unobserved = [...payload.unobserved].sort();
  const declaredUnobserved = [...expected.unobserved].sort();
  if (JSON.stringify(unobserved) !== JSON.stringify(declaredUnobserved)) {
    return `unobserved ${unobserved.join(",") || "none"}, declared ${
      declaredUnobserved.join(",") || "none"
    }`;
  }
  if (payload.truncated !== expected.truncated || payload.remainder !== expected.remainder) {
    return `remainder ${payload.remainder}/${payload.truncated}, declared ${expected.remainder}/${expected.truncated}`;
  }
  for (const entry of payload.removed) {
    if (entry.reason !== "reconciled") return `removal reason ${entry.reason} is not reconciled`;
  }
  return undefined;
};

/**
 * A tracker-read double that reports the given refs as `done` regardless of the
 * delivered observation (the "in-review is stale" breach). Typed against the
 * production tracker-read union.
 */
export const brokenReconcileReaderDouble =
  (
    base: (ref: string) => Promise<QueueTrackerRead>,
    staleAsDone: ReadonlySet<string>,
  ): ((ref: string) => Promise<QueueTrackerRead>) =>
  async (ref: string) => {
    if (staleAsDone.has(ref)) return { ok: true, kind: "state", deliveryState: "done" };
    return base(ref);
  };

/* ------------------------------ 4. CRUD integrity ------------------------- */

export type CrudIntegrityObservation = {
  readonly ref: string;
  readonly producer: string;
  readonly add: { readonly result: string; readonly edges: readonly string[] };
  readonly afterAddDependencies: readonly QueueDependencyRecord[];
  readonly depRemove: { readonly result: string; readonly edges: readonly string[] };
  readonly afterRemoveDependencies: readonly QueueDependencyRecord[];
  readonly cycle: { readonly code: string; readonly summary: string } | undefined;
  readonly survivor: {
    readonly ref: string;
    readonly presentRefs: readonly string[];
    readonly edges: readonly string[];
    /** True when the dependent's dependency records are byte-identical (no cascade). */
    readonly recordsUnchanged: boolean;
  };
};

/** Independent latest-record edge multiset (append order decides). */
const latestDeclaredEdges = (
  records: readonly QueueDependencyRecord[],
  ref: string,
): readonly string[] => {
  let latest: readonly string[] | undefined;
  for (const record of records) {
    if (record.ref === ref) latest = [...record.edges];
  }
  return latest ?? [];
};

/** Independent CRUD-integrity re-derivation over the raw dependency records. */
export const crudIntegrityDivergence = (
  observation: CrudIntegrityObservation,
): string | undefined => {
  if (observation.add.result !== "added") return `dep add result ${observation.add.result}`;
  if (observation.add.edges.length !== 1 || observation.add.edges[0] !== observation.producer) {
    return `dep add wrote ${observation.add.edges.length} edges, declared one to ${observation.producer}`;
  }
  const afterAdd = latestDeclaredEdges(observation.afterAddDependencies, observation.ref);
  if (JSON.stringify(afterAdd) !== JSON.stringify(observation.add.edges)) {
    return `edge multiset [${afterAdd.join(",")}] disagrees with the surface [${observation.add.edges.join(",")}]`;
  }
  for (const record of observation.afterAddDependencies) {
    const unique = new Set(record.edges);
    if (unique.size !== record.edges.length) {
      return `independent re-derivation found an extra edge on ${record.ref}`;
    }
  }
  if (observation.depRemove.result !== "removed") {
    return `dep remove result ${observation.depRemove.result}`;
  }
  if (observation.depRemove.edges.length !== 0) {
    return `dep remove left ${observation.depRemove.edges.length} edges`;
  }
  const afterRemove = latestDeclaredEdges(observation.afterRemoveDependencies, observation.ref);
  if (afterRemove.length !== 0) {
    return `edge multiset [${afterRemove.join(",")}] survives the one-edge removal`;
  }
  if (observation.cycle?.code !== "queue.dependency-cycle") {
    return `cycle add result ${observation.cycle?.code ?? "accepted"}`;
  }
  if (
    !observation.cycle.summary.includes(observation.ref) ||
    !observation.cycle.summary.includes(observation.producer)
  ) {
    return "cycle refusal does not name the existing path";
  }
  if (!observation.survivor.presentRefs.includes(observation.survivor.ref)) {
    return `removal cascaded into dependent ${observation.survivor.ref}`;
  }
  if (!observation.survivor.recordsUnchanged) {
    return `removal rewrote dependent ${observation.survivor.ref}'s records (a cascade)`;
  }
  if (!observation.survivor.edges.includes(observation.producer)) {
    return `dependent ${observation.survivor.ref} lost its declared edge to the retired producer`;
  }
  return undefined;
};

/** A derived-comparison breach: one extra edge appended to the declared records. */
export const crudExtraEdgeBreach = (
  observation: CrudIntegrityObservation,
): CrudIntegrityObservation => {
  const breached = observation.afterAddDependencies.map((record) =>
    record.ref === observation.ref
      ? { ...record, edges: [...record.edges, observation.producer] }
      : record,
  );
  return { ...observation, afterAddDependencies: breached };
};

/* ------------------------ 5. reason-bearing removal ----------------------- */

export type RemovalRefusalObservation = {
  readonly label: string;
  readonly expectedCode: string;
  readonly code: string;
  readonly appended: number;
};

export type ReasonBearingRemovalObservation = {
  readonly refusals: readonly RemovalRefusalObservation[];
  readonly explicitSecond: { readonly code: string };
  readonly automaticSecond: {
    readonly outcome: "removed" | "satisfied" | "skipped" | "would-remove";
  };
};

/** Independent refusal/append re-derivation for the removal property. */
export const reasonBearingRemovalDivergence = (
  observation: ReasonBearingRemovalObservation,
): string | undefined => {
  for (const refusal of observation.refusals) {
    if (refusal.code !== refusal.expectedCode) {
      return `refusal ${refusal.label} returned ${refusal.code}, declared ${refusal.expectedCode}`;
    }
    if (refusal.appended !== 0) {
      return `refusal ${refusal.label} appended ${refusal.appended} records`;
    }
  }
  if (observation.explicitSecond.code !== "queue.entry.unobserved") {
    return `explicit second removal returned ${observation.explicitSecond.code}, declared queue.entry.unobserved`;
  }
  if (observation.automaticSecond.outcome !== "satisfied") {
    return `automatic second result ${observation.automaticSecond.outcome}, declared satisfied`;
  }
  return undefined;
};

/** A derived-comparison breach: a refusal that appended a record. */
export const removalAppendBreach = (
  observation: ReasonBearingRemovalObservation,
): ReasonBearingRemovalObservation => {
  const [first, ...rest] = observation.refusals;
  if (first === undefined) throw new Error("the removal control needs one refusal");
  return { ...observation, refusals: [{ ...first, appended: 1 }, ...rest] };
};

/** A derived-comparison breach: the automatic second result stops converging. */
export const removalConvergenceBreach = (
  observation: ReasonBearingRemovalObservation,
): ReasonBearingRemovalObservation => ({
  ...observation,
  automaticSecond: { outcome: "removed" },
});

/* ------------------------------ 6. single-flight -------------------------- */

export type SingleFlightEnvelope = {
  readonly code: string;
  readonly detail?: CommandResultDetail;
  readonly nested?: { readonly detail?: CommandResultDetail };
};

export type SingleFlightObservation = {
  readonly holder: string;
  readonly envelope: SingleFlightEnvelope;
};

/** Independent envelope-root holder re-derivation for the refusal. */
export const singleFlightDivergence = (
  observation: SingleFlightObservation,
): string | undefined => {
  const { envelope, holder } = observation;
  if (envelope.code !== "queue.single-flight") {
    return `refusal code ${envelope.code} is not queue.single-flight`;
  }
  const rootHolder = envelope.detail?.holder;
  if (rootHolder === undefined) {
    return `holder missing from the envelope root${
      envelope.nested?.detail?.holder === undefined
        ? ""
        : ` (present only as nested detail ${envelope.nested.detail.holder})`
    }`;
  }
  if (rootHolder !== holder) {
    const nested = envelope.nested?.detail?.holder;
    return `envelope-root holder ${rootHolder} is not the live holder ${holder}${
      nested === undefined ? "" : ` (nested detail carries ${nested})`
    }`;
  }
  if (rootHolder.length > COMMAND_FAILURE_DETAIL_MAX_CHARS) {
    return `holder length ${rootHolder.length} exceeds ${COMMAND_FAILURE_DETAIL_MAX_CHARS}`;
  }
  return undefined;
};

/** A snapshot double that returns the holder only in nested detail (breach). */
export const brokenNestedHolderDouble = (
  observation: SingleFlightObservation,
): SingleFlightObservation => ({
  ...observation,
  envelope: {
    code: "queue.single-flight",
    nested: { detail: { holder: observation.holder } },
  },
});

/** A snapshot double that returns a stale holder in the root (breach). */
export const brokenStaleHolderDouble = (
  observation: SingleFlightObservation,
): SingleFlightObservation => ({
  ...observation,
  envelope: {
    code: "queue.single-flight",
    detail: { holder: "lane-0" },
    nested: { detail: { holder: observation.holder } },
  },
});

/* ---------------------- 7. append-position presence ----------------------- */

export type PresenceSnapshot = {
  readonly records: readonly StateRecord[];
  readonly foldPresent: boolean;
};

export type PresenceObservation = {
  readonly ref: string;
  readonly afterRemoval: PresenceSnapshot;
  readonly afterRedeclaration: PresenceSnapshot;
  readonly decisionSource: "append-position" | "timestamp-text";
  readonly rederivationSpecialCase: boolean;
};

type PresenceDerivation = {
  readonly present: boolean;
  readonly entrySequence?: number;
  readonly removalSequence?: number;
  readonly entryRecordedAt?: string;
  readonly removalRecordedAt?: string;
};

const presenceSnapshotOf = (snapshot: PresenceSnapshot): PresenceDerivation => {
  const sequencesOf = (kind: string): readonly number[] =>
    snapshot.records.filter((record) => record.kind === kind).map((record) => record.sequence);
  const payloadsOf = (kind: string): readonly { readonly recordedAt: string }[] =>
    snapshot.records
      .filter((record) => record.kind === kind)
      .map((record) => {
        const payload = record.payload as { readonly recordedAt?: unknown };
        return { recordedAt: typeof payload.recordedAt === "string" ? payload.recordedAt : "" };
      });
  const entrySequences = sequencesOf("queue.entry");
  const removalSequences = sequencesOf("queue.removal");
  const entryPayloads = payloadsOf("queue.entry");
  const removalPayloads = payloadsOf("queue.removal");
  const entrySequence = entrySequences.length === 0 ? undefined : Math.max(...entrySequences);
  const removalSequence = removalSequences.length === 0 ? undefined : Math.max(...removalSequences);
  const entryRecordedAt = entryPayloads.at(-1)?.recordedAt;
  const removalRecordedAt = removalPayloads.at(-1)?.recordedAt;
  const presentBySequence =
    entrySequence !== undefined &&
    (removalSequence === undefined || entrySequence > removalSequence);
  return {
    present: presentBySequence,
    ...(entrySequence === undefined ? {} : { entrySequence }),
    ...(removalSequence === undefined ? {} : { removalSequence }),
    ...(entryRecordedAt === undefined ? {} : { entryRecordedAt }),
    ...(removalRecordedAt === undefined ? {} : { removalRecordedAt }),
  };
};

/** Independent presence re-derivation: append position, then timestamp text. */
export const presenceIntegrityDivergence = (
  observation: PresenceObservation,
): string | undefined => {
  const afterRemoval = presenceSnapshotOf(observation.afterRemoval);
  const afterRedeclaration = presenceSnapshotOf(observation.afterRedeclaration);
  if (afterRemoval.present) return "the fold kept a removed ref present";
  if (!afterRedeclaration.present) return "re-declaration did not restore presence";
  if (observation.afterRemoval.foldPresent !== afterRemoval.present) {
    return `production fold ${observation.afterRemoval.foldPresent} disagrees with append position ${afterRemoval.present}`;
  }
  if (observation.afterRedeclaration.foldPresent !== afterRedeclaration.present) {
    return `production fold ${observation.afterRedeclaration.foldPresent} disagrees with append position ${afterRedeclaration.present}`;
  }
  if (observation.decisionSource === "timestamp-text") {
    const timestampPresent =
      afterRedeclaration.entryRecordedAt !== undefined &&
      (afterRedeclaration.removalRecordedAt === undefined ||
        Date.parse(afterRedeclaration.entryRecordedAt) >
          Date.parse(afterRedeclaration.removalRecordedAt));
    if (timestampPresent !== afterRedeclaration.present) {
      return `timestamp text decides presence: entry ${afterRedeclaration.entryRecordedAt ?? "absent"} vs removal ${afterRedeclaration.removalRecordedAt ?? "absent"}`;
    }
    if (timestampPresent) return "timestamp text agrees only by accident";
  }
  if (observation.rederivationSpecialCase) {
    return "re-declaration needs a special case; presence must be sequence-only";
  }
  return undefined;
};

/** A derived-comparison breach: presence decided from timestamp text. */
export const presenceTimestampBreach = (observation: PresenceObservation): PresenceObservation => ({
  ...observation,
  decisionSource: "timestamp-text",
});

/** A derived-comparison breach: a re-declaration special case. */
export const presenceSpecialCaseBreach = (
  observation: PresenceObservation,
): PresenceObservation => ({ ...observation, rederivationSpecialCase: true });

/* ---------------------------- the bounds surface -------------------------- */

/** The four declared removal reasons (a bound the property suite pins). */
export const DECLARED_REMOVAL_REASONS = QUEUE_REMOVAL_REASONS;

/** The declared park-cause vocabulary the park property pins. */
export const DECLARED_PARK_CAUSES = QUEUE_PARK_CAUSES;

/** The failure-envelope root detail bound and the safe queue detail bound. */
export const DECLARED_DETAIL_BOUNDS = {
  command: COMMAND_FAILURE_DETAIL_MAX_CHARS,
  queue: QUEUE_MAX_DETAIL_CHARS,
} as const;

/** A removal record is a tombstone; the type keeps its closed reason. */
export type RemovalTombstone = QueueRemovalRecord;
