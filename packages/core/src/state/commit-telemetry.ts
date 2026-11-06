/**
 * The `commit.telemetry` ledger over the injected state port (GH-227 EVT-1,
 * DM-1, DEC-9).
 *
 * Additive inside `delivery.state.v1`: one verified append per landed commit,
 * a verified read, and no derived projection document. Payloads are metadata
 * only — never message bodies, diff content, or secret material — and emission
 * is non-gating: a failed append is returned to the caller as evidence.
 */
import {
  COMMIT_MESSAGE_SOURCES,
  COMMIT_TELEMETRY_RECORD_KEY_PREFIX,
  COMMIT_TELEMETRY_RECORD_KIND,
  COMMIT_TELEMETRY_SCHEMA_ID,
  COMMIT_TRANSPORTS,
  type CommitTelemetryRead,
  type CommitTelemetryRecord,
  type StateAppendOutcome,
  type StateJsonValue,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The store-scoped key that carries one change's telemetry history. */
export const commitTelemetryRecordKey = (changeRef: string): string =>
  `${COMMIT_TELEMETRY_RECORD_KEY_PREFIX}${changeRef}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const torn = (location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code: "state.store.torn", consequence: "not_landed", location },
});

const payloadFor = (record: CommitTelemetryRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  changeRef: record.changeRef,
  ...(record.phaseId === undefined ? {} : { phaseId: record.phaseId }),
  commitSha: record.commitSha,
  messageSource: record.messageSource,
  transport: record.transport,
  tokenSpend: {
    inputTokens: record.tokenSpend.inputTokens,
    outputTokens: record.tokenSpend.outputTokens,
  },
  landedAt: record.landedAt,
  ...(record.transitionId === undefined ? {} : { transitionId: record.transitionId }),
  ...(record.failover === undefined
    ? {}
    : {
        failover: record.failover.map((entry) => ({
          transport: entry.transport,
          reason: entry.reason,
        })),
      }),
});

const recordFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<CommitTelemetryRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COMMIT_TELEMETRY_SCHEMA_ID) return torn(location);
  if (!isNonEmptyString(value.changeRef)) return torn(location);
  if (Object.hasOwn(value, "phaseId") && !isNonEmptyString(value.phaseId)) return torn(location);
  const phaseId = isNonEmptyString(value.phaseId) ? value.phaseId : undefined;
  const transitionId = isNonEmptyString(value.transitionId) ? value.transitionId : undefined;
  if (!isNonEmptyString(value.commitSha)) return torn(location);
  if (
    typeof value.messageSource !== "string" ||
    !(COMMIT_MESSAGE_SOURCES as readonly string[]).includes(value.messageSource)
  ) {
    return torn(location);
  }
  if (
    typeof value.transport !== "string" ||
    !(COMMIT_TRANSPORTS as readonly string[]).includes(value.transport)
  ) {
    return torn(location);
  }
  if (!isRecord(value.tokenSpend)) return torn(location);
  if (
    !isNonNegativeInteger(value.tokenSpend.inputTokens) ||
    !isNonNegativeInteger(value.tokenSpend.outputTokens)
  ) {
    return torn(location);
  }
  if (!isNonEmptyString(value.landedAt)) return torn(location);
  if (Object.hasOwn(value, "transitionId") && !isNonEmptyString(value.transitionId)) {
    return torn(location);
  }
  const rawFailover = value.failover;
  const failover = Array.isArray(rawFailover)
    ? rawFailover.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        if (
          typeof entry.transport !== "string" ||
          !(COMMIT_TRANSPORTS as readonly string[]).includes(entry.transport) ||
          typeof entry.reason !== "string"
        ) {
          return [];
        }
        return [{ transport: entry.transport as CommitTelemetryRecord["transport"], reason: entry.reason }];
      })
    : undefined;
  if (rawFailover !== undefined && !Array.isArray(rawFailover)) return torn(location);
  if (Array.isArray(rawFailover) && (failover === undefined || failover.length !== rawFailover.length)) {
    return torn(location);
  }
  return ok({
    schemaId: COMMIT_TELEMETRY_SCHEMA_ID,
    changeRef: value.changeRef,
    ...(phaseId === undefined ? {} : { phaseId }),
    commitSha: value.commitSha,
    messageSource: value.messageSource as CommitTelemetryRecord["messageSource"],
    transport: value.transport as CommitTelemetryRecord["transport"],
    tokenSpend: {
      inputTokens: value.tokenSpend.inputTokens,
      outputTokens: value.tokenSpend.outputTokens,
    },
    landedAt: value.landedAt,
    ...(transitionId === undefined ? {} : { transitionId }),
    ...(failover === undefined ? {} : { failover }),
  });
};

/** Read one change's verified telemetry history; no projection is consulted. */
export const readCommitTelemetry = (
  store: StateStorePort,
  changeRef: string,
): StateResult<CommitTelemetryRead> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = commitTelemetryRecordKey(changeRef);
  const records: CommitTelemetryRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== key) continue;
    if (ledgerRecord.kind !== COMMIT_TELEMETRY_RECORD_KIND) {
      return torn({ path: verified.value.evidence.storePath, record: ledgerRecord.sequence });
    }
    const parsed = recordFrom(ledgerRecord.payload, {
      path: verified.value.evidence.storePath,
      record: ledgerRecord.sequence,
    });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok({
    changeRef,
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: verified.value.evidence,
  });
};

/** Append exactly one telemetry event through a freshly acquired fence. */
export const appendCommitTelemetry = (
  store: StateStorePort,
  fenceToken: string,
  record: CommitTelemetryRecord,
): StateResult<{ readonly record: CommitTelemetryRecord; readonly append: StateAppendOutcome }> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: COMMIT_TELEMETRY_RECORD_KIND,
    recordKey: commitTelemetryRecordKey(record.changeRef),
    payload: payloadFor(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  return ok({ record, append: appended.value });
};
