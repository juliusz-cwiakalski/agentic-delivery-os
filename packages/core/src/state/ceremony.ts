/**
 * The `ceremony.run` and `ceremony.step` boundary over the injected state port
 * (GH-296 F-4, F-8; DM-3..DM-6).
 *
 * Additive inside `delivery.state.v1`: two record kinds under the `ceremony.`
 * key prefix, boundary-validated fenced appends with a post-append verified
 * re-read, four classified read verdicts, and pure folds for run status, run
 * duration, and per-phase durations. There is no derived run document: every
 * derived figure is a fold over verified step records. No runtime API.
 */
import {
  CEREMONY_RECORD_BOUNDARY_DECLARATION,
  CEREMONY_RUN_PAYLOAD_SCHEMA,
  CEREMONY_RUN_RECORD_KIND,
  CEREMONY_RUN_RECORD_KEY_PREFIX,
  CEREMONY_STEP_PAYLOAD_SCHEMA,
  CEREMONY_STEP_RECORD_KIND,
  CEREMONY_STEP_RECORD_KEY_PREFIX,
  type CeremonyRecordAppend,
  type CeremonyRecordPort,
  type CeremonyRecordsRead,
  type CeremonyRunRecord,
  type CeremonyRunVerdict,
  type CeremonyStepRecord,
  type StateAppendOutcome,
  type StateArtifactKindDeclaration,
  type StateFenceHandle,
  type StateJsonValue,
  type StateResult,
  type StateStorePort,
} from "#contracts";
import { createArtifactBoundary, type StateArtifactBoundary } from "./artifact-boundary.js";

/** The run record key for one run id (DM-3). */
export const ceremonyRunRecordKey = (runId: string): string =>
  `${CEREMONY_RUN_RECORD_KEY_PREFIX}${encodeURIComponent(runId)}`;

/** The step record key for one run id and step index (DM-4). */
export const ceremonyStepRecordKey = (runId: string, index: number): string =>
  `${CEREMONY_STEP_RECORD_KEY_PREFIX}${encodeURIComponent(runId)}:${String(index)}`;

/** One stable run-identity key for lookups: `(ceremony, scopeKey, window)`. */
export const ceremonyRunIdentityKey = (input: {
  readonly ceremonyId: string;
  readonly scopeKey: string;
  readonly windowStart: string;
  readonly windowEnd: string;
}): string =>
  `${input.ceremonyId}\u0000${input.scopeKey}\u0000${input.windowStart}..${input.windowEnd}`;

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const declaredKind = (kind: string): StateArtifactKindDeclaration | undefined =>
  CEREMONY_RECORD_BOUNDARY_DECLARATION.kinds.find((entry) => entry.kind === kind);

const matchesFieldType = (type: string, value: unknown): boolean => {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return isFiniteNumber(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return false;
  }
};

const validatePayload = (
  declaration: StateArtifactKindDeclaration,
  payload: StateJsonValue,
): boolean => {
  if (!isRecord(payload)) return false;
  if (declaration.payloadSchema !== undefined && payload.schemaId !== declaration.payloadSchema) {
    return false;
  }
  for (const field of declaration.fields) {
    if (!Object.hasOwn(payload, field.name)) {
      if (field.required) return false;
      continue;
    }
    if (!matchesFieldType(field.type, payload[field.name])) return false;
  }
  const identity = payload[declaration.identityField];
  if (typeof identity !== "string" || identity.length === 0) return false;
  for (const vocabulary of declaration.vocabularies ?? []) {
    if (!Object.hasOwn(payload, vocabulary.field)) continue;
    const value = payload[vocabulary.field];
    if (typeof value !== "string" || !vocabulary.values.includes(value)) return false;
  }
  return true;
};

const validRun = (value: unknown): value is CeremonyRunRecord => {
  if (!isRecord(value)) return false;
  if (value.schemaId !== CEREMONY_RUN_PAYLOAD_SCHEMA) return false;
  if (!isNonEmptyString(value.ceremonyId) || !isNonEmptyString(value.runId)) return false;
  if (value.origin !== "built-in" && value.origin !== "project") return false;
  if (!isNonEmptyString(value.declarationDigest)) return false;
  if (!isRecord(value.trigger)) return false;
  if (!isRecord(value.scopeKey) || !isNonEmptyString(value.scopeKey.value)) return false;
  if (!isRecord(value.tier)) return false;
  if (!isFiniteNumber(value.startedAtMs) || !isFiniteNumber(value.phaseCount)) return false;
  return true;
};

const validStep = (value: unknown): value is CeremonyStepRecord => {
  if (!isRecord(value)) return false;
  if (value.schemaId !== CEREMONY_STEP_PAYLOAD_SCHEMA) return false;
  if (!isNonEmptyString(value.runId)) return false;
  if (!isFiniteNumber(value.index) || !Number.isInteger(value.index) || value.index < 0) {
    return false;
  }
  if (!isFiniteNumber(value.phaseIndex) || !Number.isInteger(value.phaseIndex)) return false;
  if (!isFiniteNumber(value.startedAtMs) || !isFiniteNumber(value.endedAtMs)) return false;
  if (!isFiniteNumber(value.durationMs) || value.durationMs < 0) return false;
  if (!isNonEmptyString(value.kind) || !isNonEmptyString(value.slot)) return false;
  if (typeof value.artifactRef !== "string") return false;
  if (
    value.outcome !== "verified" &&
    value.outcome !== "unverified" &&
    value.outcome !== "dry-run"
  ) {
    return false;
  }
  if (value.verification !== "verified" && value.verification !== "unverified") return false;
  return true;
};

const readPrefix = <T>(
  store: StateStorePort,
  input: {
    readonly keyPrefix: string;
    readonly kind: string;
    readonly parse: (value: unknown) => value is T;
  },
): StateResult<CeremonyRecordsRead<T>> => {
  const verified = store.readRecords();
  if (!verified.ok) {
    const code = verified.error.code;
    if (code === "state.store.unknown") {
      return ok({ verdict: "unknown", records: [], malformed: [], detail: code });
    }
    return verified;
  }
  const records: T[] = [];
  const malformed: number[] = [];
  for (const record of verified.value.records) {
    if (!record.key.startsWith(input.keyPrefix)) continue;
    const kind = declaredKind(record.kind);
    if (record.kind !== input.kind || kind === undefined) {
      malformed.push(record.sequence);
      continue;
    }
    if (!validatePayload(kind, record.payload) || !input.parse(record.payload)) {
      malformed.push(record.sequence);
      continue;
    }
    records.push(record.payload as unknown as T);
  }
  if (malformed.length > 0) {
    return ok({
      verdict: "torn",
      records,
      malformed,
      detail: `${String(malformed.length)} malformed ceremony record(s)`,
    });
  }
  return ok({ verdict: records.length === 0 ? "verified-empty" : "valid", records, malformed });
};

/** Read every verified ceremony run record with its classified verdict (DM-5). */
export const readCeremonyRuns = (
  store: StateStorePort,
): StateResult<CeremonyRecordsRead<CeremonyRunRecord>> =>
  readPrefix(store, {
    keyPrefix: CEREMONY_RUN_RECORD_KEY_PREFIX,
    kind: CEREMONY_RUN_RECORD_KIND,
    parse: validRun,
  });

/** Read every verified step record for one run, sorted by step index (DM-5). */
export const readCeremonySteps = (
  store: StateStorePort,
  runId: string,
): StateResult<CeremonyRecordsRead<CeremonyStepRecord>> => {
  const read = readPrefix(store, {
    keyPrefix: `${CEREMONY_STEP_RECORD_KEY_PREFIX}${encodeURIComponent(runId)}:`,
    kind: CEREMONY_STEP_RECORD_KIND,
    parse: validStep,
  });
  if (!read.ok) return read;
  return ok({
    ...read.value,
    records: [...read.value.records].sort((left, right) => left.index - right.index),
  });
};

const boundaryFor = (store: StateStorePort): StateArtifactBoundary =>
  createArtifactBoundary(store, CEREMONY_RECORD_BOUNDARY_DECLARATION);

const verifyAppended = <T>(
  read: () => StateResult<CeremonyRecordsRead<T>>,
  expected: number,
): StateResult<undefined> => {
  const after = read();
  if (!after.ok) return after;
  if (after.value.records.length !== expected) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: "ceremony", record: expected },
      },
    };
  }
  return ok(undefined);
};

const payloadOfRun = (record: CeremonyRunRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

const payloadOfStep = (record: CeremonyStepRecord): StateJsonValue =>
  record as unknown as StateJsonValue;

/** Append one run record with a post-append verified re-read (DM-5). */
export const appendCeremonyRun = (
  store: StateStorePort,
  handle: StateFenceHandle,
  record: CeremonyRunRecord,
): StateResult<StateAppendOutcome> => {
  const before = readCeremonyRuns(store);
  if (!before.ok) return before;
  const appended = boundaryFor(store).append(handle, {
    kind: CEREMONY_RUN_RECORD_KIND,
    recordKey: ceremonyRunRecordKey(record.runId),
    payload: payloadOfRun(record),
  });
  if (!appended.ok) return appended;
  const verified = verifyAppended(() => readCeremonyRuns(store), before.value.records.length + 1);
  return verified.ok ? appended : verified;
};

/** Append one step record with a post-append verified re-read (DM-5). */
export const appendCeremonyStep = (
  store: StateStorePort,
  handle: StateFenceHandle,
  record: CeremonyStepRecord,
): StateResult<StateAppendOutcome> => {
  const before = readCeremonySteps(store, record.runId);
  if (!before.ok) return before;
  const appended = boundaryFor(store).append(handle, {
    kind: CEREMONY_STEP_RECORD_KIND,
    recordKey: ceremonyStepRecordKey(record.runId, record.index),
    payload: payloadOfStep(record),
  });
  if (!appended.ok) return appended;
  const verified = verifyAppended(
    () => readCeremonySteps(store, record.runId),
    before.value.records.length + 1,
  );
  return verified.ok ? appended : verified;
};

/** Fold the recorded step set into the run verdict: the fold is the truth (F-4). */
export const foldCeremonyRunVerdict = (
  steps: readonly CeremonyStepRecord[],
): CeremonyRunVerdict => {
  if (steps.some((step) => step.outcome === "unverified")) return "unverified";
  if (steps.some((step) => step.outcome === "dry-run")) return "dry-run";
  return "verified";
};

/** Fold the run duration: first step start to last step end (F-8, NFR-10). */
export const ceremonyRunDurationMs = (steps: readonly CeremonyStepRecord[]): number | null => {
  if (steps.length === 0) return null;
  const started = Math.min(...steps.map((step) => step.startedAtMs));
  const ended = Math.max(...steps.map((step) => step.endedAtMs));
  return Math.max(0, ended - started);
};

/** Fold per-phase durations over the recorded steps (F-8). */
export const foldCeremonyPhaseDurations = (
  steps: readonly CeremonyStepRecord[],
): readonly { readonly phaseIndex: number; readonly durationMs: number }[] => {
  const durations = new Map<number, number>();
  for (const step of steps) {
    durations.set(step.phaseIndex, (durations.get(step.phaseIndex) ?? 0) + step.durationMs);
  }
  return [...durations.entries()]
    .sort(([left], [right]) => left - right)
    .map(([phaseIndex, durationMs]) => ({ phaseIndex, durationMs }));
};

/** Find the recorded run with one identity, if any (F-4 idempotency). */
export const findCeremonyRunByIdentity = (
  runs: readonly CeremonyRunRecord[],
  identity: {
    readonly ceremonyId: string;
    readonly scopeKey: string;
    readonly windowStart: string;
    readonly windowEnd: string;
  },
): CeremonyRunRecord | undefined =>
  runs.find(
    (run) =>
      run.ceremonyId === identity.ceremonyId &&
      run.scopeKey.value === identity.scopeKey &&
      run.trigger.actualWindow.start === identity.windowStart &&
      run.trigger.actualWindow.end === identity.windowEnd,
  );

const mapAppend = (result: StateResult<StateAppendOutcome>): CeremonyRecordAppend =>
  result.ok
    ? { ok: true }
    : {
        ok: false,
        code: result.error.code,
        ...(result.error.location.path === "" ? {} : { detail: result.error.location.path }),
      };

const mapRead = <T>(result: StateResult<CeremonyRecordsRead<T>>): CeremonyRecordsRead<T> =>
  result.ok
    ? result.value
    : { verdict: "unknown", records: [], malformed: [], detail: result.error.code };

/**
 * The engine-facing record port over one store and one fence token. Each append
 * acquires and releases the single-writer fence; reads are verified reads.
 */
export const createCeremonyRecordPort = (
  store: StateStorePort,
  fenceToken: string,
): CeremonyRecordPort => {
  const withFence = <T>(body: (handle: StateFenceHandle) => StateResult<T>): StateResult<T> => {
    const acquired = store.acquireFence(fenceToken);
    if (!acquired.ok) return acquired;
    try {
      return body(acquired.value.handle);
    } finally {
      store.releaseFence(acquired.value.handle);
    }
  };
  return {
    readRuns: () => mapRead(readCeremonyRuns(store)),
    readSteps: (runId) => mapRead(readCeremonySteps(store, runId)),
    appendRun: (record) =>
      mapAppend(withFence((handle) => appendCeremonyRun(store, handle, record))),
    appendStep: (record) =>
      mapAppend(withFence((handle) => appendCeremonyStep(store, handle, record))),
  };
};
