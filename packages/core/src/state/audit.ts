/**
 * The command audit-ledger consumer (GH-223 F-1/F-4/F-5, DEC-5, DEC-8).
 *
 * Composes the public state port only: a reservation-first two-phase append
 * under one shared fence, a keyed chain over both audit kinds, the durable
 * store-managed chaining-key artifact, and the bounded, filtered read surface.
 * Additive inside `delivery.state.v1`: no schema bump, no new error-table row,
 * no runtime API outside the driver edge.
 */
import {
  AUDIT_BOUNDARY_DECLARATION,
  AUDIT_CHAIN_ANCHOR,
  AUDIT_CHAIN_KEY_BYTES,
  AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_OUTCOME_CLASSES,
  AUDIT_RECORD_KEY,
  AUDIT_RESERVATION_PAYLOAD_SCHEMA,
  AUDIT_RESERVATION_RECORD_KIND,
  type AuditChainBreak,
  type AuditChainVerdict,
  type AuditInvocationFacts,
  type AuditInvocationRecord,
  type AuditOutcomeClass,
  type AuditReadFailure,
  type AuditReadOutcome,
  type AuditReadQuery,
  type AuditReadResult,
  type AuditReservationOrphanFinding,
  type AuditReservationRecord,
  auditChainKeyArtifactName,
  isAuditRecordKind,
  type StateAppendOutcome,
  type StateArtifactRecord,
  type StateFailureCode,
  type StateFenceHandle,
  type StateJsonValue,
  type StateRecord,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";
import { createArtifactBoundary, type StateArtifactBoundary } from "./artifact-boundary.js";

/** One successful two-phase append's evidence. */
export type AuditAppendOutcome = {
  readonly auditSeq: number;
  readonly reservationSequence: number;
  readonly invocationSequence: number;
  readonly chainValue: string;
};

type AuditRecordView = {
  readonly artifacts: readonly StateArtifactRecord[];
  readonly storePath: string;
  readonly records: number;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const unknownFailure = (store: StateStorePort): StateResult<never> => ({
  ok: false,
  error: {
    kind: "state",
    code: "state.store.unknown",
    consequence: "not_landed",
    location: { path: store.identity.stateDirectory },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const auditFailure = (code: StateFailureCode, location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: {
    kind: "state",
    code,
    consequence: "not_landed",
    location: { ...location },
  },
});

const refusal = (path: string): { readonly ok: false; readonly error: AuditReadFailure } => ({
  ok: false,
  error: {
    kind: "input",
    code: "input.value.rejected",
    consequence: "not_landed",
    location: { path },
  },
});

const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK_64 = 0xffffffffffffffffn;

const fnv1a64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
};

/** Recursively sort object keys so the chain input is canonical. */
const canonicalize = (value: StateJsonValue): StateJsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (typeof value === "object" && value !== null) {
    const source = value as { readonly [key: string]: StateJsonValue };
    const sorted: Record<string, StateJsonValue> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key] as StateJsonValue);
    }
    return sorted;
  }
  return value;
};

/**
 * The keyed chain link over the previous audit-domain link and the record's
 * audited content. Deterministic, key-sensitive, previous-link-sensitive, and
 * content-sensitive; the primitive is intentionally opaque (TR-6).
 */
export const auditChainValue = (
  keyHex: string,
  previousChainValue: string,
  content: StateJsonValue,
): string => {
  const material = `${keyHex}\u0000${previousChainValue}\u0000${JSON.stringify(canonicalize(content))}`;
  const first = fnv1a64(material);
  const second = fnv1a64(`${keyHex}\u0000${first}`);
  return `${first}${second}`;
};

const invocationContent = (
  facts: AuditInvocationFacts,
  auditSeq: number,
): Record<string, StateJsonValue> => {
  const content: Record<string, StateJsonValue> = {
    schemaId: AUDIT_INVOCATION_PAYLOAD_SCHEMA,
    runId: facts.runId,
    command: facts.command,
    arguments: [...facts.arguments],
    exitCode: facts.exitCode,
    timing: { totalMs: facts.timing.totalMs },
    resultSchemaVersion: facts.resultSchemaVersion,
    outcomeClass: facts.outcomeClass,
    scope: facts.scope,
    startedAt: facts.startedAt,
    auditSeq,
  };
  if (facts.repo !== undefined) content.repo = facts.repo;
  if (facts.agentIdentity !== undefined) {
    content.agentIdentity = {
      kind: facts.agentIdentity.kind,
      value: facts.agentIdentity.value,
    };
  }
  return content;
};

const reservationContent = (auditSeq: number, runId: string): Record<string, StateJsonValue> => ({
  schemaId: AUDIT_RESERVATION_PAYLOAD_SCHEMA,
  auditSeq,
  runId,
});

/** Assemble a reservation payload chaining from the previous audit-domain link. */
export const assembleAuditReservation = (
  auditSeq: number,
  runId: string,
  keyHex: string,
  previousChainValue: string,
): AuditReservationRecord => {
  const content = reservationContent(auditSeq, runId);
  return {
    schemaId: AUDIT_RESERVATION_PAYLOAD_SCHEMA,
    auditSeq,
    runId,
    chainValue: auditChainValue(keyHex, previousChainValue, content),
  };
};

/** Assemble an invocation payload chaining from its own reservation. */
export const assembleAuditInvocation = (
  facts: AuditInvocationFacts,
  auditSeq: number,
  keyHex: string,
  reservationChainValue: string,
): AuditInvocationRecord => {
  const content = invocationContent(facts, auditSeq);
  return {
    schemaId: AUDIT_INVOCATION_PAYLOAD_SCHEMA,
    ...facts,
    auditSeq,
    chainValue: auditChainValue(keyHex, reservationChainValue, content),
  };
};

/**
 * The audit boundary: the reusable validated boundary plus the exact-key-set
 * rule (an extra field — for example `arguments` on a reservation — is
 * `state.store.unknown`, never silently ignored).
 */
export const createAuditBoundary = (store: StateStorePort): StateArtifactBoundary => {
  const inner = createArtifactBoundary(store, AUDIT_BOUNDARY_DECLARATION);
  return {
    declaration: inner.declaration,
    read: () => inner.read(),
    append: (handle: StateFenceHandle, request): StateResult<StateAppendOutcome> => {
      const kind = AUDIT_BOUNDARY_DECLARATION.kinds.find((entry) => entry.kind === request.kind);
      if (kind !== undefined && isRecord(request.payload)) {
        const allowed = new Set(kind.fields.map((field) => field.name));
        const extra = Object.keys(request.payload).filter((key) => !allowed.has(key));
        if (extra.length > 0) return unknownFailure(store);
      }
      return inner.append(handle, request);
    },
  };
};

const readAuditArtifacts = (store: StateStorePort): StateResult<AuditRecordView> => {
  const boundary = createAuditBoundary(store);
  const read = boundary.read();
  if (!read.ok) return read;
  return {
    ok: true,
    value: {
      artifacts: read.value.artifacts,
      storePath: read.value.evidence.storePath,
      records: read.value.evidence.recordCount,
    },
  };
};

const parseChainKey = (content: string, path: string): StateResult<string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return auditFailure("state.store.torn", { path, record: 0 });
  }
  if (!isRecord(parsed) || parsed.schemaId !== AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA) {
    return auditFailure("state.store.torn", { path, record: 0 });
  }
  const key = parsed.key;
  if (typeof key !== "string" || !/^[0-9a-f]{64}$/.test(key)) {
    return auditFailure("state.store.torn", { path, record: 0 });
  }
  return { ok: true, value: key };
};

/** Read the durable chaining-key artifact (DM-5); open failures stay classified. */
export const readAuditChainKey = (store: StateStorePort): StateResult<string> => {
  const artifact = store.readStoreArtifact({
    name: auditChainKeyArtifactName(store.identity.workspaceId),
  });
  if (!artifact.ok) return artifact;
  return parseChainKey(artifact.value.content, artifact.value.path);
};

/** Read the artifact or create it once with runtime-edge random material. */
export const ensureAuditChainKey = (store: StateStorePort): StateResult<string> => {
  const artifact = store.ensureStoreArtifact({
    name: auditChainKeyArtifactName(store.identity.workspaceId),
    randomBytes: AUDIT_CHAIN_KEY_BYTES,
    create: (randomHex) =>
      `${JSON.stringify({ schemaId: AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA, key: randomHex })}\n`,
    guardKinds: [AUDIT_INVOCATION_RECORD_KIND, AUDIT_RESERVATION_RECORD_KIND],
  });
  if (!artifact.ok) return artifact;
  return parseChainKey(artifact.value.content, artifact.value.path);
};

const auditDomainChain = (
  artifacts: readonly StateArtifactRecord[],
  keyHex: string,
): {
  readonly breaks: readonly AuditChainBreak[];
  readonly orphans: readonly AuditReservationOrphanFinding[];
} => {
  const breaks: AuditChainBreak[] = [];
  let previous: string = AUDIT_CHAIN_ANCHOR;
  for (const artifact of artifacts) {
    if (!isAuditRecordKind(artifact.kind) || !isRecord(artifact.payload)) continue;
    const payload = artifact.payload;
    const chainValue = payload.chainValue;
    const auditSeq = typeof payload.auditSeq === "number" ? payload.auditSeq : 0;
    const content: Record<string, StateJsonValue> = {};
    for (const field of Object.keys(payload)) {
      if (field === "chainValue") continue;
      content[field] = payload[field] as StateJsonValue;
    }
    const expected = auditChainValue(keyHex, previous, content);
    if (typeof chainValue !== "string" || chainValue !== expected) {
      breaks.push({ position: artifact.sequence, auditSeq });
      previous = typeof chainValue === "string" ? chainValue : expected;
      continue;
    }
    previous = chainValue;
  }

  const reservations = artifacts.filter(
    (artifact) => artifact.kind === AUDIT_RESERVATION_RECORD_KIND,
  );
  const invocationOrdinals = new Set(
    artifacts
      .filter(
        (artifact) =>
          artifact.kind === AUDIT_INVOCATION_RECORD_KIND &&
          isRecord(artifact.payload) &&
          typeof artifact.payload.auditSeq === "number",
      )
      .map((artifact) => (artifact.payload as Record<string, unknown>).auditSeq as number),
  );
  const orphans: AuditReservationOrphanFinding[] = [];
  for (const artifact of reservations) {
    if (!isRecord(artifact.payload)) continue;
    const auditSeq = artifact.payload.auditSeq;
    const runId = artifact.payload.runId;
    if (typeof auditSeq !== "number" || typeof runId !== "string") continue;
    if (invocationOrdinals.has(auditSeq)) continue;
    orphans.push({ auditSeq, runId, position: artifact.sequence });
  }
  return { breaks, orphans };
};

const chainVerdictFor = (view: AuditRecordView, keyHex: string | undefined): AuditChainVerdict => {
  if (view.artifacts.length === 0) {
    return {
      verified: true,
      records: 0,
      breaks: [],
      orphans: [],
      storePath: view.storePath,
    };
  }
  const { breaks, orphans } = auditDomainChain(view.artifacts, keyHex ?? "");
  return {
    verified: breaks.length === 0,
    records: view.artifacts.length,
    breaks,
    orphans,
    storePath: view.storePath,
  };
};

/** Verify the keyed chain over the verified audit-domain sequence (F-4). */
export const verifyAuditChain = (store: StateStorePort): AuditReadResult<AuditChainVerdict> => {
  const view = readAuditArtifacts(store);
  if (!view.ok) return view;
  if (view.value.artifacts.length === 0) {
    return { ok: true, value: chainVerdictFor(view.value, undefined) };
  }
  const key = readAuditChainKey(store);
  if (!key.ok) return key;
  return { ok: true, value: chainVerdictFor(view.value, key.value) };
};

const validQuery = (query: AuditReadQuery): boolean => {
  if (!Number.isInteger(query.limit) || query.limit < 1) return false;
  for (const field of ["scope", "repo", "command"] as const) {
    const value = query[field];
    if (value !== undefined && (typeof value !== "string" || value.length === 0)) return false;
  }
  if (
    query.outcomeClass !== undefined &&
    !AUDIT_OUTCOME_CLASSES.includes(query.outcomeClass as AuditOutcomeClass)
  ) {
    return false;
  }
  for (const field of ["from", "to"] as const) {
    const value = query[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) return false;
  }
  if (query.from !== undefined && query.to !== undefined && query.from > query.to) return false;
  return true;
};

const matchesQuery = (record: AuditInvocationRecord, query: AuditReadQuery): boolean => {
  if (query.scope !== undefined && record.scope !== query.scope) return false;
  if (query.repo !== undefined && record.repo !== query.repo) return false;
  if (query.command !== undefined && record.command !== query.command) return false;
  if (query.outcomeClass !== undefined && record.outcomeClass !== query.outcomeClass) return false;
  if (query.from !== undefined && record.startedAt < query.from) return false;
  if (query.to !== undefined && record.startedAt > query.to) return false;
  return true;
};

/**
 * The bounded, filtered, library-only read surface (F-5, DEC-6). Never
 * acquires a fence and never writes; refuses invalid bounds/filters with the
 * existing `input.value.rejected` identity.
 */
export const readAuditLedger = (
  store: StateStorePort,
  query: AuditReadQuery,
): AuditReadResult<AuditReadOutcome> => {
  if (!validQuery(query)) return refusal(store.identity.stateDirectory);
  const view = readAuditArtifacts(store);
  if (!view.ok) return view;

  const key = view.value.artifacts.length === 0 ? undefined : readAuditChainKey(store);
  if (key !== undefined && !key.ok) return key;

  const chain = chainVerdictFor(view.value, key?.ok === true ? key.value : undefined);
  const invocations: AuditInvocationRecord[] = [];
  for (const artifact of view.value.artifacts) {
    if (artifact.kind !== AUDIT_INVOCATION_RECORD_KIND) continue;
    invocations.push(artifact.payload as unknown as AuditInvocationRecord);
  }
  const matchedRecords = invocations.filter((record) => matchesQuery(record, query));
  const records = matchedRecords.slice(0, query.limit);
  return {
    ok: true,
    value: {
      verifiedEmpty: records.length === 0,
      records,
      matched: matchedRecords.length,
      truncated: matchedRecords.length > records.length,
      chain,
      storePath: view.value.storePath,
    },
  };
};

/**
 * Reservation-first two-phase append under one shared fence (DEC-8, F-1).
 * The ordinal comes from verified ledger truth inside the fence; the
 * reservation chains from the preceding audit-domain record and the invocation
 * from its reservation. The fence is always released.
 */
export const appendAuditInvocation = (
  store: StateStorePort,
  facts: AuditInvocationFacts,
): StateResult<AuditAppendOutcome> => {
  const acquired = store.acquireFence(`audit-${facts.runId}`);
  if (!acquired.ok) return acquired;
  try {
    const view = readAuditArtifacts(store);
    if (!view.ok) return view;

    let highestReservation = 0;
    let previousChain: string = AUDIT_CHAIN_ANCHOR;
    for (const artifact of view.value.artifacts) {
      if (!isRecord(artifact.payload)) continue;
      const auditSeq = artifact.payload.auditSeq;
      if (artifact.kind === AUDIT_RESERVATION_RECORD_KIND && typeof auditSeq === "number") {
        highestReservation = Math.max(highestReservation, auditSeq);
      }
      const chainValue = artifact.payload.chainValue;
      if (typeof chainValue === "string") previousChain = chainValue;
    }

    const key = ensureAuditChainKey(store);
    if (!key.ok) return key;

    const auditSeq = highestReservation + 1;
    const boundary = createAuditBoundary(store);
    const reservation = assembleAuditReservation(auditSeq, facts.runId, key.value, previousChain);
    const reservationAppend = boundary.append(acquired.value.handle, {
      kind: AUDIT_RESERVATION_RECORD_KIND,
      recordKey: AUDIT_RECORD_KEY,
      payload: reservation as unknown as StateJsonValue,
    });
    if (!reservationAppend.ok) return reservationAppend;

    const invocation = assembleAuditInvocation(facts, auditSeq, key.value, reservation.chainValue);
    const invocationAppend = boundary.append(acquired.value.handle, {
      kind: AUDIT_INVOCATION_RECORD_KIND,
      recordKey: AUDIT_RECORD_KEY,
      payload: invocation as unknown as StateJsonValue,
    });
    if (!invocationAppend.ok) return invocationAppend;

    return ok({
      auditSeq,
      reservationSequence: reservationAppend.value.sequence,
      invocationSequence: invocationAppend.value.sequence,
      chainValue: invocation.chainValue,
    });
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** The verified audit record view as stored (used by diagnostics/tests). */
export const readAuditRecords = (store: StateStorePort): StateResult<readonly StateRecord[]> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  return ok(verified.value.records.filter((record) => isAuditRecordKind(record.kind)));
};
