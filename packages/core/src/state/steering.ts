/**
 * The three additive steering record kinds over the injected state port
 * (GH-298 DM-2, NFR-5).
 *
 * Additive inside `delivery.state.v1`: one fenced append per record,
 * post-append coverage verification, verified reads that fold message, outcome,
 * and completion presence into derived closure, and fail-closed classification.
 * The record kind and payload schema are validated at the artifact boundary
 * before any byte lands. No runtime API, clock, randomness, or environment
 * access exists here.
 */
import {
  STEER_COMPLETION_PAYLOAD_SCHEMA,
  STEER_COMPLETION_RECORD_KIND,
  STEER_KINDS,
  STEER_MAX_REF_CHARS,
  STEER_MAX_TEXT_CHARS,
  STEER_MAX_TTL_MS,
  STEER_MESSAGE_PAYLOAD_SCHEMA,
  STEER_MESSAGE_RECORD_KIND,
  STEER_OUTCOME_PAYLOAD_SCHEMA,
  STEER_OUTCOME_RECORD_KIND,
  STEER_PRIORITIES,
  STEER_SCOPES,
  type StateAppendOutcome,
  type StateArtifactBoundaryDeclaration,
  type StateJsonValue,
  type StateReadEvidence,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
  type SteerCompletionRecord,
  type SteerMessageRecord,
  type SteerOrigin,
  type SteerOutcome,
  type SteerOutcomeRecord,
  type SteerReceipt,
} from "#contracts";
import { createArtifactBoundary } from "./artifact-boundary.js";

/** The boundary-owned store key prefixes covering the three steering kinds. */
export const STEERING_RECORD_KEY_PREFIX = "steering." as const;
export const STEERING_MESSAGE_RECORD_KEY_PREFIX = "steering.messages:" as const;
export const STEERING_OUTCOME_RECORD_KEY_PREFIX = "steering.outcomes:" as const;
export const STEERING_COMPLETION_RECORD_KEY_PREFIX = "steering.completions:" as const;

/** The message record key for one id (one immutable record per message). */
export const steeringMessageRecordKey = (id: string): string =>
  `${STEERING_MESSAGE_RECORD_KEY_PREFIX}${id}`;

/** The outcome record key for one note id (exactly one outcome per note). */
export const steeringOutcomeRecordKey = (id: string): string =>
  `${STEERING_OUTCOME_RECORD_KEY_PREFIX}${id}`;

/** The completion record key for one note id (first completion authoritative). */
export const steeringCompletionRecordKey = (id: string): string =>
  `${STEERING_COMPLETION_RECORD_KEY_PREFIX}${id}`;

/** The validated artifact-boundary declaration for the three steering kinds. */
export const STEERING_ARTIFACT_BOUNDARY: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: STEERING_RECORD_KEY_PREFIX,
  kinds: [
    {
      kind: STEER_MESSAGE_RECORD_KIND,
      payloadSchema: STEER_MESSAGE_PAYLOAD_SCHEMA,
      identityField: "id",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "id", type: "string", required: true },
        { name: "from", type: "string", required: true },
        { name: "to", type: "string", required: true },
        { name: "scope", type: "string", required: true },
        { name: "kind", type: "string", required: true },
        { name: "subject", type: "string", required: true },
        { name: "ref", type: "string", required: false },
        { name: "origin", type: "object", required: true },
        { name: "priority", type: "string", required: true },
        { name: "created", type: "string", required: true },
        { name: "ttl", type: "number", required: true },
      ],
      vocabularies: [
        { field: "scope", values: STEER_SCOPES },
        { field: "kind", values: STEER_KINDS },
        { field: "priority", values: STEER_PRIORITIES },
      ],
    },
    {
      kind: STEER_OUTCOME_RECORD_KIND,
      payloadSchema: STEER_OUTCOME_PAYLOAD_SCHEMA,
      identityField: "id",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "id", type: "string", required: true },
        { name: "outcome", type: "string", required: true },
        { name: "recordedAt", type: "string", required: true },
        { name: "receipt", type: "object", required: false },
        { name: "reason", type: "string", required: false },
      ],
      vocabularies: [{ field: "outcome", values: ["applied", "expired"] }],
    },
    {
      kind: STEER_COMPLETION_RECORD_KIND,
      payloadSchema: STEER_COMPLETION_PAYLOAD_SCHEMA,
      identityField: "id",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "id", type: "string", required: true },
        { name: "completedAt", type: "string", required: true },
        { name: "artifact", type: "string", required: true },
      ],
    },
  ],
};

/** A verified read of every steering record, folded by kind. */
export type SteeringQueueRead = {
  readonly verifiedEmpty: boolean;
  readonly messages: readonly SteerMessageRecord[];
  readonly outcomes: readonly SteerOutcome[];
  readonly completions: readonly SteerCompletionRecord[];
  readonly recordCount: number;
  readonly evidence: StateReadEvidence;
};

/** One successful append outcome. */
export type SteeringAppendOutcome = {
  readonly appended: true;
  readonly append: StateAppendOutcome;
  readonly fenceReleased: boolean;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (
  code: "state.store.torn" | "state.store.unknown",
  location: StateSafeLocation,
): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isParseableInstant = (value: string): boolean => Number.isFinite(Date.parse(value));

const charLength = (value: string): number => Array.from(value).length;

const hasOnlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const MESSAGE_KEYS = [
  "schemaId",
  "id",
  "from",
  "to",
  "scope",
  "kind",
  "subject",
  "ref",
  "origin",
  "priority",
  "created",
  "ttl",
] as const;

const OUTCOME_KEYS = ["schemaId", "id", "outcome", "recordedAt", "receipt", "reason"] as const;

const COMPLETION_KEYS = ["schemaId", "id", "completedAt", "artifact"] as const;

const ORIGIN_KEYS = ["change", "repo", "agent"] as const;
const RECEIPT_KEYS = ["origin", "readReceipt", "ttl", "expiresAt"] as const;
const READ_RECEIPT_KEYS = ["at", "boundary"] as const;

const messagePayload = (record: SteerMessageRecord): StateJsonValue => ({
  schemaId: STEER_MESSAGE_PAYLOAD_SCHEMA,
  id: record.id,
  from: record.from,
  to: record.to,
  scope: record.scope,
  kind: record.kind,
  subject: record.subject,
  ref: record.ref,
  origin: {
    change: record.origin.change,
    repo: record.origin.repo,
    agent: record.origin.agent,
  },
  priority: record.priority,
  created: record.created,
  ttl: record.ttl,
});

const receiptPayload = (receipt: SteerReceipt): StateJsonValue => ({
  origin: {
    change: receipt.origin.change,
    repo: receipt.origin.repo,
    agent: receipt.origin.agent,
  },
  readReceipt: { at: receipt.readReceipt.at, boundary: receipt.readReceipt.boundary },
  ttl: receipt.ttl,
  expiresAt: receipt.expiresAt,
});

const outcomePayload = (record: SteerOutcome): StateJsonValue =>
  record.outcome === "applied"
    ? {
        schemaId: STEER_OUTCOME_PAYLOAD_SCHEMA,
        id: record.id,
        outcome: "applied",
        recordedAt: record.recordedAt,
        receipt: receiptPayload(record.receipt),
      }
    : {
        schemaId: STEER_OUTCOME_PAYLOAD_SCHEMA,
        id: record.id,
        outcome: "expired",
        recordedAt: record.recordedAt,
        reason: record.reason,
      };

const completionPayload = (record: SteerCompletionRecord): StateJsonValue => ({
  schemaId: STEER_COMPLETION_PAYLOAD_SCHEMA,
  id: record.id,
  completedAt: record.completedAt,
  artifact: record.artifact,
});

const originFrom = (value: unknown): SteerOrigin | undefined => {
  if (!isRecord(value) || !hasOnlyKeys(value, ORIGIN_KEYS)) return undefined;
  if (!isNonEmptyString(value.repo) || !isNonEmptyString(value.agent)) return undefined;
  if (value.change !== null && !isNonEmptyString(value.change)) return undefined;
  return {
    change: value.change === null ? null : value.change,
    repo: value.repo,
    agent: value.agent,
  };
};

const receiptFrom = (value: unknown): SteerReceipt | undefined => {
  if (!isRecord(value) || !hasOnlyKeys(value, RECEIPT_KEYS)) return undefined;
  const origin = originFrom(value.origin);
  if (origin === undefined) return undefined;
  if (!isRecord(value.readReceipt) || !hasOnlyKeys(value.readReceipt, READ_RECEIPT_KEYS)) {
    return undefined;
  }
  if (!isNonEmptyString(value.readReceipt.at) || !isNonEmptyString(value.readReceipt.boundary)) {
    return undefined;
  }
  if (typeof value.ttl !== "number" || !Number.isSafeInteger(value.ttl) || value.ttl <= 0) {
    return undefined;
  }
  if (!isNonEmptyString(value.expiresAt)) return undefined;
  return {
    origin,
    readReceipt: { at: value.readReceipt.at, boundary: value.readReceipt.boundary },
    ttl: value.ttl,
    expiresAt: value.expiresAt,
  };
};

const messageFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<SteerMessageRecord> => {
  if (!isRecord(value) || !hasOnlyKeys(value, MESSAGE_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (value.schemaId !== STEER_MESSAGE_PAYLOAD_SCHEMA) {
    return fail("state.store.unknown", location);
  }
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.from) || !isNonEmptyString(value.to)) {
    return fail("state.store.unknown", location);
  }
  if (
    typeof value.scope !== "string" ||
    !(STEER_SCOPES as readonly string[]).includes(value.scope)
  ) {
    return fail("state.store.unknown", location);
  }
  if (typeof value.kind !== "string" || !(STEER_KINDS as readonly string[]).includes(value.kind)) {
    return fail("state.store.unknown", location);
  }
  if (
    typeof value.priority !== "string" ||
    !(STEER_PRIORITIES as readonly string[]).includes(value.priority)
  ) {
    return fail("state.store.unknown", location);
  }
  if (!isNonEmptyString(value.subject) || charLength(value.subject) > STEER_MAX_TEXT_CHARS) {
    return fail("state.store.torn", location);
  }
  if (value.ref !== null && typeof value.ref !== "string")
    return fail("state.store.torn", location);
  if (typeof value.ref === "string" && charLength(value.ref) > STEER_MAX_REF_CHARS) {
    return fail("state.store.torn", location);
  }
  const origin = originFrom(value.origin);
  if (origin === undefined) return fail("state.store.torn", location);
  if (!isNonEmptyString(value.created) || !isParseableInstant(value.created)) {
    return fail("state.store.unknown", location);
  }
  if (
    typeof value.ttl !== "number" ||
    !Number.isSafeInteger(value.ttl) ||
    value.ttl <= 0 ||
    value.ttl > STEER_MAX_TTL_MS
  ) {
    return fail("state.store.torn", location);
  }
  return ok({
    id: value.id,
    from: value.from,
    to: value.to,
    scope: value.scope as SteerMessageRecord["scope"],
    kind: value.kind as SteerMessageRecord["kind"],
    subject: value.subject,
    ref: typeof value.ref === "string" ? value.ref : null,
    origin,
    priority: value.priority as SteerMessageRecord["priority"],
    created: value.created,
    ttl: value.ttl,
  });
};

const outcomeFrom = (value: unknown, location: StateSafeLocation): StateResult<SteerOutcome> => {
  if (!isRecord(value) || !hasOnlyKeys(value, OUTCOME_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (value.schemaId !== STEER_OUTCOME_PAYLOAD_SCHEMA) {
    return fail("state.store.unknown", location);
  }
  if (!isNonEmptyString(value.id)) return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.recordedAt) || !isParseableInstant(value.recordedAt)) {
    return fail("state.store.torn", location);
  }
  if (value.outcome === "applied") {
    if (Object.hasOwn(value, "reason")) return fail("state.store.torn", location);
    const receipt = receiptFrom(value.receipt);
    if (receipt === undefined) return fail("state.store.torn", location);
    const record: SteerOutcomeRecord = {
      schemaId: STEER_OUTCOME_PAYLOAD_SCHEMA,
      id: value.id,
      outcome: "applied",
      recordedAt: value.recordedAt,
      receipt,
    };
    return ok(record);
  }
  if (value.outcome === "expired") {
    if (Object.hasOwn(value, "receipt")) return fail("state.store.torn", location);
    if (value.reason !== "ttl-elapsed") return fail("state.store.torn", location);
    return ok({
      schemaId: STEER_OUTCOME_PAYLOAD_SCHEMA,
      id: value.id,
      outcome: "expired",
      recordedAt: value.recordedAt,
      reason: "ttl-elapsed",
    });
  }
  return fail("state.store.unknown", location);
};

const completionFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<SteerCompletionRecord> => {
  if (!isRecord(value) || !hasOnlyKeys(value, COMPLETION_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (value.schemaId !== STEER_COMPLETION_PAYLOAD_SCHEMA) {
    return fail("state.store.unknown", location);
  }
  if (!isNonEmptyString(value.id)) return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.completedAt) || !isParseableInstant(value.completedAt)) {
    return fail("state.store.torn", location);
  }
  if (!isNonEmptyString(value.artifact) || charLength(value.artifact) > STEER_MAX_REF_CHARS) {
    return fail("state.store.torn", location);
  }
  return ok({
    schemaId: STEER_COMPLETION_PAYLOAD_SCHEMA,
    id: value.id,
    completedAt: value.completedAt,
    artifact: value.artifact,
  });
};

/**
 * Read every verified steering record.
 *
 * The boundary validates kind, schema, required fields, and the closed
 * vocabularies; this module additionally validates record semantics and fails
 * closed on duplicate message ids, duplicate outcomes, or duplicate completions.
 */
export const readSteeringQueue = (store: StateStorePort): StateResult<SteeringQueueRead> => {
  const boundary = createArtifactBoundary(store, STEERING_ARTIFACT_BOUNDARY);
  const read = boundary.read();
  if (!read.ok) return read;
  const messages: SteerMessageRecord[] = [];
  const outcomes: SteerOutcome[] = [];
  const completions: SteerCompletionRecord[] = [];
  const messageIds = new Set<string>();
  const outcomeIds = new Set<string>();
  const completionIds = new Set<string>();
  for (const artifact of read.value.artifacts) {
    const location: StateSafeLocation = {
      path: read.value.evidence.storePath,
      record: artifact.sequence,
    };
    if (artifact.kind === STEER_MESSAGE_RECORD_KIND) {
      const parsed = messageFrom(artifact.payload, location);
      if (!parsed.ok) return parsed;
      if (messageIds.has(parsed.value.id)) return fail("state.store.torn", location);
      messageIds.add(parsed.value.id);
      messages.push(parsed.value);
      continue;
    }
    if (artifact.kind === STEER_OUTCOME_RECORD_KIND) {
      const parsed = outcomeFrom(artifact.payload, location);
      if (!parsed.ok) return parsed;
      if (outcomeIds.has(parsed.value.id)) return fail("state.store.torn", location);
      outcomeIds.add(parsed.value.id);
      outcomes.push(parsed.value);
      continue;
    }
    const parsed = completionFrom(artifact.payload, location);
    if (!parsed.ok) return parsed;
    if (completionIds.has(parsed.value.id)) return fail("state.store.torn", location);
    completionIds.add(parsed.value.id);
    completions.push(parsed.value);
  }
  return ok({
    verifiedEmpty: read.value.verdict === "verified-empty",
    messages,
    outcomes,
    completions,
    recordCount: read.value.artifacts.length,
    evidence: read.value.evidence,
  });
};

const appendRecord = (
  store: StateStorePort,
  request: {
    readonly kind: string;
    readonly recordKey: string;
    readonly payload: StateJsonValue;
    readonly fenceToken: string;
    readonly expectedRecordCount: number;
  },
): StateResult<{ readonly append: StateAppendOutcome; readonly fenceReleased: boolean }> => {
  const boundary = createArtifactBoundary(store, STEERING_ARTIFACT_BOUNDARY);
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = boundary.append(handle, {
    kind: request.kind,
    recordKey: request.recordKey,
    payload: request.payload,
  });
  if (!appended.ok) {
    store.releaseFence(handle);
    return appended;
  }
  const coverage = boundary.read();
  const released = store.releaseFence(handle);
  if (!coverage.ok) return coverage;
  if (coverage.value.artifacts.length !== request.expectedRecordCount + 1) {
    return fail("state.store.torn", {
      path: coverage.value.evidence.storePath,
      record: coverage.value.artifacts.length,
    });
  }
  return ok({ append: appended.value, fenceReleased: released.ok && released.value.released });
};

/**
 * Append one immutable message record under a single-writer fence.
 *
 * The payload is validated before any byte lands; the post-append read proves
 * exactly one new record. A duplicate message id fails closed instead of
 * overwriting history (NFR-3, NFR-5).
 */
export const appendSteeringMessage = (
  store: StateStorePort,
  request: {
    readonly record: SteerMessageRecord;
    readonly fenceToken: string;
    readonly current?: SteeringQueueRead;
  },
): StateResult<SteeringAppendOutcome> => {
  const current = request.current === undefined ? readSteeringQueue(store) : ok(request.current);
  if (!current.ok) return current;
  if (current.value.messages.some((message) => message.id === request.record.id)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const payload = messagePayload(request.record);
  const validated = messageFrom(payload, { path: store.identity.stateDirectory });
  if (!validated.ok) return validated;
  const appended = appendRecord(store, {
    kind: STEER_MESSAGE_RECORD_KIND,
    recordKey: steeringMessageRecordKey(request.record.id),
    payload,
    fenceToken: request.fenceToken,
    expectedRecordCount: current.value.recordCount,
  });
  if (!appended.ok) return appended;
  return ok({
    appended: true,
    append: appended.value.append,
    fenceReleased: appended.value.fenceReleased,
  });
};

/**
 * Append one outcome record under a single-writer fence.
 *
 * Exactly one outcome per note is authoritative; the message must exist and a
 * duplicate outcome fails closed (DM-2, NFR-5).
 */
export const appendSteeringOutcome = (
  store: StateStorePort,
  request: {
    readonly record: SteerOutcome;
    readonly fenceToken: string;
    readonly current?: SteeringQueueRead;
  },
): StateResult<SteeringAppendOutcome> => {
  const current = request.current === undefined ? readSteeringQueue(store) : ok(request.current);
  if (!current.ok) return current;
  if (current.value.outcomes.some((outcome) => outcome.id === request.record.id)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  if (!current.value.messages.some((message) => message.id === request.record.id)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const payload = outcomePayload(request.record);
  const validated = outcomeFrom(payload, { path: store.identity.stateDirectory });
  if (!validated.ok) return validated;
  const appended = appendRecord(store, {
    kind: STEER_OUTCOME_RECORD_KIND,
    recordKey: steeringOutcomeRecordKey(request.record.id),
    payload,
    fenceToken: request.fenceToken,
    expectedRecordCount: current.value.recordCount,
  });
  if (!appended.ok) return appended;
  return ok({
    appended: true,
    append: appended.value.append,
    fenceReleased: appended.value.fenceReleased,
  });
};

/**
 * Append one completion record under a single-writer fence.
 *
 * Completion is landed-only: the note must carry an applied outcome, no earlier
 * completion may exist, and the artifact is required (F-6, NFR-5).
 */
export const appendSteeringCompletion = (
  store: StateStorePort,
  request: {
    readonly record: SteerCompletionRecord;
    readonly fenceToken: string;
    readonly current?: SteeringQueueRead;
  },
): StateResult<SteeringAppendOutcome> => {
  const current = request.current === undefined ? readSteeringQueue(store) : ok(request.current);
  if (!current.ok) return current;
  if (current.value.completions.some((completion) => completion.id === request.record.id)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const applied = current.value.outcomes.some(
    (outcome) => outcome.id === request.record.id && outcome.outcome === "applied",
  );
  if (!applied) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const payload = completionPayload(request.record);
  const validated = completionFrom(payload, { path: store.identity.stateDirectory });
  if (!validated.ok) return validated;
  const appended = appendRecord(store, {
    kind: STEER_COMPLETION_RECORD_KIND,
    recordKey: steeringCompletionRecordKey(request.record.id),
    payload,
    fenceToken: request.fenceToken,
    expectedRecordCount: current.value.recordCount,
  });
  if (!appended.ok) return appended;
  return ok({
    appended: true,
    append: appended.value.append,
    fenceReleased: appended.value.fenceReleased,
  });
};
