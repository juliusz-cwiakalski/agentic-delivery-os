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
  QUEUE_LEASE_SCOPES,
  QUEUE_LEASE_SCHEMA,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_CONDITION_TYPES,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  QUEUE_PARK_RECOVERY_STATES,
  QUEUE_PARK_SCHEMA,
  QUEUE_WEIGHT_CLASSES,
  type QueueDependencyRecord,
  type QueueEntryRecord,
  type QueueGraphDocument,
  type QueueIncidentRecord,
  type QueueLeaseRecord,
  type QueueParkRecord,
  type StateAppendRequest,
  type StateFailure,
  type StateFailureCode,
  type StateFenceHandle,
  type StateJsonValue,
  type StateReadEvidence,
  type StateSafeLocation,
  type StateStoreIdentity,
  type StateStorePort,
} from "#contracts";
import {
  canonicalQueueRef,
  detectCycleForEdge,
  foldLatestDependencyRecords,
  foldLatestEntries,
  foldQueueGraph,
  mergeEdges,
  normalizeEdges,
  type QueueGraphFold,
  queueGraphDocument,
} from "../domain/queue-graph.js";

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

const hasOnlyKeys = (value: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

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
] as const;
const DEPENDENCY_KEYS = ["schema", "ref", "edges", "recordedAt"] as const;
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
  if (typeof value.scope !== "string" || !(QUEUE_LEASE_SCOPES as readonly string[]).includes(value.scope)) {
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
  if (typeof value.cause !== "string" || !(QUEUE_PARK_CAUSES as readonly string[]).includes(value.cause)) {
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
  if (
    value.conditionType === "provider-window" &&
    !isNonEmptyString(value.condition.expiresAt)
  ) {
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

const readRecords = <T>(store: StateStorePort, spec: RecordSpec<T>): QueueLedgerRead<T> => {
  const verified = store.readRecords();
  if (!verified.ok) {
    return {
      ok: false,
      reason: reasonFor(verified.error.code),
      code: verified.error.code,
    };
  }
  const records: T[] = [];
  for (const ledgerRecord of verified.value.records) {
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
  }
  return {
    ok: true,
    records,
    latest: records,
    verifiedEmpty: records.length === 0,
    evidence: verified.value.evidence,
  };
};

/** Read every verified queue entry record, oldest first (latest folded). */
export const readQueueEntries = (store: StateStorePort): QueueLedgerRead<QueueEntryRecord> => {
  const read = readRecords(store, {
    prefix: QUEUE_ENTRY_KEY_PREFIX,
    kind: QUEUE_ENTRY_RECORD_KIND,
    schema: QUEUE_ENTRY_SCHEMA,
    isRecord: isEntryRecord,
  });
  if (!read.ok) return read;
  return { ...read, latest: foldLatestEntries(read.records) };
};

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
  readRecords(store, {
    prefix: QUEUE_LEASE_KEY_PREFIX,
    kind: QUEUE_LEASE_RECORD_KIND,
    schema: QUEUE_LEASE_SCHEMA,
    isRecord: isLeaseRecord,
  });

/** Read every verified queue park record, oldest first. */
export const readQueueParks = (store: StateStorePort): QueueLedgerRead<QueueParkRecord> =>
  readRecords(store, {
    prefix: QUEUE_PARK_KEY_PREFIX,
    kind: QUEUE_PARK_RECORD_KIND,
    schema: QUEUE_PARK_SCHEMA,
    isRecord: isParkRecord,
  });

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
  const entries = readQueueEntries(store);
  if (!entries.ok) {
    return {
      ok: false,
      kind: "state",
      code: entries.code,
      location: { path: store.identity.stateDirectory },
      reason: entries.reason,
    };
  }
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
  return ok(foldQueueGraph(entries.records, dependencies.records));
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

type DesiredEntryResult =
  | { readonly ok: true; readonly value: DesiredEntry }
  | QueueIntentFailure;

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
  };
  const entryChanged =
    current === undefined ||
    current.repository !== record.repository ||
    current.repositoryRoot !== record.repositoryRoot ||
    current.priority !== record.priority;
  const currentEdges = edgesOf(fold, ref);
  const edgesChanged =
    edges.length !== currentEdges.length || edges.some((edge) => !currentEdges.includes(edge));
  return { ok: true, value: { record, edges, existed: current !== undefined, entryChanged, edgesChanged } };
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

const withIntentFence = (
  store: StateStorePort,
  fenceToken: string,
  body: (handle: StateFenceHandle) => QueueIntentResult,
): QueueIntentResult => {
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
