/**
 * The daemon execution ledgers over the injected state port (GH-238 F-2, F-7;
 * EVT-1, EVT-2; DM-1, DM-2).
 *
 * Additive inside `delivery.state.v1`: fenced appends, verified post-append
 * reads, and identical replays append nothing. Latest record per key wins. No
 * module-level mutable durable state exists.
 */
import {
  DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
  DAEMON_HEARTBEAT_RECORD_KIND,
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  DAEMON_INSTANCE_RECORD_KEY,
  DAEMON_INSTANCE_RECORD_KIND,
  DAEMON_LANE_KEY_PREFIX,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_PREEMPTION_KEY_PREFIX,
  DAEMON_PREEMPTION_PAYLOAD_SCHEMA,
  DAEMON_PREEMPTION_RECORD_KIND,
  DAEMON_RECONCILIATION_KEY_PREFIX,
  DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
  DAEMON_RECONCILIATION_RECORD_KIND,
  daemonLaneRecordKey,
  daemonPreemptionRecordKey,
  type DaemonHeartbeatRecord,
  type DaemonInstanceRecord,
  type DaemonLaneRecord,
  type DaemonPreemptionRecord,
  type DaemonReconciliationRecord,
  type StateAppendOutcome,
  type StateFailureCode,
  type StateJsonValue,
  type StateReadEvidence,
  type StateRecord,
  type StateStorePort,
} from "#contracts";

export type DaemonLedgerRead<T> =
  | {
      readonly ok: true;
      readonly records: readonly T[];
      readonly latest: T | undefined;
      readonly verifiedEmpty: boolean;
      readonly evidence: StateReadEvidence;
    }
  | { readonly ok: false; readonly code: StateFailureCode; readonly path: string };

export type DaemonAppendResult<T> =
  | { readonly ok: true; readonly appended: boolean; readonly record: T }
  | { readonly ok: false; readonly code: string; readonly path: string };

type RecordSpec<T> = {
  readonly kind: string;
  readonly schema: string;
  readonly keyPrefix: string;
  readonly isRecord: (value: unknown) => value is T;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInstant = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isInstanceRecord = (value: unknown): value is DaemonInstanceRecord =>
  isRecord(value) &&
  value.schema === DAEMON_INSTANCE_PAYLOAD_SCHEMA &&
  typeof value.instanceId === "string" &&
  typeof value.pid === "number" &&
  typeof value.scope === "string" &&
  typeof value.lockToken === "string" &&
  ["acquired", "taken-over", "released", "immediate-stop"].includes(String(value.operation)) &&
  isInstant(value.acquiredAt) &&
  isInstant(value.heartbeatAt) &&
  isInstant(value.recordedAt);

const isHeartbeatRecord = (value: unknown): value is DaemonHeartbeatRecord =>
  isRecord(value) &&
  value.schema === DAEMON_HEARTBEAT_PAYLOAD_SCHEMA &&
  typeof value.instanceId === "string" &&
  typeof value.ordinal === "number" &&
  isInstant(value.beatAt) &&
  typeof value.uptimeMs === "number" &&
  typeof value.queueDepth === "number" &&
  isRecord(value.laneCounts) &&
  typeof value.cursor === "number" &&
  isInstant(value.recordedAt);

const isLaneRecord = (value: unknown): value is DaemonLaneRecord =>
  isRecord(value) &&
  value.schema === DAEMON_LANE_PAYLOAD_SCHEMA &&
  typeof value.ref === "string" &&
  ["delivering", "detached", "completed", "failed", "preempted"].includes(String(value.state)) &&
  typeof value.spawnOrdinal === "number" &&
  isInstant(value.recordedAt);

const isReconciliationRecord = (value: unknown): value is DaemonReconciliationRecord =>
  isRecord(value) &&
  value.schema === DAEMON_RECONCILIATION_PAYLOAD_SCHEMA &&
  typeof value.instanceId === "string" &&
  isRecord(value.queue) &&
  Array.isArray(value.lanes) &&
  typeof value.duplicates === "number" &&
  Array.isArray(value.questions) &&
  isInstant(value.startedAt) &&
  isInstant(value.completedAt) &&
  typeof value.truncated === "boolean" &&
  isInstant(value.recordedAt);

const isPreemptionRecord = (value: unknown): value is DaemonPreemptionRecord =>
  isRecord(value) &&
  value.schema === DAEMON_PREEMPTION_PAYLOAD_SCHEMA &&
  typeof value.ref === "string" &&
  typeof value.closeRef === "string" &&
  ["pending", "applied", "withdrawn"].includes(String(value.state)) &&
  isInstant(value.requestedAt) &&
  isInstant(value.recordedAt);

const readLedger = <T>(
  store: StateStorePort,
  spec: RecordSpec<T>,
  view?: readonly StateRecord[],
): DaemonLedgerRead<T> => {
  const read =
    view === undefined
      ? store.readRecords()
      : {
          ok: true as const,
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
  if (!read.ok) {
    return {
      ok: false,
      code: read.error.code,
      path: read.error.location.path,
    };
  }
  const records: T[] = [];
  for (const ledgerRecord of read.value.records) {
    if (!ledgerRecord.key.startsWith(spec.keyPrefix)) continue;
    if (ledgerRecord.kind !== spec.kind || !spec.isRecord(ledgerRecord.payload)) {
      return { ok: false, code: "state.store.torn", path: read.value.evidence.storePath };
    }
    records.push(ledgerRecord.payload);
  }
  return {
    ok: true,
    records,
    latest: records.length === 0 ? undefined : records[records.length - 1],
    verifiedEmpty: records.length === 0,
    evidence: read.value.evidence,
  };
};

const appendLedger = <T>(
  store: StateStorePort,
  fenceToken: string,
  spec: { readonly kind: string; readonly keyPrefix: string },
  recordKey: string,
  payload: T,
): DaemonAppendResult<T> => {
  const before = store.readRecords();
  if (!before.ok) return { ok: false, code: before.error.code, path: before.error.location.path };
  const previous = [...before.value.records]
    .reverse()
    .find((entry) => entry.key === recordKey && entry.kind === spec.kind);
  if (previous !== undefined && JSON.stringify(previous.payload) === JSON.stringify(payload)) {
    return { ok: true, appended: false, record: payload };
  }
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok)
    return { ok: false, code: acquired.error.code, path: acquired.error.location.path };
  const appended: StateAppendOutcome | undefined = (() => {
    const result = store.append(acquired.value.handle, {
      kind: spec.kind,
      recordKey,
      payload: payload as StateJsonValue,
    });
    return result.ok ? result.value : undefined;
  })();
  const released = store.releaseFence(acquired.value.handle);
  if (appended === undefined) {
    return { ok: false, code: "state.write.failed", path: recordKey };
  }
  if (!released.ok)
    return { ok: false, code: released.error.code, path: released.error.location.path };
  const after = store.readRecords();
  if (!after.ok) return { ok: false, code: after.error.code, path: after.error.location.path };
  const found = after.value.records.some(
    (entry) =>
      entry.kind === spec.kind &&
      entry.key === recordKey &&
      JSON.stringify(entry.payload) === JSON.stringify(payload),
  );
  if (!found) return { ok: false, code: "state.write.failed", path: appended.path };
  return { ok: true, appended: true, record: payload };
};

export const readDaemonInstance = (store: StateStorePort): DaemonLedgerRead<DaemonInstanceRecord> =>
  readLedger(store, {
    kind: DAEMON_INSTANCE_RECORD_KIND,
    schema: DAEMON_INSTANCE_PAYLOAD_SCHEMA,
    keyPrefix: DAEMON_INSTANCE_RECORD_KEY,
    isRecord: isInstanceRecord,
  });

export const appendDaemonInstance = (
  store: StateStorePort,
  fenceToken: string,
  record: DaemonInstanceRecord,
): DaemonAppendResult<DaemonInstanceRecord> => {
  if (record.operation !== "taken-over" && record.takeover !== undefined) {
    return { ok: false, code: "state.store.torn", path: DAEMON_INSTANCE_RECORD_KEY };
  }
  if (record.operation === "taken-over" && record.takeover === undefined) {
    return { ok: false, code: "state.store.torn", path: DAEMON_INSTANCE_RECORD_KEY };
  }
  const current = readDaemonInstance(store);
  if (!current.ok) return { ok: false, code: current.code, path: current.path };
  const latest = current.latest;
  if (
    record.operation === "acquired" &&
    latest !== undefined &&
    latest.instanceId !== record.instanceId &&
    (latest.operation === "acquired" || latest.operation === "taken-over")
  ) {
    return { ok: false, code: "state.lock.busy", path: DAEMON_INSTANCE_RECORD_KEY };
  }
  return appendLedger(
    store,
    fenceToken,
    { kind: DAEMON_INSTANCE_RECORD_KIND, keyPrefix: DAEMON_INSTANCE_RECORD_KEY },
    DAEMON_INSTANCE_RECORD_KEY,
    record,
  );
};

export const readDaemonHeartbeat = (
  store: StateStorePort,
): DaemonLedgerRead<DaemonHeartbeatRecord> =>
  readLedger(store, {
    kind: DAEMON_HEARTBEAT_RECORD_KIND,
    schema: DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
    keyPrefix: "daemon.heartbeat",
    isRecord: isHeartbeatRecord,
  });

export const appendDaemonHeartbeat = (
  store: StateStorePort,
  fenceToken: string,
  record: DaemonHeartbeatRecord,
): DaemonAppendResult<DaemonHeartbeatRecord> => {
  const current = readDaemonHeartbeat(store);
  if (!current.ok) return { ok: false, code: current.code, path: current.path };
  const latest = current.latest;
  if (
    latest !== undefined &&
    latest.instanceId === record.instanceId &&
    record.ordinal <= latest.ordinal
  ) {
    return { ok: false, code: "state.write.failed", path: "daemon.heartbeat" };
  }
  return appendLedger(
    store,
    fenceToken,
    { kind: DAEMON_HEARTBEAT_RECORD_KIND, keyPrefix: "daemon.heartbeat" },
    "daemon.heartbeat",
    record,
  );
};

export const readDaemonLanes = (
  store: StateStorePort,
  view?: readonly StateRecord[],
): DaemonLedgerRead<DaemonLaneRecord> =>
  readLedger(
    store,
    {
      kind: DAEMON_LANE_RECORD_KIND,
      schema: DAEMON_LANE_PAYLOAD_SCHEMA,
      keyPrefix: DAEMON_LANE_KEY_PREFIX,
      isRecord: isLaneRecord,
    },
    view,
  );

export const appendDaemonLane = (
  store: StateStorePort,
  fenceToken: string,
  record: DaemonLaneRecord,
): DaemonAppendResult<DaemonLaneRecord> =>
  appendLedger(
    store,
    fenceToken,
    { kind: DAEMON_LANE_RECORD_KIND, keyPrefix: DAEMON_LANE_KEY_PREFIX },
    daemonLaneRecordKey(record.ref),
    record,
  );

export const readDaemonReconciliations = (
  store: StateStorePort,
): DaemonLedgerRead<DaemonReconciliationRecord> =>
  readLedger(store, {
    kind: DAEMON_RECONCILIATION_RECORD_KIND,
    schema: DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
    keyPrefix: DAEMON_RECONCILIATION_KEY_PREFIX,
    isRecord: isReconciliationRecord,
  });

export const appendDaemonReconciliation = (
  store: StateStorePort,
  fenceToken: string,
  record: DaemonReconciliationRecord,
): DaemonAppendResult<DaemonReconciliationRecord> =>
  appendLedger(
    store,
    fenceToken,
    { kind: DAEMON_RECONCILIATION_RECORD_KIND, keyPrefix: DAEMON_RECONCILIATION_KEY_PREFIX },
    `${DAEMON_RECONCILIATION_KEY_PREFIX}${record.instanceId}`,
    record,
  );

export const readDaemonPreemptions = (
  store: StateStorePort,
): DaemonLedgerRead<DaemonPreemptionRecord> =>
  readLedger(store, {
    kind: DAEMON_PREEMPTION_RECORD_KIND,
    schema: DAEMON_PREEMPTION_PAYLOAD_SCHEMA,
    keyPrefix: DAEMON_PREEMPTION_KEY_PREFIX,
    isRecord: isPreemptionRecord,
  });

export const appendDaemonPreemption = (
  store: StateStorePort,
  fenceToken: string,
  record: DaemonPreemptionRecord,
): DaemonAppendResult<DaemonPreemptionRecord> =>
  appendLedger(
    store,
    fenceToken,
    { kind: DAEMON_PREEMPTION_RECORD_KIND, keyPrefix: DAEMON_PREEMPTION_KEY_PREFIX },
    daemonPreemptionRecordKey(record.ref),
    record,
  );

// The heartbeat, instance, lane, reconciliation, and preemption keys are the
// constants declared in the contracts tier; no local store-key literal drifts.
