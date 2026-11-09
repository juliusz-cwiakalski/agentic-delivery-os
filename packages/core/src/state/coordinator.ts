/**
 * The additive coordinator record kinds over the injected state port (GH-241
 * F-10, EVT-1..EVT-5, EVT-7; DM-1..DM-5, DM-11; AC-F10-3).
 *
 * Additive inside `delivery.state.v1`: six record kinds under coordinator-scoped
 * keys, validated appends, verified reads, contiguous-ordinal classification,
 * and crash durability. No schema-version bump, no migration, and no change to
 * the delivered state contracts. Every append takes the delivered short-lived
 * write fence for that append only under the NON-CLAIM rule (one stale-lock
 * recovery, then a still-busy fence maps to `state.lock.busy`); the claim-acquire
 * rule and its `coordinator.already-running` refusal belong to the command tier.
 */
import {
  COORDINATOR_DECISION_KINDS,
  COORDINATOR_ERROR_CODES,
  COORDINATOR_EXHAUSTION_KEY_PREFIX,
  COORDINATOR_EXHAUSTION_OPTIONS,
  COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
  COORDINATOR_EXHAUSTION_RECORD_KIND,
  COORDINATOR_EXTERNAL_UNITS,
  COORDINATOR_FENCE_ACTIONS,
  COORDINATOR_FENCE_KEY_PREFIX,
  COORDINATOR_FENCE_PAYLOAD_SCHEMA,
  COORDINATOR_FENCE_RECORD_KIND,
  COORDINATOR_ITERATION_KEY_PREFIX,
  COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
  COORDINATOR_ITERATION_RECORD_KIND,
  COORDINATOR_ITERATION_REASONS,
  COORDINATOR_ITERATION_TRIGGERS,
  COORDINATOR_KILL_FAILURE_REASONS,
  COORDINATOR_KILL_OUTCOMES,
  COORDINATOR_PERSISTED_VERDICTS,
  COORDINATOR_RESTART_KEY_PREFIX,
  COORDINATOR_RESTART_PAYLOAD_SCHEMA,
  COORDINATOR_RESTART_REASONS,
  COORDINATOR_RESTART_RECORD_KIND,
  COORDINATOR_STUCK_KEY_PREFIX,
  COORDINATOR_STUCK_PAYLOAD_SCHEMA,
  COORDINATOR_STUCK_PHASES,
  COORDINATOR_STUCK_REASONS,
  COORDINATOR_STUCK_RECORD_KIND,
  COORDINATOR_SUPERVISOR_MODES,
  COORDINATOR_WAKE_KEY_PREFIX,
  COORDINATOR_WAKE_PAYLOAD_SCHEMA,
  COORDINATOR_WAKE_RECORD_KIND,
  type CoordinatorExhaustionOption,
  type CoordinatorExhaustionRecord,
  type CoordinatorFenceRecord,
  type CoordinatorIterationRecord,
  type CoordinatorRestartRecord,
  type CoordinatorStuckRecord,
  type CoordinatorWakeRecord,
  type StateFailureCode,
  type StateJsonValue,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/* -------------------------------- keys ----------------------------------- */

export const coordinatorIterationKey = (coordinatorId: string): string =>
  `${COORDINATOR_ITERATION_KEY_PREFIX}${coordinatorId}`;
export const coordinatorRestartKey = (coordinatorId: string): string =>
  `${COORDINATOR_RESTART_KEY_PREFIX}${coordinatorId}`;
export const coordinatorStuckKey = (coordinatorId: string): string =>
  `${COORDINATOR_STUCK_KEY_PREFIX}${coordinatorId}`;
export const coordinatorExhaustionKey = (coordinatorId: string): string =>
  `${COORDINATOR_EXHAUSTION_KEY_PREFIX}${coordinatorId}`;
export const coordinatorWakeKey = (coordinatorId: string): string =>
  `${COORDINATOR_WAKE_KEY_PREFIX}${coordinatorId}`;
export const coordinatorFenceKey = (coordinatorId: string): string =>
  `${COORDINATOR_FENCE_KEY_PREFIX}${coordinatorId}`;

/** The key a record kind is stored under; identity is the coordinator id. */
export const coordinatorKeyFor = (
  kind:
    | typeof COORDINATOR_ITERATION_RECORD_KIND
    | typeof COORDINATOR_RESTART_RECORD_KIND
    | typeof COORDINATOR_STUCK_RECORD_KIND
    | typeof COORDINATOR_EXHAUSTION_RECORD_KIND
    | typeof COORDINATOR_WAKE_RECORD_KIND
    | typeof COORDINATOR_FENCE_RECORD_KIND,
  coordinatorId: string,
): string => {
  switch (kind) {
    case COORDINATOR_ITERATION_RECORD_KIND:
      return coordinatorIterationKey(coordinatorId);
    case COORDINATOR_RESTART_RECORD_KIND:
      return coordinatorRestartKey(coordinatorId);
    case COORDINATOR_STUCK_RECORD_KIND:
      return coordinatorStuckKey(coordinatorId);
    case COORDINATOR_EXHAUSTION_RECORD_KIND:
      return coordinatorExhaustionKey(coordinatorId);
    case COORDINATOR_WAKE_RECORD_KIND:
      return coordinatorWakeKey(coordinatorId);
    case COORDINATOR_FENCE_RECORD_KIND:
      return coordinatorFenceKey(coordinatorId);
  }
};

/* ------------------------------ outcomes --------------------------------- */

/** A classified coordinator read: the folded set or a state failure code. */
export type CoordinatorRecordsRead =
  | {
      readonly ok: true;
      readonly coordinatorId: string;
      readonly iterations: readonly CoordinatorIterationRecord[];
      readonly restarts: readonly CoordinatorRestartRecord[];
      readonly stuck: readonly CoordinatorStuckRecord[];
      readonly exhaustion: readonly CoordinatorExhaustionRecord[];
      readonly wakes: readonly CoordinatorWakeRecord[];
      readonly fences: readonly CoordinatorFenceRecord[];
      readonly verifiedEmpty: boolean;
    }
  | {
      readonly ok: false;
      readonly code: StateFailureCode;
      readonly location?: StateSafeLocation;
    };

/** One classified append result. `appended: false` is an idempotent replay. */
export type CoordinatorAppendOutcome =
  | {
      readonly ok: true;
      readonly appended: boolean;
      readonly sequence?: number;
      readonly record: unknown;
    }
  | {
      readonly ok: false;
      readonly code: StateFailureCode | "state.write.failed";
      readonly location?: StateSafeLocation;
    };

const READ_FAILURE_CODES = new Set<string>([
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

const classifyReadFailure = (code: string): StateFailureCode =>
  READ_FAILURE_CODES.has(code) ? (code as StateFailureCode) : "state.store.torn";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const inVocabulary = (values: readonly string[], value: unknown): boolean =>
  typeof value === "string" && values.includes(value);

const torn = (_location: StateSafeLocation): { ok: false; code: StateFailureCode } => ({
  ok: false,
  code: "state.store.torn",
});

const unknown = (_location: StateSafeLocation): { ok: false; code: StateFailureCode } => ({
  ok: false,
  code: "state.store.unknown",
});

/* ------------------------------ validation ------------------------------- */

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: StateFailureCode };

const iterationFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorIterationRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_ITERATION_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.iterationId)) return torn(location);
  if (!inVocabulary(COORDINATOR_ITERATION_TRIGGERS, value.trigger)) return torn(location);
  if (!inVocabulary(COORDINATOR_DECISION_KINDS, value.decision)) return torn(location);
  if (!inVocabulary(COORDINATOR_ITERATION_REASONS, value.reason)) return torn(location);
  if (value.sessionId !== null && !isNonEmptyString(value.sessionId)) return torn(location);
  if (value.contextTokens !== null && !isNonNegativeInteger(value.contextTokens)) {
    return torn(location);
  }
  if (!isNonEmptyString(value.digestFingerprint)) return torn(location);
  if (!isPositiveInteger(value.expectationWindowMs)) return torn(location);
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
      iterationId: value.iterationId,
      coordinatorId,
      trigger: value.trigger as CoordinatorIterationRecord["trigger"],
      decision: value.decision as CoordinatorIterationRecord["decision"],
      reason: value.reason as CoordinatorIterationRecord["reason"],
      sessionId: value.sessionId === null ? null : (value.sessionId as string),
      contextTokens: value.contextTokens === null ? null : (value.contextTokens as number),
      digestFingerprint: value.digestFingerprint,
      expectationWindowMs: value.expectationWindowMs,
      recordedAt: value.recordedAt,
    },
  };
};

const restartFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorRestartRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_RESTART_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.restartId)) return torn(location);
  if (!isNonEmptyString(value.budgetEpochId)) return torn(location);
  if (value.sessionId !== null && !isNonEmptyString(value.sessionId)) return torn(location);
  if (!isPositiveInteger(value.ordinal)) return torn(location);
  if (!inVocabulary(COORDINATOR_RESTART_REASONS, value.reason)) return torn(location);
  if (value.previousSessionId !== null && !isNonEmptyString(value.previousSessionId)) {
    return torn(location);
  }
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_RESTART_PAYLOAD_SCHEMA,
      restartId: value.restartId,
      coordinatorId,
      budgetEpochId: value.budgetEpochId,
      sessionId: value.sessionId === null ? null : (value.sessionId as string),
      ordinal: value.ordinal,
      reason: value.reason as CoordinatorRestartRecord["reason"],
      previousSessionId:
        value.previousSessionId === null ? null : (value.previousSessionId as string),
      recordedAt: value.recordedAt,
    },
  };
};

const stuckFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorStuckRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_STUCK_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.stuckId)) return torn(location);
  if (!isNonEmptyString(value.iterationId)) return torn(location);
  if (!inVocabulary(COORDINATOR_PERSISTED_VERDICTS, value.verdict)) return torn(location);
  if (!inVocabulary(COORDINATOR_STUCK_PHASES, value.phase)) return torn(location);
  if (!inVocabulary(COORDINATOR_STUCK_REASONS, value.reason)) return torn(location);
  if (typeof value.evidence !== "string") return torn(location);
  if (!inVocabulary(COORDINATOR_KILL_OUTCOMES, value.killOutcome)) return torn(location);
  const failureReason = value.killFailureReason ?? null;
  if (failureReason !== null && !inVocabulary(COORDINATOR_KILL_FAILURE_REASONS, failureReason)) {
    return torn(location);
  }
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  // The closed verdict/reason coupling is enforced on read.
  if (value.verdict === "stuck" && value.reason !== "stuck-artifact-evidence") {
    return torn(location);
  }
  if (value.verdict === "unevaluable") {
    if (value.reason !== "evidence-unevaluable") return torn(location);
    if (value.phase !== "verdict") return torn(location);
    if (value.killOutcome !== "not-attempted") return torn(location);
  }
  if (value.phase === "verdict" && value.killOutcome !== "not-attempted") return torn(location);
  if (value.phase === "outcome" && value.killOutcome === "not-attempted") return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_STUCK_PAYLOAD_SCHEMA,
      stuckId: value.stuckId,
      coordinatorId,
      iterationId: value.iterationId,
      verdict: value.verdict as CoordinatorStuckRecord["verdict"],
      phase: value.phase as CoordinatorStuckRecord["phase"],
      reason: value.reason as CoordinatorStuckRecord["reason"],
      evidence: value.evidence,
      killOutcome: value.killOutcome as CoordinatorStuckRecord["killOutcome"],
      killFailureReason:
        failureReason === null
          ? null
          : (failureReason as CoordinatorStuckRecord["killFailureReason"]),
      recordedAt: value.recordedAt,
    },
  };
};

const exhaustionFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorExhaustionRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.exhaustionId)) return torn(location);
  if (!isNonEmptyString(value.budgetEpochId)) return torn(location);
  if (!isNonNegativeInteger(value.restarts)) return torn(location);
  if (!isNonEmptyString(value.historyRef)) return torn(location);
  if (!isNonEmptyString(value.escalationQuestionId)) return torn(location);
  if (!Array.isArray(value.options)) return torn(location);
  const options: CoordinatorExhaustionOption[] = [];
  for (const option of value.options) {
    if (!inVocabulary(COORDINATOR_EXHAUSTION_OPTIONS, option)) return torn(location);
    options.push(option as CoordinatorExhaustionOption);
  }
  if (value.terminal !== true) return torn(location);
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
      exhaustionId: value.exhaustionId,
      coordinatorId,
      budgetEpochId: value.budgetEpochId,
      restarts: value.restarts,
      historyRef: value.historyRef,
      escalationQuestionId: value.escalationQuestionId,
      options,
      terminal: true,
      recordedAt: value.recordedAt,
    },
  };
};

const wakeFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorWakeRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_WAKE_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.wakeId)) return torn(location);
  if (!isNonEmptyString(value.questionId)) return torn(location);
  if (!isPositiveInteger(value.questionRank)) return torn(location);
  if (!isNonEmptyString(value.askedAt)) return torn(location);
  if (value.outcome !== "woken") return torn(location);
  if (value.iterationId !== null && !isNonEmptyString(value.iterationId)) return torn(location);
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_WAKE_PAYLOAD_SCHEMA,
      wakeId: value.wakeId,
      coordinatorId,
      questionId: value.questionId,
      questionRank: value.questionRank,
      askedAt: value.askedAt,
      outcome: "woken",
      iterationId: value.iterationId === null ? null : (value.iterationId as string),
      recordedAt: value.recordedAt,
    },
  };
};

const fenceFrom = (value: unknown, coordinatorId: string, location: StateSafeLocation): Parsed<CoordinatorFenceRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== COORDINATOR_FENCE_PAYLOAD_SCHEMA) return torn(location);
  if (value.coordinatorId !== coordinatorId) return unknown(location);
  if (!isNonEmptyString(value.fenceId)) return torn(location);
  if (!isNonEmptyString(value.instanceId)) return torn(location);
  if (!inVocabulary(COORDINATOR_FENCE_ACTIONS, value.action)) return torn(location);
  if (!isNonEmptyString(value.holder)) return torn(location);
  if (!isPositiveInteger(value.pid)) return torn(location);
  if (!isNonNegativeInteger(value.processStartTimeMs)) return torn(location);
  if (!inVocabulary(COORDINATOR_SUPERVISOR_MODES, value.supervisorMode)) return torn(location);
  if (!inVocabulary(COORDINATOR_EXTERNAL_UNITS, value.externalUnit)) return torn(location);
  if (value.previousHolder !== null && !isNonEmptyString(value.previousHolder)) {
    return torn(location);
  }
  if (value.fenceAgeMs !== null && !isNonNegativeInteger(value.fenceAgeMs)) return torn(location);
  if (value.action === "stale-takeover") {
    if (value.previousHolder === null) return torn(location);
  } else if (value.previousHolder !== null) {
    return torn(location);
  }
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: COORDINATOR_FENCE_PAYLOAD_SCHEMA,
      fenceId: value.fenceId,
      instanceId: value.instanceId,
      coordinatorId,
      action: value.action as CoordinatorFenceRecord["action"],
      holder: value.holder,
      pid: value.pid,
      processStartTimeMs: value.processStartTimeMs,
      supervisorMode: value.supervisorMode as CoordinatorFenceRecord["supervisorMode"],
      externalUnit: value.externalUnit as CoordinatorFenceRecord["externalUnit"],
      previousHolder: value.previousHolder === null ? null : (value.previousHolder as string),
      fenceAgeMs: value.fenceAgeMs === null ? null : (value.fenceAgeMs as number),
      recordedAt: value.recordedAt,
    },
  };
};

/* -------------------------------- reads ---------------------------------- */

const recordLocation = (path: string, record: number): StateSafeLocation => ({ path, record });

/**
 * Read one coordinator's verified records.
 *
 * Every coordinator record under the coordinator id is validated before any
 * value returns: kind/schema, required fields, closed vocabularies, the
 * verdict/reason coupling, and duplicate identities (the two `stuck` phases
 * sharing one `stuckId` are the only admitted duplicate). A kind/schema/key
 * mismatch is `state.store.unknown`; a malformed or contradictory record is
 * `state.store.torn`.
 */
export const readCoordinatorRecords = (
  store: StateStorePort,
  coordinatorId: string,
): CoordinatorRecordsRead => {
  const verified = store.readRecords();
  if (!verified.ok) {
    return {
      ok: false,
      code: classifyReadFailure(verified.error.code),
      ...(verified.error.location === undefined ? {} : { location: verified.error.location }),
    };
  }
  const iterations: CoordinatorIterationRecord[] = [];
  const restarts: CoordinatorRestartRecord[] = [];
  const stuck: CoordinatorStuckRecord[] = [];
  const exhaustion: CoordinatorExhaustionRecord[] = [];
  const wakes: CoordinatorWakeRecord[] = [];
  const fences: CoordinatorFenceRecord[] = [];
  const iterationIds = new Set<string>();
  const restartIds = new Set<string>();
  const restartOrdinals = new Set<string>();
  const stuckPairs = new Set<string>();
  const wakeKeys = new Set<string>();

  const fail = (code: StateFailureCode, location: StateSafeLocation): CoordinatorRecordsRead => ({
    ok: false,
    code,
    location,
  });

  for (const record of verified.value.records) {
    if (!String(record.kind).startsWith("coordinator.")) continue;
    const location = recordLocation(verified.value.evidence.storePath, record.sequence);
    const key = record.key;
    if (!COORDINATOR_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return fail("state.store.unknown", location);
    }
    if (record.kind === COORDINATOR_ITERATION_RECORD_KIND) {
      if (key !== coordinatorIterationKey(coordinatorId)) continue;
      const parsed = iterationFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      if (iterationIds.has(parsed.value.iterationId)) return fail("state.store.torn", location);
      iterationIds.add(parsed.value.iterationId);
      iterations.push(parsed.value);
      continue;
    }
    if (record.kind === COORDINATOR_RESTART_RECORD_KIND) {
      if (key !== coordinatorRestartKey(coordinatorId)) continue;
      const parsed = restartFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      if (restartIds.has(parsed.value.restartId)) return fail("state.store.torn", location);
      const ordinalKey = `${parsed.value.budgetEpochId}#${parsed.value.ordinal}`;
      if (restartOrdinals.has(ordinalKey)) return fail("state.store.torn", location);
      restartIds.add(parsed.value.restartId);
      restartOrdinals.add(ordinalKey);
      restarts.push(parsed.value);
      continue;
    }
    if (record.kind === COORDINATOR_STUCK_RECORD_KIND) {
      if (key !== coordinatorStuckKey(coordinatorId)) continue;
      const parsed = stuckFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      const pairKey = `${parsed.value.stuckId}#${parsed.value.phase}`;
      if (stuckPairs.has(pairKey)) return fail("state.store.torn", location);
      stuckPairs.add(pairKey);
      stuck.push(parsed.value);
      continue;
    }
    if (record.kind === COORDINATOR_EXHAUSTION_RECORD_KIND) {
      if (key !== coordinatorExhaustionKey(coordinatorId)) continue;
      const parsed = exhaustionFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      if (exhaustion.length > 0) return fail("state.store.torn", location);
      exhaustion.push(parsed.value);
      continue;
    }
    if (record.kind === COORDINATOR_WAKE_RECORD_KIND) {
      if (key !== coordinatorWakeKey(coordinatorId)) continue;
      const parsed = wakeFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      const wakeKey = `${parsed.value.questionId}#${parsed.value.askedAt}`;
      if (wakeKeys.has(wakeKey)) return fail("state.store.torn", location);
      wakeKeys.add(wakeKey);
      wakes.push(parsed.value);
      continue;
    }
    if (record.kind === COORDINATOR_FENCE_RECORD_KIND) {
      if (key !== coordinatorFenceKey(coordinatorId)) continue;
      const parsed = fenceFrom(record.payload, coordinatorId, location);
      if (!parsed.ok) return fail(parsed.code, location);
      fences.push(parsed.value);
      continue;
    }
    return fail("state.store.unknown", location);
  }

  return {
    ok: true,
    coordinatorId,
    iterations,
    restarts,
    stuck,
    exhaustion,
    wakes,
    fences,
    verifiedEmpty:
      iterations.length === 0 &&
      restarts.length === 0 &&
      stuck.length === 0 &&
      exhaustion.length === 0 &&
      wakes.length === 0 &&
      fences.length === 0,
  };
};

/* -------------------------------- folds ---------------------------------- */

/**
 * Fold the two-phase stuck records latest-wins per `stuckId` by ledger sequence.
 *
 * The input order is ledger order, so the last record for a `stuckId` wins;
 * `recordedAt` is descriptive only and never a tie-break.
 */
export const foldCoordinatorStuck = (
  records: readonly CoordinatorStuckRecord[],
): Readonly<Record<string, CoordinatorStuckRecord>> => {
  const folded: Record<string, CoordinatorStuckRecord> = {};
  for (const record of records) folded[record.stuckId] = record;
  return folded;
};

/** The last recorded lifecycle decision (latest iteration by ledger sequence). */
export const foldCoordinatorDecision = (
  records: readonly CoordinatorIterationRecord[],
): CoordinatorIterationRecord | null => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && record.decision !== "none") return record;
  }
  return null;
};

/** The last durable wake record (latest by ledger sequence). */
export const foldCoordinatorWake = (
  records: readonly CoordinatorWakeRecord[],
): CoordinatorWakeRecord | null => {
  const last = records[records.length - 1];
  return last ?? null;
};

/* ------------------------------- appends --------------------------------- */

const appendFailure = (
  code: string,
  location?: StateSafeLocation,
): CoordinatorAppendOutcome => {
  const classified: StateFailureCode | "state.write.failed" =
    code === "state.write.failed"
      ? "state.write.failed"
      : READ_FAILURE_CODES.has(code)
        ? (code as StateFailureCode)
        : "state.write.failed";
  return location === undefined
    ? { ok: false, code: classified }
    : { ok: false, code: classified, location };
};

const toJson = (value: object): StateJsonValue => JSON.parse(JSON.stringify(value)) as StateJsonValue;

/** The coordinator key prefixes; a coordinator record outside them is unknown. */
const COORDINATOR_KEY_PREFIXES = [
  COORDINATOR_ITERATION_KEY_PREFIX,
  COORDINATOR_RESTART_KEY_PREFIX,
  COORDINATOR_STUCK_KEY_PREFIX,
  COORDINATOR_EXHAUSTION_KEY_PREFIX,
  COORDINATOR_WAKE_KEY_PREFIX,
  COORDINATOR_FENCE_KEY_PREFIX,
] as const;

/**
 * Append one validated payload under the NON-CLAIM per-append state write fence
 * rule (AC-F8-7, AC-F10-3).
 *
 * One `acquireFence`; on `state.lock.busy` read `fenceStatus()`, and when the
 * lock is stale perform exactly one `recoverFence` and exactly one retry. A
 * still-busy (or non-stale) fence after that recovery maps to the delivered
 * `state.lock.busy` identity — never to `coordinator.already-running`. The fence
 * is released in a `finally` and never held across a cycle.
 */
export const appendCoordinatorPayload = (
  store: StateStorePort,
  token: string,
  request: { readonly kind: string; readonly recordKey: string; readonly payload: unknown },
): { readonly ok: true; readonly sequence: number } | { readonly ok: false; readonly code: StateFailureCode } => {
  let acquired = store.acquireFence(token);
  if (!acquired.ok && acquired.error.code === "state.lock.busy") {
    const status = store.fenceStatus();
    if (status.stale) {
      const recovered = store.recoverFence(token);
      if (recovered.ok) acquired = store.acquireFence(token);
    }
  }
  if (!acquired.ok) {
    return { ok: false, code: classifyReadFailure(acquired.error.code) };
  }
  const handle = acquired.value.handle;
  try {
    const appended = store.append(handle, {
      kind: request.kind,
      recordKey: request.recordKey,
      payload: request.payload as StateJsonValue,
    });
    if (!appended.ok) {
      return { ok: false, code: classifyReadFailure(appended.error.code) };
    }
    return { ok: true, sequence: appended.value.sequence };
  } finally {
    store.releaseFence(handle);
  }
};

const appendVerified = (
  store: StateStorePort,
  token: string,
  request: { readonly kind: string; readonly recordKey: string; readonly payload: unknown },
): { readonly ok: true; readonly sequence: number } | { readonly ok: false; readonly code: StateFailureCode } =>
  appendCoordinatorPayload(store, token, request);

const replay = (record: unknown): CoordinatorAppendOutcome => ({
  ok: true,
  appended: false,
  record,
});

/** Append one iteration record; a replayed `iterationId` appends nothing. */
export const appendCoordinatorIteration = (
  store: StateStorePort,
  token: string,
  record: CoordinatorIterationRecord,
): CoordinatorAppendOutcome => {
  const read = readCoordinatorRecords(store, record.coordinatorId);
  if (!read.ok) return appendFailure(read.code, read.location);
  const existing = read.iterations.find((entry) => entry.iterationId === record.iterationId);
  if (existing !== undefined) return replay(existing);
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_ITERATION_RECORD_KIND,
    recordKey: coordinatorIterationKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** Append one restart record; a replayed `restartId` or ordinal appends nothing. */
export const appendCoordinatorRestart = (
  store: StateStorePort,
  token: string,
  record: CoordinatorRestartRecord,
): CoordinatorAppendOutcome => {
  const read = readCoordinatorRecords(store, record.coordinatorId);
  if (!read.ok) return appendFailure(read.code, read.location);
  const existing = read.restarts.find(
    (entry) =>
      entry.restartId === record.restartId ||
      (entry.budgetEpochId === record.budgetEpochId && entry.ordinal === record.ordinal),
  );
  if (existing !== undefined) return replay(existing);
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_RESTART_RECORD_KIND,
    recordKey: coordinatorRestartKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** Append one stuck phase; a replayed `(stuckId, phase)` appends nothing. */
export const appendCoordinatorStuck = (
  store: StateStorePort,
  token: string,
  record: CoordinatorStuckRecord,
): CoordinatorAppendOutcome => {
  const read = readCoordinatorRecords(store, record.coordinatorId);
  if (!read.ok) return appendFailure(read.code, read.location);
  const existing = read.stuck.find(
    (entry) => entry.stuckId === record.stuckId && entry.phase === record.phase,
  );
  if (existing !== undefined) return replay(existing);
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_STUCK_RECORD_KIND,
    recordKey: coordinatorStuckKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** Append the single terminal exhaustion receipt per epoch (idempotent). */
export const appendCoordinatorExhaustion = (
  store: StateStorePort,
  token: string,
  record: CoordinatorExhaustionRecord,
): CoordinatorAppendOutcome => {
  const read = readCoordinatorRecords(store, record.coordinatorId);
  if (!read.ok) return appendFailure(read.code, read.location);
  const existing = read.exhaustion.find(
    (entry) => entry.exhaustionId === record.exhaustionId,
  );
  if (existing !== undefined) return replay(existing);
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_EXHAUSTION_RECORD_KIND,
    recordKey: coordinatorExhaustionKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** Append one durable wake record; a replay of the dedupe key appends nothing. */
export const appendCoordinatorWake = (
  store: StateStorePort,
  token: string,
  record: CoordinatorWakeRecord,
): CoordinatorAppendOutcome => {
  const read = readCoordinatorRecords(store, record.coordinatorId);
  if (!read.ok) return appendFailure(read.code, read.location);
  const existing = read.wakes.find(
    (entry) => entry.questionId === record.questionId && entry.askedAt === record.askedAt,
  );
  if (existing !== undefined) return replay(existing);
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_WAKE_RECORD_KIND,
    recordKey: coordinatorWakeKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/**
 * Append one instance-lease action. Fence records are append-only events and are
 * never deduplicated: the claim logic decides whether an `acquired` or one
 * `stale-takeover` lands.
 */
export const appendCoordinatorFence = (
  store: StateStorePort,
  token: string,
  record: CoordinatorFenceRecord,
): CoordinatorAppendOutcome => {
  const appended = appendVerified(store, token, {
    kind: COORDINATOR_FENCE_RECORD_KIND,
    recordKey: coordinatorFenceKey(record.coordinatorId),
    payload: toJson(record),
  });
  if (!appended.ok) return appendFailure(appended.code);
  return { ok: true, appended: true, sequence: appended.sequence, record };
};

/** The coordinator error identities, re-exported for the state-tier consumer. */
export const COORDINATOR_STATE_ERROR_IDENTITIES = COORDINATOR_ERROR_CODES;
