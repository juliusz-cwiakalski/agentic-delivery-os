/**
 * The retro action registry's validated boundary (GH-287 F-1, F-2, DM-1; DEC-7).
 *
 * A sibling of the delivered retro-registry boundary: exactly the two additive
 * record kinds (`retro.action`, `retro.action-closure`) under the shared
 * `retro.action` scope. Reads validate every owned record before any value
 * returns and classify entry-level malformation in band; writes admit only
 * schema-conforming records and append under a fence. The delivered
 * retro-registry boundary's exactly-three declaration is untouched.
 */
import {
  RETRO_ACTION_CLOSURE_IDENTITY_FIELD,
  RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
  RETRO_ACTION_CLOSURE_RECORD_KIND,
  RETRO_ACTION_IDENTITY_FIELD,
  RETRO_ACTION_PAYLOAD_SCHEMA,
  RETRO_ACTION_RECORD_KIND,
  RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION,
  RETRO_ACTION_REGISTRY_FENCE_NAMESPACE,
  type RetroActionClosureRecord,
  type RetroActionRecord,
  type RetroActionRegistryPort,
  type RetroActionRegistrySnapshot,
  retroActionClosureRecordKey,
  retroActionRecordKey,
  type StateAppendOutcome,
  type StateAppendRequest,
  type StateArtifactKindDeclaration,
  type StateJsonValue,
  type StateResult,
  type StateStorePort,
} from "#contracts";
import { createArtifactBoundary } from "./artifact-boundary.js";

/** One entry-level malformation position (the delivered pattern). */
export type ActionRegistryMalformation = { readonly position: number };

/** A verified action-registry read with entry-level malformation reported in band. */
export type ActionRegistryRead = {
  readonly verdict: "valid" | "verified-empty";
  readonly actions: readonly RetroActionRecord[];
  readonly closures: readonly RetroActionClosureRecord[];
  readonly malformed: readonly ActionRegistryMalformation[];
  readonly evidence: { readonly storePath: string };
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFilled = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const declaredKind = (kind: string): StateArtifactKindDeclaration | undefined =>
  RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.kinds.find((entry) => entry.kind === kind);

const matchesFieldType = (type: string, value: unknown): boolean => {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
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

const parseVerifier = (value: unknown): RetroActionRecord["outcomeVerifier"] | undefined => {
  if (!isRecord(value)) return undefined;
  const evidence = value.evidence;
  const windowStart = value.windowStart;
  const windowEnd = value.windowEnd;
  if (!isFilled(evidence) || !isFilled(windowStart) || !isFilled(windowEnd)) return undefined;
  return { evidence, windowStart, windowEnd };
};

const parseAction = (payload: StateJsonValue): RetroActionRecord | undefined => {
  if (!isRecord(payload)) return undefined;
  const verifier = parseVerifier(payload.outcomeVerifier);
  const lapses = payload.dueDateLapses;
  if (
    payload.schemaId !== RETRO_ACTION_PAYLOAD_SCHEMA ||
    !isFilled(payload.actionId) ||
    !isFilled(payload.owner) ||
    typeof payload.ownerKind !== "string" ||
    typeof payload.verb !== "string" ||
    !isFilled(payload.measurableOutcome) ||
    !isFilled(payload.trackerEntry) ||
    typeof payload.trackerCorroboration !== "string" ||
    !isFilled(payload.dueDate) ||
    !Array.isArray(lapses) ||
    !lapses.every((entry) => typeof entry === "string") ||
    !isFilled(payload.verificationArtifact) ||
    verifier === undefined ||
    !isFilled(payload.rollbackCondition) ||
    typeof payload.level !== "string" ||
    !isFilled(payload.window) ||
    typeof payload.filedAt !== "number"
  ) {
    return undefined;
  }
  return {
    schemaId: RETRO_ACTION_PAYLOAD_SCHEMA,
    actionId: payload.actionId,
    owner: payload.owner,
    ownerKind: payload.ownerKind as RetroActionRecord["ownerKind"],
    verb: payload.verb as RetroActionRecord["verb"],
    measurableOutcome: payload.measurableOutcome,
    trackerEntry: payload.trackerEntry,
    trackerCorroboration: payload.trackerCorroboration as RetroActionRecord["trackerCorroboration"],
    dueDate: payload.dueDate,
    dueDateLapses: lapses,
    verificationArtifact: payload.verificationArtifact,
    outcomeVerifier: verifier,
    rollbackCondition: payload.rollbackCondition,
    level: payload.level as RetroActionRecord["level"],
    window: payload.window,
    filedAt: payload.filedAt,
  };
};

const parseJustification = (value: unknown): RetroActionClosureRecord["justification"] => {
  if (!isRecord(value)) return {};
  return {
    ...(isFilled(value.artifact) ? { artifact: value.artifact } : {}),
    ...(isFilled(value.reason) ? { reason: value.reason } : {}),
    ...(isFilled(value.successor) ? { successor: value.successor } : {}),
  };
};

const parseClosure = (payload: StateJsonValue): RetroActionClosureRecord | undefined => {
  if (!isRecord(payload)) return undefined;
  if (
    payload.schemaId !== RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA ||
    !isFilled(payload.closureId) ||
    !isFilled(payload.actionId) ||
    typeof payload.route !== "string" ||
    typeof payload.plane !== "string" ||
    !isFilled(payload.decision) ||
    !isRecord(payload.justification) ||
    typeof payload.artifactClosure !== "string" ||
    typeof payload.outcomeClosure !== "string" ||
    typeof payload.windowState !== "string" ||
    typeof payload.decidedAt !== "number"
  ) {
    return undefined;
  }
  return {
    schemaId: RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
    closureId: payload.closureId,
    actionId: payload.actionId,
    route: payload.route as RetroActionClosureRecord["route"],
    plane: payload.plane as RetroActionClosureRecord["plane"],
    decision: payload.decision,
    justification: parseJustification(payload.justification),
    artifactClosure: payload.artifactClosure as RetroActionClosureRecord["artifactClosure"],
    outcomeClosure: payload.outcomeClosure as RetroActionClosureRecord["outcomeClosure"],
    windowState: payload.windowState as RetroActionClosureRecord["windowState"],
    decidedAt: payload.decidedAt,
  };
};

/** Read every action-registry record, classifying entry-level malformation. */
export const readActionRegistry = (store: StateStorePort): StateResult<ActionRegistryRead> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const actions: RetroActionRecord[] = [];
  const closures: RetroActionClosureRecord[] = [];
  const malformed: ActionRegistryMalformation[] = [];
  for (const record of verified.value.records) {
    if (!record.key.startsWith(RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION.recordKeyPrefix))
      continue;
    const declaration = declaredKind(record.kind);
    if (declaration === undefined || !validatePayload(declaration, record.payload)) {
      malformed.push({ position: record.sequence });
      continue;
    }
    if (record.kind === RETRO_ACTION_RECORD_KIND) {
      const parsed = parseAction(record.payload);
      if (parsed === undefined) malformed.push({ position: record.sequence });
      else actions.push(parsed);
      continue;
    }
    if (record.kind === RETRO_ACTION_CLOSURE_RECORD_KIND) {
      const parsed = parseClosure(record.payload);
      if (parsed === undefined) malformed.push({ position: record.sequence });
      else closures.push(parsed);
    }
  }
  return ok({
    verdict: actions.length === 0 && closures.length === 0 ? "verified-empty" : "valid",
    actions,
    closures,
    malformed,
    evidence: { storePath: verified.value.evidence.storePath },
  });
};

const appendValidated = (
  store: StateStorePort,
  fenceToken: string,
  request: StateAppendRequest,
): StateResult<StateAppendOutcome> => {
  const acquired = store.acquireFence(`${RETRO_ACTION_REGISTRY_FENCE_NAMESPACE}:${fenceToken}`);
  if (!acquired.ok) return acquired;
  try {
    return createArtifactBoundary(store, RETRO_ACTION_REGISTRY_BOUNDARY_DECLARATION).append(
      acquired.value.handle,
      request,
    );
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const actionPayload = (record: RetroActionRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  actionId: record.actionId,
  owner: record.owner,
  ownerKind: record.ownerKind,
  verb: record.verb,
  measurableOutcome: record.measurableOutcome,
  trackerEntry: record.trackerEntry,
  trackerCorroboration: record.trackerCorroboration,
  dueDate: record.dueDate,
  dueDateLapses: [...record.dueDateLapses],
  verificationArtifact: record.verificationArtifact,
  outcomeVerifier: {
    evidence: record.outcomeVerifier.evidence,
    windowStart: record.outcomeVerifier.windowStart,
    windowEnd: record.outcomeVerifier.windowEnd,
  },
  rollbackCondition: record.rollbackCondition,
  level: record.level,
  window: record.window,
  filedAt: record.filedAt,
});

const closurePayload = (record: RetroActionClosureRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  closureId: record.closureId,
  actionId: record.actionId,
  route: record.route,
  plane: record.plane,
  decision: record.decision,
  justification: {
    ...(record.justification.artifact === undefined
      ? {}
      : { artifact: record.justification.artifact }),
    ...(record.justification.reason === undefined ? {} : { reason: record.justification.reason }),
    ...(record.justification.successor === undefined
      ? {}
      : { successor: record.justification.successor }),
  },
  artifactClosure: record.artifactClosure,
  outcomeClosure: record.outcomeClosure,
  windowState: record.windowState,
  decidedAt: record.decidedAt,
});

/** Append one validated action record under a caller-supplied fence token. */
export const appendActionRecord = (
  store: StateStorePort,
  record: RetroActionRecord,
  fenceToken: string,
): StateResult<StateAppendOutcome> =>
  appendValidated(store, fenceToken, {
    kind: RETRO_ACTION_RECORD_KIND,
    recordKey: retroActionRecordKey(record[RETRO_ACTION_IDENTITY_FIELD]),
    payload: actionPayload(record),
  });

/** Append one validated closure record under a caller-supplied fence token. */
export const appendActionClosureRecord = (
  store: StateStorePort,
  record: RetroActionClosureRecord,
  fenceToken: string,
): StateResult<StateAppendOutcome> =>
  appendValidated(store, fenceToken, {
    kind: RETRO_ACTION_CLOSURE_RECORD_KIND,
    recordKey: retroActionClosureRecordKey(record[RETRO_ACTION_CLOSURE_IDENTITY_FIELD]),
    payload: closurePayload(record),
  });

/** Compose the registry port over the validated boundary. */
export const createRetroActionRegistryPort = (store: StateStorePort): RetroActionRegistryPort => ({
  read: () => {
    const read = readActionRegistry(store);
    if (!read.ok) {
      return {
        ok: false,
        error: {
          kind: "state",
          code: read.error.code,
          consequence: "not_landed",
          location: { path: read.error.location.path },
        },
      };
    }
    const snapshot: RetroActionRegistrySnapshot = {
      actions: read.value.actions,
      closures: read.value.closures,
    };
    return { ok: true, value: snapshot };
  },
  appendAction: (record, fenceToken) => {
    const appended = appendActionRecord(store, record, fenceToken);
    return appended.ok
      ? { ok: true, value: undefined }
      : {
          ok: false,
          error: {
            kind: "state",
            code: appended.error.code,
            consequence: "not_landed",
            location: { path: appended.error.location.path },
          },
        };
  },
  appendClosure: (record, fenceToken) => {
    const appended = appendActionClosureRecord(store, record, fenceToken);
    return appended.ok
      ? { ok: true, value: undefined }
      : {
          ok: false,
          error: {
            kind: "state",
            code: appended.error.code,
            consequence: "not_landed",
            location: { path: appended.error.location.path },
          },
        };
  },
});
