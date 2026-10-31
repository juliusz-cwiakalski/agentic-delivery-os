/**
 * Delivery registry records over the injected state port (GH-179 C-5, D3).
 *
 * The registry contributes the `phase.transition` record domain and a derived
 * per-change projection (`phase-state.<REF>.json`) over the GH-174 store port.
 * It composes only the public port operations: a fenced append, verified reads
 * with the registry's declared key set, and an atomically replaced document.
 * No runtime API is touched here; the driver edge remains the only one in core.
 */
import {
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  PHASE_TRANSITION_KIND,
  type PhaseStateProjection,
  type PhaseStateProjectionEntry,
  type PhaseTransitionOperation,
  type PhaseTransitionRecord,
  REGISTRY_SCHEMA_VERSION,
  type StateAppendOutcome,
  type StateDocumentReport,
  type StateFailure,
  type StateJsonValue,
  type StateReadEvidence,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The registry's declared record-key prefix (one in-flight history per change). */
export const PHASE_TRANSITION_RECORD_KEY_PREFIX = "phase.transitions:" as const;

/** The store-scoped key the registry appends and reads (D3 key-set declaration). */
export const phaseTransitionRecordKey = (changeRef: string): string =>
  `${PHASE_TRANSITION_RECORD_KEY_PREFIX}${changeRef}`;

/** The derived projection document name for a change (PIN-3). */
export const phaseStateDocumentName = (changeRef: string): string =>
  `${PHASE_STATE_DOCUMENT_PREFIX}${changeRef}${PHASE_STATE_DOCUMENT_SUFFIX}`;

/** One fenced landing request; `reason` is reopen-only (C-5). */
export type PhaseTransitionRequest = {
  readonly changeRef: string;
  readonly phaseId: string;
  readonly operation: PhaseTransitionOperation;
  readonly timestamp: string;
  readonly fenceToken: string;
  readonly reason?: string;
};

/** A verified per-change read: history plus the state layer's evidence. */
export type PhaseTransitionsRead = {
  readonly changeRef: string;
  readonly verifiedEmpty: boolean;
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly evidence: StateReadEvidence;
};

/**
 * A presence-tolerant verified read (PIN-6): an absent per-change record in a
 * verified store is no evidence (`present: false`), never `state.keys.missing`.
 */
export type PhaseTransitionsTolerantRead = {
  readonly changeRef: string;
  readonly present: boolean;
  readonly verifiedEmpty: boolean;
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly evidence: StateReadEvidence;
};

/** One landing: the new record, the full history, and the append outcome. */
export type PhaseTransitionAppendOutcome = {
  readonly record: PhaseTransitionRecord;
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly append: StateAppendOutcome;
  readonly fenceReleased: boolean;
};

/** One atomic projection replace: the folded content and the document report. */
export type PhaseProjectionOutcome = {
  readonly projection: PhaseStateProjection;
  readonly document: StateDocumentReport;
  readonly fenceReleased: boolean;
};

/** A rebuild: verified ledger truth folded, then the projection replaced. */
export type PhaseProjectionRebuildOutcome = PhaseProjectionOutcome & {
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly evidence: StateReadEvidence;
  readonly verifiedEmpty: boolean;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (code: StateFailure["code"], location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const payloadFor = (
  record: PhaseTransitionRecord,
  transitions: readonly PhaseTransitionRecord[],
): StateJsonValue => ({
  changeRef: record.changeRef,
  phaseId: record.phaseId,
  operation: record.operation,
  timestamp: record.timestamp,
  outcome: record.outcome,
  ...(record.reason === undefined ? {} : { reason: record.reason }),
  transitions: transitions.map((entry) => ({
    changeRef: entry.changeRef,
    phaseId: entry.phaseId,
    operation: entry.operation,
    timestamp: entry.timestamp,
    outcome: entry.outcome,
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
  })),
});

const projectionJson = (projection: PhaseStateProjection): StateJsonValue => {
  const phases: Record<string, StateJsonValue> = {};
  for (const [phaseId, entry] of Object.entries(projection.phases)) {
    phases[phaseId] = { started: entry.started, completed: entry.completed };
  }
  return {
    schemaVersion: projection.schemaVersion,
    changeRef: projection.changeRef,
    phases,
  };
};

const transitionFrom = (value: unknown): PhaseTransitionRecord | string => {
  if (!isRecord(value)) return "transitions[]";
  const missing = ["changeRef", "phaseId", "operation", "timestamp", "outcome"].filter(
    (key) => !Object.hasOwn(value, key),
  );
  if (missing.length > 0) return `transitions[].${missing[0] as string}`;
  const { changeRef, phaseId, operation, timestamp, outcome, reason } = value;
  if (typeof changeRef !== "string" || changeRef.length === 0) return "transitions[].changeRef";
  if (typeof phaseId !== "string" || phaseId.length === 0) return "transitions[].phaseId";
  if (operation !== "complete" && operation !== "reopen") return "transitions[].operation";
  if (typeof timestamp !== "string" || timestamp.length === 0) return "transitions[].timestamp";
  if (outcome !== "landed") return "transitions[].outcome";
  if (reason !== undefined && typeof reason !== "string") return "transitions[].reason";
  if (reason !== undefined && operation !== "reopen") return "transitions[].reason";
  return {
    changeRef,
    phaseId,
    operation,
    timestamp,
    outcome,
    ...(reason === undefined ? {} : { reason }),
  };
};

const parseTransitions = (
  payload: StateJsonValue | undefined,
  location: StateSafeLocation,
): StateResult<readonly PhaseTransitionRecord[]> => {
  if (!isRecord(payload)) {
    return fail("state.store.torn", location);
  }
  const raw = payload.transitions;
  if (!Array.isArray(raw)) {
    return fail("state.keys.missing", { ...location, missingKeys: ["transitions"] });
  }
  const records: PhaseTransitionRecord[] = [];
  for (const entry of raw) {
    const parsed = transitionFrom(entry);
    if (typeof parsed === "string") {
      return fail("state.keys.missing", { ...location, missingKeys: [parsed] });
    }
    records.push(parsed);
  }
  return ok(records);
};

/**
 * Read one change's verified `phase.transition` history (AC-L5).
 *
 * An absent registry is an explicit verified-empty outcome; a torn, schema, or
 * key-set failure is the state layer's classified error, never a zero value.
 */
export const readChangeTransitions = (
  store: StateStorePort,
  changeRef: string,
): StateResult<PhaseTransitionsRead> => {
  const probe = store.read({ requiredKeys: [] });
  if (!probe.ok) return probe;
  if (probe.value.evidence.verifiedEmpty) {
    return ok({
      changeRef,
      verifiedEmpty: true,
      transitions: [],
      evidence: probe.value.evidence,
    });
  }
  const recordKey = phaseTransitionRecordKey(changeRef);
  const read = store.read({ requiredKeys: [recordKey] });
  if (!read.ok) return read;
  const parsed = parseTransitions(read.value.values[recordKey], {
    path: read.value.evidence.storePath,
    record: read.value.evidence.recordCount,
  });
  if (!parsed.ok) return parsed;
  return ok({
    changeRef,
    verifiedEmpty: false,
    transitions: parsed.value,
    evidence: read.value.evidence,
  });
};

/**
 * Read one change's verified history with presence tolerance (PIN-6).
 *
 * The store is verified first. A verified-empty (or absent) store and an absent
 * per-change record are both no evidence; a corrupt per-change payload remains
 * the existing classified `state.*` failure. The derived projection is never
 * read, and nothing is written.
 */
export const readChangeTransitionsTolerant = (
  store: StateStorePort,
  changeRef: string,
): StateResult<PhaseTransitionsTolerantRead> => {
  const probe = store.read({ requiredKeys: [] });
  if (!probe.ok) return probe;
  if (probe.value.evidence.verifiedEmpty) {
    return ok({
      changeRef,
      present: false,
      verifiedEmpty: true,
      transitions: [],
      evidence: probe.value.evidence,
    });
  }
  const recordKey = phaseTransitionRecordKey(changeRef);
  const read = store.read({ requiredKeys: [recordKey] });
  if (!read.ok) {
    const absentRecord =
      read.error.code === "state.keys.missing" &&
      (read.error.location.missingKeys ?? []).includes(recordKey);
    if (!absentRecord) return read;
    return ok({
      changeRef,
      present: false,
      verifiedEmpty: false,
      transitions: [],
      evidence: probe.value.evidence,
    });
  }
  const parsed = parseTransitions(read.value.values[recordKey], {
    path: read.value.evidence.storePath,
    record: read.value.evidence.recordCount,
  });
  if (!parsed.ok) return parsed;
  return ok({
    changeRef,
    present: true,
    verifiedEmpty: false,
    transitions: parsed.value,
    evidence: read.value.evidence,
  });
};

/**
 * Pure ledger fold: complete sets `started` (first completion) and the latest
 * completion; reopen clears `completed` but keeps the recorded start. The
 * projection carries no timestamp or non-fold field (PIN-3).
 */
export const foldPhaseState = (
  changeRef: string,
  transitions: readonly PhaseTransitionRecord[],
): PhaseStateProjection => {
  const phases: Record<string, PhaseStateProjectionEntry> = {};
  for (const transition of transitions) {
    const previous = phases[transition.phaseId];
    if (transition.operation === "complete") {
      phases[transition.phaseId] = {
        started: previous?.started ?? transition.timestamp,
        completed: transition.timestamp,
      };
      continue;
    }
    if (previous !== undefined) {
      phases[transition.phaseId] = { started: previous.started, completed: null };
    }
  }
  return { schemaVersion: REGISTRY_SCHEMA_VERSION, changeRef, phases };
};

/**
 * Append one landing transition under a single-writer fence. The whole verified
 * history travels in the record payload so a rebuild never needs an unverified
 * scan; a no-op never reaches this function.
 */
export const appendPhaseTransition = (
  store: StateStorePort,
  request: PhaseTransitionRequest,
): StateResult<PhaseTransitionAppendOutcome> => {
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const current = readChangeTransitions(store, request.changeRef);
  if (!current.ok) {
    store.releaseFence(handle);
    return current;
  }
  const record: PhaseTransitionRecord = {
    changeRef: request.changeRef,
    phaseId: request.phaseId,
    operation: request.operation,
    timestamp: request.timestamp,
    outcome: "landed",
    ...(request.operation === "reopen" && request.reason !== undefined
      ? { reason: request.reason }
      : {}),
  };
  const transitions = [...current.value.transitions, record];
  const appended = store.append(handle, {
    kind: PHASE_TRANSITION_KIND,
    recordKey: phaseTransitionRecordKey(request.changeRef),
    payload: payloadFor(record, transitions),
  });
  if (!appended.ok) {
    store.releaseFence(handle);
    return appended;
  }
  const released = store.releaseFence(handle);
  return ok({
    record,
    transitions,
    append: appended.value,
    fenceReleased: released.ok && released.value.released,
  });
};

/** Atomically replace the derived projection with a pure fold of `transitions`. */
export const replacePhaseProjection = (
  store: StateStorePort,
  request: {
    readonly changeRef: string;
    readonly transitions: readonly PhaseTransitionRecord[];
    readonly fenceToken: string;
  },
): StateResult<PhaseProjectionOutcome> => {
  const projection = foldPhaseState(request.changeRef, request.transitions);
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const replaced = store.replaceDocument(handle, {
    name: phaseStateDocumentName(request.changeRef),
    content: projectionJson(projection),
  });
  if (!replaced.ok) {
    store.releaseFence(handle);
    return replaced;
  }
  const released = store.releaseFence(handle);
  return ok({
    projection,
    document: replaced.value,
    fenceReleased: released.ok && released.value.released,
  });
};

/**
 * Rebuild the projection from verified ledger truth. The read verifies the
 * ledger first, so a torn store never produces a projection (AC-L5).
 */
export const rebuildPhaseProjection = (
  store: StateStorePort,
  request: { readonly changeRef: string; readonly fenceToken: string },
): StateResult<PhaseProjectionRebuildOutcome> => {
  const read = readChangeTransitions(store, request.changeRef);
  if (!read.ok) return read;
  const replaced = replacePhaseProjection(store, {
    changeRef: request.changeRef,
    transitions: read.value.transitions,
    fenceToken: request.fenceToken,
  });
  if (!replaced.ok) return replaced;
  return ok({
    ...replaced.value,
    transitions: read.value.transitions,
    evidence: read.value.evidence,
    verifiedEmpty: read.value.verifiedEmpty,
  });
};
