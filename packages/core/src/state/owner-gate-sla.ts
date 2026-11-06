/**
 * The `owner-gate.decision` ledger over the injected state port (GH-229 F-4,
 * EVT-1, DM-2).
 *
 * Additive inside `delivery.state.v1`: one append per default application, a
 * presence-tolerant verified read, and the first application per gate id is
 * authoritative. Each append carries only the new record. A torn, malformed, or
 * duplicated history is classified with the existing `state.*` identities and is
 * never served as truth.
 */
import {
  OWNER_GATE_SLA_CLOCK_SOURCE,
  OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA,
  OWNER_GATE_SLA_DECISION_RECORD_KIND,
  OWNER_GATE_SLA_DEFAULTS,
  type OwnerGateSlaDecisionRecord,
  type StateAppendOutcome,
  type StateJsonValue,
  type StateReadEvidence,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";

/** The owner-gate ledger's declared record-key prefix (one history per gate). */
export const OWNER_GATE_SLA_DECISION_RECORD_KEY_PREFIX = "owner-gate.decisions:" as const;

/** The store-scoped key the decision ledger appends and reads. */
export const ownerGateSlaDecisionRecordKey = (gateId: string): string =>
  `${OWNER_GATE_SLA_DECISION_RECORD_KEY_PREFIX}${gateId}`;

/** A presence-tolerant verified read of every decision record. */
export type OwnerGateSlaDecisionsRead = {
  readonly verifiedEmpty: boolean;
  readonly records: readonly OwnerGateSlaDecisionRecord[];
  readonly recordCount: number;
  readonly evidence: StateReadEvidence;
};

/** One idempotent append outcome: a new record or the existing authoritative one. */
export type OwnerGateSlaDecisionAppendOutcome = {
  readonly appended: boolean;
  readonly record: OwnerGateSlaDecisionRecord;
  readonly append?: StateAppendOutcome;
  readonly fenceReleased: boolean;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (code: "state.store.torn", location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const hasOnlyKeys = (value: Readonly<Record<string, unknown>>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

const PAYLOAD_KEYS = [
  "schemaId",
  "gateId",
  "gateKind",
  "workItemRef",
  "appliedDefault",
  "appliedAt",
  "thresholdCrossedMs",
  "clockSource",
] as const;

const payloadFor = (record: OwnerGateSlaDecisionRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  gateId: record.gateId,
  gateKind: record.gateKind,
  workItemRef: record.workItemRef,
  appliedDefault: record.appliedDefault,
  appliedAt: record.appliedAt,
  thresholdCrossedMs: record.thresholdCrossedMs,
  clockSource: record.clockSource,
});

const recordFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<OwnerGateSlaDecisionRecord> => {
  if (!isRecord(value) || !hasOnlyKeys(value, PAYLOAD_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (value.schemaId !== OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA) {
    return fail("state.store.torn", location);
  }
  if (!isNonEmptyString(value.gateId)) return fail("state.store.torn", location);
  if (!isNonEmptyString(value.gateKind)) return fail("state.store.torn", location);
  if (!isNonEmptyString(value.workItemRef)) return fail("state.store.torn", location);
  if (
    typeof value.appliedDefault !== "string" ||
    !(OWNER_GATE_SLA_DEFAULTS as readonly string[]).includes(value.appliedDefault)
  ) {
    return fail("state.store.torn", location);
  }
  if (!isNonEmptyString(value.appliedAt)) return fail("state.store.torn", location);
  if (
    typeof value.thresholdCrossedMs !== "number" ||
    !Number.isFinite(value.thresholdCrossedMs) ||
    value.thresholdCrossedMs < 0
  ) {
    return fail("state.store.torn", location);
  }
  if (value.clockSource !== OWNER_GATE_SLA_CLOCK_SOURCE) return fail("state.store.torn", location);
  return ok(value as unknown as OwnerGateSlaDecisionRecord);
};

/**
 * Read the verified owner-gate decision history.
 *
 * The store is verified first; an absent key set is a verified-empty history.
 * A wrong-kind record under the decision prefix, a malformed payload, or two
 * records for the same gate id is a torn store, never a zeroed history.
 */
export const readOwnerGateSlaDecisions = (
  store: StateStorePort,
): StateResult<OwnerGateSlaDecisionsRead> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const records: OwnerGateSlaDecisionRecord[] = [];
  const seen = new Set<string>();
  for (const ledgerRecord of verified.value.records) {
    if (!ledgerRecord.key.startsWith(OWNER_GATE_SLA_DECISION_RECORD_KEY_PREFIX)) continue;
    if (ledgerRecord.kind !== OWNER_GATE_SLA_DECISION_RECORD_KIND) {
      return fail("state.store.torn", {
        path: verified.value.evidence.storePath,
        record: ledgerRecord.sequence,
      });
    }
    const parsed = recordFrom(ledgerRecord.payload, {
      path: verified.value.evidence.storePath,
      record: ledgerRecord.sequence,
    });
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value.gateId)) {
      return fail("state.store.torn", {
        path: verified.value.evidence.storePath,
        record: ledgerRecord.sequence,
      });
    }
    seen.add(parsed.value.gateId);
    records.push(parsed.value);
  }
  return ok({
    verifiedEmpty: records.length === 0,
    records,
    recordCount: records.length,
    evidence: verified.value.evidence,
  });
};

/**
 * Append one default-application decision under a single-writer fence.
 *
 * The first application per gate id is authoritative: a replay is a no-op that
 * returns the existing record and acquires no fence. A distinct gate id is never
 * over-suppressed. A coverage re-read proves exactly one new record landed.
 */
export const appendOwnerGateSlaDecision = (
  store: StateStorePort,
  request: { readonly decision: OwnerGateSlaDecisionRecord; readonly fenceToken: string },
): StateResult<OwnerGateSlaDecisionAppendOutcome> => {
  const current = readOwnerGateSlaDecisions(store);
  if (!current.ok) return current;
  const existing = current.value.records.find(
    (record) => record.gateId === request.decision.gateId,
  );
  if (existing !== undefined) {
    return ok({ appended: false, record: existing, fenceReleased: true });
  }

  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const reread = readOwnerGateSlaDecisions(store);
  if (!reread.ok) {
    store.releaseFence(handle);
    return reread;
  }
  const raced = reread.value.records.find((record) => record.gateId === request.decision.gateId);
  if (raced !== undefined) {
    store.releaseFence(handle);
    return ok({ appended: false, record: raced, fenceReleased: true });
  }

  const appended = store.append(handle, {
    kind: OWNER_GATE_SLA_DECISION_RECORD_KIND,
    recordKey: ownerGateSlaDecisionRecordKey(request.decision.gateId),
    payload: payloadFor(request.decision),
  });
  if (!appended.ok) {
    store.releaseFence(handle);
    return appended;
  }
  const coverage = readOwnerGateSlaDecisions(store);
  const released = store.releaseFence(handle);
  if (!coverage.ok) return coverage;
  if (coverage.value.recordCount !== current.value.recordCount + 1) {
    return fail("state.store.torn", {
      path: coverage.value.evidence.storePath,
      record: coverage.value.recordCount,
    });
  }
  return ok({
    appended: true,
    record: request.decision,
    append: appended.value,
    fenceReleased: released.ok && released.value.released,
  });
};
