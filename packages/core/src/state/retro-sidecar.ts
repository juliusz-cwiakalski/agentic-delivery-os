/**
 * The independent evidence sidecar consumer (GH-232 F-2/F-3/F-4, DEC-1/DEC-2/
 * DEC-3/DEC-13).
 *
 * Pure over an injected `RetroSidecarIo`: the file primitives, permissions, the
 * injected keyed hash, and randomness arrive from the runtime edge. The surface
 * exposes only collector appends and verified reads — there is no update,
 * delete, reorder, or compaction member. One collector fence covers the
 * verified pre-append read, the link computation, and the append.
 */
import {
  RETRO_CHAIN_ANCHOR,
  RETRO_CHAIN_KEY_BYTES,
  RETRO_CHAIN_KEY_PAYLOAD_SCHEMA,
  RETRO_CHAIN_VALUE_HEX_LENGTH,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA_IDS,
  RETRO_EVIDENCE_SOURCES,
  RETRO_LEVEL_NAMES,
  type RetroChainBreak,
  type RetroChainVerdict,
  type RetroClaimedIdentity,
  type RetroEntryMalformation,
  type RetroErrorCode,
  type RetroEvidenceDraft,
  type RetroEvidenceRecord,
  type RetroEvidenceSource,
  type RetroFailureLocation,
  type RetroLevelName,
  type RetroResult,
  type RetroSidecarIo,
  type RetroSidecarRead,
  retroChainKeyPath,
  retroEvidenceLockPath,
  retroEvidencePath,
  type StateFailureCode,
  type StateSafeLocation,
} from "#contracts";

/** One verified sidecar consumer over an injected runtime edge. */
export type RetroSidecar = {
  readonly evidencePath: string;
  readonly keyPath: string;
  readonly lockPath: string;
  append(
    draft: RetroEvidenceDraft,
    options?: { readonly fenceToken?: string },
  ): RetroResult<RetroEvidenceRecord>;
  read(options?: { readonly reportedRemovals?: readonly number[] }): RetroResult<RetroSidecarRead>;
  verify(options?: {
    readonly reportedRemovals?: readonly number[];
  }): RetroResult<RetroChainVerdict>;
};

type ParsedLine =
  | { readonly kind: "record"; readonly record: RetroEvidenceRecord }
  | {
      readonly kind: "malformed";
      readonly position: number;
      readonly traceId?: string;
      readonly chainValue?: string;
    };

const ok = <T>(value: T): RetroResult<T> => ({ ok: true, value });

const stateFailure = (code: StateFailureCode, location: StateSafeLocation): RetroResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const retroFailure = (
  code: RetroErrorCode,
  location?: RetroFailureLocation,
): RetroResult<never> => ({
  ok: false,
  error: {
    kind: "retro",
    code,
    consequence: "not_landed",
    ...(location === undefined ? {} : { location }),
  },
});

const inputFailure = (location?: RetroFailureLocation): RetroResult<never> => ({
  ok: false,
  error: {
    kind: "input",
    code: "input.value.rejected",
    consequence: "not_landed",
    ...(location === undefined ? {} : { location }),
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLevel = (value: unknown): value is RetroLevelName =>
  typeof value === "string" && (RETRO_LEVEL_NAMES as readonly string[]).includes(value);

const isSource = (value: unknown): value is RetroEvidenceSource =>
  typeof value === "string" && (RETRO_EVIDENCE_SOURCES as readonly string[]).includes(value);

const isClaimedIdentity = (value: unknown): value is RetroClaimedIdentity =>
  isRecord(value) && value.kind === "claimed" && typeof value.value === "string";

const isDeclaredSchema = (value: unknown): value is string =>
  typeof value === "string" &&
  (RETRO_EVIDENCE_PAYLOAD_SCHEMA_IDS as readonly string[]).includes(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

type ChainHash = (previousLink: string, content: string) => string;

const canonicalContent = (record: Omit<RetroEvidenceRecord, "chainValue">): string => {
  const ordered = {
    schemaId: record.schemaId,
    traceId: record.traceId,
    level: record.level,
    source: record.source,
    windowStart: record.windowStart,
    windowEnd: record.windowEnd,
    collectedAt: record.collectedAt,
    ...(record.collectorIdentity === undefined
      ? {}
      : { collectorIdentity: record.collectorIdentity }),
    payloadRefs: record.payloadRefs,
    payloadSchemaId: record.payloadSchemaId,
  };
  return JSON.stringify(ordered);
};

const recordWithoutChain = (
  record: RetroEvidenceRecord,
): Omit<RetroEvidenceRecord, "chainValue"> => ({
  schemaId: record.schemaId,
  traceId: record.traceId,
  level: record.level,
  source: record.source,
  windowStart: record.windowStart,
  windowEnd: record.windowEnd,
  collectedAt: record.collectedAt,
  ...(record.collectorIdentity === undefined
    ? {}
    : { collectorIdentity: record.collectorIdentity }),
  payloadRefs: record.payloadRefs,
  payloadSchemaId: record.payloadSchemaId,
});

const parseLine = (line: string, position: number): ParsedLine => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { kind: "malformed", position };
  }
  if (!isRecord(parsed)) return { kind: "malformed", position };
  const traceId = parsed.traceId;
  const chainValue = parsed.chainValue;
  const collectorIdentity = parsed.collectorIdentity;
  const level = parsed.level;
  const source = parsed.source;
  const windowStart = parsed.windowStart;
  const windowEnd = parsed.windowEnd;
  const collectedAt = parsed.collectedAt;
  const payloadRefs = parsed.payloadRefs;
  const payloadSchemaId = parsed.payloadSchemaId;
  const malformed =
    parsed.schemaId !== RETRO_EVIDENCE_PAYLOAD_SCHEMA ||
    typeof traceId !== "string" ||
    !traceId.startsWith("ev-") ||
    !isLevel(level) ||
    !isSource(source) ||
    !isFiniteNumber(windowStart) ||
    !isFiniteNumber(windowEnd) ||
    windowStart > windowEnd ||
    !isFiniteNumber(collectedAt) ||
    !isStringArray(payloadRefs) ||
    !isDeclaredSchema(payloadSchemaId) ||
    typeof chainValue !== "string" ||
    (collectorIdentity !== undefined && !isClaimedIdentity(collectorIdentity));
  if (
    malformed ||
    typeof traceId !== "string" ||
    !isLevel(level) ||
    !isSource(source) ||
    !isFiniteNumber(windowStart) ||
    !isFiniteNumber(windowEnd) ||
    !isFiniteNumber(collectedAt) ||
    !isStringArray(payloadRefs) ||
    !isDeclaredSchema(payloadSchemaId) ||
    typeof chainValue !== "string" ||
    (collectorIdentity !== undefined && !isClaimedIdentity(collectorIdentity))
  ) {
    return {
      kind: "malformed",
      position,
      ...(typeof traceId === "string" ? { traceId } : {}),
      ...(typeof chainValue === "string" ? { chainValue } : {}),
    };
  }
  return {
    kind: "record",
    record: {
      schemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
      traceId,
      level,
      source,
      windowStart,
      windowEnd,
      collectedAt,
      ...(collectorIdentity === undefined ? {} : { collectorIdentity }),
      payloadRefs,
      payloadSchemaId,
      chainValue,
    },
  };
};

const parseKey = (content: string, path: string): RetroResult<string> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return stateFailure("state.store.torn", { path, record: 0 });
  }
  if (!isRecord(parsed) || parsed.schemaId !== RETRO_CHAIN_KEY_PAYLOAD_SCHEMA) {
    return stateFailure("state.store.torn", { path, record: 0 });
  }
  const key = parsed.key;
  if (
    typeof key !== "string" ||
    !new RegExp(`^[0-9a-f]{${RETRO_CHAIN_VALUE_HEX_LENGTH}}$`).test(key)
  ) {
    return stateFailure("state.store.torn", { path, record: 0 });
  }
  return ok(key);
};

const safeRead = (io: RetroSidecarIo, path: string): RetroResult<string> => {
  if (!io.exists(path)) return ok("");
  if (!io.verifyPermissions(path, "file")) {
    return stateFailure("state.permission.denied", { path });
  }
  try {
    return ok(io.readText(path));
  } catch {
    return stateFailure("state.store.torn", { path, record: 1 });
  }
};

const readKey = (io: RetroSidecarIo, path: string): RetroResult<string | undefined> => {
  if (!io.exists(path)) return ok(undefined);
  if (!io.verifyPermissions(path, "file")) {
    return stateFailure("state.permission.denied", { path });
  }
  let content: string;
  try {
    content = io.readText(path);
  } catch {
    return stateFailure("state.store.torn", { path, record: 0 });
  }
  return parseKey(content, path);
};

const ensureKey = (io: RetroSidecarIo, path: string): RetroResult<string> => {
  if (io.exists(path)) {
    const key = readKey(io, path);
    if (!key.ok) return key;
    return key.value === undefined
      ? stateFailure("state.store.torn", { path, record: 0 })
      : ok(key.value);
  }
  const keyHex = io.randomHex(RETRO_CHAIN_KEY_BYTES);
  const content = `${JSON.stringify({ schemaId: RETRO_CHAIN_KEY_PAYLOAD_SCHEMA, key: keyHex })}\n`;
  let created: boolean;
  try {
    io.ensureDirectory(io.stateDirectory);
    created = io.createExclusive(path, content);
  } catch {
    return stateFailure("state.write.failed", { path });
  }
  if (!created) {
    const existing = readKey(io, path);
    if (!existing.ok) return existing;
    return existing.value === undefined
      ? stateFailure("state.store.torn", { path, record: 0 })
      : ok(existing.value);
  }
  try {
    io.applyPermissions(path, "file");
  } catch {
    return stateFailure("state.write.failed", { path });
  }
  if (!io.verifyPermissions(path, "file")) {
    return stateFailure("state.permission.denied", { path });
  }
  return ok(keyHex);
};

const parseEvidence = (
  text: string,
  evidencePath: string,
  hash: ChainHash,
  reportedRemovals: readonly number[],
): {
  readonly records: readonly RetroEvidenceRecord[];
  readonly malformed: readonly RetroEntryMalformation[];
  readonly chain: RetroChainVerdict;
} => {
  const lines =
    text.length === 0 ? [] : text.split("\n").slice(0, text.endsWith("\n") ? -1 : undefined);
  const records: RetroEvidenceRecord[] = [];
  const malformed: RetroEntryMalformation[] = [];
  const breaks: RetroChainBreak[] = [];
  const removals = new Set(reportedRemovals);
  let previous: string = RETRO_CHAIN_ANCHOR;
  lines.forEach((line, index) => {
    const position = index + 1;
    const parsed = parseLine(line, position);
    if (parsed.kind === "malformed") {
      malformed.push({
        position,
        ...(parsed.traceId === undefined ? {} : { traceId: parsed.traceId }),
      });
      if (!removals.has(position)) {
        breaks.push({ position, traceId: parsed.traceId ?? "" });
      }
      if (parsed.chainValue !== undefined) previous = parsed.chainValue;
      return;
    }
    const content = canonicalContent(recordWithoutChain(parsed.record));
    const expected = hash(previous, content);
    if (expected !== parsed.record.chainValue && !removals.has(position)) {
      breaks.push({ position, traceId: parsed.record.traceId });
    }
    previous = parsed.record.chainValue;
    records.push(parsed.record);
  });
  return {
    records,
    malformed,
    chain: {
      verified: breaks.length === 0,
      records: lines.length,
      breaks,
      anchor: RETRO_CHAIN_ANCHOR,
      affectedDomain: "retro",
      storePath: evidencePath,
    },
  };
};

const readSidecar = (
  io: RetroSidecarIo,
  evidencePath: string,
  keyPath: string,
  reportedRemovals: readonly number[],
): RetroResult<RetroSidecarRead> => {
  const text = safeRead(io, evidencePath);
  if (!text.ok) return text;
  if (text.value.length > 0 && !text.value.endsWith("\n")) {
    return stateFailure("state.store.torn", { path: evidencePath, record: 1 });
  }
  const lineCount =
    text.value.length === 0 ? 0 : text.value.split("\n").filter((line) => line !== "").length;
  if (lineCount === 0) {
    return ok({
      records: [],
      malformed: [],
      chain: {
        verified: true,
        records: 0,
        breaks: [],
        anchor: RETRO_CHAIN_ANCHOR,
        affectedDomain: "retro",
        storePath: evidencePath,
      },
    });
  }
  for (const line of text.value.split("\n")) {
    if (line === "") continue;
    try {
      JSON.parse(line);
    } catch {
      return stateFailure("state.store.torn", { path: evidencePath, record: 1 });
    }
  }
  const key = readKey(io, keyPath);
  if (!key.ok) return key;
  if (key.value === undefined) {
    return stateFailure("state.keys.missing", { path: keyPath });
  }
  const keyHex = key.value;
  return ok(
    parseEvidence(
      text.value,
      evidencePath,
      (previous, content) => io.keyedHash(keyHex, previous, content),
      reportedRemovals,
    ),
  );
};

const validateDraft = (draft: RetroEvidenceDraft): boolean => {
  if (typeof draft.traceId !== "string" || !draft.traceId.startsWith("ev-")) return false;
  if (!isLevel(draft.level)) return false;
  if (!isSource(draft.source)) return false;
  if (!isFiniteNumber(draft.windowStart) || !isFiniteNumber(draft.windowEnd)) return false;
  if (draft.windowStart > draft.windowEnd) return false;
  if (!isFiniteNumber(draft.collectedAt)) return false;
  if (draft.collectorIdentity !== undefined && !isClaimedIdentity(draft.collectorIdentity)) {
    return false;
  }
  if (!isStringArray(draft.payloadRefs)) return false;
  return isDeclaredSchema(draft.payloadSchemaId);
};

/** Create the sidecar consumer over an injected runtime edge. */
export const createRetroSidecar = (io: RetroSidecarIo): RetroSidecar => {
  const evidencePath = retroEvidencePath(io.stateDirectory, io.workspaceId);
  const keyPath = retroChainKeyPath(io.stateDirectory, io.workspaceId);
  const lockPath = retroEvidenceLockPath(io.stateDirectory, io.workspaceId);

  return {
    evidencePath,
    keyPath,
    lockPath,

    read(options = {}) {
      return readSidecar(io, evidencePath, keyPath, options.reportedRemovals ?? []);
    },

    verify(options = {}) {
      const read = readSidecar(io, evidencePath, keyPath, options.reportedRemovals ?? []);
      if (!read.ok) return read;
      return ok(read.value.chain);
    },

    append(draft, options = {}) {
      if (!validateDraft(draft)) {
        return inputFailure({ path: evidencePath });
      }
      io.ensureDirectory(io.stateDirectory);
      const token = options.fenceToken ?? io.randomHex(8);
      let acquired: boolean;
      try {
        acquired = io.createExclusive(lockPath, `${JSON.stringify({ token })}\n`);
      } catch {
        return stateFailure("state.write.failed", { path: lockPath });
      }
      if (!acquired) return stateFailure("state.lock.busy", { path: lockPath });
      try {
        const current = readSidecar(io, evidencePath, keyPath, []);
        if (!current.ok) return current;
        if (current.value.malformed.length > 0) {
          const first = current.value.malformed[0];
          return retroFailure("retro.evidence.malformed-entry", {
            path: evidencePath,
            ...(first?.position === undefined ? {} : { position: first.position }),
            entriesProcessed: current.value.records.length + current.value.malformed.length,
            entriesPreserved: current.value.records.length,
            ...(first?.position === undefined ? {} : { firstFlaggedPosition: first.position }),
          });
        }
        if (!current.value.chain.verified) {
          const first = current.value.chain.breaks[0];
          return retroFailure("retro.evidence.tamper-flagged", {
            path: evidencePath,
            ...(first?.position === undefined ? {} : { position: first.position }),
            ...(first?.traceId === undefined ? {} : { traceId: first.traceId }),
          });
        }
        if (current.value.records.some((record) => record.traceId === draft.traceId)) {
          return inputFailure({ path: evidencePath });
        }
        const key = ensureKey(io, keyPath);
        if (!key.ok) return key;
        const previous =
          current.value.records.length === 0
            ? RETRO_CHAIN_ANCHOR
            : (current.value.records[current.value.records.length - 1]?.chainValue ??
              RETRO_CHAIN_ANCHOR);
        const recordWithoutHash: Omit<RetroEvidenceRecord, "chainValue"> = {
          schemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
          traceId: draft.traceId,
          level: draft.level,
          source: draft.source,
          windowStart: draft.windowStart,
          windowEnd: draft.windowEnd,
          collectedAt: draft.collectedAt,
          ...(draft.collectorIdentity === undefined
            ? {}
            : { collectorIdentity: draft.collectorIdentity }),
          payloadRefs: [...draft.payloadRefs],
          payloadSchemaId: draft.payloadSchemaId,
        };
        const chainValue = io.keyedHash(key.value, previous, canonicalContent(recordWithoutHash));
        const record: RetroEvidenceRecord = { ...recordWithoutHash, chainValue };
        try {
          io.appendText(evidencePath, `${JSON.stringify(record)}\n`);
          io.applyPermissions(evidencePath, "file");
        } catch {
          return stateFailure("state.write.failed", { path: evidencePath });
        }
        if (!io.verifyPermissions(evidencePath, "file")) {
          return stateFailure("state.permission.denied", { path: evidencePath });
        }
        return ok(record);
      } finally {
        try {
          io.removeFile(lockPath);
        } catch {
          // Best effort: the collector fence is released on the normal path.
        }
      }
    },
  };
};
