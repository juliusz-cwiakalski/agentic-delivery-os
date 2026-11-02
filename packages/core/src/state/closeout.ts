/**
 * The `closeout.operation` ledger over the injected state port (GH-183 F-3,
 * DM-4, EVT-1).
 *
 * Additive inside `delivery.state.v1`: one append per terminal operation, a
 * verified read, and the first terminal outcome per operation id is
 * authoritative. Each append carries only the new record; the event history is
 * folded from the ledger's verified records on read. No schema bump, no
 * migration, no runtime API.
 */
import {
  CLOSEOUT_APPLY_OUTCOMES,
  CLOSEOUT_GAP_REASONS,
  CLOSEOUT_OPERATION_NAMES,
  CLOSEOUT_OPERATION_PAYLOAD_SCHEMA,
  CLOSEOUT_OPERATION_RECORD_KIND,
  type CloseoutOperationRecord,
  type StateAppendOutcome,
  type StateFenceHandle,
  type StateJsonValue,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The closeout ledger's declared record-key prefix (one history per work item). */
export const CLOSEOUT_OPERATION_RECORD_KEY_PREFIX = "closeout.operations:" as const;

/** The store-scoped key the closeout ledger appends and reads. */
export const closeoutOperationRecordKey = (workItemRef: string): string =>
  `${CLOSEOUT_OPERATION_RECORD_KEY_PREFIX}${workItemRef}`;

const TERMINAL: ReadonlySet<string> = new Set([
  "applied",
  "satisfied",
  "skipped-gap",
  "skipped-noop",
]);

const CAPABILITY_CONTEXTS: ReadonlySet<string> = new Set(["supported", ...CLOSEOUT_GAP_REASONS]);
const OPERATION_NAMES: ReadonlySet<string> = new Set(CLOSEOUT_OPERATION_NAMES);
const APPLY_OUTCOMES: ReadonlySet<string> = new Set(CLOSEOUT_APPLY_OUTCOMES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const hasOnlyKeys = (value: Readonly<Record<string, unknown>>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (code: "state.store.torn", location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

/** Validate the canonical arguments for the recorded operation. */
const validArguments = (operation: string, value: unknown): boolean => {
  if (!isRecord(value)) return false;
  switch (operation) {
    case "transition-work-item":
      return hasOnlyKeys(value, ["deliveryState"]) && value.deliveryState === "done";
    case "write-work-item": {
      if (!hasOnlyKeys(value, ["add", "remove", "assignee"])) return false;
      const hasAdd = Object.hasOwn(value, "add");
      const hasRemove = Object.hasOwn(value, "remove");
      const hasAssignee = Object.hasOwn(value, "assignee");
      if (!hasAdd && !hasRemove && !hasAssignee) return false;
      if (hasAdd && !isStringArray(value.add)) return false;
      if (hasRemove && !isStringArray(value.remove)) return false;
      if (hasAssignee && value.assignee !== "none") return false;
      return true;
    }
    case "resolve-delivery-thread": {
      if (!hasOnlyKeys(value, ["deliveryRequest", "threadId"])) return false;
      if (!isNonEmptyString(value.threadId)) return false;
      const request = value.deliveryRequest;
      return (
        isRecord(request) &&
        hasOnlyKeys(request, ["systemName", "entityId"]) &&
        isNonEmptyString(request.systemName) &&
        isNonEmptyString(request.entityId)
      );
    }
    case "restore-checkout":
      return hasOnlyKeys(value, ["baseRef"]) && isNonEmptyString(value.baseRef);
    case "delete-branch":
      return hasOnlyKeys(value, ["branch"]) && isNonEmptyString(value.branch);
    default:
      return false;
  }
};

const validEvidence = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;
  return value.every((field) => {
    if (!isRecord(field) || !hasOnlyKeys(field, ["name", "value"])) return false;
    if (!isNonEmptyString(field.name)) return false;
    const fieldValue = field.value;
    return (
      typeof fieldValue === "string" ||
      typeof fieldValue === "boolean" ||
      (typeof fieldValue === "number" && Number.isFinite(fieldValue))
    );
  });
};

/** Serialize exactly one operation record into the JSON payload value. */
const payloadFor = (record: CloseoutOperationRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  operationId: record.operationId,
  workItemRef: record.workItemRef,
  engine: record.engine,
  capabilityContext: record.capabilityContext,
  operation: record.operation,
  arguments: record.arguments as unknown as StateJsonValue,
  target: record.target,
  outcome: record.outcome,
  ...(record.reason === undefined ? {} : { reason: record.reason }),
  evidence: record.evidence.map((field) => ({ name: field.name, value: field.value })),
  timestamp: record.timestamp,
});

const recordFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<CloseoutOperationRecord> => {
  if (!isRecord(value)) return fail("state.store.torn", location);
  if (value.schemaId !== CLOSEOUT_OPERATION_PAYLOAD_SCHEMA) {
    return fail("state.store.torn", location);
  }
  if (typeof value.operationId !== "string" || !/^[0-9a-f]{64}$/.test(value.operationId)) {
    return fail("state.store.torn", location);
  }
  if (!isNonEmptyString(value.workItemRef)) return fail("state.store.torn", location);
  if (!isNonEmptyString(value.engine)) return fail("state.store.torn", location);
  if (
    typeof value.capabilityContext !== "string" ||
    !CAPABILITY_CONTEXTS.has(value.capabilityContext)
  ) {
    return fail("state.store.torn", location);
  }
  const operation = value.operation;
  if (typeof operation !== "string" || !OPERATION_NAMES.has(operation)) {
    return fail("state.store.torn", location);
  }
  if (typeof value.outcome !== "string" || !APPLY_OUTCOMES.has(value.outcome)) {
    return fail("state.store.torn", location);
  }
  if (!validArguments(operation, value.arguments)) return fail("state.store.torn", location);
  if (
    !isRecord(value.target) ||
    !hasOnlyKeys(value.target, ["systemName", "entityId"]) ||
    !isNonEmptyString(value.target.systemName) ||
    !isNonEmptyString(value.target.entityId)
  ) {
    return fail("state.store.torn", location);
  }
  if (!validEvidence(value.evidence)) return fail("state.store.torn", location);
  if (!isNonEmptyString(value.timestamp)) return fail("state.store.torn", location);
  if (Object.hasOwn(value, "reason") && typeof value.reason !== "string") {
    return fail("state.store.torn", location);
  }
  return ok(value as unknown as CloseoutOperationRecord);
};

/** Read the full verified closeout history for one work item. */
export const readCloseoutHistory = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<readonly CloseoutOperationRecord[]> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const recordKey = closeoutOperationRecordKey(workItemRef);
  const records: CloseoutOperationRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== recordKey) continue;
    if (ledgerRecord.kind !== CLOSEOUT_OPERATION_RECORD_KIND) {
      return fail("state.store.torn", {
        path: verified.value.evidence.storePath,
        record: ledgerRecord.sequence,
      });
    }
    const parsed = recordFrom(ledgerRecord.payload, {
      path: verified.value.evidence.storePath,
      record: ledgerRecord.sequence,
    });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok(records);
};

/** Append one terminal (or failed) operation record through the fenced port. */
export const appendCloseoutOutcome = (
  store: StateStorePort,
  handle: StateFenceHandle,
  record: CloseoutOperationRecord,
): StateResult<StateAppendOutcome> => {
  const current = readCloseoutHistory(store, record.workItemRef);
  if (!current.ok) return current;
  const appended = store.append(handle, {
    kind: CLOSEOUT_OPERATION_RECORD_KIND,
    recordKey: closeoutOperationRecordKey(record.workItemRef),
    payload: payloadFor(record),
  });
  if (!appended.ok) return appended;
  const verification = readCoverage(store, record.workItemRef, current.value.length + 1);
  return verification.ok ? appended : verification;
};

const readCoverage = (
  store: StateStorePort,
  workItemRef: string,
  expected: number,
): StateResult<undefined> => {
  const read = readCloseoutHistory(store, workItemRef);
  if (!read.ok) return read;
  if (read.value.length !== expected) {
    return fail("state.store.torn", {
      path: closeoutOperationRecordKey(workItemRef),
      record: expected,
    });
  }
  return ok(undefined);
};

/** Fold a verified history: the first terminal outcome per operation id wins. */
export const foldCloseoutHistory = (
  records: readonly CloseoutOperationRecord[],
): Readonly<Record<string, CloseoutOperationRecord>> => {
  const terminal: Record<string, CloseoutOperationRecord> = {};
  const failed: Record<string, CloseoutOperationRecord> = {};
  for (const record of records) {
    if (TERMINAL.has(record.outcome)) {
      if (terminal[record.operationId] === undefined) terminal[record.operationId] = record;
      continue;
    }
    if (record.outcome === "failed" && failed[record.operationId] === undefined) {
      failed[record.operationId] = record;
    }
  }
  for (const [operationId, record] of Object.entries(failed)) {
    if (terminal[operationId] === undefined) terminal[operationId] = record;
  }
  return terminal;
};
