/**
 * The additive `harness.telemetry` ledger over the injected state port
 * (GH-233 EVT-1, DM-1, DEC-3, DEC-6, NFR-7).
 *
 * Additive inside `delivery.state.v1`: one verified append per captured
 * session under the store-scoped key per work item, plus one capture-outcome
 * record per delivery run under the same record kind. Every append is fenced
 * and verified post-append. Capture is idempotent by
 * (work item, run, session, agent, model): a re-run appends nothing for
 * already-captured session groups. A failed append is classified, never
 * silent, and never consumable as captured statistics.
 */
import {
  HARNESS_KINDS,
  HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX,
  HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  HARNESS_TELEMETRY_RECORD_KEY_PREFIX,
  HARNESS_TELEMETRY_RECORD_KIND,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessCaptureOutcomeRecord,
  type HarnessTelemetryAppendReport,
  type HarnessTelemetryRecord,
  type StateAppendOutcome,
  type StateJsonValue,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The store-scoped key carrying one delivery's session records. */
export const harnessTelemetryRecordKey = (workItemRef: string): string =>
  `${HARNESS_TELEMETRY_RECORD_KEY_PREFIX}${workItemRef}`;

/** The store-scoped key carrying one delivery run's capture outcome. */
export const harnessTelemetryCaptureKey = (workItemRef: string, runId: string): string =>
  `${HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX}${workItemRef}:${runId}`;

/**
 * The append identity is (run, session, agent, model).
 *
 * A session may span several (agent, model) groups, so the state key carries
 * the group identity additively while the store-scoped record key stays shared.
 */
const sameSessionGroup = (
  candidate: HarnessTelemetryRecord,
  record: HarnessTelemetryRecord,
): boolean =>
  candidate.runId === record.runId &&
  candidate.sessionId === record.sessionId &&
  candidate.agent === record.agent &&
  candidate.model === record.model;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNumberOrNull = (value: unknown): boolean =>
  value === null || (typeof value === "number" && Number.isFinite(value));

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const torn = (location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code: "state.store.torn", consequence: "not_landed", location },
});

const payloadFor = (record: HarnessTelemetryRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  workItemRef: record.workItemRef,
  runId: record.runId,
  sessionId: record.sessionId,
  harnessKind: record.harnessKind,
  harnessVersion: record.harnessVersion,
  agent: record.agent,
  model: record.model,
  treeRoot: record.treeRoot,
  parentChain: [...record.parentChain],
  tokens: {
    input: record.tokens.input,
    output: record.tokens.output,
    reasoning: record.tokens.reasoning,
    cacheRead: record.tokens.cacheRead,
    cacheWrite: record.tokens.cacheWrite,
  },
  calls: record.calls,
  toolCounts: record.toolCounts.map((entry) => ({ tool: entry.tool, calls: entry.calls })),
  ...(record.toolTruncation === undefined
    ? {}
    : {
        toolTruncation: {
          truncated: true,
          omitted: record.toolTruncation.omitted,
          cap: record.toolTruncation.cap,
        },
      }),
  cost: record.cost,
  capturedAt: record.capturedAt,
  warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
});

const recordFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<HarnessTelemetryRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== HARNESS_TELEMETRY_SCHEMA_ID) return torn(location);
  if (!isNonEmptyString(value.workItemRef)) return torn(location);
  if (!isNonEmptyString(value.runId)) return torn(location);
  if (!isNonEmptyString(value.sessionId)) return torn(location);
  if (
    typeof value.harnessKind !== "string" ||
    !(HARNESS_KINDS as readonly string[]).includes(value.harnessKind)
  ) {
    return torn(location);
  }
  if (value.harnessVersion !== null && !isNonEmptyString(value.harnessVersion))
    return torn(location);
  if (!isNonEmptyString(value.agent) || !isNonEmptyString(value.model)) return torn(location);
  if (!isNonEmptyString(value.treeRoot)) return torn(location);
  if (!Array.isArray(value.parentChain) || !value.parentChain.every(isNonEmptyString)) {
    return torn(location);
  }
  if (!isRecord(value.tokens)) return torn(location);
  for (const key of ["input", "output", "reasoning", "cacheRead", "cacheWrite"]) {
    if (!Object.hasOwn(value.tokens, key) || !isNumberOrNull(value.tokens[key])) {
      return torn(location);
    }
  }
  if (typeof value.calls !== "number" || !Number.isInteger(value.calls) || value.calls < 0) {
    return torn(location);
  }
  if (!Array.isArray(value.toolCounts)) return torn(location);
  for (const tool of value.toolCounts) {
    if (!isRecord(tool) || !isNonEmptyString(tool.tool)) return torn(location);
    if (typeof tool.calls !== "number" || !Number.isInteger(tool.calls) || tool.calls < 0) {
      return torn(location);
    }
  }
  if (!isNumberOrNull(value.cost)) return torn(location);
  if (!isNonEmptyString(value.capturedAt)) return torn(location);
  if (!Array.isArray(value.warnings)) return torn(location);
  return ok(value as unknown as HarnessTelemetryRecord);
};

const captureFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<HarnessCaptureOutcomeRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID) return torn(location);
  if (!isNonEmptyString(value.workItemRef) || !isNonEmptyString(value.runId)) return torn(location);
  for (const key of ["captured", "degraded", "failed"]) {
    const field = value[key];
    if (typeof field !== "number" || !Number.isInteger(field) || field < 0) return torn(location);
  }
  if (!isNonEmptyString(value.capturedAt)) return torn(location);
  if (!Array.isArray(value.warnings)) return torn(location);
  return ok(value as unknown as HarnessCaptureOutcomeRecord);
};

/** Read one delivery's verified session telemetry records. */
export const readHarnessTelemetry = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<{
  readonly records: readonly HarnessTelemetryRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
}> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = harnessTelemetryRecordKey(workItemRef);
  const records: HarnessTelemetryRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== key) continue;
    if (ledgerRecord.kind !== HARNESS_TELEMETRY_RECORD_KIND) {
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
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: { storePath: verified.value.evidence.storePath },
  });
};

/**
 * Read one delivery's verified capture-outcome records (PIN-12).
 *
 * Presence-tolerant and additive beside the per-run read: the store is verified
 * once, then every record whose key sits under the ref-scoped capture prefix is
 * parsed. A wrong record kind or a malformed payload under the prefix is the
 * delivered `state.store.torn` identity naming the path and sequence; an absent
 * family is an empty list with the verified-empty evidence. Nothing is written
 * and no fence is acquired.
 */
export const readHarnessCaptureOutcomes = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<{
  readonly records: readonly HarnessCaptureOutcomeRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
}> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const prefix = `${HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX}${workItemRef}:`;
  const records: HarnessCaptureOutcomeRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (!ledgerRecord.key.startsWith(prefix)) continue;
    if (ledgerRecord.kind !== HARNESS_TELEMETRY_RECORD_KIND) {
      return torn({ path: verified.value.evidence.storePath, record: ledgerRecord.sequence });
    }
    const parsed = recordFromCapture(ledgerRecord.payload, {
      path: verified.value.evidence.storePath,
      record: ledgerRecord.sequence,
    });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok({
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: { storePath: verified.value.evidence.storePath },
  });
};

/** Read one delivery run's verified capture outcome. */
export const readHarnessCaptureOutcome = (
  store: StateStorePort,
  workItemRef: string,
  runId: string,
): StateResult<HarnessCaptureOutcomeRecord | undefined> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = harnessTelemetryCaptureKey(workItemRef, runId);
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== key) continue;
    if (ledgerRecord.kind !== HARNESS_TELEMETRY_RECORD_KIND) {
      return torn({ path: verified.value.evidence.storePath, record: ledgerRecord.sequence });
    }
    return recordFromCapture(ledgerRecord.payload, {
      path: verified.value.evidence.storePath,
      record: ledgerRecord.sequence,
    });
  }
  return ok(undefined);
};

const recordFromCapture = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<HarnessCaptureOutcomeRecord> => captureFrom(value, location);

/**
 * Validate one `harness.telemetry` session payload (single authored copy).
 *
 * Exposed so a composed read over several telemetry families validates every
 * record through the same rules the delivered session reader uses.
 */
export const parseHarnessTelemetryPayload = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<HarnessTelemetryRecord> => recordFrom(value, location);

/** Validate one capture-outcome payload through the delivered rules. */
export const parseHarnessCaptureOutcomePayload = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<HarnessCaptureOutcomeRecord> => recordFromCapture(value, location);

const capturePayload = (record: HarnessCaptureOutcomeRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  workItemRef: record.workItemRef,
  runId: record.runId,
  captured: record.captured,
  degraded: record.degraded,
  failed: record.failed,
  warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
  capturedAt: record.capturedAt,
});

/** Append one session record through a freshly acquired fence; idempotent. */
export const appendHarnessTelemetry = (
  store: StateStorePort,
  fenceToken: string,
  record: HarnessTelemetryRecord,
): StateResult<{
  readonly record: HarnessTelemetryRecord;
  readonly report: HarnessTelemetryAppendReport;
  readonly append?: StateAppendOutcome;
}> => {
  const existing = readHarnessTelemetry(store, record.workItemRef);
  if (!existing.ok) return existing;
  if (existing.value.records.some((candidate) => sameSessionGroup(candidate, record))) {
    return ok({ record, report: { appended: 0, skipped: 1 } });
  }
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: HARNESS_TELEMETRY_RECORD_KIND,
    recordKey: harnessTelemetryRecordKey(record.workItemRef),
    payload: payloadFor(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  const verified = readHarnessTelemetry(store, record.workItemRef);
  if (!verified.ok) return verified;
  if (!verified.value.records.some((candidate) => sameSessionGroup(candidate, record))) {
    return torn({ path: appended.value.path, record: appended.value.sequence });
  }
  return ok({ record, report: { appended: 1, skipped: 0 }, append: appended.value });
};

/** Append the capture outcome through a freshly acquired fence; idempotent by run. */
export const appendHarnessCaptureOutcome = (
  store: StateStorePort,
  fenceToken: string,
  record: HarnessCaptureOutcomeRecord,
): StateResult<StateAppendOutcome> => {
  const existing = readHarnessCaptureOutcome(store, record.workItemRef, record.runId);
  if (!existing.ok) return existing;
  if (existing.value !== undefined) {
    return ok({ sequence: 0, checksum: "", path: "idempotent" });
  }
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: HARNESS_TELEMETRY_RECORD_KIND,
    recordKey: harnessTelemetryCaptureKey(record.workItemRef, record.runId),
    payload: capturePayload(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  const verified = readHarnessCaptureOutcome(store, record.workItemRef, record.runId);
  if (!verified.ok) return verified;
  if (verified.value === undefined) {
    return torn({ path: appended.value.path, record: appended.value.sequence });
  }
  return appended;
};
