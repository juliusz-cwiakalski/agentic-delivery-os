/**
 * The retro registry consumer (GH-232 F-8/F-9, DM-1/DM-5/DM-9).
 *
 * A validated boundary over the public state port: exactly three additive
 * record kinds (`retro.level`, `retro.run`, `retro.trigger`) under the retro
 * key prefix. Reads classify entry-level malformation in band (so the domain can
 * preserve valid entries), while torn/unknown stores propagate the state
 * identities. Writes are validated at the boundary and appended under a fence.
 */
import {
  RETRO_LEVEL_IDS,
  RETRO_LEVEL_NAMES,
  RETRO_LEVEL_PAYLOAD_SCHEMA,
  RETRO_LEVEL_RECORD_KEY_PREFIX,
  RETRO_LEVEL_RECORD_KIND,
  RETRO_LEVEL_STATUSES,
  RETRO_LEVELS,
  RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
  RETRO_MEMORY_AUDIT_TRIGGER_NAME,
  RETRO_MODES,
  RETRO_REGISTRY_BOUNDARY_DECLARATION,
  RETRO_RUN_PAYLOAD_SCHEMA,
  RETRO_RUN_RECORD_KEY_PREFIX,
  RETRO_RUN_RECORD_KIND,
  RETRO_SCOPE_KINDS,
  RETRO_TRIGGER_KINDS,
  RETRO_TRIGGER_PAYLOAD_SCHEMA,
  RETRO_TRIGGER_RECORD_KEY_PREFIX,
  RETRO_TRIGGER_RECORD_KIND,
  type RetroConsumedVerdict,
  type RetroEntryMalformation,
  type RetroEvidenceSource,
  type RetroLevelRecord,
  type RetroRegistryRead,
  type RetroRunRecord,
  type RetroTriggerRecord,
  type RetroTruthCheckOutcome,
  type RetroTruthVerdict,
  type StateAppendOutcome,
  type StateAppendRequest,
  type StateArtifactKindDeclaration,
  type StateArtifactRecord,
  type StateFenceHandle,
  type StateJsonValue,
  type StateResult,
  type StateStorePort,
} from "#contracts";
import { createArtifactBoundary } from "./artifact-boundary.js";

/** A verified registry read with entry-level malformations in band. */
export type { RetroRegistryRead } from "#contracts";

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const declaredKind = (kind: string): StateArtifactKindDeclaration | undefined =>
  RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds.find((entry) => entry.kind === kind);

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

const registryRecordKey = (prefix: string, identity: string): string =>
  `${prefix}:${encodeURIComponent(identity)}`;

/** Read every retro registry record, classifying entry-level malformation. */
export const readRetroRegistry = (store: StateStorePort): StateResult<RetroRegistryRead> => {
  const verified = store.readRecords();
  if (!verified.ok) return verified;
  const artifacts: StateArtifactRecord[] = [];
  const malformed: RetroEntryMalformation[] = [];
  for (const record of verified.value.records) {
    if (!record.key.startsWith(RETRO_REGISTRY_BOUNDARY_DECLARATION.recordKeyPrefix)) continue;
    const declaration = declaredKind(record.kind);
    if (declaration === undefined || !validatePayload(declaration, record.payload)) {
      malformed.push({ position: record.sequence });
      continue;
    }
    artifacts.push({
      kind: record.kind,
      recordKey: record.key,
      sequence: record.sequence,
      payload: record.payload,
    });
  }
  return ok({
    verdict: verified.value.records.length === 0 ? "verified-empty" : "valid",
    artifacts,
    malformed,
    evidence: verified.value.evidence,
  });
};

const parseLevel = (payload: StateJsonValue): RetroLevelRecord | undefined => {
  if (!isRecord(payload)) return undefined;
  const name = payload.name;
  const levelId = payload.levelId;
  const scopeKind = payload.scopeKind;
  const status = payload.status;
  const trigger = payload.trigger;
  if (
    payload.schemaId !== RETRO_LEVEL_PAYLOAD_SCHEMA ||
    typeof name !== "string" ||
    !(RETRO_LEVEL_NAMES as readonly string[]).includes(name) ||
    typeof levelId !== "string" ||
    !(RETRO_LEVEL_IDS as readonly string[]).includes(levelId) ||
    typeof scopeKind !== "string" ||
    !(RETRO_SCOPE_KINDS as readonly string[]).includes(scopeKind) ||
    typeof status !== "string" ||
    !(RETRO_LEVEL_STATUSES as readonly string[]).includes(status) ||
    !isRecord(trigger) ||
    typeof trigger.kind !== "string" ||
    !(RETRO_TRIGGER_KINDS as readonly string[]).includes(trigger.kind)
  ) {
    return undefined;
  }
  const cadence = trigger.cadence;
  const event = trigger.event;
  const lifecycle = trigger.lifecycle;
  if (cadence !== undefined && typeof cadence !== "string") return undefined;
  if (event !== undefined && typeof event !== "string") return undefined;
  if (lifecycle !== undefined && typeof lifecycle !== "string") return undefined;
  return {
    schemaId: RETRO_LEVEL_PAYLOAD_SCHEMA,
    name: name as RetroLevelRecord["name"],
    levelId: levelId as RetroLevelRecord["levelId"],
    scopeKind: scopeKind as RetroLevelRecord["scopeKind"],
    trigger: {
      kind: trigger.kind as RetroLevelRecord["trigger"]["kind"],
      ...(cadence === undefined ? {} : { cadence }),
      ...(event === undefined ? {} : { event }),
      ...(lifecycle === undefined ? {} : { lifecycle }),
    },
    status: status as RetroLevelRecord["status"],
  };
};

const parseTrigger = (payload: StateJsonValue): RetroTriggerRecord | undefined => {
  if (!isRecord(payload)) return undefined;
  const name = payload.name;
  const kind = payload.kind;
  const cadence = payload.cadence;
  const owningBinding = payload.owningBinding;
  if (
    payload.schemaId !== RETRO_TRIGGER_PAYLOAD_SCHEMA ||
    typeof name !== "string" ||
    typeof kind !== "string" ||
    !(RETRO_TRIGGER_KINDS as readonly string[]).includes(kind) ||
    typeof cadence !== "string" ||
    typeof owningBinding !== "string"
  ) {
    return undefined;
  }
  return {
    schemaId: RETRO_TRIGGER_PAYLOAD_SCHEMA,
    name,
    kind: kind as RetroTriggerRecord["kind"],
    cadence,
    owningBinding,
  };
};

const parseCheck = (value: unknown): RetroTruthCheckOutcome | undefined => {
  if (!isRecord(value)) return undefined;
  const id = value.id;
  const outcome = value.outcome;
  const findings = value.findings;
  const evidenceRefs = value.evidenceRefs;
  if (
    typeof id !== "string" ||
    (outcome !== "passed" &&
      outcome !== "finding" &&
      outcome !== "verified-empty" &&
      outcome !== "blocked") ||
    !Array.isArray(findings) ||
    !findings.every((entry) => typeof entry === "string") ||
    !Array.isArray(evidenceRefs) ||
    !evidenceRefs.every((entry) => typeof entry === "string")
  ) {
    return undefined;
  }
  return {
    id: id as RetroTruthCheckOutcome["id"],
    outcome,
    findings,
    evidenceRefs,
  };
};

const parseTruth = (value: unknown): RetroTruthVerdict | undefined => {
  if (!isRecord(value)) return undefined;
  const clean = value.clean;
  const blocking = value.blocking;
  const checks = value.checks;
  if (
    typeof clean !== "boolean" ||
    !(blocking === null || typeof blocking === "string") ||
    !Array.isArray(checks)
  ) {
    return undefined;
  }
  const parsedChecks: RetroTruthCheckOutcome[] = [];
  for (const check of checks) {
    const parsed = parseCheck(check);
    if (parsed === undefined) return undefined;
    parsedChecks.push(parsed);
  }
  return {
    clean,
    blocking: blocking as RetroTruthVerdict["blocking"],
    checks: parsedChecks,
  };
};

const parseConsumed = (value: unknown): RetroConsumedVerdict | undefined => {
  if (!isRecord(value)) return undefined;
  const source = value.source;
  const verified = value.verified;
  const records = value.records;
  const truncated = value.truncated;
  if (
    typeof source !== "string" ||
    typeof verified !== "boolean" ||
    typeof records !== "number" ||
    typeof truncated !== "boolean"
  ) {
    return undefined;
  }
  return {
    source: source as RetroEvidenceSource,
    verified,
    records,
    truncated,
  };
};

const parseRun = (payload: StateJsonValue): RetroRunRecord | undefined => {
  if (!isRecord(payload)) return undefined;
  const runId = payload.runId;
  const level = payload.level;
  const mode = payload.mode;
  const scope = payload.scope;
  const counts = payload.counts;
  const consumed = payload.consumed;
  const truth = payload.truth;
  if (
    payload.schemaId !== RETRO_RUN_PAYLOAD_SCHEMA ||
    typeof runId !== "string" ||
    typeof level !== "string" ||
    !(RETRO_LEVEL_NAMES as readonly string[]).includes(level) ||
    typeof mode !== "string" ||
    !(RETRO_MODES as readonly string[]).includes(mode) ||
    typeof scope !== "string" ||
    !isRecord(counts) ||
    typeof counts.collected !== "number" ||
    typeof counts.malformed !== "number" ||
    typeof counts.skippedSource !== "number" ||
    !Array.isArray(consumed)
  ) {
    return undefined;
  }
  const parsedConsumed: RetroConsumedVerdict[] = [];
  for (const entry of consumed) {
    const parsed = parseConsumed(entry);
    if (parsed === undefined) return undefined;
    parsedConsumed.push(parsed);
  }
  const parsedTruth = parseTruth(truth);
  if (parsedTruth === undefined) return undefined;
  return {
    schemaId: RETRO_RUN_PAYLOAD_SCHEMA,
    runId,
    level: level as RetroRunRecord["level"],
    mode: mode as RetroRunRecord["mode"],
    scope,
    counts: {
      collected: counts.collected,
      malformed: counts.malformed,
      skippedSource: counts.skippedSource,
    },
    consumed: parsedConsumed,
    truth: parsedTruth,
  };
};

/** The parsed level entries of a verified registry read. */
export const readRetroLevels = (read: RetroRegistryRead): readonly RetroLevelRecord[] =>
  read.artifacts
    .filter((artifact) => artifact.kind === RETRO_LEVEL_RECORD_KIND)
    .flatMap((artifact) => {
      const parsed = parseLevel(artifact.payload);
      return parsed === undefined ? [] : [parsed];
    });

/** The parsed trigger entries of a verified registry read. */
export const readRetroTriggers = (read: RetroRegistryRead): readonly RetroTriggerRecord[] =>
  read.artifacts
    .filter((artifact) => artifact.kind === RETRO_TRIGGER_RECORD_KIND)
    .flatMap((artifact) => {
      const parsed = parseTrigger(artifact.payload);
      return parsed === undefined ? [] : [parsed];
    });

/** The parsed run entries of a verified registry read, in append order. */
export const readRetroRuns = (read: RetroRegistryRead): readonly RetroRunRecord[] =>
  read.artifacts
    .filter((artifact) => artifact.kind === RETRO_RUN_RECORD_KIND)
    .flatMap((artifact) => {
      const parsed = parseRun(artifact.payload);
      return parsed === undefined ? [] : [parsed];
    });

const appendValidated = (
  store: StateStorePort,
  handle: StateFenceHandle,
  request: StateAppendRequest,
): StateResult<StateAppendOutcome> =>
  createArtifactBoundary(store, RETRO_REGISTRY_BOUNDARY_DECLARATION).append(handle, request);

/** Append one validated registry record under a caller-supplied fence token. */
export const appendRetroRegistryRecord = (
  store: StateStorePort,
  request: {
    readonly kind: string;
    readonly recordKey: string;
    readonly payload: StateJsonValue;
    readonly fenceToken: string;
  },
): StateResult<StateAppendOutcome> => {
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  try {
    return appendValidated(store, acquired.value.handle, {
      kind: request.kind,
      recordKey: request.recordKey,
      payload: request.payload,
    });
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const levelPayload = (level: RetroLevelRecord): StateJsonValue => ({
  schemaId: level.schemaId,
  name: level.name,
  levelId: level.levelId,
  scopeKind: level.scopeKind,
  trigger: {
    kind: level.trigger.kind,
    ...(level.trigger.cadence === undefined ? {} : { cadence: level.trigger.cadence }),
    ...(level.trigger.event === undefined ? {} : { event: level.trigger.event }),
    ...(level.trigger.lifecycle === undefined ? {} : { lifecycle: level.trigger.lifecycle }),
  },
  status: level.status,
});

const publicTrigger = (): RetroTriggerRecord => ({
  schemaId: RETRO_TRIGGER_PAYLOAD_SCHEMA,
  name: RETRO_MEMORY_AUDIT_TRIGGER_NAME,
  kind: "schedule",
  cadence: RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
  owningBinding: "memory consolidation skill",
});

const toRunPayload = (run: RetroRunRecord): StateJsonValue => ({
  schemaId: run.schemaId,
  runId: run.runId,
  level: run.level,
  mode: run.mode,
  scope: run.scope,
  counts: {
    collected: run.counts.collected,
    malformed: run.counts.malformed,
    skippedSource: run.counts.skippedSource,
  },
  consumed: run.consumed.map((entry) => ({
    source: entry.source,
    verified: entry.verified,
    records: entry.records,
    truncated: entry.truncated,
  })),
  truth: {
    clean: run.truth.clean,
    blocking: run.truth.blocking,
    checks: run.truth.checks.map((check) => ({
      id: check.id,
      outcome: check.outcome,
      findings: [...check.findings],
      evidenceRefs: [...check.evidenceRefs],
    })),
  },
});

/** Append one validated run record under a fresh fence token. */
export const recordRetroRun = (
  store: StateStorePort,
  run: RetroRunRecord,
  fenceToken: string,
): StateResult<StateAppendOutcome> =>
  appendRetroRegistryRecord(store, {
    kind: RETRO_RUN_RECORD_KIND,
    recordKey: registryRecordKey(RETRO_RUN_RECORD_KEY_PREFIX, run.runId),
    payload: toRunPayload(run),
    fenceToken,
  });

/** Additive, idempotent seed of the six levels and the memory-audit trigger. */ export const seedRetroRegistry =
  (store: StateStorePort, fenceToken: string): StateResult<readonly StateAppendOutcome[]> => {
    const read = readRetroRegistry(store);
    if (!read.ok) return read;
    const existingLevels = new Set(readRetroLevels(read.value).map((level) => level.name));
    const existingTriggers = new Set(readRetroTriggers(read.value).map((trigger) => trigger.name));
    const requests: StateAppendRequest[] = [];
    for (const level of RETRO_LEVELS) {
      if (existingLevels.has(level.name)) continue;
      requests.push({
        kind: RETRO_LEVEL_RECORD_KIND,
        recordKey: registryRecordKey(RETRO_LEVEL_RECORD_KEY_PREFIX, level.name),
        payload: levelPayload({
          schemaId: RETRO_LEVEL_PAYLOAD_SCHEMA,
          name: level.name,
          levelId: level.id,
          scopeKind: level.scopeKind,
          trigger: level.trigger,
          status: level.status,
        }),
      });
    }
    if (!existingTriggers.has(RETRO_MEMORY_AUDIT_TRIGGER_NAME)) {
      const trigger = publicTrigger();
      requests.push({
        kind: RETRO_TRIGGER_RECORD_KIND,
        recordKey: registryRecordKey(
          RETRO_TRIGGER_RECORD_KEY_PREFIX,
          RETRO_MEMORY_AUDIT_TRIGGER_NAME,
        ),
        payload: {
          schemaId: trigger.schemaId,
          name: trigger.name,
          kind: trigger.kind,
          cadence: trigger.cadence,
          owningBinding: trigger.owningBinding,
        },
      });
    }
    if (requests.length === 0) return ok([]);
    const acquired = store.acquireFence(fenceToken);
    if (!acquired.ok) return acquired;
    const appended: StateAppendOutcome[] = [];
    try {
      for (const request of requests) {
        const result = appendValidated(store, acquired.value.handle, request);
        if (!result.ok) return result;
        appended.push(result.value);
      }
      return ok(appended);
    } finally {
      store.releaseFence(acquired.value.handle);
    }
  };
