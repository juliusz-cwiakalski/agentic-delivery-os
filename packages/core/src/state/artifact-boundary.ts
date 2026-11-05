/**
 * Reusable validated artifact-boundary contracts (GH-222 F-1/F-6, DM-4).
 *
 * A boundary declares the record kinds and payload schemas it owns under one
 * store-scoped key prefix, and composes the public store port exactly like the
 * registry and closeout consumers do. Reads validate every record the boundary
 * owns before any value returns; writes admit only schema-conforming records.
 * The raw store port stays kind-agnostic (ASM-4): "undeclared" is
 * boundary-relative, never a closed store-wide kind list. No runtime API.
 */
import type {
  StateAppendOutcome,
  StateAppendRequest,
  StateArtifactBoundaryDeclaration,
  StateArtifactFieldType,
  StateArtifactKindDeclaration,
  StateArtifactRead,
  StateArtifactRecord,
  StateFenceHandle,
  StateJsonValue,
  StateResult,
  StateSafeLocation,
  StateStorePort,
} from "#contracts";

/** One validated artifact boundary over an injected store port. */
export type StateArtifactBoundary = {
  readonly declaration: StateArtifactBoundaryDeclaration;
  read(): StateResult<StateArtifactRead>;
  append(handle: StateFenceHandle, request: StateAppendRequest): StateResult<StateAppendOutcome>;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const undeclared = (location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code: "state.store.unknown", consequence: "not_landed", location },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a JSON value matches a declared payload field type. */
const matchesType = (type: StateArtifactFieldType, value: unknown): boolean => {
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

/**
 * Validate one payload against its declared kind: schema identifier, required
 * fields and their types, the record identity, and every closed vocabulary.
 * A violation is `state.store.unknown`; nothing is defaulted or coerced.
 */
const validatePayload = (
  kind: StateArtifactKindDeclaration,
  payload: StateJsonValue,
  location: StateSafeLocation,
): StateResult<undefined> => {
  if (!isRecord(payload)) return undeclared(location);
  if (kind.payloadSchema !== undefined && payload.schemaId !== kind.payloadSchema) {
    return undeclared(location);
  }
  for (const field of kind.fields) {
    if (!Object.hasOwn(payload, field.name)) {
      if (field.required) return undeclared(location);
      continue;
    }
    if (!matchesType(field.type, payload[field.name])) return undeclared(location);
  }
  const identity = payload[kind.identityField];
  if (typeof identity !== "string" || identity.length === 0) return undeclared(location);
  for (const vocabulary of kind.vocabularies ?? []) {
    if (!Object.hasOwn(payload, vocabulary.field)) continue;
    const value = payload[vocabulary.field];
    if (typeof value !== "string" || !vocabulary.values.includes(value)) {
      return undeclared(location);
    }
  }
  return ok(undefined);
};

/**
 * Create a validated boundary over a store. The declaration is data: applying
 * it to a second, differently named kind requires no code change.
 */
export const createArtifactBoundary = (
  store: StateStorePort,
  declaration: StateArtifactBoundaryDeclaration,
): StateArtifactBoundary => {
  const kindFor = (kind: string): StateArtifactKindDeclaration | undefined =>
    declaration.kinds.find((entry) => entry.kind === kind);

  return {
    declaration,

    read(): StateResult<StateArtifactRead> {
      const verified = store.readRecords();
      if (!verified.ok) return verified;
      const artifacts: StateArtifactRecord[] = [];
      for (const record of verified.value.records) {
        if (!record.key.startsWith(declaration.recordKeyPrefix)) continue;
        const location: StateSafeLocation = {
          path: verified.value.evidence.storePath,
          record: record.sequence,
        };
        const kind = kindFor(record.kind);
        if (kind === undefined) return undeclared(location);
        const validated = validatePayload(kind, record.payload, location);
        if (!validated.ok) return validated;
        artifacts.push({
          kind: record.kind,
          recordKey: record.key,
          sequence: record.sequence,
          payload: record.payload,
        });
      }
      return ok({
        verdict: artifacts.length === 0 ? "verified-empty" : "valid",
        artifacts,
        evidence: verified.value.evidence,
      });
    },

    append(handle: StateFenceHandle, request: StateAppendRequest): StateResult<StateAppendOutcome> {
      const location: StateSafeLocation = { path: store.identity.stateDirectory };
      const kind = kindFor(request.kind);
      if (kind === undefined) return undeclared(location);
      const validated = validatePayload(kind, request.payload, location);
      if (!validated.ok) return validated;
      return store.append(handle, request);
    },
  };
};
