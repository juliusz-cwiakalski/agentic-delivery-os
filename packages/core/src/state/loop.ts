/**
 * The two additive loop record kinds over the injected state port (GH-348
 * DM-1, DM-2; F-4, F-6, F-7).
 *
 * Additive inside `delivery.state.v1`: `loop.session` and `loop.stop` under
 * LOOP-scoped keys, latest-wins folds, and a typed unreadable distinction. No
 * state engine, storage-format, or boundary change; the appends ride the
 * delivered NON-CLAIM per-append write-fence path, so the loop invents no second
 * lock fold and the coordinator family is untouched.
 *
 * The stop fold is the one place where "unreadable" must never read as "not
 * stopped": a verified-read failure or a malformed payload is a typed failure
 * (`state.*`), never a `none` reading (AC-F4-2, PM ruling R3).
 */
import {
  LOOP_SESSION_KEY_PREFIX,
  LOOP_SESSION_PAYLOAD_SCHEMA,
  LOOP_SESSION_RECORD_KIND,
  LOOP_SESSION_STATES,
  LOOP_STOP_ACTIONS,
  LOOP_STOP_KEY_PREFIX,
  LOOP_STOP_MODES,
  LOOP_STOP_PAYLOAD_SCHEMA,
  LOOP_STOP_RECORD_KIND,
  type LoopSessionRecord,
  type LoopStopMode,
  type LoopStopRecord,
  type StateFailureCode,
  type StateJsonValue,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";
import { appendCoordinatorPayload } from "./coordinator.js";

/* -------------------------------- keys ----------------------------------- */

export const loopSessionKey = (loopId: string): string => `${LOOP_SESSION_KEY_PREFIX}${loopId}`;
export const loopStopKey = (loopId: string): string => `${LOOP_STOP_KEY_PREFIX}${loopId}`;

/* ------------------------------- outcomes -------------------------------- */

export type LoopRecordsRead =
  | {
      readonly ok: true;
      readonly loopId: string;
      readonly sessions: readonly LoopSessionRecord[];
      readonly stops: readonly LoopStopRecord[];
      readonly verifiedEmpty: boolean;
    }
  | {
      readonly ok: false;
      readonly code: StateFailureCode;
      readonly location?: StateSafeLocation;
    };

export type LoopAppendOutcome<T> =
  | {
      readonly ok: true;
      readonly appended: boolean;
      readonly sequence?: number;
      readonly record: T;
    }
  | { readonly ok: false; readonly code: string; readonly location?: StateSafeLocation };

/* ------------------------------- reading --------------------------------- */

const toJson = (value: object): StateJsonValue =>
  JSON.parse(JSON.stringify(value)) as StateJsonValue;

const isPositiveInteger = (value: unknown): boolean =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNullablePositiveInteger = (value: unknown): boolean =>
  value === null || isPositiveInteger(value);

/** One parsed session payload, or `undefined` when the shape is unusable. */
const parseSession = (payload: StateJsonValue): LoopSessionRecord | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const value = payload as Record<string, unknown>;
  if (value["schemaId"] !== LOOP_SESSION_PAYLOAD_SCHEMA) return undefined;
  for (const field of ["sessionRecordId", "loopId", "sessionId", "harnessKind", "acquiredAt"]) {
    if (typeof value[field] !== "string" || (value[field] as string).length === 0) return undefined;
  }
  if (typeof value["recordedAt"] !== "string") return undefined;
  if (!(LOOP_SESSION_STATES as readonly string[]).includes(String(value["state"])))
    return undefined;
  if (!isNullablePositiveInteger(value["pid"])) return undefined;
  if (!isNullablePositiveInteger(value["processStartTimeMs"])) return undefined;
  if (value["title"] !== null && typeof value["title"] !== "string") return undefined;
  return payload as unknown as LoopSessionRecord;
};

/** One parsed stop payload, or `undefined` when the shape is unusable. */
const parseStop = (payload: StateJsonValue): LoopStopRecord | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const value = payload as Record<string, unknown>;
  if (value["schemaId"] !== LOOP_STOP_PAYLOAD_SCHEMA) return undefined;
  for (const field of ["stopId", "loopId", "recordedAt"]) {
    if (typeof value[field] !== "string" || (value[field] as string).length === 0) return undefined;
  }
  if (!(LOOP_STOP_ACTIONS as readonly string[]).includes(String(value["action"]))) return undefined;
  const mode = value["mode"];
  if (mode !== null && !(LOOP_STOP_MODES as readonly string[]).includes(String(mode))) {
    return undefined;
  }
  return payload as unknown as LoopStopRecord;
};

const FAILURE_CODES = new Set<StateFailureCode>([
  "state.store.torn",
  "state.schema.mismatch",
  "state.keys.missing",
  "state.lock.busy",
  "state.permission.denied",
  "state.write.failed",
  "state.level.unsupported",
  "state.storage.exhausted",
  "state.store.unknown",
]);

const classify = (code: string): StateFailureCode =>
  FAILURE_CODES.has(code as StateFailureCode) ? (code as StateFailureCode) : "state.store.unknown";

/**
 * Read both loop record kinds for one identity from the single verified read.
 *
 * A read failure is classified, and a malformed payload of either kind is a
 * `state.store.torn` failure rather than a silently dropped record: a torn loop
 * fold must fail closed.
 */
export const readLoopRecords = (store: StateStorePort, loopId: string): LoopRecordsRead => {
  const verified = store.readRecords();
  if (!verified.ok) {
    return {
      ok: false,
      code: classify(verified.error.code),
      ...(verified.error.location === undefined ? {} : { location: verified.error.location }),
    };
  }
  const sessions: LoopSessionRecord[] = [];
  const stops: LoopStopRecord[] = [];
  const sessionKey = loopSessionKey(loopId);
  const stopKey = loopStopKey(loopId);
  for (const record of verified.value.records) {
    if (record.kind === LOOP_SESSION_RECORD_KIND) {
      if (record.key !== sessionKey) continue;
      const parsed = parseSession(record.payload);
      if (parsed === undefined) {
        return { ok: false, code: "state.store.torn", location: { path: record.key } };
      }
      sessions.push(parsed);
    } else if (record.kind === LOOP_STOP_RECORD_KIND) {
      if (record.key !== stopKey) continue;
      const parsed = parseStop(record.payload);
      if (parsed === undefined) {
        return { ok: false, code: "state.store.torn", location: { path: record.key } };
      }
      stops.push(parsed);
    }
  }
  const verifiedEmpty =
    verified.value.records.filter(
      (record) =>
        (record.kind === LOOP_SESSION_RECORD_KIND && record.key === sessionKey) ||
        (record.kind === LOOP_STOP_RECORD_KIND && record.key === stopKey),
    ).length === 0;
  return { ok: true, loopId, sessions, stops, verifiedEmpty };
};

/* -------------------------------- folding -------------------------------- */

/** The newest recorded session for the identity, or `null` (latest wins). */
export const foldLoopSession = (sessions: readonly LoopSessionRecord[]): LoopSessionRecord | null =>
  sessions[sessions.length - 1] ?? null;

/** One folded durable-stop reading: a request, a clearance, or nothing. */
export type LoopStopFold =
  | {
      readonly applied: true;
      readonly kind: "requested";
      readonly mode: LoopStopMode;
      readonly recordedAt: string;
    }
  | { readonly applied: true; readonly kind: "cleared"; readonly recordedAt: string }
  | { readonly applied: false; readonly kind: "none" };

/** Fold the stop transitions in order; the newest record decides (DM-2). */
export const foldLoopStop = (stops: readonly LoopStopRecord[]): LoopStopFold => {
  const latest = stops[stops.length - 1];
  if (latest === undefined) return { applied: false, kind: "none" };
  if (latest.action === "cleared")
    return { applied: true, kind: "cleared", recordedAt: latest.recordedAt };
  return {
    applied: true,
    kind: "requested",
    mode: latest.mode ?? "drain",
    recordedAt: latest.recordedAt,
  };
};

/**
 * The stop fold that a `start` must honour: a request is a folded stop, a
 * clearance or an empty history is not. The typed unreadable case never reaches
 * this function — the caller keeps `readLoopRecords`' failure and fails closed.
 */
export const isStopFolded = (stops: readonly LoopStopRecord[]): boolean => {
  const folded = foldLoopStop(stops);
  return folded.applied && folded.kind === "requested";
};

/** The folded request's mode, or `null` when no request is folded. */
export const foldedStopMode = (stops: readonly LoopStopRecord[]): LoopStopMode | null => {
  const folded = foldLoopStop(stops);
  return folded.applied && folded.kind === "requested" ? folded.mode : null;
};

/* -------------------------------- appends -------------------------------- */

/** Append one `loop.session` record; a replayed `sessionRecordId` appends nothing. */
export const appendLoopSession = (
  store: StateStorePort,
  token: string,
  record: LoopSessionRecord,
  current?: LoopRecordsRead,
): LoopAppendOutcome<LoopSessionRecord> => {
  const read = current ?? readLoopRecords(store, record.loopId);
  if (!read.ok) {
    return {
      ok: false,
      code: read.code,
      ...(read.location === undefined ? {} : { location: read.location }),
    };
  }
  const existing = read.sessions.find((entry) => entry.sessionRecordId === record.sessionRecordId);
  if (existing !== undefined) return { ok: true, appended: false, record: existing };
  const appended = appendCoordinatorPayload(store, token, {
    kind: LOOP_SESSION_RECORD_KIND,
    recordKey: loopSessionKey(record.loopId),
    payload: toJson(record),
  });
  if (!appended.ok) return { ok: false, code: appended.code };
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** Append one `loop.stop` record; a replayed `stopId` appends nothing. */
export const appendLoopStop = (
  store: StateStorePort,
  token: string,
  record: LoopStopRecord,
  current?: LoopRecordsRead,
): LoopAppendOutcome<LoopStopRecord> => {
  const read = current ?? readLoopRecords(store, record.loopId);
  if (!read.ok) {
    return {
      ok: false,
      code: read.code,
      ...(read.location === undefined ? {} : { location: read.location }),
    };
  }
  const existing = read.stops.find((entry) => entry.stopId === record.stopId);
  if (existing !== undefined) return { ok: true, appended: false, record: existing };
  const appended = appendCoordinatorPayload(store, token, {
    kind: LOOP_STOP_RECORD_KIND,
    recordKey: loopStopKey(record.loopId),
    payload: toJson(record),
  });
  if (!appended.ok) return { ok: false, code: appended.code };
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** The two loop record kinds, so the closed-surface scan can name them. */
export const LOOP_RECORD_KINDS = [LOOP_SESSION_RECORD_KIND, LOOP_STOP_RECORD_KIND] as const;
