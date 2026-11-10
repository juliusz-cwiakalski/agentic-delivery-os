/**
 * The durable dispatch evidence ledger (GH-239 F-4; EVT-1..EVT-3; DM-1..DM-4).
 *
 * Additive inside `delivery.state.v1`: one fenced append plus a verified
 * post-append read per attempt, divergence, and handover record; latest-per-key
 * and latest-per-identity folds; the derived authority view is replaced
 * atomically from the folded handover ledger. Identical replays append nothing.
 */
import {
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_ATTEMPT_RECORD_KIND,
  DISPATCH_ATTEMPT_KEY_PREFIX,
  DISPATCH_AUTHORITY_DOCUMENT_NAME,
  DISPATCH_DIVERGENCE_KEY_PREFIX,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_DIVERGENCE_RECORD_KIND,
  DISPATCH_EVIDENCE_CLASSES,
  DISPATCH_HANDOVER_KEY_PREFIX,
  DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  DISPATCH_HANDOVER_RECORD_KIND,
  DISPATCH_MAX_ATTEMPT_RECORDS,
  DISPATCH_MAX_DIVERGENCE_IDS,
  DISPATCH_MAX_EVIDENCE_REFS,
  DISPATCH_MAX_NOTE_CHARS,
  type DispatchAttemptRecord,
  type DispatchAuthorityView,
  type DispatchDivergenceRecord,
  type DispatchHandoverRecord,
  type StateAppendOutcome,
  type StateFailureCode,
  type StateJsonValue,
  type StateReadEvidence,
  type StateStorePort,
  dispatchAttemptRecordKey,
  dispatchDivergenceRecordKey,
  dispatchHandoverRecordKey,
} from "#contracts";

/** One verified ledger read, with any declared truncation. */
export type DispatchLedgerRead<T> =
  | {
      readonly ok: true;
      readonly records: readonly T[];
      readonly verifiedEmpty: boolean;
      readonly truncation?: { readonly bound: number; readonly omittedRecords: number };
      readonly evidence: StateReadEvidence;
    }
  | { readonly ok: false; readonly code: StateFailureCode; readonly path: string };

/** One append outcome: landed, an identical noop, or a classified refusal. */
export type DispatchAppendResult<T> =
  | { readonly ok: true; readonly appended: boolean; readonly record: T }
  | { readonly ok: false; readonly code: string; readonly path: string };

type RecordSpec<T> = {
  readonly kind: string;
  readonly schema: string;
  readonly keyPrefix: string;
  readonly isRecord: (value: unknown) => value is T;
  readonly max: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInstant = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isBoundedRefs = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= DISPATCH_MAX_EVIDENCE_REFS &&
  value.every((entry) => typeof entry === "string");

const isComparison = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const cls = value.class;
  const outcome = value.outcome;
  const nullToken = value.token === null;
  if (cls !== "verify-change" && cls !== "tracker-truth" && cls !== "not-applicable") return false;
  if (outcome !== "match" && outcome !== "mismatch" && outcome !== "not-applicable") return false;
  const notApplicableClass = cls === "not-applicable";
  const notApplicableOutcome = outcome === "not-applicable";
  return nullToken === notApplicableClass && notApplicableOutcome === notApplicableClass;
};

const isCorroboration = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const state = (entry: unknown): boolean =>
    entry === "satisfied" || entry === "unsatisfied" || entry === "not-applicable";
  return state(value.pmNotes) && state(value.tracker) && state(value.ci);
};

/** The closed evidence-class guard (AC-F4-5). */
export const isEvidenceClass = (value: unknown): boolean =>
  typeof value === "string" && (DISPATCH_EVIDENCE_CLASSES as readonly string[]).includes(value);

const isAttemptRecord = (value: unknown): value is DispatchAttemptRecord =>
  isRecord(value) &&
  value.schema === DISPATCH_ATTEMPT_PAYLOAD_SCHEMA &&
  typeof value.attemptId === "string" &&
  typeof value.repository === "string" &&
  typeof value.ref === "string" &&
  typeof value.harness === "string" &&
  isEvidenceClass(value.evidenceClass) &&
  isInstant(value.startedAt) &&
  isInstant(value.finishedAt) &&
  (value.handoverState === "dual-run" || value.handoverState === "authoritative") &&
  typeof value.outcome === "string" &&
  typeof value.token === "string" &&
  isComparison(value.comparison) &&
  typeof value.falseSuccess === "boolean" &&
  isCorroboration(value.corroboration) &&
  isBoundedRefs(value.evidenceRefs) &&
  isInstant(value.recordedAt);

const isDivergenceRecord = (value: unknown): value is DispatchDivergenceRecord =>
  isRecord(value) &&
  value.schema === DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA &&
  typeof value.divergenceId === "string" &&
  typeof value.repository === "string" &&
  typeof value.ref === "string" &&
  typeof value.attemptId === "string" &&
  (value.state === "open" || value.state === "resolved") &&
  typeof value.engineToken === "string" &&
  isInstant(value.recordedAt) &&
  isBoundedRefs(value.evidenceRefs) &&
  (value.note === undefined ||
    (typeof value.note === "string" && value.note.length <= DISPATCH_MAX_NOTE_CHARS));

const isHandoverRecord = (value: unknown): value is DispatchHandoverRecord =>
  isRecord(value) &&
  value.schema === DISPATCH_HANDOVER_PAYLOAD_SCHEMA &&
  typeof value.repository === "string" &&
  (value.operation === "authoritative" || value.operation === "dual-run") &&
  isRecord(value.conditions) &&
  typeof value.principal === "string" &&
  isInstant(value.recordedAt) &&
  isBoundedRefs(value.evidenceRefs);

const readLedger = <T>(store: StateStorePort, spec: RecordSpec<T>): DispatchLedgerRead<T> => {
  const read = store.readRecords();
  if (!read.ok) return { ok: false, code: read.error.code, path: read.error.location.path };
  const records: T[] = [];
  for (const ledgerRecord of read.value.records) {
    if (!ledgerRecord.key.startsWith(spec.keyPrefix)) continue;
    if (ledgerRecord.kind !== spec.kind || !spec.isRecord(ledgerRecord.payload)) {
      return { ok: false, code: "state.store.torn", path: read.value.evidence.storePath };
    }
    records.push(ledgerRecord.payload);
  }
  const overflow = Math.max(0, records.length - spec.max);
  const bounded = overflow === 0 ? records : records.slice(records.length - spec.max);
  return {
    ok: true,
    records: bounded,
    verifiedEmpty: bounded.length === 0,
    ...(overflow === 0 ? {} : { truncation: { bound: spec.max, omittedRecords: overflow } }),
    evidence: read.value.evidence,
  };
};

const appendLedger = <T>(
  store: StateStorePort,
  fenceToken: string,
  kind: string,
  recordKey: string,
  payload: T,
  immutable: boolean,
): DispatchAppendResult<T> => {
  const before = store.readRecords();
  if (!before.ok) return { ok: false, code: before.error.code, path: before.error.location.path };
  const previous = [...before.value.records]
    .reverse()
    .find((entry) => entry.key === recordKey && entry.kind === kind);
  if (previous !== undefined) {
    if (JSON.stringify(previous.payload) === JSON.stringify(payload)) {
      return { ok: true, appended: false, record: payload };
    }
    // Immutability: a second different append for one identity is refused and
    // the original record stays byte-identical. Append-only folds (divergence
    // open -> resolved, handover flip -> reversal) pass `immutable: false`.
    if (immutable) return { ok: false, code: "state.write.failed", path: recordKey };
  }
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok)
    return { ok: false, code: acquired.error.code, path: acquired.error.location.path };
  let appended: StateAppendOutcome | undefined;
  let appendCode: string | undefined;
  try {
    const result = store.append(acquired.value.handle, {
      kind,
      recordKey,
      payload: payload as StateJsonValue,
    });
    if (result.ok) appended = result.value;
    else appendCode = result.error.code;
  } catch {
    appendCode = "state.write.failed";
  } finally {
    const released = store.releaseFence(acquired.value.handle);
    if (appendCode === undefined && !released.ok) appendCode = released.error.code;
  }
  if (appended === undefined) {
    return { ok: false, code: appendCode ?? "state.write.failed", path: recordKey };
  }
  const after = store.readRecords();
  if (!after.ok) return { ok: false, code: after.error.code, path: after.error.location.path };
  const found = after.value.records.some(
    (entry) =>
      entry.kind === kind &&
      entry.key === recordKey &&
      JSON.stringify(entry.payload) === JSON.stringify(payload),
  );
  if (!found) return { ok: false, code: "state.write.failed", path: appended.path };
  return { ok: true, appended: true, record: payload };
};

/** Read the attempt evidence, bounded and with declared truncation. */
export const readDispatchAttempts = (
  store: StateStorePort,
  options: { readonly max?: number } = {},
): DispatchLedgerRead<DispatchAttemptRecord> =>
  readLedger(store, {
    kind: DISPATCH_ATTEMPT_RECORD_KIND,
    schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
    keyPrefix: DISPATCH_ATTEMPT_KEY_PREFIX,
    isRecord: isAttemptRecord,
    max: options.max ?? DISPATCH_MAX_ATTEMPT_RECORDS,
  });

/**
 * The app-local distinguishable not-found sentinel for a resolve target.
 *
 * It is not an error-table identity: the resolve surface maps it to
 * `input.value.rejected`, while a genuine store key-set failure keeps
 * `state.keys.missing`.
 */
export const DISPATCH_DIVERGENCE_NOT_FOUND = "divergence-not-found" as const;

/** Append exactly one attempt record; a differing replay is refused. */
export const appendDispatchAttempt = (
  store: StateStorePort,
  fenceToken: string,
  record: DispatchAttemptRecord,
): DispatchAppendResult<DispatchAttemptRecord> => {
  const recordKey = dispatchAttemptRecordKey(record.attemptId);
  if (!isEvidenceClass(record.evidenceClass) || !isAttemptRecord(record)) {
    return { ok: false, code: "state.write.failed", path: recordKey };
  }
  return appendLedger(store, fenceToken, DISPATCH_ATTEMPT_RECORD_KIND, recordKey, record, true);
};

/** Read every divergence record in append order. */
export const readDispatchDivergences = (
  store: StateStorePort,
): DispatchLedgerRead<DispatchDivergenceRecord> =>
  readLedger(store, {
    kind: DISPATCH_DIVERGENCE_RECORD_KIND,
    schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
    keyPrefix: DISPATCH_DIVERGENCE_KEY_PREFIX,
    isRecord: isDivergenceRecord,
    max: DISPATCH_MAX_ATTEMPT_RECORDS,
  });

/** Fold divergences to the latest state per identifier, preserving history. */
export const foldDispatchDivergences = (
  records: readonly DispatchDivergenceRecord[],
): readonly DispatchDivergenceRecord[] => {
  const latest = new Map<string, DispatchDivergenceRecord>();
  for (const record of records) latest.set(record.divergenceId, record);
  return [...latest.values()];
};

/** A compact divergence summary for the gate and summary surfaces. */
export type DispatchDivergenceSummary = {
  readonly reported: number;
  readonly resolved: number;
  readonly unresolved: number;
  readonly unresolvedIds: readonly string[];
};

export const summarizeDispatchDivergences = (
  records: readonly DispatchDivergenceRecord[],
): DispatchDivergenceSummary => {
  const folded = foldDispatchDivergences(records);
  const unresolvedIds = folded
    .filter((record) => record.state === "open")
    .map((record) => record.divergenceId)
    .slice(0, DISPATCH_MAX_DIVERGENCE_IDS);
  const resolved = folded.length - unresolvedIds.length;
  return {
    reported: folded.length,
    resolved,
    unresolved: unresolvedIds.length,
    unresolvedIds,
  };
};

/** Append one divergence open record. */
export const appendDispatchDivergence = (
  store: StateStorePort,
  fenceToken: string,
  record: DispatchDivergenceRecord,
): DispatchAppendResult<DispatchDivergenceRecord> => {
  const recordKey = dispatchDivergenceRecordKey(record.divergenceId);
  if (!isDivergenceRecord(record)) {
    return { ok: false, code: "state.write.failed", path: recordKey };
  }
  return appendLedger(store, fenceToken, DISPATCH_DIVERGENCE_RECORD_KIND, recordKey, record, false);
};

/**
 * Resolve a divergence append-only: the original open record stays byte
 * identical and the resolved record carries the bounded note, principal, and
 * timestamp. An already-resolved or unknown identifier is a noop/refusal.
 */
export const resolveDispatchDivergence = (
  store: StateStorePort,
  fenceToken: string,
  input: {
    readonly divergenceId: string;
    readonly note: string;
    readonly principal: string;
    readonly recordedAt: string;
  },
): DispatchAppendResult<DispatchDivergenceRecord> => {
  const read = readDispatchDivergences(store);
  if (!read.ok) return { ok: false, code: read.code, path: read.path };
  const folded = foldDispatchDivergences(read.records).find(
    (record) => record.divergenceId === input.divergenceId,
  );
  if (folded === undefined) {
    return { ok: false, code: DISPATCH_DIVERGENCE_NOT_FOUND, path: input.divergenceId };
  }
  if (folded.state === "resolved") return { ok: true, appended: false, record: folded };
  const note = input.note.slice(0, DISPATCH_MAX_NOTE_CHARS);
  const resolved: DispatchDivergenceRecord = {
    ...folded,
    state: "resolved",
    note,
    principal: input.principal,
    resolvedAt: input.recordedAt,
    recordedAt: input.recordedAt,
  };
  return appendDispatchDivergence(store, fenceToken, resolved);
};

/** Read every handover record in append order. */
export const readDispatchHandover = (
  store: StateStorePort,
): DispatchLedgerRead<DispatchHandoverRecord> =>
  readLedger(store, {
    kind: DISPATCH_HANDOVER_RECORD_KIND,
    schema: DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
    keyPrefix: DISPATCH_HANDOVER_KEY_PREFIX,
    isRecord: isHandoverRecord,
    max: DISPATCH_MAX_ATTEMPT_RECORDS,
  });

/** Append one handover or reversal record. */
export const appendDispatchHandover = (
  store: StateStorePort,
  fenceToken: string,
  record: DispatchHandoverRecord,
): DispatchAppendResult<DispatchHandoverRecord> => {
  const recordKey = dispatchHandoverRecordKey(record.repository);
  if (!isHandoverRecord(record)) {
    return { ok: false, code: "state.write.failed", path: recordKey };
  }
  // A handover and its reversal are distinct operations and both land; only an
  // identical replay is a noop.
  const read = readDispatchHandover(store);
  if (!read.ok) return { ok: false, code: read.code, path: read.path };
  const identical = read.records.find(
    (existing) =>
      existing.repository === record.repository &&
      existing.operation === record.operation &&
      existing.recordedAt === record.recordedAt,
  );
  if (identical !== undefined) return { ok: true, appended: false, record: identical };
  return appendLedger(store, fenceToken, DISPATCH_HANDOVER_RECORD_KIND, recordKey, record, false);
};

/** Replace the derived authority view atomically from the folded truth. */
export const writeDispatchAuthority = (
  store: StateStorePort,
  fenceToken: string,
  view: DispatchAuthorityView,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly path: string } => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok)
    return { ok: false, code: acquired.error.code, path: acquired.error.location.path };
  const replaced = store.replaceDocument(acquired.value.handle, {
    name: DISPATCH_AUTHORITY_DOCUMENT_NAME,
    content: view as unknown as StateJsonValue,
  });
  const released = store.releaseFence(acquired.value.handle);
  if (!replaced.ok)
    return { ok: false, code: replaced.error.code, path: replaced.error.location.path };
  if (!released.ok)
    return { ok: false, code: released.error.code, path: released.error.location.path };
  return { ok: true };
};
