/**
 * The queue intent ledgers over the injected state port (GH-237 F-1, F-12;
 * EVT-1, EVT-2; DM-1, DM-2, DM-13).
 *
 * Additive inside `delivery.state.v1`: fenced appends, verified post-append
 * reads, an identical replay appends nothing, and the derived graph document is
 * replaced atomically only when intent truth changes. Reads never write and the
 * derived document is never served as truth. A wrong kind, malformed payload,
 * or torn/unreadable key set is a classified `state.*` failure and never a
 * fabricated entry.
 */

import {
  type CloseoutQueueRemovalData,
  LOCAL_CALLER_PRINCIPAL,
  type OwnerHoldFact,
  QUEUE_DEFAULT_LEASE_TTL_MS,
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_DEPENDENCY_KEY_PREFIX,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_DEPENDENCY_SCHEMA,
  QUEUE_ENTRY_KEY_PREFIX,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_ENTRY_SCHEMA,
  QUEUE_GRAPH_DOCUMENT_NAME,
  QUEUE_INCIDENT_KEY_PREFIX,
  QUEUE_INCIDENT_RECORD_KIND,
  QUEUE_INCIDENT_SCHEMA,
  QUEUE_INCIDENT_TYPES,
  QUEUE_LEASE_KEY_PREFIX,
  QUEUE_LEASE_OPERATIONS,
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_LEASE_SCHEMA,
  QUEUE_LEASE_SCOPES,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_CONDITION_TYPES,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  QUEUE_PARK_RECOVERY_STATES,
  QUEUE_PARK_SCHEMA,
  QUEUE_RECONCILE_MAX_ENTRIES,
  QUEUE_RECONCILE_STALE_STATES,
  QUEUE_REMOVAL_KEY_PREFIX,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RECORD_KIND,
  QUEUE_REMOVAL_SCHEMA,
  QUEUE_WEIGHT_CLASSES,
  type QueueActiveLease,
  type QueueDependencyRecord,
  type QueueEntryRecord,
  type QueueGraphDocument,
  type QueueIncidentRecord,
  type QueueLeaseRecord,
  type QueueParkCause,
  type QueueParkCondition,
  type QueueParkRecord,
  type QueueReconcileRemoved,
  type QueueReconcileResult,
  type QueueReconcileRetained,
  type QueueRemovalReason,
  type QueueRemovalRecord,
  type QueueRemovalResult,
  type QueueTrackerRead,
  type QueueWeightClass,
  type StateAppendRequest,
  type StateFailure,
  type StateFailureCode,
  type StateFenceHandle,
  type StateJsonValue,
  type StateReadEvidence,
  type StateRecord,
  type StateSafeLocation,
  type StateStoreIdentity,
  type StateStorePort,
} from "#contracts";
import {
  canonicalQueueRef,
  compareText,
  detectCycleForEdge,
  foldLatestDependencyRecords,
  foldLatestEntries,
  foldQueueGraph,
  mergeEdges,
  normalizeEdges,
  type QueueGraphFold,
  type QueuePresenceFacts,
  queueGraphDocument,
  queuePresenceFacts,
  queueRefPresent,
} from "../domain/queue-graph.js";

/** The bounded detail naming the source and optional reason, separate from the token. */
const ownerHoldDetail = (hold: Extract<OwnerHoldFact, { readonly active: true }>): string =>
  hold.reason === undefined
    ? `owner hold active (${hold.source})`
    : `owner hold active (${hold.source}): ${hold.reason}`;

import {
  claimScope,
  earliestTakeoverAtIso,
  foldActiveLeases,
  isLeaseStale,
  leaseConflict,
  leaseHeartbeatAgeMs,
  makeLeaseId,
  type QueueClaimPrecondition,
  type QueueLeaseConflict,
} from "../domain/queue-lease.js";
import {
  clearObservedRecord,
  conditionTypeForCause,
  createParkRecord,
  defaultParkRecheckMs,
  evaluateParkPass,
  hasDuplicateActiveParks,
  latestParkRecords,
  observationGapMs,
  type QueueParkContext,
  type QueueParkPass,
  recoveredRecord,
  releasedParkRecord,
} from "../domain/queue-park.js";
import type { QueueParkEvaluation } from "../domain/queue-readiness.js";

export type {
  QueueGraphEdge,
  QueueGraphFold,
} from "../domain/queue-graph.js";

/** The classified read failure reasons shared with the merge ledgers. */
export type QueueReadReason = "torn" | "incompatible" | "unreadable";

/** One verified queue ledger read, or its classified failure. */
export type QueueLedgerRead<T> =
  | {
      readonly ok: true;
      readonly records: readonly T[];
      /** The store `sequence` of each record, parallel to `records` (DM-2). */
      readonly sequences: readonly number[];
      readonly latest: readonly T[];
      readonly verifiedEmpty: boolean;
      readonly evidence: StateReadEvidence;
    }
  | {
      readonly ok: false;
      readonly reason: QueueReadReason;
      readonly code: StateFailureCode;
    };

/** One queue intent refusal: storage, cycle, unobserved entry, or bad input. */
export type QueueIntentFailure =
  | {
      readonly ok: false;
      readonly kind: "state";
      readonly code: StateFailureCode;
      readonly location: StateSafeLocation;
      readonly reason: QueueReadReason;
    }
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.dependency-cycle";
      readonly path: readonly string[];
    }
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.entry.unobserved";
      readonly ref: string;
    }
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.reason-missing";
      readonly ref: string;
    }
  | {
      readonly ok: false;
      readonly kind: "input";
      readonly code: "input.value.rejected";
      readonly detail: string;
    };

/** The landed intent outcome. */
export type QueueIntentOutcome = {
  readonly result: "added" | "updated" | "noop";
  readonly entry: QueueEntryRecord;
  readonly edges: readonly string[];
  readonly fold: QueueGraphFold;
  readonly graph: QueueGraphDocument;
};

export type QueueIntentResult =
  | { readonly ok: true; readonly value: QueueIntentOutcome }
  | QueueIntentFailure;

const ok = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value });

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const hasOnlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const stringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const ENTRY_KEYS = [
  "schema",
  "ref",
  "repository",
  "repositoryRoot",
  "priority",
  "recordedAt",
  "callerPrincipal",
] as const;
const DEPENDENCY_KEYS = ["schema", "ref", "edges", "recordedAt", "callerPrincipal"] as const;
const LEASE_KEYS = [
  "schema",
  "leaseId",
  "scope",
  "repository",
  "holder",
  "ref",
  "runner",
  "weightClass",
  "operation",
  "acquiredAt",
  "heartbeatAt",
  "ttlMs",
  "recordedAt",
  "takeover",
] as const;
const TAKEOVER_KEYS = [
  "previousHolder",
  "leaseId",
  "heartbeatAgeMs",
  "lastHeartbeatAt",
  "takenOverAt",
] as const;
const PARK_KEYS = [
  "schema",
  "ref",
  "repository",
  "cause",
  "conditionType",
  "condition",
  "recheckMs",
  "evaluatedAt",
  "clearObservedAt",
  "clearedAt",
  "recoveredAt",
  "observationGapMs",
  "recoveryState",
  "recordedAt",
] as const;
const INCIDENT_KEYS = ["schema", "type", "ref", "repository", "evidence", "recordedAt"] as const;
const REMOVAL_KEYS = ["schema", "ref", "reason", "recordedAt", "callerPrincipal"] as const;

const isEntryRecord = (value: unknown): value is QueueEntryRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ENTRY_KEYS)) return false;
  if (value.schema !== QUEUE_ENTRY_SCHEMA) return false;
  if (typeof value.ref !== "string" || canonicalQueueRef(value.ref) !== value.ref) return false;
  if (value.repository !== undefined && !isNonEmptyString(value.repository)) return false;
  if (value.repositoryRoot !== undefined && !isNonEmptyString(value.repositoryRoot)) return false;
  // The key and the recorded root travel together: both present or both absent.
  if ((value.repository === undefined) !== (value.repositoryRoot === undefined)) return false;
  if (!isInteger(value.priority) || value.priority < 0) return false;
  return isNonEmptyString(value.recordedAt);
};

const isDependencyRecord = (value: unknown): value is QueueDependencyRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, DEPENDENCY_KEYS)) return false;
  if (value.schema !== QUEUE_DEPENDENCY_SCHEMA) return false;
  if (typeof value.ref !== "string" || canonicalQueueRef(value.ref) !== value.ref) return false;
  if (!stringList(value.edges) || value.edges.length > QUEUE_MAX_EDGES_PER_ENTRY) return false;
  if (new Set(value.edges).size !== value.edges.length) return false;
  if (!value.edges.every((edge) => canonicalQueueRef(edge) === edge)) return false;
  return isNonEmptyString(value.recordedAt);
};

const isTakeoverEvidence = (value: unknown): boolean =>
  isPlainRecord(value) &&
  hasOnlyKeys(value, TAKEOVER_KEYS) &&
  isNonEmptyString(value.previousHolder) &&
  isNonEmptyString(value.leaseId) &&
  isInteger(value.heartbeatAgeMs) &&
  value.heartbeatAgeMs >= 0 &&
  isNonEmptyString(value.lastHeartbeatAt) &&
  isNonEmptyString(value.takenOverAt);

const isLeaseRecord = (value: unknown): value is QueueLeaseRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, LEASE_KEYS)) return false;
  if (value.schema !== QUEUE_LEASE_SCHEMA) return false;
  if (!isNonEmptyString(value.leaseId)) return false;
  if (
    typeof value.scope !== "string" ||
    !(QUEUE_LEASE_SCOPES as readonly string[]).includes(value.scope)
  ) {
    return false;
  }
  if (!isNonEmptyString(value.repository)) return false;
  if (!isNonEmptyString(value.holder)) return false;
  if (typeof value.ref !== "string" || canonicalQueueRef(value.ref) !== value.ref) return false;
  if (!isNonEmptyString(value.runner)) return false;
  if (
    typeof value.weightClass !== "string" ||
    !(QUEUE_WEIGHT_CLASSES as readonly string[]).includes(value.weightClass)
  ) {
    return false;
  }
  if (
    typeof value.operation !== "string" ||
    !(QUEUE_LEASE_OPERATIONS as readonly string[]).includes(value.operation)
  ) {
    return false;
  }
  if (!isNonEmptyString(value.acquiredAt) || !isNonEmptyString(value.heartbeatAt)) return false;
  if (!isInteger(value.ttlMs) || value.ttlMs <= 0) return false;
  if (!isNonEmptyString(value.recordedAt)) return false;
  return value.takeover === undefined || isTakeoverEvidence(value.takeover);
};

const isParkRecord = (value: unknown): value is QueueParkRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, PARK_KEYS)) return false;
  if (value.schema !== QUEUE_PARK_SCHEMA) return false;
  if (typeof value.ref !== "string" || canonicalQueueRef(value.ref) !== value.ref) return false;
  if (value.repository !== undefined && !isNonEmptyString(value.repository)) return false;
  if (
    typeof value.cause !== "string" ||
    !(QUEUE_PARK_CAUSES as readonly string[]).includes(value.cause)
  ) {
    return false;
  }
  if (
    typeof value.conditionType !== "string" ||
    !(QUEUE_PARK_CONDITION_TYPES as readonly string[]).includes(value.conditionType)
  ) {
    return false;
  }
  if (!isPlainRecord(value.condition)) return false;
  if (value.condition.type !== value.conditionType) return false;
  if (value.conditionType === "provider-window" && !isNonEmptyString(value.condition.expiresAt)) {
    return false;
  }
  if (!isInteger(value.recheckMs) || value.recheckMs <= 0) return false;
  if (!isNonEmptyString(value.evaluatedAt)) return false;
  for (const key of ["clearObservedAt", "clearedAt", "recoveredAt"] as const) {
    if (value[key] !== undefined && !isNonEmptyString(value[key])) return false;
  }
  if (
    value.observationGapMs !== undefined &&
    (!isInteger(value.observationGapMs) || value.observationGapMs < 0)
  ) {
    return false;
  }
  if (
    typeof value.recoveryState !== "string" ||
    !(QUEUE_PARK_RECOVERY_STATES as readonly string[]).includes(value.recoveryState)
  ) {
    return false;
  }
  return isNonEmptyString(value.recordedAt);
};

const isIncidentEvidence = (value: unknown): boolean =>
  isPlainRecord(value) && isNonEmptyString(value.key) && isNonEmptyString(value.value);

const isIncidentRecord = (value: unknown): value is QueueIncidentRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, INCIDENT_KEYS)) return false;
  if (value.schema !== QUEUE_INCIDENT_SCHEMA) return false;
  if (
    typeof value.type !== "string" ||
    !(QUEUE_INCIDENT_TYPES as readonly string[]).includes(value.type)
  ) {
    return false;
  }
  if (value.ref !== undefined && !isNonEmptyString(value.ref)) return false;
  if (value.repository !== undefined && !isNonEmptyString(value.repository)) return false;
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) return false;
  if (!value.evidence.every(isIncidentEvidence)) return false;
  return isNonEmptyString(value.recordedAt);
};

const isRemovalRecord = (value: unknown): value is QueueRemovalRecord => {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, REMOVAL_KEYS)) return false;
  if (value.schema !== QUEUE_REMOVAL_SCHEMA) return false;
  if (typeof value.ref !== "string" || canonicalQueueRef(value.ref) !== value.ref) return false;
  if (
    typeof value.reason !== "string" ||
    !(QUEUE_REMOVAL_REASONS as readonly string[]).includes(value.reason)
  ) {
    return false;
  }
  return isNonEmptyString(value.recordedAt);
};

/** The declared store-scoped key for one entry history. */
export const queueEntryRecordKey = (ref: string): string =>
  `${QUEUE_ENTRY_KEY_PREFIX}${canonicalQueueRef(ref) ?? ref}`;

/** The declared store-scoped key for one dependency history. */
export const queueDependencyRecordKey = (ref: string): string =>
  `${QUEUE_DEPENDENCY_KEY_PREFIX}${canonicalQueueRef(ref) ?? ref}`;

/** The declared store-scoped key for one repository lease history. */
export const queueLeaseRecordKey = (repository: string): string =>
  `${QUEUE_LEASE_KEY_PREFIX}${repository}`;

/** The declared store-scoped key for one entry park history. */
export const queueParkRecordKey = (ref: string): string =>
  `${QUEUE_PARK_KEY_PREFIX}${canonicalQueueRef(ref) ?? ref}`;

/** The declared store-scoped key for one incident history. */
export const queueIncidentRecordKey = (identity: string): string =>
  `${QUEUE_INCIDENT_KEY_PREFIX}${identity}`;

/** The declared store-scoped key for one ref's removal history (GH-292 DM-1). */
export const queueRemovalRecordKey = (ref: string): string =>
  `${QUEUE_REMOVAL_KEY_PREFIX}${canonicalQueueRef(ref) ?? ref}`;

/** The removal-ledger record spec shared by the read seams. */
const REMOVAL_SPEC = {
  prefix: QUEUE_REMOVAL_KEY_PREFIX,
  kind: QUEUE_REMOVAL_RECORD_KIND,
  schema: QUEUE_REMOVAL_SCHEMA,
  isRecord: isRemovalRecord,
} as const;

/** The entry-ledger record spec shared by the read seams. */
const ENTRY_SPEC = {
  prefix: QUEUE_ENTRY_KEY_PREFIX,
  kind: QUEUE_ENTRY_RECORD_KIND,
  schema: QUEUE_ENTRY_SCHEMA,
  isRecord: isEntryRecord,
} as const;

/** The lease-ledger record spec shared by the read seams. */
const LEASE_SPEC = {
  prefix: QUEUE_LEASE_KEY_PREFIX,
  kind: QUEUE_LEASE_RECORD_KIND,
  schema: QUEUE_LEASE_SCHEMA,
  isRecord: isLeaseRecord,
} as const;

/** The success variant of a verified ledger read (records plus sequences). */
type VerifiedLedgerRead<T> = Extract<QueueLedgerRead<T>, { readonly ok: true }>;

/**
 * The presence facts over the two presence-bearing ledgers (DM-2): latest entry
 * append and latest removal append per canonical ref, from one shared snapshot
 * when a view is supplied or from two verified reads otherwise.
 */
const presenceFacts = (
  entries: VerifiedLedgerRead<QueueEntryRecord>,
  removals: VerifiedLedgerRead<QueueRemovalRecord>,
): QueuePresenceFacts =>
  queuePresenceFacts(
    entries.records.map((record, index) => ({
      ref: record.ref,
      sequence: entries.sequences[index] ?? 0,
    })),
    removals.records.map((record, index) => ({
      ref: record.ref,
      sequence: removals.sequences[index] ?? 0,
    })),
  );

/**
 * The one snapshot read shared by the entry read and the fold (NFR-3,
 * review-iter-1 F-2): the entry and removal ledgers are classified from the
 * same verified snapshot, so the fold reuses the removals it already
 * classified instead of scanning the ledger a second time.
 */
type QueueEntriesAndRemovals =
  | {
      readonly ok: true;
      readonly entries: VerifiedLedgerRead<QueueEntryRecord>;
      readonly removals: VerifiedLedgerRead<QueueRemovalRecord>;
    }
  | {
      readonly ok: false;
      readonly reason: QueueReadReason;
      readonly code: StateFailureCode;
    };

const readQueueEntriesAndRemovals = (
  store: StateStorePort,
  view?: readonly StateRecord[],
): QueueEntriesAndRemovals => {
  const snapshot = verifiedSnapshot(store, view);
  const read = classifyRecords(snapshot, ENTRY_SPEC);
  if (!read.ok) return read;
  const removals = classifyRecords(snapshot, REMOVAL_SPEC);
  if (!removals.ok) return removals;
  if (removals.records.length === 0) {
    return { ok: true, entries: { ...read, latest: foldLatestEntries(read.records) }, removals };
  }
  const facts = presenceFacts(read, removals);
  const present = read.records.filter((record) => {
    const ref = canonicalQueueRef(record.ref);
    return ref !== undefined && queueRefPresent(facts, ref);
  });
  return {
    ok: true,
    entries: { ...read, records: present, latest: foldLatestEntries(present) },
    removals,
  };
};

/**
 * Read every verified queue entry record, oldest first, with the presence rule
 * applied (GH-292 DM-2): a ref whose latest removal append is later than its
 * latest entry append contributes no record and no latest projection, so every
 * consumer of this read — the lane fold, the snapshot topic, the scheduler key
 * resolution — observes the entry as absent. A store with no removal records
 * reads exactly as before, in exactly one whole-store read: both ledgers are
 * classified from the same verified snapshot, and a supplied ledger view is
 * shared the same way.
 */
export const readQueueEntries = (
  store: StateStorePort,
  view?: readonly StateRecord[],
): QueueLedgerRead<QueueEntryRecord> => {
  const read = readQueueEntriesAndRemovals(store, view);
  return read.ok ? read.entries : read;
};

/** Read every verified queue removal record, oldest first (GH-292 DM-1). */
export const readQueueRemovals = (store: StateStorePort): QueueLedgerRead<QueueRemovalRecord> =>
  readRecords(store, REMOVAL_SPEC);

/** The derived graph document's path in the store layout (tests and diagnostics). */
export const queueGraphDocumentPath = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/documents.${encodeURIComponent(identity.workspaceId)}/${QUEUE_GRAPH_DOCUMENT_NAME}`;

const reasonFor = (code: StateFailureCode): QueueReadReason => {
  if (code === "state.schema.mismatch") return "incompatible";
  if (code === "state.store.torn" || code === "state.keys.missing") return "torn";
  return "unreadable";
};

const stateFailureOf = (error: StateFailure): QueueIntentFailure => ({
  ok: false,
  kind: "state",
  code: error.code,
  location: error.location,
  reason: reasonFor(error.code),
});

type RecordSpec<T> = {
  readonly prefix: string;
  readonly kind: string;
  readonly schema: string;
  readonly isRecord: (value: unknown) => value is T;
};

type VerifiedSnapshot =
  | {
      readonly ok: true;
      readonly value: {
        readonly records: readonly StateRecord[];
        readonly evidence: StateReadEvidence;
      };
    }
  | {
      readonly ok: false;
      readonly error: StateFailure;
    };

/** One whole-store read (or a supplied view) every ledger classification shares. */
const verifiedSnapshot = (
  store: StateStorePort,
  view?: readonly StateRecord[],
): VerifiedSnapshot =>
  view === undefined
    ? store.readRecords()
    : {
        ok: true,
        value: {
          records: view,
          evidence: {
            storePath: store.identity.stateDirectory,
            verification: [],
            verifiedEmpty: view.length === 0,
            recordCount: view.length,
          },
        },
      };

const classifyRecords = <T>(
  snapshot: VerifiedSnapshot,
  spec: RecordSpec<T>,
): QueueLedgerRead<T> => {
  if (!snapshot.ok) {
    return {
      ok: false,
      reason: reasonFor(snapshot.error.code),
      code: snapshot.error.code,
    };
  }
  const records: T[] = [];
  const sequences: number[] = [];
  for (const ledgerRecord of snapshot.value.records) {
    if (!ledgerRecord.key.startsWith(spec.prefix)) continue;
    if (ledgerRecord.kind !== spec.kind) {
      return { ok: false, reason: "torn", code: "state.store.torn" };
    }
    const payload = ledgerRecord.payload;
    if (!isPlainRecord(payload)) {
      return { ok: false, reason: "torn", code: "state.store.torn" };
    }
    if (payload.schema !== spec.schema) {
      return { ok: false, reason: "incompatible", code: "state.schema.mismatch" };
    }
    if (!spec.isRecord(payload)) {
      return { ok: false, reason: "torn", code: "state.store.torn" };
    }
    records.push(payload);
    sequences.push(ledgerRecord.sequence);
  }
  return {
    ok: true,
    records,
    sequences,
    latest: records,
    verifiedEmpty: records.length === 0,
    evidence: snapshot.value.evidence,
  };
};

const readRecords = <T>(
  store: StateStorePort,
  spec: RecordSpec<T>,
  view?: readonly StateRecord[],
): QueueLedgerRead<T> => classifyRecords(verifiedSnapshot(store, view), spec);

/** Read every verified queue dependency record, oldest first (latest folded). */
export const readQueueDependencies = (
  store: StateStorePort,
): QueueLedgerRead<QueueDependencyRecord> => {
  const read = readRecords(store, {
    prefix: QUEUE_DEPENDENCY_KEY_PREFIX,
    kind: QUEUE_DEPENDENCY_RECORD_KIND,
    schema: QUEUE_DEPENDENCY_SCHEMA,
    isRecord: isDependencyRecord,
  });
  if (!read.ok) return read;
  const latest = [...foldLatestDependencyRecords(read.records).values()].sort((left, right) =>
    left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0,
  );
  return { ...read, latest };
};

/** Read every verified queue lease operation record, oldest first. */
export const readQueueLeases = (store: StateStorePort): QueueLedgerRead<QueueLeaseRecord> =>
  readRecords(store, LEASE_SPEC);

/** Read every verified queue park record, oldest first. */
export const readQueueParks = (store: StateStorePort): QueueLedgerRead<QueueParkRecord> => {
  const read = readRecords(store, {
    prefix: QUEUE_PARK_KEY_PREFIX,
    kind: QUEUE_PARK_RECORD_KIND,
    schema: QUEUE_PARK_SCHEMA,
    isRecord: isParkRecord,
  });
  if (!read.ok) return read;
  // At most one active park exists per entry. Two concurrently active `parked`
  // records are an Appendix D invariant violation and fail closed rather than
  // letting latest-record-wins fabricate a single park.
  if (hasDuplicateActiveParks(read.records)) {
    return { ok: false, reason: "torn", code: "state.store.torn" };
  }
  return read;
};

/** Read every verified queue incident record, oldest first. */
export const readQueueIncidents = (store: StateStorePort): QueueLedgerRead<QueueIncidentRecord> =>
  readRecords(store, {
    prefix: QUEUE_INCIDENT_KEY_PREFIX,
    kind: QUEUE_INCIDENT_RECORD_KIND,
    schema: QUEUE_INCIDENT_SCHEMA,
    isRecord: isIncidentRecord,
  });

/** The verified intent fold consumed by intent mutations and later phases. */
export const readQueueFold = (
  store: StateStorePort,
): { readonly ok: true; readonly value: QueueGraphFold } | QueueIntentFailure => {
  const entriesRead = readQueueEntriesAndRemovals(store);
  if (!entriesRead.ok) {
    return {
      ok: false,
      kind: "state",
      code: entriesRead.code,
      location: { path: store.identity.stateDirectory },
      reason: entriesRead.reason,
    };
  }
  const entries = entriesRead.entries;
  const dependencies = readQueueDependencies(store);
  if (!dependencies.ok) {
    return {
      ok: false,
      kind: "state",
      code: dependencies.code,
      location: { path: store.identity.stateDirectory },
      reason: dependencies.reason,
    };
  }
  return ok(
    foldQueueGraph(
      entries.records,
      dependencies.records,
      presenceFacts(entries, entriesRead.removals),
    ),
  );
};

const entryOf = (fold: QueueGraphFold, ref: string): QueueEntryRecord | undefined =>
  fold.entryRecords.find((entry) => entry.ref === ref);

const edgesOf = (fold: QueueGraphFold, ref: string): readonly string[] =>
  fold.entries.find((entry) => entry.ref === ref)?.edges ?? [];

const cycleFailure = (path: readonly string[]): QueueIntentFailure => ({
  ok: false,
  kind: "queue",
  code: "queue.dependency-cycle",
  path,
});

const cycleFor = (
  fold: QueueGraphFold,
  consumer: string,
  producers: readonly string[],
): readonly string[] | undefined => {
  for (const producer of producers) {
    const path = detectCycleForEdge(fold.edges, consumer, producer);
    if (path !== undefined) return path;
  }
  return undefined;
};

const intentOutcome = (
  result: "added" | "updated" | "noop",
  record: QueueEntryRecord,
  edges: readonly string[],
  fold: QueueGraphFold,
): QueueIntentResult =>
  ok({
    result,
    entry: record,
    edges,
    fold,
    graph: queueGraphDocument(fold),
  });

type DesiredEntry = {
  readonly record: QueueEntryRecord;
  readonly edges: readonly string[];
  readonly existed: boolean;
  readonly entryChanged: boolean;
  readonly edgesChanged: boolean;
};

type DesiredEntryResult = { readonly ok: true; readonly value: DesiredEntry } | QueueIntentFailure;

const desiredEntry = (
  fold: QueueGraphFold,
  request: {
    readonly ref: string;
    readonly repository?: string;
    readonly repositoryRoot?: string;
    readonly priority?: number;
    readonly addEdges?: readonly string[];
    readonly recordedAt: string;
  },
): DesiredEntryResult => {
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `ref ${request.ref} is not a canonical work-item ref`,
    };
  }
  const current = entryOf(fold, ref);
  const repository = request.repository ?? current?.repository;
  const repositoryRoot = request.repositoryRoot ?? current?.repositoryRoot;
  if ((repository === undefined) !== (repositoryRoot === undefined)) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "repository key and recorded root must be present together",
    };
  }
  const priority = request.priority ?? current?.priority ?? QUEUE_DEFAULT_PRIORITY;
  if (!Number.isInteger(priority) || priority < 0) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "priority must be a non-negative integer",
    };
  }
  const added = (request.addEdges ?? []).map((edge) => {
    const canonical = canonicalQueueRef(edge);
    return canonical ?? edge;
  });
  const mergedRaw = new Set([...edgesOf(fold, ref), ...added]);
  if (mergedRaw.size > QUEUE_MAX_EDGES_PER_ENTRY) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `an entry may declare at most ${QUEUE_MAX_EDGES_PER_ENTRY} edges`,
    };
  }
  const edges = mergeEdges([...mergedRaw], []);
  const record: QueueEntryRecord = {
    schema: QUEUE_ENTRY_SCHEMA,
    ref,
    ...(repository === undefined ? {} : { repository }),
    ...(repositoryRoot === undefined ? {} : { repositoryRoot }),
    priority,
    recordedAt: request.recordedAt,
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  };
  const entryChanged =
    current === undefined ||
    current.repository !== record.repository ||
    current.repositoryRoot !== record.repositoryRoot ||
    current.priority !== record.priority;
  const currentEdges = edgesOf(fold, ref);
  const edgesChanged =
    edges.length !== currentEdges.length || edges.some((edge) => !currentEdges.includes(edge));
  return {
    ok: true,
    value: { record, edges, existed: current !== undefined, entryChanged, edgesChanged },
  };
};

const verifyAppends = (
  store: StateStorePort,
  before: readonly { readonly sequence: number }[],
  appended: readonly { readonly sequence: number }[],
  expected: readonly { readonly kind: string; readonly recordKey: string }[],
): QueueIntentFailure | undefined => {
  const after = store.readRecords();
  if (!after.ok) return stateFailureOf(after.error);
  if (after.value.records.length !== before.length + appended.length) {
    return {
      ok: false,
      kind: "state",
      code: "state.store.torn",
      location: { path: after.value.evidence.storePath },
      reason: "torn",
    };
  }
  for (const [index, outcome] of appended.entries()) {
    const spec = expected[index];
    if (spec === undefined) continue;
    const landed = after.value.records.some(
      (record) =>
        record.sequence === outcome.sequence &&
        record.kind === spec.kind &&
        record.key === spec.recordKey,
    );
    if (!landed) {
      return {
        ok: false,
        kind: "state",
        code: "state.store.torn",
        location: { path: after.value.evidence.storePath, record: outcome.sequence },
        reason: "torn",
      };
    }
  }
  return undefined;
};

const withIntentFence = <T>(
  store: StateStorePort,
  fenceToken: string,
  body: (handle: StateFenceHandle) => { readonly ok: true; readonly value: T } | QueueIntentFailure,
): { readonly ok: true; readonly value: T } | QueueIntentFailure => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return stateFailureOf(acquired.error);
  try {
    return body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const mutateIntent = (
  store: StateStorePort,
  request: {
    readonly fenceToken: string;
    readonly ref: string;
    readonly repository?: string;
    readonly repositoryRoot?: string;
    readonly priority?: number;
    readonly addEdges?: readonly string[];
    readonly recordedAt: string;
  },
): QueueIntentResult => {
  const pre = readQueueFold(store);
  if (!pre.ok) return pre;
  const desiredPre = desiredEntry(pre.value, request);
  if (!desiredPre.ok) return desiredPre;
  const desired = desiredPre.value;
  const ref = desired.record.ref;
  if (desired.edgesChanged) {
    const cycle = cycleFor(pre.value, ref, desired.edges);
    if (cycle !== undefined) return cycleFailure(cycle);
  }
  if (!desired.entryChanged && !desired.edgesChanged) {
    return intentOutcome("noop", desired.record, desired.edges, pre.value);
  }
  return withIntentFence(store, request.fenceToken, (handle) => {
    const inside = readQueueFold(store);
    if (!inside.ok) return inside;
    const desiredInsidePre = desiredEntry(inside.value, request);
    if (!desiredInsidePre.ok) return desiredInsidePre;
    const desiredInside = desiredInsidePre.value;
    if (desiredInside.edgesChanged) {
      const cycle = cycleFor(inside.value, ref, desiredInside.edges);
      if (cycle !== undefined) return cycleFailure(cycle);
    }
    if (!desiredInside.entryChanged && !desiredInside.edgesChanged) {
      return intentOutcome("noop", desiredInside.record, desiredInside.edges, inside.value);
    }
    const before = store.readRecords();
    if (!before.ok) return stateFailureOf(before.error);
    const appends: StateAppendRequest[] = [];
    if (desiredInside.entryChanged) {
      appends.push({
        kind: QUEUE_ENTRY_RECORD_KIND,
        recordKey: queueEntryRecordKey(ref),
        payload: desiredInside.record as unknown as StateJsonValue,
      });
    }
    if (desiredInside.edgesChanged) {
      appends.push({
        kind: QUEUE_DEPENDENCY_RECORD_KIND,
        recordKey: queueDependencyRecordKey(ref),
        payload: {
          schema: QUEUE_DEPENDENCY_SCHEMA,
          ref,
          edges: desiredInside.edges,
          recordedAt: request.recordedAt,
          callerPrincipal: LOCAL_CALLER_PRINCIPAL,
        } satisfies QueueDependencyRecord as unknown as StateJsonValue,
      });
    }
    const appended: { readonly sequence: number }[] = [];
    for (const append of appends) {
      const outcome = store.append(handle, append);
      if (!outcome.ok) return stateFailureOf(outcome.error);
      appended.push(outcome.value);
    }
    const verification = verifyAppends(
      store,
      before.value.records,
      appended,
      appends.map((append) => ({ kind: append.kind, recordKey: append.recordKey })),
    );
    if (verification !== undefined) return verification;
    const final = readQueueFold(store);
    if (!final.ok) return final;
    const document = queueGraphDocument(final.value);
    const replaced = store.replaceDocument(handle, {
      name: QUEUE_GRAPH_DOCUMENT_NAME,
      content: document as unknown as StateJsonValue,
    });
    if (!replaced.ok) return stateFailureOf(replaced.error);
    return intentOutcome(
      desiredInside.existed ? "updated" : "added",
      desiredInside.record,
      desiredInside.edges,
      final.value,
    );
  });
};

/** Declare or supersede one queue entry, merging any supplied edges. */
export const declareQueueEntry = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly repository?: string;
    readonly repositoryRoot?: string;
    readonly priority?: number;
    readonly edges?: readonly string[];
    readonly recordedAt: string;
    readonly fenceToken: string;
  },
): QueueIntentResult =>
  mutateIntent(store, {
    fenceToken: request.fenceToken,
    ref: request.ref,
    ...(request.repository === undefined ? {} : { repository: request.repository }),
    ...(request.repositoryRoot === undefined ? {} : { repositoryRoot: request.repositoryRoot }),
    ...(request.priority === undefined ? {} : { priority: request.priority }),
    ...(request.edges === undefined ? {} : { addEdges: request.edges }),
    recordedAt: request.recordedAt,
  });

/** Set one entry's priority, latest-wins, with no schema bump. */
export const prioritizeQueueEntry = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly priority: number;
    readonly recordedAt: string;
    readonly fenceToken: string;
  },
): QueueIntentResult => {
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined || entryOf(fold.value, ref) === undefined) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.entry.unobserved",
      ref: request.ref,
    };
  }
  return mutateIntent(store, {
    fenceToken: request.fenceToken,
    ref,
    priority: request.priority,
    recordedAt: request.recordedAt,
  });
};

/** Add one consumer-to-producer edge, refusing a cycle before any append. */
export const addQueueDependency = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly onRef: string;
    readonly recordedAt: string;
    readonly fenceToken: string;
  },
): QueueIntentResult => {
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const ref = canonicalQueueRef(request.ref);
  const onRef = canonicalQueueRef(request.onRef);
  if (ref === undefined || onRef === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "both the consumer and producer must be canonical work-item refs",
    };
  }
  if (entryOf(fold.value, ref) === undefined) {
    return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
  }
  return mutateIntent(store, {
    fenceToken: request.fenceToken,
    ref,
    addEdges: [onRef],
    recordedAt: request.recordedAt,
  });
};

/** The normalized edge set used when a record is serialized (exported for tests). */
export const normalizedQueueEdges = normalizeEdges;

/* ------------------ dispatch-family admission (GH-292 F-4) ----------------- */

/** One per-ref admission refusal naming the live lease (TDR-0026 DC-2). */
export type DispatchAdmissionRefusal = {
  readonly code: "queue.single-flight" | "queue.lease-conflict";
  readonly holder?: string;
  readonly summary?: string;
};

/**
 * The dispatch family's ONE admission predicate over live per-ref lease truth
 * (GH-292 F-4, TDR-0026 DC-2; AC-F4-1/AC-F4-5). The dispatch path claims with
 * the fixed holder `dispatch` and never renews mid-flight, so a live lease
 * whose recorded ref equals the requested ref — same or different holder — is
 * a dispatch already running, and the second dispatch is by definition a
 * duplicate: it refuses `queue.single-flight` naming the live holder before
 * any claim, spawn, resume, attempt, or record. A live lease on any other ref
 * refuses the delivered `queue.lease-conflict` (repository exclusivity stated
 * as a refusal). A lease at or over its TTL is not active, and no live lease
 * proceeds: both keep the delivered takeover/claim behaviour.
 *
 * One whole-store read: the entry and lease ledgers are classified from the
 * same verified snapshot. An unreadable or torn ledger is NOT a queue refusal —
 * the predicate abstains and the claim path classifies the state failure with
 * the delivered `state.*` identity.
 */
export const dispatchAdmissionRefusal = (
  store: StateStorePort,
  input: { readonly ref: string; readonly nowMs: number },
): DispatchAdmissionRefusal | undefined => {
  const snapshot = verifiedSnapshot(store);
  const entries = classifyRecords(snapshot, ENTRY_SPEC);
  if (!entries.ok) return undefined;
  const leases = classifyRecords(snapshot, LEASE_SPEC);
  if (!leases.ok) return undefined;
  const ref = canonicalQueueRef(input.ref);
  if (ref === undefined) return undefined;
  const active = foldActiveLeases(leases.records, input.nowMs);
  if (active === undefined) return undefined;
  const latestEntry = [...entries.records]
    .reverse()
    .find((record) => canonicalQueueRef(record.ref) === ref);
  const repository = latestEntry?.repository;
  if (repository === undefined) return undefined;
  const held = active.find((lease) => lease.repository === repository);
  if (held === undefined) return undefined;
  // A lease at or over its TTL is not active on any path: the delivered
  // stale-takeover applies, so the guard abstains.
  if (isLeaseStale(held.heartbeatAgeMs, held.ttlMs)) return undefined;
  if (held.ref === ref) {
    return {
      code: "queue.single-flight",
      holder: held.holder,
      summary: `holder:${held.holder}; ref:${held.ref}`,
    };
  }
  const conflict = leaseConflict(held);
  return {
    code: "queue.lease-conflict",
    summary: `holder:${conflict.holder}; lease:${conflict.leaseId}; heartbeatAgeMs:${conflict.heartbeatAgeMs}; earliestTakeoverAt:${conflict.earliestTakeoverAt}`,
  };
};

/**
 * The claim path's holder-aware admission (GH-292 F-4, TDR-0026 DC-2/DC-3;
 * AC-F4-2). Refuses ONLY another holder's live lease on the requested ref with
 * `queue.single-flight` naming the live holder. The caller's own holder's
 * same-ref lease falls through to the delivered renewal, any other-ref live
 * lease falls through to the delivered `queue.lease-conflict`, and a lease at
 * or over its TTL is not active, so the delivered stale takeover stands. One
 * whole-store read; an unreadable or torn ledger abstains and the claim path
 * classifies the state failure with the delivered `state.*` identity.
 */
export const claimSingleFlightRefusal = (
  store: StateStorePort,
  input: { readonly ref: string; readonly holder: string; readonly nowMs: number },
): DispatchAdmissionRefusal | undefined => {
  const snapshot = verifiedSnapshot(store);
  const entries = classifyRecords(snapshot, ENTRY_SPEC);
  if (!entries.ok) return undefined;
  const leases = classifyRecords(snapshot, LEASE_SPEC);
  if (!leases.ok) return undefined;
  const ref = canonicalQueueRef(input.ref);
  if (ref === undefined) return undefined;
  const active = foldActiveLeases(leases.records, input.nowMs);
  if (active === undefined) return undefined;
  const latestEntry = [...entries.records]
    .reverse()
    .find((record) => canonicalQueueRef(record.ref) === ref);
  const repository = latestEntry?.repository;
  if (repository === undefined) return undefined;
  const held = active.find((lease) => lease.repository === repository);
  if (held === undefined || held.ref !== ref || held.holder === input.holder) return undefined;
  // The liveness predicate is shared: a stale lease takes over as delivered.
  if (isLeaseStale(held.heartbeatAgeMs, held.ttlMs)) return undefined;
  return {
    code: "queue.single-flight",
    holder: held.holder,
    summary: `holder:${held.holder}; ref:${held.ref}`,
  };
};

/* --------------------------- removal (GH-292 F-1) ------------------------- */

/** One landed removal: the durable record, the withdrawn park when one existed. */
export type QueueRemovalOutcome = {
  readonly result: QueueRemovalResult;
  readonly ref: string;
  readonly reason: QueueRemovalReason;
  readonly removal: QueueRemovalRecord;
  readonly parkWithdrawn?: QueueParkRecord;
  readonly fold: QueueGraphFold;
  readonly graph: QueueGraphDocument;
};

export type QueueRemovalMutationResult =
  | { readonly ok: true; readonly value: QueueRemovalOutcome }
  | QueueLeaseFailure;

const removalPayload = (record: QueueRemovalRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const sameDocument = (left: QueueGraphDocument, right: QueueGraphDocument): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Remove one queue entry with a recorded reason (GH-292 F-1, DM-1..DM-4).
 *
 * The refusal set is exact and pre-append: a missing reason is
 * `queue.reason-missing`, a reason outside the closed vocabulary or a
 * non-canonical ref is `input.value.rejected`, an unobserved (or already
 * removed) ref is `queue.entry.unobserved`, and a live lease on the entry's
 * repository is the delivered `queue.precondition.unmet` with blocking reason
 * `lease-held` naming the holder — nothing is appended and no lease is
 * released. A lease at or over its TTL is not live (the delivered TTL
 * predicate, spec §5.1 F-1) and does not refuse. An accepted removal appends
 * the delivered park-withdrawal record
 * (`recoveryState: "released"`) first when an active park exists, then the
 * removal record, both inside one fenced transaction and verified
 * post-append; the derived document is replaced only when the folded intent
 * truth changed. Presence follows append position (DM-2), so re-declaring the
 * ref later restores the entry with no record deleted, rewritten, or re-keyed.
 */
export const removeQueueEntry = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly reason?: QueueRemovalReason;
    readonly recordedAt: string;
    readonly nowMs: number;
    readonly fenceToken: string;
  },
): QueueRemovalMutationResult => {
  if (request.reason === undefined) {
    return { ok: false, kind: "queue", code: "queue.reason-missing", ref: request.ref };
  }
  if (!(QUEUE_REMOVAL_REASONS as readonly string[]).includes(request.reason)) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `reason ${request.reason} is outside the declared removal vocabulary`,
    };
  }
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `ref ${request.ref} is not a canonical work-item ref`,
    };
  }
  return withRemovalFence(store, request.fenceToken, (handle) =>
    removeQueueEntryWithinFence(store, {
      ref,
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      recordedAt: request.recordedAt,
      nowMs: request.nowMs,
      handle,
    }),
  );
};

/**
 * The removal body executed inside a caller-held fence handle: the closeout
 * hook shares the closeout transaction's fence through this seam (GH-292 F-2,
 * NFR-3), so no second acquisition exists. The refusal set and the append
 * order are exactly `removeQueueEntry`'s.
 */
export const removeQueueEntryWithinFence = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly reason?: QueueRemovalReason;
    readonly recordedAt: string;
    readonly nowMs: number;
    readonly handle: StateFenceHandle;
  },
): QueueRemovalMutationResult => {
  const reason = request.reason;
  if (reason === undefined) {
    return { ok: false, kind: "queue", code: "queue.reason-missing", ref: request.ref };
  }
  if (!(QUEUE_REMOVAL_REASONS as readonly string[]).includes(reason)) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `reason ${reason} is outside the declared removal vocabulary`,
    };
  }
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `ref ${request.ref} is not a canonical work-item ref`,
    };
  }
  const pre = readQueueFold(store);
  if (!pre.ok) return pre;
  const entry = entryOf(pre.value, ref);
  if (entry === undefined) {
    return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
  }
  const repository = entry.repository;
  return (() => {
    const handle = request.handle;
    const inside = readQueueFold(store);
    if (!inside.ok) return inside;
    if (entryOf(inside.value, ref) === undefined) {
      return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
    }
    if (repository !== undefined) {
      const activeRead = readActiveLeases(store, request.nowMs);
      if (!activeRead.ok) {
        return stateFailureOf({
          ...activeRead,
          kind: "state",
          consequence: "not_landed",
          location: { path: store.identity.stateDirectory },
        });
      }
      const held = activeRead.active.find((lease) => lease.repository === repository);
      if (held !== undefined && !isLeaseStale(held.heartbeatAgeMs, held.ttlMs)) {
        return {
          ok: false,
          kind: "queue",
          code: "queue.precondition.unmet",
          reason: "lease-held",
          detail: `holder:${held.holder}; lease:${held.leaseId}`,
        };
      }
    }
    const parkRead = readQueueParks(store);
    if (!parkRead.ok) {
      return stateFailureOf({
        ...parkRead,
        kind: "state",
        consequence: "not_landed",
        location: { path: store.identity.stateDirectory },
      });
    }
    const activePark = latestParkRecords(parkRead.records).find(
      (park) => park.ref === ref && park.recoveryState === "parked",
    );
    const removal: QueueRemovalRecord = {
      schema: QUEUE_REMOVAL_SCHEMA,
      ref,
      reason,
      recordedAt: request.recordedAt,
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    };
    const appends: StateAppendRequest[] = [];
    let parkWithdrawn: QueueParkRecord | undefined;
    if (activePark !== undefined) {
      parkWithdrawn = releasedParkRecord(activePark, { nowIso: request.recordedAt });
      appends.push({
        kind: QUEUE_PARK_RECORD_KIND,
        recordKey: queueParkRecordKey(ref),
        payload: parkWithdrawn as unknown as StateJsonValue,
      });
    }
    appends.push({
      kind: QUEUE_REMOVAL_RECORD_KIND,
      recordKey: queueRemovalRecordKey(ref),
      payload: removalPayload(removal),
    });
    const before = store.readRecords();
    if (!before.ok) return stateFailureOf(before.error);
    const appended: { readonly sequence: number }[] = [];
    for (const append of appends) {
      const outcome = store.append(handle, append);
      if (!outcome.ok) return stateFailureOf(outcome.error);
      appended.push(outcome.value);
    }
    const verification = verifyAppends(
      store,
      before.value.records,
      appended,
      appends.map((append) => ({ kind: append.kind, recordKey: append.recordKey })),
    );
    if (verification !== undefined) return verification;
    const final = readQueueFold(store);
    if (!final.ok) return final;
    const document = queueGraphDocument(final.value);
    if (!sameDocument(queueGraphDocument(inside.value), document)) {
      const replaced = store.replaceDocument(handle, {
        name: QUEUE_GRAPH_DOCUMENT_NAME,
        content: document as unknown as StateJsonValue,
      });
      if (!replaced.ok) return stateFailureOf(replaced.error);
    }
    return ok({
      result: "removed",
      ref,
      reason,
      removal,
      ...(parkWithdrawn === undefined ? {} : { parkWithdrawn }),
      fold: final.value,
      graph: document,
    });
  })();
};

/* ------------------- closeout landed removal (GH-292 F-2, DM-6) ------------ */

/**
 * The closeout queue-removal hook (F-2, DM-6): one total function over the
 * merge truth and the queue ledgers that never throws and never changes a step
 * outcome. Plan mode reads and reports `would-remove`; apply mode runs the
 * removal inside the caller's fence handle (the closeout transaction's own
 * fence — no second acquisition). `satisfied` covers a re-run over an
 * already-removed ref and a ref that never entered; `skipped` carries the
 * closed reason and appends nothing. Cost: at most one fold, at most two
 * appends, and at most one lease read (NFR-3).
 */
export const queueRemovalForCloseout = (
  store: StateStorePort,
  input: {
    readonly mode: "plan" | "apply";
    readonly workItemRef: string;
    readonly mergedObserved: boolean;
    readonly recordedAt: string;
    readonly nowMs: number;
    readonly handle?: StateFenceHandle;
  },
): CloseoutQueueRemovalData => {
  const ref = canonicalQueueRef(input.workItemRef);
  if (ref === undefined) return { outcome: "skipped", skipReason: "ref-not-canonical" };
  if (!input.mergedObserved) {
    return { outcome: "skipped", skipReason: "no-merge-truth", ref };
  }
  const fold = readQueueFold(store);
  if (!fold.ok) return { outcome: "skipped", skipReason: "state-unavailable", ref };
  const entry = entryOf(fold.value, ref);
  if (entry === undefined) return { outcome: "satisfied", ref };
  if (entry.repository !== undefined) {
    const leases = readActiveLeases(store, input.nowMs);
    if (!leases.ok) return { outcome: "skipped", skipReason: "state-unavailable", ref };
    const held = leases.active.find((lease) => lease.repository === entry.repository);
    // A lease at or over its TTL is not live: the closeout removal proceeds
    // instead of reporting `lease-held` (spec §5.1 F-1, RSK-2).
    if (held !== undefined && !isLeaseStale(held.heartbeatAgeMs, held.ttlMs)) {
      return { outcome: "skipped", skipReason: "lease-held", ref };
    }
  }
  if (input.mode === "plan") return { outcome: "would-remove", ref, reason: "landed" };
  if (input.handle === undefined) {
    return { outcome: "skipped", skipReason: "state-unavailable", ref };
  }
  const removal = removeQueueEntryWithinFence(store, {
    ref,
    reason: "landed",
    recordedAt: input.recordedAt,
    nowMs: input.nowMs,
    handle: input.handle,
  });
  if (!removal.ok) {
    if (removal.kind === "queue" && removal.code === "queue.precondition.unmet") {
      return { outcome: "skipped", skipReason: "lease-held", ref };
    }
    return { outcome: "skipped", skipReason: "state-unavailable", ref };
  }
  return { outcome: "removed", ref, reason: "landed" };
};

/* ------------------- dependency-edge removal (GH-292 F-3) ------------------ */

/** One dependency-edge edit outcome: the removed (or absent) edge. */
export type QueueDependencyRemovalOutcome = {
  readonly result: "removed" | "noop";
  readonly ref: string;
  readonly entry: QueueEntryRecord;
  readonly edges: readonly string[];
  readonly removedEdge?: string;
  readonly fold: QueueGraphFold;
  readonly graph: QueueGraphDocument;
};

export type QueueDependencyRemovalResult =
  | { readonly ok: true; readonly value: QueueDependencyRemovalOutcome }
  | QueueIntentFailure;

/**
 * Remove exactly one consumer-to-producer edge (GH-292 F-3). Removing an edge
 * that is not declared is a `noop` with zero appends and zero events; removing
 * a declared edge appends one dependency record carrying the resulting folded
 * edge set, runs no cycle check (removal cannot close a cycle), and replaces
 * the derived document when the folded truth changed. The producer may be
 * unobserved; a consumer with no entry is `queue.entry.unobserved`.
 */
export const removeQueueDependency = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly onRef: string;
    readonly recordedAt: string;
    readonly fenceToken: string;
  },
): QueueDependencyRemovalResult => {
  const ref = canonicalQueueRef(request.ref);
  const onRef = canonicalQueueRef(request.onRef);
  if (ref === undefined || onRef === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "both the consumer and producer must be canonical work-item refs",
    };
  }
  const noopOutcome = (fold: QueueGraphFold): QueueDependencyRemovalResult => {
    const entry = entryOf(fold, ref);
    if (entry === undefined) {
      return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
    }
    return ok({
      result: "noop",
      ref,
      entry,
      edges: edgesOf(fold, ref),
      fold,
      graph: queueGraphDocument(fold),
    });
  };
  const pre = readQueueFold(store);
  if (!pre.ok) return pre;
  if (entryOf(pre.value, ref) === undefined) {
    return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
  }
  if (!edgesOf(pre.value, ref).includes(onRef)) return noopOutcome(pre.value);
  return withIntentFence(store, request.fenceToken, (handle) => {
    const inside = readQueueFold(store);
    if (!inside.ok) return inside;
    const entry = entryOf(inside.value, ref);
    if (entry === undefined) {
      return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
    }
    const current = edgesOf(inside.value, ref);
    if (!current.includes(onRef)) return noopOutcome(inside.value);
    const edges = current.filter((edge) => edge !== onRef);
    const record: QueueDependencyRecord = {
      schema: QUEUE_DEPENDENCY_SCHEMA,
      ref,
      edges,
      recordedAt: request.recordedAt,
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    };
    const before = store.readRecords();
    if (!before.ok) return stateFailureOf(before.error);
    const append: StateAppendRequest = {
      kind: QUEUE_DEPENDENCY_RECORD_KIND,
      recordKey: queueDependencyRecordKey(ref),
      payload: record as unknown as StateJsonValue,
    };
    const outcome = store.append(handle, append);
    if (!outcome.ok) return stateFailureOf(outcome.error);
    const verification = verifyAppends(
      store,
      before.value.records,
      [outcome.value],
      [{ kind: append.kind, recordKey: append.recordKey }],
    );
    if (verification !== undefined) return verification;
    const final = readQueueFold(store);
    if (!final.ok) return final;
    const document = queueGraphDocument(final.value);
    if (!sameDocument(queueGraphDocument(inside.value), document)) {
      const replaced = store.replaceDocument(handle, {
        name: QUEUE_GRAPH_DOCUMENT_NAME,
        content: document as unknown as StateJsonValue,
      });
      if (!replaced.ok) return stateFailureOf(replaced.error);
    }
    return ok({
      result: "removed",
      ref,
      entry,
      edges,
      removedEdge: onRef,
      fold: final.value,
      graph: document,
    });
  });
};

/* ----------------------- reconcile (GH-292 F-5, DM-5) --------------------- */

/** One reconcile sweep outcome: the bounded lists and the removal truth. */
export type QueueReconcileOutcome = {
  readonly result: QueueReconcileResult;
  readonly checked: number;
  readonly removed: readonly QueueReconcileRemoved[];
  readonly retained: readonly QueueReconcileRetained[];
  readonly unobserved: readonly string[];
  readonly removedRefs: readonly string[];
  readonly truncated: boolean;
  readonly remainder: number;
};

export type QueueReconcileMutationResult =
  | { readonly ok: true; readonly value: QueueReconcileOutcome }
  | { readonly ok: false; readonly kind: "provider"; readonly code: string }
  | QueueLeaseFailure;

/**
 * Sweep the invoking checkout's queue against tracker delivery state
 * (GH-292 F-5, DM-1, DM-5). Exactly one bounded tracker read happens per
 * examined entry — no retry, no pagination, no concurrency — and the sweep
 * stops at the first unreadable read: nothing is appended on that path and the
 * failure surfaces the provider's own identity (never a `queue.*` code). A
 * `done` or `canceled` observation removes the entry through the F-1 removal
 * seam with reason `reconciled` (one append, one event, park withdrawal, no
 * cascade); every other observed state is retained and reported with its
 * observed state; a not-found item is retained and reported `unobserved` —
 * absence is not evidence that work landed (DEC-11). At most 100 entries are
 * examined (`truncated` plus an exact `remainder` beyond the cap), and no
 * entry beyond the cap is read. Every examined entry is read before the first
 * removal, so an unreadable read always leaves a ledger with zero appended
 * records and zero removals — there is no partial-success path (AC-F5-4). A
 * repeat run converges truthfully: `checked` counts only entries that still
 * exist, so an already-removed ref appears in no list (AC-F5-9).
 */
export const reconcileQueueEntries = async (
  store: StateStorePort,
  input: {
    readonly ref?: string;
    readonly readTracker: (ref: string) => Promise<QueueTrackerRead>;
    readonly recordedAt: string;
    readonly nowMs: number;
    readonly fenceToken: () => string;
  },
): Promise<QueueReconcileMutationResult> => {
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const existing = [...fold.value.entries]
    .map((entry) => entry.ref)
    .sort((left, right) => compareText(left, right));
  if (input.ref !== undefined) {
    const ref = canonicalQueueRef(input.ref);
    if (ref === undefined) {
      return {
        ok: false,
        kind: "input",
        code: "input.value.rejected",
        detail: `ref ${input.ref} is not a canonical work-item ref`,
      };
    }
    // A `--ref` naming a ref with no entry examines nothing and reports the
    // truthful noop (AC-F5-9's narrow-scope form).
    if (!existing.includes(ref)) {
      return ok({
        result: "noop",
        checked: 0,
        removed: [],
        retained: [],
        unobserved: [],
        removedRefs: [],
        truncated: false,
        remainder: 0,
      });
    }
    return reconcileSweep(store, {
      refs: [ref],
      total: 1,
      readTracker: input.readTracker,
      recordedAt: input.recordedAt,
      nowMs: input.nowMs,
      fenceToken: input.fenceToken,
    });
  }
  const examined = existing.slice(0, QUEUE_RECONCILE_MAX_ENTRIES);
  const remainder = existing.length - examined.length;
  return reconcileSweep(store, {
    refs: examined,
    total: existing.length,
    readTracker: input.readTracker,
    recordedAt: input.recordedAt,
    nowMs: input.nowMs,
    fenceToken: input.fenceToken,
    remainder,
  });
};

/**
 * The bounded sweep body: one read per examined entry, sequential, fail-closed.
 * The read pass completes for every examined entry before the first removal, so
 * an unreadable read always finds a ledger with zero appended records (F-5:
 * readable truth for every examined entry, or the run changes nothing).
 */
const reconcileSweep = async (
  store: StateStorePort,
  input: {
    readonly refs: readonly string[];
    readonly total: number;
    readonly readTracker: (ref: string) => Promise<QueueTrackerRead>;
    readonly recordedAt: string;
    readonly nowMs: number;
    readonly fenceToken: () => string;
    readonly remainder?: number;
  },
): Promise<QueueReconcileMutationResult> => {
  // Read pass: exactly one bounded read per examined entry, in canonical order,
  // no retry and no read past the failure. The provider identity surfaces
  // as-is with nothing appended (AC-F5-4, NFR-4).
  const observed = new Map<string, Extract<QueueTrackerRead, { ok: true }>>();
  for (const ref of input.refs) {
    const read = await input.readTracker(ref);
    if (!read.ok) {
      return { ok: false, kind: "provider", code: read.failureCode };
    }
    observed.set(ref, read);
  }
  // Removal pass: every stale observation goes through the ordinary F-1
  // removal seam, so the delivered refusal set applies as-is.
  const removed: QueueReconcileRemoved[] = [];
  const removedRefs: string[] = [];
  const retained: QueueReconcileRetained[] = [];
  const unobserved: string[] = [];
  for (const ref of input.refs) {
    const read = observed.get(ref);
    if (read === undefined) continue;
    if (read.kind === "not-found") {
      unobserved.push(ref);
      continue;
    }
    if (!(QUEUE_RECONCILE_STALE_STATES as readonly string[]).includes(read.deliveryState)) {
      retained.push({ ref, deliveryState: read.deliveryState });
      continue;
    }
    const removal = removeQueueEntry(store, {
      ref,
      reason: "reconciled",
      recordedAt: input.recordedAt,
      nowMs: input.nowMs,
      fenceToken: input.fenceToken(),
    });
    if (!removal.ok) return removal;
    removed.push({ ref, reason: "reconciled" });
    removedRefs.push(ref);
  }
  return ok({
    result: removed.length > 0 ? "removed" : "noop",
    checked: input.refs.length,
    removed,
    retained,
    unobserved,
    removedRefs,
    truncated: (input.remainder ?? 0) > 0,
    remainder: input.remainder ?? 0,
  });
};

/* ------------------------------ lease ledger ------------------------------ */

/** One verified active-lease read: the folded live holders plus the raw history. */
export type QueueActiveLeaseRead =
  | {
      readonly ok: true;
      readonly records: readonly QueueLeaseRecord[];
      readonly active: readonly QueueActiveLease[];
      readonly evidence: StateReadEvidence;
    }
  | {
      readonly ok: false;
      readonly reason: QueueReadReason;
      readonly code: StateFailureCode;
    };

/** Read the verified lease history and fold it to at most one holder per repo. */
export const readActiveLeases = (store: StateStorePort, nowMs: number): QueueActiveLeaseRead => {
  const read = readQueueLeases(store);
  if (!read.ok) return read;
  const active = foldActiveLeases(read.records, nowMs);
  if (active === undefined) {
    return { ok: false, reason: "torn", code: "state.store.torn" };
  }
  return { ok: true, records: read.records, active, evidence: read.evidence };
};

/** One lease outcome: the landed record plus an optional takeover incident. */
export type QueueClaimOutcome = {
  readonly result: "claimed" | "renewed" | "taken-over";
  readonly lease: QueueLeaseRecord;
  readonly incident?: QueueIncidentRecord;
};

/** One release outcome: the landed record, or noop with no lease held. */
export type QueueReleaseOutcome = {
  readonly result: "released" | "parked" | "noop";
  readonly lease?: QueueLeaseRecord;
  readonly park?: QueueParkRecord;
};

/** A lease refusal cannot be a dependency cycle; it reuses the intent refusals. */
export type QueueLeaseFailure =
  | QueueIntentFailure
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.lease-conflict";
      readonly conflict: QueueLeaseConflict;
      readonly detail: string;
    }
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.precondition.unmet";
      readonly reason: string;
      readonly detail?: string;
    }
  | {
      readonly ok: false;
      readonly kind: "queue";
      readonly code: "queue.park-condition-stuck";
      readonly detail?: string;
    };

export type QueueClaimResult =
  | { readonly ok: true; readonly value: QueueClaimOutcome }
  | QueueLeaseFailure;

export type QueueReleaseResult =
  | { readonly ok: true; readonly value: QueueReleaseOutcome }
  | QueueLeaseFailure;

const entryRepository = (
  fold: QueueGraphFold,
  ref: string,
):
  | { readonly ok: true; readonly repository: string; readonly record: QueueEntryRecord }
  | QueueLeaseFailure => {
  const entry = entryOf(fold, ref);
  if (entry === undefined) {
    return { ok: false, kind: "queue", code: "queue.entry.unobserved", ref };
  }
  if (entry.repository === undefined) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      reason: "not-ready",
      detail: "repository-binding-unresolved",
    };
  }
  return { ok: true, repository: entry.repository, record: entry };
};

const leasePayload = (record: QueueLeaseRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const incidentPayload = (record: QueueIncidentRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const runClaimFence = (
  store: StateStorePort,
  fenceToken: string,
  body: (handle: StateFenceHandle) => QueueClaimResult,
): QueueClaimResult => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return stateFailureOf(acquired.error);
  try {
    return body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** The generic fenced body for the removal-family results (GH-292). */
const withRemovalFence = <T>(
  store: StateStorePort,
  fenceToken: string,
  body: (handle: StateFenceHandle) => { readonly ok: true; readonly value: T } | QueueLeaseFailure,
): { readonly ok: true; readonly value: T } | QueueLeaseFailure => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return stateFailureOf(acquired.error);
  try {
    return body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const runReleaseFence = (
  store: StateStorePort,
  fenceToken: string,
  body: (handle: StateFenceHandle) => QueueReleaseResult,
): QueueReleaseResult => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return stateFailureOf(acquired.error);
  try {
    return body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const appendLeaseRecords = (
  store: StateStorePort,
  handle: StateFenceHandle,
  appends: readonly StateAppendRequest[],
): { readonly ok: true; readonly sequences: readonly number[] } | QueueLeaseFailure => {
  const before = store.readRecords();
  if (!before.ok) return stateFailureOf(before.error);
  const appended: { readonly sequence: number }[] = [];
  for (const append of appends) {
    const outcome = store.append(handle, append);
    if (!outcome.ok) return stateFailureOf(outcome.error);
    appended.push(outcome.value);
  }
  const verification = verifyAppends(
    store,
    before.value.records,
    appended,
    appends.map((append) => ({ kind: append.kind, recordKey: append.recordKey })),
  );
  if (verification !== undefined) return verification;
  return { ok: true, sequences: appended.map((outcome) => outcome.sequence) };
};

const newLeaseRecord = (input: {
  readonly operation: QueueLeaseRecord["operation"];
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: QueueWeightClass;
  readonly ttlMs: number;
  readonly nowIso: string;
  readonly acquiredAt?: string;
  readonly leaseId?: string;
  readonly takeover?: QueueLeaseRecord["takeover"];
}): QueueLeaseRecord => ({
  schema: QUEUE_LEASE_SCHEMA,
  leaseId: input.leaseId ?? makeLeaseId(input.repository, input.holder, input.nowIso),
  scope: claimScope(),
  repository: input.repository,
  holder: input.holder,
  ref: input.ref,
  runner: input.runner,
  weightClass: input.weightClass,
  operation: input.operation,
  acquiredAt: input.acquiredAt ?? input.nowIso,
  heartbeatAt: input.nowIso,
  ttlMs: input.ttlMs,
  recordedAt: input.nowIso,
  ...(input.takeover === undefined ? {} : { takeover: input.takeover }),
});

/**
 * Claim one repository for one holder with the two-stage contract.
 *
 * The caller supplies the pre-fence precondition (parks and the five
 * non-exclusivity readiness conditions); `repo-free` is never part of it. Inside
 * the fence the verified lease history is re-read: a live lease held by another
 * holder refuses `queue.lease-conflict`, a stale lease is taken over with full
 * evidence plus a `lease-stale-takeover` incident, and the caller's own lease
 * is renewed when it already records the requested ref (GH-292 renewal
 * narrowing: one `(repository, ref, holder)` — the recorded ref is never
 * rewritten, so an own-holder claim for a different ref refuses
 * `queue.lease-conflict` like any other holder's). Every append is verified
 * post-append.
 */
export const claimQueueLease = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly holder: string;
    readonly runner: string;
    readonly weightClass: QueueWeightClass;
    readonly ttlMs?: number;
    readonly nowIso: string;
    readonly nowMs: number;
    readonly fenceToken: string;
    /** The injected owner hold; active refuses before the fence is acquired. */
    readonly ownerHold?: OwnerHoldFact;
    readonly precheck?: () => QueueClaimPrecondition;
  },
): QueueClaimResult => {
  if (request.holder.length === 0) {
    return { ok: false, kind: "input", code: "input.value.rejected", detail: "holder is empty" };
  }
  if (request.ownerHold?.active === true) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      reason: "owner-hold",
      detail: ownerHoldDetail(request.ownerHold),
    };
  }
  if (request.precheck !== undefined) {
    const pre = request.precheck();
    if (!pre.ok) {
      if (pre.code === "queue.park-condition-stuck") {
        return {
          ok: false,
          kind: "queue",
          code: pre.code,
          ...(pre.detail === undefined ? {} : { detail: pre.detail }),
        };
      }
      return {
        ok: false,
        kind: "queue",
        code: pre.code,
        reason: pre.reason,
        ...(pre.detail === undefined ? {} : { detail: pre.detail }),
      };
    }
  }
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `ref ${request.ref} is not canonical`,
    };
  }
  const resolved = entryRepository(fold.value, ref);
  if (!resolved.ok) return resolved;
  const repository = resolved.repository;
  const ttlMs = request.ttlMs ?? QUEUE_DEFAULT_LEASE_TTL_MS;
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "ttlMs must be positive",
    };
  }
  return runClaimFence(store, request.fenceToken, (handle) => {
    const activeRead = readActiveLeases(store, request.nowMs);
    if (!activeRead.ok)
      return stateFailureOf({
        ...activeRead,
        kind: "state",
        consequence: "not_landed",
        location: { path: store.identity.stateDirectory },
      });
    const existing = activeRead.active.find((lease) => lease.repository === repository);
    if (existing === undefined) {
      const record = newLeaseRecord({
        operation: "acquired",
        repository,
        holder: request.holder,
        ref,
        runner: request.runner,
        weightClass: request.weightClass,
        ttlMs,
        nowIso: request.nowIso,
      });
      const appended = appendLeaseRecords(store, handle, [
        {
          kind: QUEUE_LEASE_RECORD_KIND,
          recordKey: queueLeaseRecordKey(repository),
          payload: leasePayload(record),
        },
      ]);
      if (!appended.ok) return appended;
      return { ok: true, value: { result: "claimed", lease: record } };
    }
    if (existing.holder === request.holder && existing.ref === ref) {
      const record = newLeaseRecord({
        operation: "renewed",
        repository,
        holder: request.holder,
        ref,
        runner: request.runner,
        weightClass: request.weightClass,
        ttlMs,
        nowIso: request.nowIso,
        acquiredAt: existing.acquiredAt,
        leaseId: existing.leaseId,
      });
      const appended = appendLeaseRecords(store, handle, [
        {
          kind: QUEUE_LEASE_RECORD_KIND,
          recordKey: queueLeaseRecordKey(repository),
          payload: leasePayload(record),
        },
      ]);
      if (!appended.ok) return appended;
      return { ok: true, value: { result: "renewed", lease: record } };
    }
    // GH-292 renewal narrowing (DEC-13, TDR-0026 DC-3): renewal is one
    // (repository, ref, holder). The delivered renewal rewrote the lease's
    // recorded ref to the requested one, which let a second ref slip past
    // repository exclusivity; the recorded ref is never rewritten. The own
    // holder's other-ref claim refuses exactly like any other holder's.
    if (!isLeaseStale(existing.heartbeatAgeMs, existing.ttlMs)) {
      const conflict = leaseConflict(existing);
      return {
        ok: false,
        kind: "queue",
        code: "queue.lease-conflict",
        conflict,
        detail: `holder:${conflict.holder}; lease:${conflict.leaseId}; heartbeatAgeMs:${conflict.heartbeatAgeMs}; earliestTakeoverAt:${conflict.earliestTakeoverAt}`,
      };
    }
    const record = newLeaseRecord({
      operation: "taken-over",
      repository,
      holder: request.holder,
      ref,
      runner: request.runner,
      weightClass: request.weightClass,
      ttlMs,
      nowIso: request.nowIso,
      takeover: {
        previousHolder: existing.holder,
        leaseId: existing.leaseId,
        heartbeatAgeMs: existing.heartbeatAgeMs,
        lastHeartbeatAt: existing.heartbeatAt,
        takenOverAt: request.nowIso,
      },
    });
    const incident: QueueIncidentRecord = {
      schema: QUEUE_INCIDENT_SCHEMA,
      type: "lease-stale-takeover",
      repository,
      evidence: [
        { key: "previousHolder", value: existing.holder },
        { key: "leaseId", value: existing.leaseId },
        { key: "heartbeatAgeMs", value: String(existing.heartbeatAgeMs) },
        { key: "lastHeartbeatAt", value: existing.heartbeatAt },
        { key: "earliestTakeoverAt", value: earliestTakeoverAtIso(existing) },
      ],
      recordedAt: request.nowIso,
    };
    const appended = appendLeaseRecords(store, handle, [
      {
        kind: QUEUE_LEASE_RECORD_KIND,
        recordKey: queueLeaseRecordKey(repository),
        payload: leasePayload(record),
      },
      {
        kind: QUEUE_INCIDENT_RECORD_KIND,
        recordKey: queueIncidentRecordKey(repository),
        payload: incidentPayload(incident),
      },
    ]);
    if (!appended.ok) return appended;
    return { ok: true, value: { result: "taken-over", lease: record, incident } };
  });
};

/**
 * Release one held lease. Releasing when no lease exists is an explicit noop;
 * releasing another holder's live lease refuses; the release record is verified
 * post-append.
 */
export const releaseQueueLease = (
  store: StateStorePort,
  request: {
    readonly ref: string;
    readonly holder?: string;
    readonly park?: {
      readonly cause: QueueParkCause;
      readonly condition: QueueParkCondition;
      readonly recheckMs?: number;
    };
    readonly nowIso: string;
    readonly nowMs: number;
    readonly fenceToken: string;
  },
): QueueReleaseResult => {
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const ref = canonicalQueueRef(request.ref);
  if (ref === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: `ref ${request.ref} is not canonical`,
    };
  }
  const resolved = entryRepository(fold.value, ref);
  if (!resolved.ok) return resolved;
  const repository = resolved.repository;
  return runReleaseFence(store, request.fenceToken, (handle) => {
    const activeRead = readActiveLeases(store, request.nowMs);
    if (!activeRead.ok) {
      return stateFailureOf({
        ...activeRead,
        kind: "state",
        consequence: "not_landed",
        location: { path: store.identity.stateDirectory },
      });
    }
    const existing = activeRead.active.find((lease) => lease.repository === repository);
    if (existing === undefined) {
      return { ok: true, value: { result: "noop" } };
    }
    if (request.holder !== undefined && existing.holder !== request.holder) {
      const conflict = leaseConflict(existing);
      return {
        ok: false,
        kind: "queue",
        code: "queue.lease-conflict",
        conflict,
        detail: `holder:${conflict.holder}; lease:${conflict.leaseId}`,
      };
    }
    const record = newLeaseRecord({
      operation: "released",
      repository,
      holder: existing.holder,
      ref: existing.ref,
      runner: existing.runner,
      weightClass: existing.weightClass,
      ttlMs: existing.ttlMs,
      nowIso: request.nowIso,
      acquiredAt: existing.acquiredAt,
      leaseId: existing.leaseId,
    });
    if (request.park === undefined) {
      const appended = appendLeaseRecords(store, handle, [
        {
          kind: QUEUE_LEASE_RECORD_KIND,
          recordKey: queueLeaseRecordKey(repository),
          payload: leasePayload(record),
        },
      ]);
      if (!appended.ok) return appended;
      return { ok: true, value: { result: "released", lease: record } };
    }
    const expectedConditionType = conditionTypeForCause(request.park.cause);
    if (request.park.condition.type !== expectedConditionType) {
      return {
        ok: false,
        kind: "input",
        code: "input.value.rejected",
        detail: `cause ${request.park.cause} pairs with condition type ${expectedConditionType}`,
      };
    }
    const parkRecord = createParkRecord({
      ref,
      ...(resolved.record.repository === undefined
        ? {}
        : { repository: resolved.record.repository }),
      cause: request.park.cause,
      condition: request.park.condition,
      recheckMs: request.park.recheckMs ?? defaultParkRecheckMs(expectedConditionType),
      evaluatedAt: request.nowIso,
      recordedAt: request.nowIso,
    });
    // Park first, then release. Both land or neither outcome lands: if the
    // lease-release append fails after the park landed, append a compensating
    // `released` park record so the fold observes no active park while the
    // lease remains held, then return the classified state failure.
    const parkWrite = appendLeaseRecords(store, handle, [
      {
        kind: QUEUE_PARK_RECORD_KIND,
        recordKey: queueParkRecordKey(ref),
        payload: parkRecord as unknown as StateJsonValue,
      },
    ]);
    if (!parkWrite.ok) return parkWrite;
    const releaseWrite = appendLeaseRecords(store, handle, [
      {
        kind: QUEUE_LEASE_RECORD_KIND,
        recordKey: queueLeaseRecordKey(repository),
        payload: leasePayload(record),
      },
    ]);
    if (!releaseWrite.ok) {
      const withdrawn = releasedParkRecord(parkRecord, { nowIso: request.nowIso });
      appendLeaseRecords(store, handle, [
        {
          kind: QUEUE_PARK_RECORD_KIND,
          recordKey: queueParkRecordKey(ref),
          payload: withdrawn as unknown as StateJsonValue,
        },
      ]);
      return releaseWrite;
    }
    return { ok: true, value: { result: "parked", lease: record, park: parkRecord } };
  });
};

/** One pass of park re-evaluation: recover cleared parks, report stuck ones. */
export type QueueParkRecoveryOutcome = {
  readonly recovered: readonly string[];
  readonly stuck: readonly string[];
  readonly evaluations: Readonly<Record<string, QueueParkEvaluation>>;
  readonly records: readonly QueueParkRecord[];
};

export type QueueParkRecoveryResult =
  | { readonly ok: true; readonly value: QueueParkRecoveryOutcome }
  | QueueLeaseFailure;

/**
 * Mutating park pass: for every latest park whose condition evaluated clear,
 * append the durable clear-observed marker first, then attempt recovery with a
 * `park-auto-recovery` incident. If the recovery append is refused, the marker
 * persists and the pass returns `queue.park-condition-stuck`. Reads never call
 * this; a park seen only by a read is reported, never recovered.
 */
export const recoverQueueParks = (
  store: StateStorePort,
  request: {
    readonly nowIso: string;
    readonly nowMs: number;
    readonly context: QueueParkContext;
    readonly fenceToken: string;
    /** An active hold skips the mutating pass: no marker, recovery, or incident. */
    readonly ownerHold?: OwnerHoldFact;
  },
): QueueParkRecoveryResult => {
  if (request.ownerHold?.active === true) {
    const read = readQueueParks(store);
    if (!read.ok) {
      return stateFailureOf({
        ...read,
        kind: "state",
        consequence: "not_landed",
        location: { path: store.identity.stateDirectory },
      });
    }
    const pass = evaluateParkPass(read.records, request.nowMs, request.context);
    const stuck: string[] = [];
    for (const record of pass.records) {
      if (pass.evaluations[record.ref]?.state === "stuck") stuck.push(record.ref);
    }
    return {
      ok: true,
      value: { recovered: [], stuck, evaluations: pass.evaluations, records: pass.records },
    };
  }
  const fold = readQueueFold(store);
  if (!fold.ok) return fold;
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return stateFailureOf(acquired.error);
  try {
    const read = readQueueParks(store);
    if (!read.ok) {
      return stateFailureOf({
        ...read,
        kind: "state",
        consequence: "not_landed",
        location: { path: store.identity.stateDirectory },
      });
    }
    const pass = evaluateParkPass(read.records, request.nowMs, request.context);
    const recovered: string[] = [];
    const stuck: string[] = [];
    for (const record of pass.records) {
      const evaluation = pass.evaluations[record.ref];
      if (evaluation?.state === "stuck") {
        stuck.push(record.ref);
        continue;
      }
      if (evaluation?.state !== "resumable") continue;
      const marker = clearObservedRecord(record, {
        nowIso: request.nowIso,
        nowMs: request.nowMs,
      });
      const markerWrite = appendLeaseRecords(store, acquired.value.handle, [
        {
          kind: QUEUE_PARK_RECORD_KIND,
          recordKey: queueParkRecordKey(record.ref),
          payload: marker as unknown as StateJsonValue,
        },
      ]);
      if (!markerWrite.ok) return markerWrite;
      const recovery = recoveredRecord(marker, {
        nowIso: request.nowIso,
        nowMs: request.nowMs,
      });
      const incident: QueueIncidentRecord = {
        schema: QUEUE_INCIDENT_SCHEMA,
        type: "park-auto-recovery",
        ref: record.ref,
        ...(record.repository === undefined ? {} : { repository: record.repository }),
        evidence: [
          { key: "condition", value: record.conditionType },
          { key: "clearObservedAt", value: marker.clearObservedAt ?? request.nowIso },
          { key: "evaluatedAt", value: request.nowIso },
          {
            key: "observationGapMs",
            value: String(observationGapMs(record.evaluatedAt, request.nowMs)),
          },
        ],
        recordedAt: request.nowIso,
      };
      const recoveredWrite = appendLeaseRecords(store, acquired.value.handle, [
        {
          kind: QUEUE_PARK_RECORD_KIND,
          recordKey: queueParkRecordKey(record.ref),
          payload: recovery as unknown as StateJsonValue,
        },
        {
          kind: QUEUE_INCIDENT_RECORD_KIND,
          recordKey: queueIncidentRecordKey(record.ref),
          payload: incidentPayload(incident),
        },
      ]);
      if (!recoveredWrite.ok) {
        // The durable marker persists; the pass reports the stuck class.
        stuck.push(record.ref);
        continue;
      }
      recovered.push(record.ref);
    }
    return {
      ok: true,
      value: { recovered, stuck, evaluations: pass.evaluations, records: pass.records },
    };
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** Read-only park pass for the read surfaces and the lane fold. */
export type QueueParkRead =
  | {
      readonly ok: true;
      readonly pass: QueueParkPass;
      readonly evidence: StateReadEvidence;
    }
  | { readonly ok: false; readonly reason: QueueReadReason; readonly code: StateFailureCode };

export const readQueueParkPass = (
  store: StateStorePort,
  nowMs: number,
  context: QueueParkContext,
): QueueParkRead => {
  const read = readQueueParks(store);
  if (!read.ok) return read;
  return {
    ok: true,
    pass: evaluateParkPass(read.records, nowMs, context),
    evidence: read.evidence,
  };
};

/** The derived heartbeat age for one raw lease record. */
export const leaseRecordHeartbeatAgeMs = leaseHeartbeatAgeMs;
