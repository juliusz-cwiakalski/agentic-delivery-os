/**
 * The three additive merge-domain ledgers over the injected state port
 * (GH-225 EVT-1..3, DM-1..3, NFR-7).
 *
 * Additive inside `delivery.state.v1`: one append per verification, waiver, or
 * transaction outcome; presence-tolerant verified reads; fenced appends verified
 * post-append. A wrong kind under a merge prefix, a malformed payload, or a
 * schema-incompatible record is classified and never served as truth. No
 * existing record kind, read, or schema version is touched.
 */
import {
  MERGE_GATE_VERIFICATION_RECORD_KIND,
  MERGE_GATE_VERIFICATION_SCHEMA,
  MERGE_POST_LANDING_STATUSES,
  MERGE_POST_LANDING_STEP_IDS,
  MERGE_TRANSACTION_RECORD_KIND,
  MERGE_TRANSACTION_RESULTS,
  MERGE_TRANSACTION_SCHEMA,
  MERGE_WAIVER_RECORD_KIND,
  MERGE_WAIVER_SCHEMA,
  type MergeGateVerdictRecord,
  type MergeGateVerificationRecord,
  type MergeLandingEvidence,
  type MergePostLandingStatus,
  type MergeRefreshEvidence,
  type MergeStateRead,
  type MergeStateReadReason,
  type MergeTrackerPosture,
  type MergeTransactionRecord,
  type MergeWaiverRecord,
  type StateJsonValue,
  type StateResult,
  type StateStorePort,
} from "#contracts";

export type { MergeStateRead, MergeStateReadReason } from "#contracts";

/** The verification ledger's declared record-key prefix (per change ref). */
export const MERGE_GATE_VERIFICATION_RECORD_KEY_PREFIX = "merge.gate-verification:" as const;
/** The waiver ledger's declared record-key prefix (per change ref). */
export const MERGE_WAIVER_RECORD_KEY_PREFIX = "merge.waiver:" as const;
/** The transaction ledger's declared record-key prefix (per change ref). */
export const MERGE_TRANSACTION_RECORD_KEY_PREFIX = "merge.transaction:" as const;

/** One idempotent append outcome: the landed record plus release evidence. */
export type MergeStateAppend = {
  readonly appended: true;
  readonly sequence: number;
  readonly fenceReleased: boolean;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const torn = (): MergeStateRead<never> => ({
  ok: false,
  reason: "torn",
  code: "state.store.torn",
});

const incompatible = (): MergeStateRead<never> => ({
  ok: false,
  reason: "incompatible",
  code: "state.schema.mismatch",
});

const stateFailureReason = (code: string): MergeStateReadReason => {
  if (code === "state.schema.mismatch") return "incompatible";
  if (code === "state.store.torn" || code === "state.keys.missing") return "torn";
  return "unreadable";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const hasOnlyKeys = (value: Readonly<Record<string, unknown>>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const hasEveryKey = (value: Readonly<Record<string, unknown>>, required: readonly string[]) =>
  required.every((key) => Object.hasOwn(value, key));

const stringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const VERIFICATION_KEYS = [
  "schema",
  "changeRef",
  "headSha",
  "verifiedAt",
  "gateSet",
  "gates",
  "trackerPosture",
] as const;
const GATE_SET_KEYS = ["schemaVersion", "ids"] as const;
const POSTURE_KEYS = ["labels", "ownerLabels"] as const;
const GATE_VERDICT_KEYS = ["id", "verdict", "reason", "citation"] as const;
const WAIVER_KEYS = [
  "schema",
  "changeRef",
  "gateId",
  "gateClass",
  "authorizer",
  "authorizedAt",
  "reason",
] as const;
const TRANSACTION_KEYS = [
  "schema",
  "changeRef",
  "result",
  "squashSha",
  "replayed",
  "landing",
  "refresh",
  "waiverRefs",
  "postLanding",
  "recordedAt",
] as const;
const LANDING_KEYS = ["shaOnBase", "requestState"] as const;
const REFRESH_KEYS = ["attempts", "outcome"] as const;
const POST_LANDING_KEYS = ["id", "status"] as const;

const isCitation = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.identity) &&
    Array.isArray(value.sources) &&
    Array.isArray(value.counts) &&
    Array.isArray(value.names) &&
    stringList(value.reasons)
  );
};

const isGateVerdict = (value: unknown): value is MergeGateVerdictRecord => {
  if (!isRecord(value) || !hasOnlyKeys(value, GATE_VERDICT_KEYS)) return false;
  return (
    isNonEmptyString(value.id) &&
    (value.verdict === "pass" || value.verdict === "fail" || value.verdict === "unknown") &&
    isNonEmptyString(value.reason) &&
    isCitation(value.citation)
  );
};

const isPosture = (value: unknown): value is MergeTrackerPosture =>
  isRecord(value) &&
  hasOnlyKeys(value, POSTURE_KEYS) &&
  stringList(value.labels) &&
  stringList(value.ownerLabels);

const isVerification = (value: unknown): value is MergeGateVerificationRecord => {
  if (!isRecord(value) || !hasOnlyKeys(value, VERIFICATION_KEYS)) return false;
  if (!hasEveryKey(value, ["schema", "changeRef", "headSha", "verifiedAt", "gateSet", "gates"]))
    return false;
  if (value.schema !== MERGE_GATE_VERIFICATION_SCHEMA) return false;
  if (!isNonEmptyString(value.changeRef)) return false;
  if (typeof value.headSha !== "string") return false;
  if (!isNonEmptyString(value.verifiedAt)) return false;
  if (!isRecord(value.gateSet) || !hasOnlyKeys(value.gateSet, GATE_SET_KEYS)) return false;
  if (!isNonEmptyString(value.gateSet.schemaVersion)) return false;
  if (!stringList(value.gateSet.ids)) return false;
  if (!Array.isArray(value.gates) || !value.gates.every(isGateVerdict)) return false;
  return value.trackerPosture === undefined || isPosture(value.trackerPosture);
};

const isWaiver = (value: unknown): value is MergeWaiverRecord => {
  if (!isRecord(value) || !hasOnlyKeys(value, WAIVER_KEYS)) return false;
  if (
    !hasEveryKey(value, [
      "schema",
      "changeRef",
      "gateId",
      "gateClass",
      "authorizer",
      "authorizedAt",
    ])
  )
    return false;
  if (value.schema !== MERGE_WAIVER_SCHEMA) return false;
  if (!isNonEmptyString(value.changeRef)) return false;
  if (!isNonEmptyString(value.gateId)) return false;
  if (!isNonEmptyString(value.gateClass)) return false;
  if (!isNonEmptyString(value.authorizer)) return false;
  if (!isNonEmptyString(value.authorizedAt)) return false;
  return value.reason === undefined || typeof value.reason === "string";
};

const isLanding = (value: unknown): value is MergeLandingEvidence =>
  isRecord(value) &&
  hasOnlyKeys(value, LANDING_KEYS) &&
  typeof value.shaOnBase === "boolean" &&
  isNonEmptyString(value.requestState);

const isRefresh = (value: unknown): value is MergeRefreshEvidence =>
  isRecord(value) &&
  hasOnlyKeys(value, REFRESH_KEYS) &&
  typeof value.attempts === "number" &&
  Number.isInteger(value.attempts) &&
  value.attempts >= 0 &&
  typeof value.outcome === "string" &&
  (["not-attempted", "succeeded", "conflicted"] as readonly string[]).includes(value.outcome);

const isPostLandingStatus = (value: unknown): value is MergePostLandingStatus =>
  typeof value === "string" && (MERGE_POST_LANDING_STATUSES as readonly string[]).includes(value);

const isPostLanding = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, POST_LANDING_KEYS) &&
  typeof value.id === "string" &&
  (MERGE_POST_LANDING_STEP_IDS as readonly string[]).includes(value.id) &&
  isPostLandingStatus(value.status);

const isTransaction = (value: unknown): value is MergeTransactionRecord => {
  if (!isRecord(value) || !hasOnlyKeys(value, TRANSACTION_KEYS)) return false;
  if (
    !hasEveryKey(value, [
      "schema",
      "changeRef",
      "result",
      "replayed",
      "landing",
      "refresh",
      "waiverRefs",
      "postLanding",
      "recordedAt",
    ])
  )
    return false;
  if (value.schema !== MERGE_TRANSACTION_SCHEMA) return false;
  if (!isNonEmptyString(value.changeRef)) return false;
  if (typeof value.result !== "string") return false;
  if (!(MERGE_TRANSACTION_RESULTS as readonly string[]).includes(value.result)) return false;
  if (value.squashSha !== undefined && typeof value.squashSha !== "string") return false;
  if (typeof value.replayed !== "boolean") return false;
  if (!isLanding(value.landing)) return false;
  if (!isRefresh(value.refresh)) return false;
  if (!stringList(value.waiverRefs)) return false;
  if (!Array.isArray(value.postLanding) || !value.postLanding.every(isPostLanding)) return false;
  return isNonEmptyString(value.recordedAt);
};

const verificationPayload = (record: MergeGateVerificationRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const waiverPayload = (record: MergeWaiverRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const transactionPayload = (record: MergeTransactionRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

type ReadSpec<T> = {
  readonly prefix: string;
  readonly kind: string;
  readonly schema: string;
  readonly isRecord: (value: unknown) => value is T;
};

const readMergeRecords = <T>(
  store: StateStorePort,
  changeRef: string,
  spec: ReadSpec<T>,
): MergeStateRead<T> => {
  const verified = store.readRecords();
  if (!verified.ok) {
    return {
      ok: false,
      reason: stateFailureReason(verified.error.code),
      code: verified.error.code,
    };
  }
  const records: T[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (!ledgerRecord.key.startsWith(spec.prefix)) continue;
    if (ledgerRecord.kind !== spec.kind) return torn();
    const payload = ledgerRecord.payload;
    if (!isRecord(payload)) return torn();
    if (payload.schema !== spec.schema) return incompatible();
    if (!spec.isRecord(payload)) return torn();
    if (payload.changeRef !== changeRef) continue;
    records.push(payload);
  }
  return {
    ok: true,
    verifiedEmpty: records.length === 0,
    records,
    evidence: verified.value.evidence,
  };
};

const appendMergeRecord = <T>(
  store: StateStorePort,
  request: {
    readonly kind: string;
    readonly recordKey: string;
    readonly record: T;
    readonly payload: StateJsonValue;
    readonly fenceToken: string;
    readonly equals: (value: unknown, expected: T) => value is T;
  },
): StateResult<MergeStateAppend> => {
  const before = store.readRecords();
  if (!before.ok) return before;
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = store.append(handle, {
    kind: request.kind,
    recordKey: request.recordKey,
    payload: request.payload,
  });
  if (!appended.ok) {
    store.releaseFence(handle);
    return appended;
  }
  const after = store.readRecords();
  const released = store.releaseFence(handle);
  if (!after.ok) return after;
  const landed = after.value.records.some(
    (record) =>
      record.sequence === appended.value.sequence && request.equals(record.payload, request.record),
  );
  if (!landed || after.value.records.length !== before.value.records.length + 1) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: after.value.evidence.storePath, record: appended.value.sequence },
      },
    };
  }
  return ok({
    appended: true,
    sequence: appended.value.sequence,
    fenceReleased: released.ok && released.value.released,
  });
};

/** The store-scoped verification key (one append-only history per change ref). */
export const mergeGateVerificationRecordKey = (changeRef: string): string =>
  `${MERGE_GATE_VERIFICATION_RECORD_KEY_PREFIX}${changeRef}`;

/** The store-scoped waiver key (one append-only history per change ref). */
export const mergeWaiverRecordKey = (changeRef: string): string =>
  `${MERGE_WAIVER_RECORD_KEY_PREFIX}${changeRef}`;

/** The store-scoped transaction key (one append-only history per change ref). */
export const mergeTransactionRecordKey = (changeRef: string): string =>
  `${MERGE_TRANSACTION_RECORD_KEY_PREFIX}${changeRef}`;

/** Read every verified gate-verification record for one change ref, oldest first. */
export const readMergeGateVerifications = (
  store: StateStorePort,
  changeRef: string,
): MergeStateRead<MergeGateVerificationRecord> =>
  readMergeRecords(store, changeRef, {
    prefix: MERGE_GATE_VERIFICATION_RECORD_KEY_PREFIX,
    kind: MERGE_GATE_VERIFICATION_RECORD_KIND,
    schema: MERGE_GATE_VERIFICATION_SCHEMA,
    isRecord: isVerification,
  });

/** Read every verified waiver record for one change ref, oldest first. */
export const readMergeWaivers = (
  store: StateStorePort,
  changeRef: string,
): MergeStateRead<MergeWaiverRecord> =>
  readMergeRecords(store, changeRef, {
    prefix: MERGE_WAIVER_RECORD_KEY_PREFIX,
    kind: MERGE_WAIVER_RECORD_KIND,
    schema: MERGE_WAIVER_SCHEMA,
    isRecord: isWaiver,
  });

/** Read every verified waiver record across all change refs (board consumer). */
export const readAllMergeWaivers = (store: StateStorePort): MergeStateRead<MergeWaiverRecord> => {
  const verified = store.readRecords();
  if (!verified.ok) {
    return {
      ok: false,
      reason: stateFailureReason(verified.error.code),
      code: verified.error.code,
    };
  }
  const records: MergeWaiverRecord[] = [];
  for (const ledgerRecord of verified.value.records) {
    if (!ledgerRecord.key.startsWith(MERGE_WAIVER_RECORD_KEY_PREFIX)) continue;
    if (ledgerRecord.kind !== MERGE_WAIVER_RECORD_KIND) return torn();
    const payload = ledgerRecord.payload;
    if (!isRecord(payload)) return torn();
    if (payload.schema !== MERGE_WAIVER_SCHEMA) return incompatible();
    if (!isWaiver(payload)) return torn();
    records.push(payload);
  }
  return {
    ok: true,
    verifiedEmpty: records.length === 0,
    records,
    evidence: verified.value.evidence,
  };
};

/** Read every verified transaction record for one change ref, oldest first. */
export const readMergeTransactions = (
  store: StateStorePort,
  changeRef: string,
): MergeStateRead<MergeTransactionRecord> =>
  readMergeRecords(store, changeRef, {
    prefix: MERGE_TRANSACTION_RECORD_KEY_PREFIX,
    kind: MERGE_TRANSACTION_RECORD_KIND,
    schema: MERGE_TRANSACTION_SCHEMA,
    isRecord: isTransaction,
  });

/** Append one fenced, post-append-verified gate-verification record. */
export const appendMergeGateVerification = (
  store: StateStorePort,
  request: { readonly record: MergeGateVerificationRecord; readonly fenceToken: string },
): StateResult<MergeStateAppend> =>
  appendMergeRecord(store, {
    kind: MERGE_GATE_VERIFICATION_RECORD_KIND,
    recordKey: mergeGateVerificationRecordKey(request.record.changeRef),
    record: request.record,
    payload: verificationPayload(request.record),
    fenceToken: request.fenceToken,
    equals: isVerification,
  });

/** Append one fenced, post-append-verified waiver record. */
export const appendMergeWaiver = (
  store: StateStorePort,
  request: { readonly record: MergeWaiverRecord; readonly fenceToken: string },
): StateResult<MergeStateAppend> =>
  appendMergeRecord(store, {
    kind: MERGE_WAIVER_RECORD_KIND,
    recordKey: mergeWaiverRecordKey(request.record.changeRef),
    record: request.record,
    payload: waiverPayload(request.record),
    fenceToken: request.fenceToken,
    equals: isWaiver,
  });

/** Append one fenced, post-append-verified transaction record. */
export const appendMergeTransaction = (
  store: StateStorePort,
  request: { readonly record: MergeTransactionRecord; readonly fenceToken: string },
): StateResult<MergeStateAppend> =>
  appendMergeRecord(store, {
    kind: MERGE_TRANSACTION_RECORD_KIND,
    recordKey: mergeTransactionRecordKey(request.record.changeRef),
    record: request.record,
    payload: transactionPayload(request.record),
    fenceToken: request.fenceToken,
    equals: isTransaction,
  });
