/**
 * The schema-versioned telemetry storage over the injected state port
 * (GH-291 F-4, AC-F4-1, DM-1, DM-5, NFR-8; OQ-T2 §1).
 *
 * Additive inside `delivery.state.v1`: one fenced, verified append per captured
 * step under the delivery's step key, and one per attributed harness session
 * under the delivery's baseline key. Every read is a verified read; a malformed
 * payload, an unknown payload schema, or a wrong record kind under either key
 * is the delivered `state.store.torn` identity naming the path and sequence —
 * damage never renders as a partial truth, and absence never borrows a damage
 * identity.
 *
 * The storage version is the declared `delivery.telemetry.storage.v1`. A bump
 * migrates by re-reading: the versioned payload is the source, a reader at a
 * later version re-derives the record from it, and stored bytes are never
 * mutated in place (no record is dropped or reinterpreted).
 */
import {
  HARNESS_KINDS,
  HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX,
  HARNESS_TELEMETRY_RECORD_KEY_PREFIX,
  HARNESS_TELEMETRY_RECORD_KIND,
  HARNESS_TOKEN_CLASSES,
  HARNESS_WARNING_REASONS,
  type HarnessCaptureOutcomeRecord,
  type HarnessKind,
  type HarnessTelemetryRecord,
  type HarnessTelemetryWarning,
  type HarnessTokenCounts,
  type StateAppendOutcome,
  type StateJsonValue,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
  TELEMETRY_BASELINE_KEY_PREFIX,
  TELEMETRY_BASELINE_RECORD_KIND,
  TELEMETRY_BASELINE_SCHEMA_ID,
  TELEMETRY_CAPTURE_KEY_PREFIX,
  TELEMETRY_CAPTURE_RECORD_KIND,
  TELEMETRY_CAPTURE_SCHEMA_ID,
  TELEMETRY_STEP_KEY_PREFIX,
  TELEMETRY_STEP_RECORD_KIND,
  TELEMETRY_STEP_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  TELEMETRY_WARNING_REASONS,
  type TelemetryBaselineRecord,
  type TelemetryIngestCaptureRecord,
  type TelemetryIngestCounts,
  type TelemetryStepRecord,
  type TelemetryStepTokens,
  type TelemetryWarning,
  type TelemetryWarningReason,
} from "#contracts";
import {
  parseHarnessCaptureOutcomePayload,
  parseHarnessTelemetryPayload,
} from "./harness-telemetry.js";

/**
 * The declared migration target proving the re-read rule (DM-5, GAP-7).
 *
 * No stored record carries it yet; the version-(N+1) reader re-derives every
 * record from its versioned payload, which is the migration contract itself.
 */
export const TELEMETRY_STORAGE_NEXT_VERSION = "delivery.telemetry.storage.v2" as const;

/** Every storage version a reader accepts. */
export const TELEMETRY_STORAGE_READ_VERSIONS = [
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  TELEMETRY_STORAGE_NEXT_VERSION,
] as const;

export type TelemetryStorageReadVersion = (typeof TELEMETRY_STORAGE_READ_VERSIONS)[number];

/** One step record as a reader at a declared version derives it. */
export type TelemetryStepRecordAtVersion = Omit<TelemetryStepRecord, "storageVersion"> & {
  readonly storageVersion: TelemetryStorageReadVersion;
};

/** The store-scoped key carrying one delivery's captured step records. */
export const telemetryStepKey = (workItemRef: string): string =>
  `${TELEMETRY_STEP_KEY_PREFIX}${workItemRef}`;

/** The store-scoped key carrying one delivery's session baseline records. */
export const telemetryBaselineKey = (workItemRef: string): string =>
  `${TELEMETRY_BASELINE_KEY_PREFIX}${workItemRef}`;

/** The store-scoped key carrying one delivery's ingest-accounting records (§10). */
export const telemetryCaptureKey = (workItemRef: string): string =>
  `${TELEMETRY_CAPTURE_KEY_PREFIX}${workItemRef}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isNumber(value);

/** A reported token class is a whole count; a fractional value is malformed. */
const isCountOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);

const isCallsOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const torn = (location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code: "state.store.torn", consequence: "not_landed", location },
});

const warningsFrom = (value: unknown): readonly TelemetryWarning[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const warnings: TelemetryWarning[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    if (typeof entry.field !== "string") return undefined;
    const reason = TELEMETRY_WARNING_REASONS.find((candidate) => candidate === entry.reason);
    if (reason === undefined) return undefined;
    warnings.push({ reason, field: entry.field });
  }
  return warnings;
};

const harnessWarningsFrom = (value: unknown): readonly HarnessTelemetryWarning[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const warnings: HarnessTelemetryWarning[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    if (typeof entry.field !== "string") return undefined;
    const reason = HARNESS_WARNING_REASONS.find((candidate) => candidate === entry.reason);
    if (reason === undefined) return undefined;
    warnings.push({ reason, field: entry.field });
  }
  return warnings;
};

/** Validate the shared five-class token shape: every class present, number|null. */
const hasTokenShape = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  return HARNESS_TOKEN_CLASSES.every(
    (tokenClass) => Object.hasOwn(value, tokenClass) && isCountOrNull(value[tokenClass]),
  );
};

const tokenNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);

/** The five validated classes, built explicitly (no cast, no fabricated zero). */
const tokensOf = (value: Record<string, unknown>): TelemetryStepTokens => ({
  input: tokenNumber(value.input),
  output: tokenNumber(value.output),
  reasoning: tokenNumber(value.reasoning),
  cacheRead: tokenNumber(value.cacheRead),
  cacheWrite: tokenNumber(value.cacheWrite),
});

/** The narrow harness kind a validated membership check proves. */
const harnessKindOf = (value: unknown): HarnessKind | undefined =>
  HARNESS_KINDS.find((candidate) => candidate === value);

const stepPayload = (record: TelemetryStepRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  storageVersion: record.storageVersion,
  workItemRef: record.workItemRef,
  runId: record.runId,
  sessionId: record.sessionId,
  harnessKind: record.harnessKind,
  harnessVersion: record.harnessVersion,
  treeRoot: record.treeRoot,
  model: record.model,
  ticket: record.ticket,
  repository: record.repository,
  lane: record.lane,
  agentRole: record.agentRole,
  tokens: {
    input: record.tokens.input,
    output: record.tokens.output,
    reasoning: record.tokens.reasoning,
    cacheRead: record.tokens.cacheRead,
    cacheWrite: record.tokens.cacheWrite,
  },
  calls: record.calls,
  cost: record.cost,
  startedAt: record.startedAt,
  finishedAt: record.finishedAt,
  warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
  capturedAt: record.capturedAt,
});

const stepFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<TelemetryStepRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== TELEMETRY_STEP_SCHEMA_ID) return torn(location);
  if (
    !(TELEMETRY_STORAGE_READ_VERSIONS as readonly string[]).includes(String(value.storageVersion))
  ) {
    return torn(location);
  }
  if (!isNonEmptyString(value.workItemRef) || !isNonEmptyString(value.runId)) return torn(location);
  if (!isNonEmptyString(value.sessionId)) return torn(location);
  const harnessKind = harnessKindOf(value.harnessKind);
  if (harnessKind === undefined) return torn(location);
  if (!isNullableString(value.harnessVersion)) return torn(location);
  if (!isNullableString(value.treeRoot)) return torn(location);
  if (!isNullableString(value.model)) return torn(location);
  if (!isNullableString(value.ticket)) return torn(location);
  if (!isNullableString(value.repository)) return torn(location);
  if (!isNullableString(value.lane)) return torn(location);
  if (!isNullableString(value.agentRole)) return torn(location);
  if (!hasTokenShape(value.tokens)) return torn(location);
  if (!isCallsOrNull(value.calls)) return torn(location);
  if (!isNumberOrNull(value.cost)) return torn(location);
  if (!isNullableString(value.startedAt) || !isNullableString(value.finishedAt)) {
    return torn(location);
  }
  const warnings = warningsFrom(value.warnings);
  if (warnings === undefined) return torn(location);
  if (!isNonEmptyString(value.capturedAt)) return torn(location);
  return ok({
    schemaId: TELEMETRY_STEP_SCHEMA_ID,
    storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
    workItemRef: value.workItemRef,
    runId: value.runId,
    sessionId: value.sessionId,
    harnessKind,
    harnessVersion: value.harnessVersion,
    treeRoot: value.treeRoot,
    model: value.model,
    ticket: value.ticket,
    repository: value.repository,
    lane: value.lane,
    agentRole: value.agentRole,
    tokens: tokensOf(value.tokens),
    calls: value.calls,
    cost: value.cost,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    warnings,
    capturedAt: value.capturedAt,
  });
};

const baselinePayload = (record: TelemetryBaselineRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  storageVersion: record.storageVersion,
  workItemRef: record.workItemRef,
  runId: record.runId,
  sessionId: record.sessionId,
  tokens: {
    input: record.tokens.input,
    output: record.tokens.output,
    reasoning: record.tokens.reasoning,
    cacheRead: record.tokens.cacheRead,
    cacheWrite: record.tokens.cacheWrite,
  },
  calls: record.calls,
  cost: record.cost,
  capturedAt: record.capturedAt,
  warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
});

const baselineFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<TelemetryBaselineRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== TELEMETRY_BASELINE_SCHEMA_ID) return torn(location);
  if (
    !(TELEMETRY_STORAGE_READ_VERSIONS as readonly string[]).includes(String(value.storageVersion))
  ) {
    return torn(location);
  }
  if (!isNonEmptyString(value.workItemRef) || !isNonEmptyString(value.runId)) return torn(location);
  if (!isNonEmptyString(value.sessionId)) return torn(location);
  if (!hasTokenShape(value.tokens)) return torn(location);
  if (!isCallsOrNull(value.calls)) return torn(location);
  if (!isNumberOrNull(value.cost)) return torn(location);
  if (!isNonEmptyString(value.capturedAt)) return torn(location);
  const warnings = harnessWarningsFrom(value.warnings);
  if (warnings === undefined) return torn(location);
  return ok({
    schemaId: TELEMETRY_BASELINE_SCHEMA_ID,
    storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
    workItemRef: value.workItemRef,
    runId: value.runId,
    sessionId: value.sessionId,
    tokens: tokensOf(value.tokens),
    calls: value.calls,
    cost: value.cost,
    capturedAt: value.capturedAt,
    warnings,
  });
};

/** A whole non-negative count; a fractional or negative count is malformed. */
const isWholeCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Validate the three disclosed counts. */
const countsFrom = (value: unknown): TelemetryIngestCounts | undefined => {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 3) return undefined;
  for (const key of ["captured", "degraded", "failed"] as const) {
    if (!Object.hasOwn(value, key) || !isWholeCount(value[key])) return undefined;
  }
  return {
    captured: value.captured as number,
    degraded: value.degraded as number,
    failed: value.failed as number,
  };
};

/** Validate the per-reason counts: exactly the closed vocabulary, nothing else. */
const byReasonFrom = (
  value: unknown,
): Readonly<Record<TelemetryWarningReason, number>> | undefined => {
  if (!isRecord(value)) return undefined;
  if (Object.keys(value).length !== TELEMETRY_WARNING_REASONS.length) return undefined;
  const counts: Record<string, number> = {};
  for (const reason of TELEMETRY_WARNING_REASONS) {
    const count = value[reason];
    if (!isWholeCount(count)) return undefined;
    counts[reason] = count;
  }
  return counts as Readonly<Record<TelemetryWarningReason, number>>;
};

const capturePayload = (record: TelemetryIngestCaptureRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  storageVersion: record.storageVersion,
  workItemRef: record.workItemRef,
  runId: record.runId,
  sessionId: record.sessionId,
  counts: {
    captured: record.counts.captured,
    degraded: record.counts.degraded,
    failed: record.counts.failed,
  },
  byReason: Object.fromEntries(
    TELEMETRY_WARNING_REASONS.map((reason) => [reason, record.byReason[reason] ?? 0]),
  ),
  capturedAt: record.capturedAt,
});

const captureFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<TelemetryIngestCaptureRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== TELEMETRY_CAPTURE_SCHEMA_ID) return torn(location);
  if (
    !(TELEMETRY_STORAGE_READ_VERSIONS as readonly string[]).includes(String(value.storageVersion))
  ) {
    return torn(location);
  }
  if (!isNonEmptyString(value.workItemRef) || !isNonEmptyString(value.runId)) return torn(location);
  if (!isNonEmptyString(value.sessionId)) return torn(location);
  const counts = countsFrom(value.counts);
  if (counts === undefined) return torn(location);
  const byReason = byReasonFrom(value.byReason);
  if (byReason === undefined) return torn(location);
  if (!isNonEmptyString(value.capturedAt)) return torn(location);
  return ok({
    schemaId: TELEMETRY_CAPTURE_SCHEMA_ID,
    storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
    workItemRef: value.workItemRef,
    runId: value.runId,
    sessionId: value.sessionId,
    counts,
    byReason,
    capturedAt: value.capturedAt,
  });
};

/** Read one delivery's verified step records under the exact step key. */
export const readTelemetrySteps = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<{
  readonly records: readonly TelemetryStepRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
}> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = telemetryStepKey(workItemRef);
  const path = verified.value.evidence.storePath;
  const records: TelemetryStepRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.kind !== TELEMETRY_STEP_RECORD_KIND) {
      // An unknown kind under a telemetry key is damage, never silently skipped.
      if (ledgerRecord.key.startsWith(TELEMETRY_STEP_KEY_PREFIX)) {
        return torn({ path, record: ledgerRecord.sequence });
      }
      continue;
    }
    if (ledgerRecord.key !== key) {
      if (ledgerRecord.key.startsWith(TELEMETRY_STEP_KEY_PREFIX)) {
        return torn({ path, record: ledgerRecord.sequence });
      }
      continue;
    }
    const parsed = stepFrom(ledgerRecord.payload, { path, record: ledgerRecord.sequence });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok({
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: { storePath: path },
  });
};

/** Read one delivery's verified baseline records under the exact baseline key. */
export const readTelemetryBaselines = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<{
  readonly records: readonly TelemetryBaselineRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
}> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = telemetryBaselineKey(workItemRef);
  const path = verified.value.evidence.storePath;
  const records: TelemetryBaselineRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== key) {
      if (ledgerRecord.key.startsWith(TELEMETRY_BASELINE_KEY_PREFIX)) {
        return torn({ path, record: ledgerRecord.sequence });
      }
      continue;
    }
    if (ledgerRecord.kind !== TELEMETRY_BASELINE_RECORD_KIND) {
      return torn({ path, record: ledgerRecord.sequence });
    }
    const parsed = baselineFrom(ledgerRecord.payload, { path, record: ledgerRecord.sequence });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok({
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: { storePath: path },
  });
};

/**
 * Re-derive one step record at a declared storage version (the re-read rule).
 *
 * The record arrives from its versioned payload; the reader at version N+1
 * returns the same figures under the new declared version. Nothing is mutated
 * in the store, and no field is dropped or reinterpreted.
 */
export const telemetryStepAtVersion = (
  record: TelemetryStepRecord,
  version: TelemetryStorageReadVersion,
): TelemetryStepRecordAtVersion => ({ ...record, storageVersion: version });

/** Read one delivery's step records as a reader at a declared version sees them. */
export const readTelemetryStepsAtVersion = (
  store: StateStorePort,
  workItemRef: string,
  version: TelemetryStorageReadVersion,
): StateResult<{
  readonly records: readonly TelemetryStepRecordAtVersion[];
  readonly evidence: { readonly storePath: string };
}> => {
  const read = readTelemetrySteps(store, workItemRef);
  if (!read.ok) return read;
  return ok({
    records: read.value.records.map((record) => telemetryStepAtVersion(record, version)),
    evidence: read.value.evidence,
  });
};

/**
 * Append one step record through a freshly acquired fence.
 *
 * Every decoded step is one observation: two frames reporting the same figures
 * are two steps, so no positional dedupe is attempted. The delivered append is
 * itself the verified write (fenced, framed, checksummed, fsynced); no
 * whole-ledger re-read is performed per step, so ingest work stays bounded and
 * constant-memory on a long session (NFR-5, NFR-8).
 */
export const appendTelemetryStep = (
  store: StateStorePort,
  fenceToken: string,
  record: TelemetryStepRecord,
): StateResult<{ readonly appended: boolean; readonly append?: StateAppendOutcome }> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: TELEMETRY_STEP_RECORD_KIND,
    recordKey: telemetryStepKey(record.workItemRef),
    payload: stepPayload(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  return ok({ appended: true, append: appended.value });
};

/** Append one session baseline record; idempotent by (run, session). */
export const appendTelemetryBaseline = (
  store: StateStorePort,
  fenceToken: string,
  record: TelemetryBaselineRecord,
): StateResult<{ readonly appended: boolean; readonly append?: StateAppendOutcome }> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  // The idempotency read runs inside the fence: two concurrent captures of one
  // (run, session) can no longer both observe absence and both append.
  const existing = readTelemetryBaselines(store, record.workItemRef);
  if (!existing.ok) {
    const released = store.releaseFence(handle);
    return released.ok ? existing : released;
  }
  if (
    existing.value.records.some(
      (candidate) => candidate.runId === record.runId && candidate.sessionId === record.sessionId,
    )
  ) {
    const released = store.releaseFence(handle);
    return released.ok ? ok({ appended: false }) : released;
  }
  const appended = store.append(handle, {
    kind: TELEMETRY_BASELINE_RECORD_KIND,
    recordKey: telemetryBaselineKey(record.workItemRef),
    payload: baselinePayload(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  const verified = readTelemetryBaselines(store, record.workItemRef);
  if (!verified.ok) return verified;
  if (
    !verified.value.records.some(
      (candidate) => candidate.runId === record.runId && candidate.sessionId === record.sessionId,
    )
  ) {
    return torn({ path: appended.value.path, record: appended.value.sequence });
  }
  return ok({ appended: true, append: appended.value });
};

/**
 * Append one session's ingest accounting record (§10).
 *
 * One fenced, verified append per session close under the delivery's capture
 * key: a degradation that never produced a step record (a drift frame, an
 * undecodable frame, a failed storage append) still leaves a counted trace.
 * The write is additive beside the step and baseline families and uses the same
 * delivered append path.
 */
export const appendTelemetryCaptureOutcome = (
  store: StateStorePort,
  fenceToken: string,
  record: TelemetryIngestCaptureRecord,
): StateResult<{ readonly appended: boolean; readonly append?: StateAppendOutcome }> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: TELEMETRY_CAPTURE_RECORD_KIND,
    recordKey: telemetryCaptureKey(record.workItemRef),
    payload: capturePayload(record),
  });
  const released = store.releaseFence(handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  return ok({ appended: true, append: appended.value });
};

/** Read one delivery's verified ingest-accounting records under the exact key. */
export const readTelemetryCaptureOutcomes = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<{
  readonly records: readonly TelemetryIngestCaptureRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
}> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const key = telemetryCaptureKey(workItemRef);
  const path = verified.value.evidence.storePath;
  const records: TelemetryIngestCaptureRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (ledgerRecord.key !== key) {
      if (ledgerRecord.key.startsWith(TELEMETRY_CAPTURE_KEY_PREFIX)) {
        return torn({ path, record: ledgerRecord.sequence });
      }
      continue;
    }
    if (ledgerRecord.kind !== TELEMETRY_CAPTURE_RECORD_KIND) {
      return torn({ path, record: ledgerRecord.sequence });
    }
    const parsed = captureFrom(ledgerRecord.payload, { path, record: ledgerRecord.sequence });
    if (!parsed.ok) return parsed;
    records.push(parsed.value);
  }
  return ok({
    records,
    verifiedEmpty: verified.value.evidence.verifiedEmpty,
    evidence: { storePath: path },
  });
};

/** The per-session totals read the adapter supplies at stream close (OQ-T2 §1). */
export type TelemetrySessionTotalsRead = {
  readonly tokens: HarnessTokenCounts;
  readonly calls: number | null;
  readonly cost: number | null;
};

/**
 * Capture one attributed session's harness-reported totals at stream close.
 *
 * Exactly one bounded read through the injected read-only seam; a successful
 * read lands one baseline record. An unavailable read lands nothing and
 * fabricates nothing — the session then appears in a report as an excluded
 * baseline session with its named count (DEC-5).
 */
export const captureTelemetryBaseline = (input: {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly capturedAt: string;
  readonly readTotals: (sessionId: string) => TelemetrySessionTotalsRead | undefined;
}): StateResult<{ readonly captured: boolean; readonly record?: TelemetryBaselineRecord }> => {
  const totals = input.readTotals(input.sessionId);
  if (totals === undefined) return ok({ captured: false });
  const record: TelemetryBaselineRecord = {
    schemaId: TELEMETRY_BASELINE_SCHEMA_ID,
    storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
    workItemRef: input.workItemRef,
    runId: input.runId,
    sessionId: input.sessionId,
    tokens: {
      input: totals.tokens.input,
      output: totals.tokens.output,
      reasoning: totals.tokens.reasoning,
      cacheRead: totals.tokens.cacheRead,
      cacheWrite: totals.tokens.cacheWrite,
    },
    calls: totals.calls,
    cost: totals.cost,
    capturedAt: input.capturedAt,
    warnings: [],
  };
  const appended = appendTelemetryBaseline(input.store, input.fenceToken, record);
  if (!appended.ok) return appended;
  return ok({ captured: true, record });
};

/**
 * The four telemetry record families one spend read composes (PIN-12, NFR-4).
 *
 * A single verified read over the injected state port yields the v2 step and
 * baseline families beside the delivered v1 session and capture-outcome
 * families. One read per family is the bound; composing them in one pass keeps
 * the fold's read work constant regardless of record population.
 */
export type TelemetryFamiliesRead = {
  readonly steps: readonly TelemetryStepRecord[];
  readonly baselines: readonly TelemetryBaselineRecord[];
  readonly records: readonly HarnessTelemetryRecord[];
  readonly outcomes: readonly HarnessCaptureOutcomeRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string; readonly recordCount: number };
};

/** Read every telemetry family for one exact ref in one verified pass. */
export const readTelemetryFamilies = (
  store: StateStorePort,
  workItemRef: string,
): StateResult<TelemetryFamiliesRead> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const path = verified.value.evidence.storePath;
  const stepKey = telemetryStepKey(workItemRef);
  const baselineKey = telemetryBaselineKey(workItemRef);
  const recordKey = `${HARNESS_TELEMETRY_RECORD_KEY_PREFIX}${workItemRef}`;
  const capturePrefix = `${HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX}${workItemRef}:`;
  const steps: TelemetryStepRecord[] = [];
  const baselines: TelemetryBaselineRecord[] = [];
  const records: HarnessTelemetryRecord[] = [];
  const outcomes: HarnessCaptureOutcomeRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    const location = { path, record: ledgerRecord.sequence };
    if (ledgerRecord.key.startsWith(TELEMETRY_STEP_KEY_PREFIX)) {
      if (ledgerRecord.key !== stepKey || ledgerRecord.kind !== TELEMETRY_STEP_RECORD_KIND) {
        return torn(location);
      }
      const parsed = stepFrom(ledgerRecord.payload, location);
      if (!parsed.ok) return parsed;
      steps.push(parsed.value);
      continue;
    }
    if (ledgerRecord.key.startsWith(TELEMETRY_BASELINE_KEY_PREFIX)) {
      if (
        ledgerRecord.key !== baselineKey ||
        ledgerRecord.kind !== TELEMETRY_BASELINE_RECORD_KIND
      ) {
        return torn(location);
      }
      const parsed = baselineFrom(ledgerRecord.payload, location);
      if (!parsed.ok) return parsed;
      baselines.push(parsed.value);
      continue;
    }
    if (ledgerRecord.key === recordKey) {
      if (ledgerRecord.kind !== HARNESS_TELEMETRY_RECORD_KIND) return torn(location);
      const parsed = parseHarnessTelemetryPayload(ledgerRecord.payload, location);
      if (!parsed.ok) return parsed;
      records.push(parsed.value);
      continue;
    }
    if (ledgerRecord.key.startsWith(capturePrefix)) {
      if (ledgerRecord.kind !== HARNESS_TELEMETRY_RECORD_KIND) return torn(location);
      const parsed = parseHarnessCaptureOutcomePayload(ledgerRecord.payload, location);
      if (!parsed.ok) return parsed;
      outcomes.push(parsed.value);
    }
  }
  return ok({
    steps,
    baselines,
    records,
    outcomes,
    verifiedEmpty:
      steps.length === 0 && baselines.length === 0 && records.length === 0 && outcomes.length === 0,
    evidence: { storePath: path, recordCount: verified.value.records.length },
  });
};
