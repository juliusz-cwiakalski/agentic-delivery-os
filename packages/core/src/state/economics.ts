/**
 * The additive economics record kinds over the injected state port (GH-235
 * F-4, DM-2, DM-3, DEC-3, D-4, D-10).
 *
 * Additive inside `delivery.state.v1`: one verified restart-event append per
 * admitted restart and one terminal exhaustion record per delivery, both under
 * the delivery's `economics/<work-item>` store key. No schema-version bump, no
 * migration, and no modified existing kind. Reads fold the verified ledger; the
 * port never caches a count.
 */
import {
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXHAUSTION_RECORD_KIND,
  ECONOMICS_EXHAUSTION_SCHEMA_ID,
  ECONOMICS_RECORD_FAILURE_CODES,
  ECONOMICS_RECORD_KEY_PREFIX,
  ECONOMICS_RESTART_REASONS,
  ECONOMICS_RESTART_RECORD_KIND,
  ECONOMICS_RESTART_SCHEMA_ID,
  type EconomicsExhaustionAppendOutcome,
  type EconomicsExhaustionOption,
  type EconomicsExhaustionRecord,
  type EconomicsRecordFailureCode,
  type EconomicsRecordsRead,
  type EconomicsRestartAppendOutcome,
  type EconomicsRestartRecord,
  type EconomicsResumeStorePort,
  type StateJsonValue,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The per-delivery store-scoped key carrying the delivery's economics records. */
export const economicsRecordKey = (workItemRef: string): string =>
  `${ECONOMICS_RECORD_KEY_PREFIX}${workItemRef}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const failureCodes = new Set<string>(ECONOMICS_RECORD_FAILURE_CODES);

const classifyReadFailure = (code: string): EconomicsRecordFailureCode =>
  failureCodes.has(code) ? (code as EconomicsRecordFailureCode) : "state.store.torn";

const locationOf = (error: { readonly location?: StateSafeLocation }): StateSafeLocation | undefined =>
  error.location;

const restartPayload = (record: EconomicsRestartRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  workItemRef: record.workItemRef,
  runId: record.runId,
  sessionId: record.sessionId,
  ordinal: record.ordinal,
  reason: record.reason,
  ...(record.repayTokens === undefined
    ? {}
    : {
        repayTokens: {
          inputTokens: record.repayTokens.inputTokens,
          outputTokens: record.repayTokens.outputTokens,
        },
      }),
  ...(record.observedUniqueProgressTokens === undefined
    ? {}
    : { observedUniqueProgressTokens: record.observedUniqueProgressTokens }),
  recordedAt: record.recordedAt,
});

const exhaustionPayload = (record: EconomicsExhaustionRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  workItemRef: record.workItemRef,
  runId: record.runId,
  reason: record.reason,
  restarts: record.restarts,
  historyRef: record.historyRef,
  terminal: record.terminal,
  options: [...record.options],
  recordedAt: record.recordedAt,
});

const restartFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<EconomicsRestartRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== ECONOMICS_RESTART_SCHEMA_ID) return torn(location);
  if (!isNonEmptyString(value.workItemRef)) return torn(location);
  if (!isNonEmptyString(value.runId)) return torn(location);
  if (!isNonEmptyString(value.sessionId)) return torn(location);
  if (!isPositiveInteger(value.ordinal)) return torn(location);
  if (
    typeof value.reason !== "string" ||
    !(ECONOMICS_RESTART_REASONS as readonly string[]).includes(value.reason)
  ) {
    return torn(location);
  }
  let repayTokens: EconomicsRestartRecord["repayTokens"];
  if (Object.hasOwn(value, "repayTokens")) {
    if (!isRecord(value.repayTokens)) return torn(location);
    if (
      !isNonNegativeInteger(value.repayTokens.inputTokens) ||
      !isNonNegativeInteger(value.repayTokens.outputTokens)
    ) {
      return torn(location);
    }
    repayTokens = {
      inputTokens: value.repayTokens.inputTokens,
      outputTokens: value.repayTokens.outputTokens,
    };
  }
  let observedUniqueProgressTokens: number | null | undefined;
  if (Object.hasOwn(value, "observedUniqueProgressTokens")) {
    const observed = value.observedUniqueProgressTokens;
    if (observed !== null && !isNonNegativeInteger(observed)) return torn(location);
    observedUniqueProgressTokens = observed === null ? null : (observed as number);
  }
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: ECONOMICS_RESTART_SCHEMA_ID,
      workItemRef: value.workItemRef,
      runId: value.runId,
      sessionId: value.sessionId,
      ordinal: value.ordinal,
      reason: value.reason as EconomicsRestartRecord["reason"],
      ...(repayTokens === undefined ? {} : { repayTokens }),
      ...(observedUniqueProgressTokens === undefined ? {} : { observedUniqueProgressTokens }),
      recordedAt: value.recordedAt,
    },
  };
};

const exhaustionFrom = (
  value: unknown,
  workItemRef: string,
  location: StateSafeLocation,
): StateResult<EconomicsExhaustionRecord> => {
  if (!isRecord(value)) return torn(location);
  if (value.schemaId !== ECONOMICS_EXHAUSTION_SCHEMA_ID) return torn(location);
  if (value.workItemRef !== workItemRef) return torn(location);
  if (!isNonEmptyString(value.runId)) return torn(location);
  if (value.reason !== "dispatch.restart-budget-exceeded") return torn(location);
  if (!isNonNegativeInteger(value.restarts)) return torn(location);
  if (!isNonEmptyString(value.historyRef)) return torn(location);
  if (value.terminal !== true) return torn(location);
  if (!Array.isArray(value.options)) return torn(location);
  const options: EconomicsExhaustionOption[] = [];
  for (const option of value.options) {
    if (
      typeof option !== "string" ||
      !(ECONOMICS_EXHAUSTION_OPTIONS as readonly string[]).includes(option)
    ) {
      return torn(location);
    }
    options.push(option as EconomicsExhaustionOption);
  }
  if (!isNonEmptyString(value.recordedAt)) return torn(location);
  return {
    ok: true,
    value: {
      schemaId: ECONOMICS_EXHAUSTION_SCHEMA_ID,
      workItemRef,
      runId: value.runId,
      reason: "dispatch.restart-budget-exceeded",
      restarts: value.restarts,
      historyRef: value.historyRef,
      terminal: true,
      options,
      recordedAt: value.recordedAt,
    },
  };
};

const torn = (location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code: "state.store.torn", consequence: "not_landed", location },
});

const readFailure = (code: string, location?: StateSafeLocation): EconomicsRecordsRead =>
  location === undefined
    ? { ok: false, code: classifyReadFailure(code) }
    : { ok: false, code: classifyReadFailure(code), location };

/**
 * Read one delivery's verified economics records. A restart record may repeat no
 * ordinal; a second terminal record is contradictory and classifies as torn; an
 * unknown record kind under the delivery key classifies as `state.store.unknown`.
 */
export const readEconomicsRecords = (
  store: StateStorePort,
  workItemRef: string,
): EconomicsRecordsRead => {
  const verified = store.readRecords();
  if (!verified.ok) return readFailure(verified.error.code, locationOf(verified.error));
  const key = economicsRecordKey(workItemRef);
  const restarts: EconomicsRestartRecord[] = [];
  const ordinals = new Set<number>();
  let terminal: EconomicsExhaustionRecord | undefined;
  for (const record of verified.value.records) {
    if (record.key !== key) continue;
    const location: StateSafeLocation = {
      path: verified.value.evidence.storePath,
      record: record.sequence,
    };
    if (record.kind === ECONOMICS_RESTART_RECORD_KIND) {
      const parsed = restartFrom(record.payload, location);
      if (!parsed.ok) return readFailure(parsed.error.code, parsed.error.location);
      if (parsed.value.workItemRef !== workItemRef) return readFailure("state.store.unknown", location);
      if (ordinals.has(parsed.value.ordinal)) return readFailure("state.store.torn", location);
      ordinals.add(parsed.value.ordinal);
      restarts.push(parsed.value);
      continue;
    }
    if (record.kind === ECONOMICS_EXHAUSTION_RECORD_KIND) {
      const parsed = exhaustionFrom(record.payload, workItemRef, location);
      if (!parsed.ok) return readFailure(parsed.error.code, parsed.error.location);
      if (terminal !== undefined) return readFailure("state.store.torn", location);
      terminal = parsed.value;
      continue;
    }
    return readFailure("state.store.unknown", location);
  }
  return {
    ok: true,
    workItemRef,
    restarts,
    ...(terminal === undefined ? {} : { terminal }),
    verifiedEmpty: restarts.length === 0 && terminal === undefined,
  };
};

type EconomicsAppendFailure = {
  readonly ok: false;
  readonly code: EconomicsRecordFailureCode | "state.write.failed";
  readonly location?: StateSafeLocation;
};

const appendFailure = (code: string, location?: StateSafeLocation): EconomicsAppendFailure => {
  const classified =
    code === "state.write.failed" || failureCodes.has(code)
      ? (code as EconomicsRecordFailureCode | "state.write.failed")
      : "state.write.failed";
  return location === undefined
    ? { ok: false, code: classified }
    : { ok: false, code: classified, location };
};

const appendOutcome = (
  store: StateStorePort,
  fenceToken: string,
  request: { readonly kind: string; readonly recordKey: string; readonly payload: StateJsonValue },
): StateResult<{ readonly sequence: number; readonly path: string }> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) return acquired;
  const appended = store.append(acquired.value.handle, request);
  const released = store.releaseFence(acquired.value.handle);
  if (!appended.ok) return appended;
  if (!released.ok) return released;
  return { ok: true, value: { sequence: appended.value.sequence, path: appended.value.path } };
};

/**
 * Append one restart event through a fresh fence, then read it back. A replay of
 * the same `(run, ordinal)` appends nothing; a failed append is classified and
 * never consumable as captured economics.
 */
export const appendEconomicsRestartEvent = (
  store: StateStorePort,
  fenceToken: string,
  record: EconomicsRestartRecord,
): EconomicsRestartAppendOutcome => {
  const read = readEconomicsRecords(store, record.workItemRef);
  if (!read.ok) return appendFailure(read.code, read.location);
  const replay = read.restarts.find(
    (candidate) => candidate.runId === record.runId && candidate.ordinal === record.ordinal,
  );
  if (replay !== undefined) return { ok: true, appended: false, record: replay };
  const appended = appendOutcome(store, fenceToken, {
    kind: ECONOMICS_RESTART_RECORD_KIND,
    recordKey: economicsRecordKey(record.workItemRef),
    payload: restartPayload(record),
  });
  if (!appended.ok) return appendFailure(appended.error.code, locationOf(appended.error));
  const verified = readEconomicsRecords(store, record.workItemRef);
  if (!verified.ok) return appendFailure(verified.code, verified.location);
  const found = verified.restarts.some(
    (candidate) => candidate.runId === record.runId && candidate.ordinal === record.ordinal,
  );
  if (!found) return appendFailure("state.write.failed", { path: appended.value.path });
  return { ok: true, appended: true, record, sequence: appended.value.sequence };
};

/**
 * Ensure the single terminal exhaustion record exists (D-10). The first refusal
 * appends it; later refusals re-read the same truth and never overwrite or fork
 * the reason.
 */
export const ensureEconomicsExhaustionRecord = (
  store: StateStorePort,
  fenceToken: string,
  record: EconomicsExhaustionRecord,
): EconomicsExhaustionAppendOutcome => {
  const read = readEconomicsRecords(store, record.workItemRef);
  if (!read.ok) return appendFailure(read.code, read.location);
  if (read.terminal !== undefined) {
    return { ok: true, appended: false, record: read.terminal };
  }
  const appended = appendOutcome(store, fenceToken, {
    kind: ECONOMICS_EXHAUSTION_RECORD_KIND,
    recordKey: economicsRecordKey(record.workItemRef),
    payload: exhaustionPayload(record),
  });
  if (!appended.ok) return appendFailure(appended.error.code, locationOf(appended.error));
  const verified = readEconomicsRecords(store, record.workItemRef);
  if (!verified.ok) return appendFailure(verified.code, verified.location);
  if (verified.terminal === undefined) {
    return appendFailure("state.write.failed", { path: appended.value.path });
  }
  return { ok: true, appended: true, record: verified.terminal, sequence: appended.value.sequence };
};

/** Options for the state-backed resume port (all facts injected). */
export type EconomicsResumeStorePortOptions = {
  readonly store: StateStorePort;
  readonly newFenceToken: () => string;
};

/** Compose the data-only resume store port over the real state store. */
export const createEconomicsResumeStorePort = (
  options: EconomicsResumeStorePortOptions,
): EconomicsResumeStorePort => ({
  readDeliveryRecords: (workItemRef) => readEconomicsRecords(options.store, workItemRef),
  appendRestartEvent: (record) =>
    appendEconomicsRestartEvent(options.store, options.newFenceToken(), record),
  ensureExhaustionRecord: (record) =>
    ensureEconomicsExhaustionRecord(options.store, options.newFenceToken(), record),
});
