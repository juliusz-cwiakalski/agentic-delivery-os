/**
 * The `closeout.operation` ledger over the injected state port (GH-183 F-3,
 * DM-4, EVT-1).
 *
 * Additive inside `delivery.state.v1`: one append per terminal operation, a
 * verified read, and the first terminal outcome per operation id is
 * authoritative. No schema bump, no migration, no runtime API.
 */
import {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (code: "state.store.torn", location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

/** Serialize one operation record into the JSON payload value. */
const payloadFor = (records: readonly CloseoutOperationRecord[]): StateJsonValue => ({
  schemaId: CLOSEOUT_OPERATION_PAYLOAD_SCHEMA,
  workItemRef: records[0]?.workItemRef ?? "",
  records: records.map((record) => ({
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
  })),
});

const recordFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<CloseoutOperationRecord> => {
  if (!isRecord(value)) return fail("state.store.torn", location);
  const required = [
    "schemaId",
    "operationId",
    "workItemRef",
    "engine",
    "capabilityContext",
    "operation",
    "arguments",
    "target",
    "outcome",
    "evidence",
    "timestamp",
  ];
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.keys.missing",
        consequence: "not_landed",
        location: { ...location, missingKeys: missing },
      },
    };
  }
  if (value.schemaId !== CLOSEOUT_OPERATION_PAYLOAD_SCHEMA) {
    return fail("state.store.torn", location);
  }
  if (
    !isRecord(value.target) ||
    typeof value.target.entityId !== "string" ||
    typeof value.target.systemName !== "string"
  ) {
    return fail("state.store.torn", location);
  }
  if (!Array.isArray(value.evidence)) return fail("state.store.torn", location);
  return ok(value as unknown as CloseoutOperationRecord);
};

/** Read the full verified closeout history for one work item. */
export const readCloseoutHistory = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<readonly CloseoutOperationRecord[]> => {
  const probe = store.read({ requiredKeys: [] });
  if (!probe.ok) return probe;
  if (probe.value.evidence.verifiedEmpty) return ok([]);
  const recordKey = closeoutOperationRecordKey(workItemRef);
  const read = store.read({ requiredKeys: [recordKey] });
  if (!read.ok) {
    const absent =
      read.error.code === "state.keys.missing" &&
      (read.error.location.missingKeys ?? []).includes(recordKey);
    return absent ? ok([]) : read;
  }
  const payload = read.value.values[recordKey];
  if (!isRecord(payload) || !Array.isArray(payload.records)) {
    return fail("state.store.torn", {
      path: read.value.evidence.storePath,
      record: read.value.evidence.recordCount,
    });
  }
  const records: CloseoutOperationRecord[] = [];
  for (const entry of payload.records) {
    const parsed = recordFrom(entry, {
      path: read.value.evidence.storePath,
      record: read.value.evidence.recordCount,
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
  const records = [...current.value, record];
  const appended = store.append(handle, {
    kind: CLOSEOUT_OPERATION_RECORD_KIND,
    recordKey: closeoutOperationRecordKey(record.workItemRef),
    payload: payloadFor(records),
  });
  if (!appended.ok) return appended;
  const verification = readCoverage(store, record.workItemRef, records.length);
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
