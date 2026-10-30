/**
 * `@delivery-os/core/state` — the driver-neutral store facade (GH-174 F-1..F-7).
 *
 * One public port over injected identity and an injected runtime edge. The
 * driver kind selects only the read/index strategy; no operation or result on
 * the port discriminates by kind. Runtime APIs live in `./driver/runtime-edge`.
 */
import {
  STATE_SCHEMA_VERSION,
  type StateAppendOutcome,
  type StateAppendRequest,
  type StateDocumentReplaceRequest,
  type StateDocumentReport,
  type StateDriverKind,
  type StateFailure,
  type StateFailureCode,
  type StateFenceAcquisition,
  type StateFenceHandle,
  type StateFenceRecoveryReport,
  type StateFenceReleaseReport,
  type StateFenceStatus,
  type StateIntegrityOutcome,
  type StateJsonValue,
  type StateReadEvidence,
  type StateReadOutcome,
  type StateReadRequest,
  type StateRecord,
  type StateRepairOutcome,
  type StateResult,
  type StateSafeLocation,
  type StateStoreIdentity,
  type StateStorePort,
} from "#contracts";
import {
  createJsonlStrategy,
  createSqliteStrategy,
  type StateReadStrategy,
} from "./driver/strategy.js";
import type { StateRuntimeEdge } from "./edge.js";
import { buildRecord, serializeRecord, verifyLedger } from "./ledger.js";

export {
  STATE_DRIVER_KINDS,
  STATE_LEVELS,
  STATE_SCHEMA_VERSION,
  type StateDriverKind,
} from "#contracts";
export { createNodeStateEdge } from "./driver/runtime-edge.js";
export type {
  StateEdgeFaultPoint,
  StateIndexRow,
  StatePathKind,
  StatePlatform,
  StateRuntimeEdge,
} from "./edge.js";

/** Options for opening a store: the driver kind and the injected edge. */
export type StateStoreOptions = {
  readonly driver: StateDriverKind;
  readonly edge: StateRuntimeEdge;
  /** Injected staleness window for fences; never read from a wall clock. */
  readonly staleFenceMs?: number;
};

const DEFAULT_STALE_FENCE_MS = 30_000;

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (code: StateFailureCode, location: StateSafeLocation): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const torn = (path: string, record: number): StateResult<never> =>
  fail("state.store.torn", { path, record });

const encodeSegment = (value: string): string => encodeURIComponent(value);

const strategyFor = (driver: StateDriverKind): StateReadStrategy =>
  driver === "sqlite" ? createSqliteStrategy() : createJsonlStrategy();

const isSafeDocumentName = (name: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && name !== "." && name !== "..";

const isLockContent = (
  value: unknown,
): value is { namespace?: unknown; token?: unknown; acquiredAtMs?: unknown } =>
  typeof value === "object" && value !== null;

/**
 * Create a store over an injected identity. Construction performs the open checks
 * (level, schema version, existing permissions) and no write; an open failure is
 * reported by every operation of the returned port.
 */
export const createStateStore = (
  identity: StateStoreIdentity,
  options: StateStoreOptions,
): StateStorePort => {
  const edge = options.edge;
  const strategy = strategyFor(options.driver);
  const staleFenceMs = options.staleFenceMs ?? DEFAULT_STALE_FENCE_MS;
  const workspace = encodeSegment(identity.workspaceId);
  const stateDirectory = identity.stateDirectory;
  const ledgerPath = `${stateDirectory}/ledger.${workspace}.jsonl`;
  const headerPath = `${stateDirectory}/header.${workspace}.json`;
  const indexPath = `${stateDirectory}/index.${workspace}.sqlite`;
  const fencePath = `${stateDirectory}/fence.${workspace}.lock`;
  const documentsDirectory = `${stateDirectory}/documents.${workspace}`;

  const activeHandles = new Set<StateFenceHandle>();
  const cleanedTemporaries: string[] = [];

  const openFailure = (): StateFailure | undefined => {
    if (identity.level !== "local") {
      return {
        kind: "state",
        code: "state.level.unsupported",
        consequence: "not_landed",
        location: { path: stateDirectory },
      };
    }
    if (identity.schemaVersion !== STATE_SCHEMA_VERSION) {
      return {
        kind: "state",
        code: "state.schema.mismatch",
        consequence: "not_landed",
        location: { path: stateDirectory },
      };
    }
    if (!edge.exists(stateDirectory)) return undefined;
    const directoryOk = edge.verifyPermissions(stateDirectory, "directory");
    if (!directoryOk) {
      return {
        kind: "state",
        code: "state.permission.denied",
        consequence: "not_landed",
        location: { path: stateDirectory },
      };
    }
    for (const path of [ledgerPath, headerPath, fencePath, indexPath]) {
      if (edge.exists(path) && !edge.verifyPermissions(path, "file")) {
        return {
          kind: "state",
          code: "state.permission.denied",
          consequence: "not_landed",
          location: { path },
        };
      }
    }
    for (const directory of [documentsDirectory]) {
      if (!edge.exists(directory)) continue;
      if (!edge.verifyPermissions(directory, "directory")) {
        return {
          kind: "state",
          code: "state.permission.denied",
          consequence: "not_landed",
          location: { path: directory },
        };
      }
      for (const name of edge.listDirectory(directory)) {
        const path = `${directory}/${name}`;
        if (name.endsWith(".tmp")) {
          edge.removeFile(path);
          cleanedTemporaries.push(path);
          continue;
        }
        if (!edge.verifyPermissions(path, "file")) {
          return {
            kind: "state",
            code: "state.permission.denied",
            consequence: "not_landed",
            location: { path },
          };
        }
      }
    }
    if (edge.exists(`${indexPath}.tmp`)) {
      edge.removeFile(`${indexPath}.tmp`);
      cleanedTemporaries.push(`${indexPath}.tmp`);
    }
    return undefined;
  };

  const failure = openFailure();

  const baseEvidence = (records: readonly StateRecord[]): StateReadEvidence => ({
    storePath: ledgerPath,
    verification: strategy.verification,
    verifiedEmpty: records.length === 0,
    recordCount: records.length,
    ...(cleanedTemporaries.length > 0 ? { cleanedTemporaries: [...cleanedTemporaries] } : {}),
  });

  const readHeader = (): StateResult<undefined> => {
    if (!edge.exists(headerPath)) return ok(undefined);
    let parsed: unknown;
    try {
      parsed = JSON.parse(edge.readText(headerPath));
    } catch {
      return torn(headerPath, 0);
    }
    const version =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { schemaVersion?: unknown }).schemaVersion
        : undefined;
    if (version !== identity.schemaVersion) {
      return fail("state.schema.mismatch", { path: headerPath, record: 0 });
    }
    return ok(undefined);
  };

  const verifiedState = (): StateResult<{
    readonly records: readonly StateRecord[];
    readonly evidence: StateReadEvidence;
  }> => {
    const header = readHeader();
    if (!header.ok) return header;
    if (!edge.exists(ledgerPath)) {
      return ok({ records: [], evidence: baseEvidence([]) });
    }
    let text: string;
    try {
      text = edge.readText(ledgerPath);
    } catch {
      return torn(ledgerPath, 1);
    }
    const verification = verifyLedger(text, identity.schemaVersion);
    if (verification.status === "empty") {
      return ok({ records: [], evidence: baseEvidence([]) });
    }
    if (verification.status === "schema") {
      return fail("state.schema.mismatch", { path: ledgerPath, record: verification.position });
    }
    if (verification.status === "torn") {
      return torn(ledgerPath, verification.position);
    }
    return ok({ records: verification.records, evidence: baseEvidence(verification.records) });
  };

  const lockState = (): { held: boolean; stale: boolean; token?: string } => {
    if (!edge.exists(fencePath)) return { held: false, stale: false };
    let parsed: unknown;
    try {
      parsed = JSON.parse(edge.readText(fencePath));
    } catch {
      return { held: true, stale: true };
    }
    if (!isLockContent(parsed)) return { held: true, stale: true };
    const token = typeof parsed.token === "string" ? parsed.token : undefined;
    const acquiredAtMs = Number(parsed.acquiredAtMs);
    const age = edge.now() - acquiredAtMs;
    const stale = !Number.isFinite(acquiredAtMs) || age > staleFenceMs;
    return { held: true, stale, ...(token !== undefined ? { token } : {}) };
  };

  const ensureRoot = (): void => {
    if (!edge.exists(stateDirectory)) edge.ensureDirectory(stateDirectory);
    if (!edge.exists(headerPath)) {
      edge.writeFile(headerPath, `${JSON.stringify({ schemaVersion: identity.schemaVersion })}\n`);
    }
  };

  const requireFence = (handle: StateFenceHandle): StateResult<undefined> => {
    if (!activeHandles.has(handle)) return fail("state.lock.busy", { path: fencePath });
    const lock = lockState();
    if (!lock.held || lock.token !== handle.token) {
      return fail("state.lock.busy", { path: fencePath });
    }
    return ok(undefined);
  };

  const appendRecord = (
    handle: StateFenceHandle,
    kind: string,
    key: string,
    payload: StateJsonValue,
  ): StateResult<StateRecord> => {
    const fence = requireFence(handle);
    if (!fence.ok) return fence;
    const verified = verifiedState();
    if (!verified.ok) return verified;
    const sequence = verified.value.records.length + 1;
    const record = buildRecord(kind, key, sequence, payload, identity.schemaVersion);
    try {
      ensureRoot();
      edge.raiseFault("append-before-flush");
      edge.appendFile(ledgerPath, serializeRecord(record));
    } catch {
      return fail("state.write.failed", { path: ledgerPath, record: sequence });
    }
    // Crash barrier: the record has landed and is fsynced. An injected fault
    // here simulates a writer dying before the fence is released (TC-015), so
    // it must escape rather than be reported as `not_landed`.
    edge.raiseFault("append-after-flush");
    strategy.afterAppend([...verified.value.records, record], indexPath, edge);
    return ok(record);
  };

  const createHandle = (token: string): StateFenceHandle =>
    // The brand is compile-time only (a unique type-level symbol), so the
    // runtime handle is the token plus its store-scoped identity fields.
    ({
      token,
      workspaceId: identity.workspaceId,
      fenceNamespace: identity.fenceNamespace,
    }) as StateFenceHandle;

  return {
    identity,
    read(request: StateReadRequest): StateResult<StateReadOutcome> {
      if (failure !== undefined) return { ok: false, error: failure };
      const verified = verifiedState();
      if (!verified.ok) return verified;
      const outcome = strategy.read(verified.value.records, indexPath, edge);
      if (!outcome.ok) return { ok: false, error: outcome.error };
      const values = outcome.value.values;
      const missing = request.requiredKeys.filter((key) => !Object.hasOwn(values, key));
      if (missing.length > 0) {
        return fail("state.keys.missing", {
          path: ledgerPath,
          record: verified.value.records.length,
          missingKeys: missing,
        });
      }
      const picked: Record<string, StateJsonValue> = {};
      for (const key of request.requiredKeys) {
        const value = values[key];
        if (value !== undefined) picked[key] = value;
      }
      const evidence: StateReadEvidence = {
        ...verified.value.evidence,
        ...(outcome.value.rebuild !== undefined ? { rebuild: outcome.value.rebuild } : {}),
      };
      return ok({ values: picked, evidence });
    },

    append(handle: StateFenceHandle, request: StateAppendRequest): StateResult<StateAppendOutcome> {
      if (failure !== undefined) return { ok: false, error: failure };
      const record = appendRecord(handle, request.kind, request.recordKey, request.payload);
      if (!record.ok) return record;
      return ok({
        sequence: record.value.sequence,
        checksum: record.value.checksum,
        path: ledgerPath,
      });
    },

    replaceDocument(
      handle: StateFenceHandle,
      request: StateDocumentReplaceRequest,
    ): StateResult<StateDocumentReport> {
      if (failure !== undefined) return { ok: false, error: failure };
      const target = `${documentsDirectory}/${request.name}`;
      if (!isSafeDocumentName(request.name)) {
        return fail("state.write.failed", { path: documentsDirectory });
      }
      const fence = requireFence(handle);
      if (!fence.ok) return fence;
      const record = appendRecord(handle, "document", `document:${request.name}`, request.content);
      if (!record.ok) return record;
      try {
        if (!edge.exists(documentsDirectory)) edge.ensureDirectory(documentsDirectory);
        const temporary = `${target}.tmp`;
        edge.raiseFault("replace-before-temp");
        edge.writeTemporaryFile(temporary, `${JSON.stringify(request.content)}\n`);
        edge.raiseFault("replace-after-temp-write");
        edge.raiseFault("replace-rename");
        edge.renameFile(temporary, target);
      } catch {
        // The target is still the previous version; the document replace did
        // not land even though its intent record did (DEC-8).
        return fail("state.write.failed", { path: target, record: record.value.sequence });
      }
      // Crash barrier: the rename already made the new version visible.
      edge.raiseFault("replace-after-rename");
      return ok({ name: request.name, path: target, sequence: record.value.sequence });
    },

    acquireFence(token: string): StateResult<StateFenceAcquisition> {
      if (failure !== undefined) return { ok: false, error: failure };
      const lock = lockState();
      if (lock.held) return fail("state.lock.busy", { path: fencePath });
      try {
        if (!edge.exists(stateDirectory)) edge.ensureDirectory(stateDirectory);
        const created = edge.createExclusiveFile(
          fencePath,
          `${JSON.stringify({
            namespace: identity.fenceNamespace,
            token,
            acquiredAtMs: edge.now(),
          })}\n`,
        );
        if (!created) return fail("state.lock.busy", { path: fencePath });
      } catch {
        return fail("state.write.failed", { path: fencePath });
      }
      const handle = createHandle(token);
      activeHandles.add(handle);
      // Crash barrier: the fence is held; the writer never returned a handle.
      edge.raiseFault("fence-after-acquire");
      return ok({ handle, token });
    },

    releaseFence(handle: StateFenceHandle): StateResult<StateFenceReleaseReport> {
      if (failure !== undefined) return { ok: false, error: failure };
      if (!activeHandles.has(handle)) return fail("state.lock.busy", { path: fencePath });
      const lock = lockState();
      if (!lock.held || lock.token !== handle.token) {
        return fail("state.lock.busy", { path: fencePath });
      }
      try {
        edge.removeFile(fencePath);
      } catch {
        return fail("state.write.failed", { path: fencePath });
      }
      activeHandles.delete(handle);
      return ok({ token: handle.token, released: true });
    },

    fenceStatus(): StateFenceStatus {
      const lock = lockState();
      return {
        held: lock.held,
        stale: lock.stale,
        ...(lock.token !== undefined ? { token: lock.token } : {}),
      };
    },

    recoverFence(token: string): StateResult<StateFenceRecoveryReport> {
      if (failure !== undefined) return { ok: false, error: failure };
      const lock = lockState();
      if (!lock.held || !lock.stale) return fail("state.lock.busy", { path: fencePath });
      const recoveredAtMs = edge.now();
      try {
        // Explicit recovery clears the stale lock and reports it; the next
        // writer acquires normally. Nothing is stolen silently.
        edge.removeFile(fencePath);
      } catch {
        return fail("state.write.failed", { path: fencePath });
      }
      activeHandles.clear();
      edge.raiseFault("fence-after-recovery");
      return ok({
        token,
        staleToken: lock.token ?? "",
        recoveredAtMs,
        path: fencePath,
      });
    },

    checkIntegrity(): StateResult<StateIntegrityOutcome> {
      if (failure !== undefined) return { ok: false, error: failure };
      const verified = verifiedState();
      if (!verified.ok) return verified;
      return ok({ evidence: verified.value.evidence });
    },

    repairTornTail(): StateResult<StateRepairOutcome> {
      if (failure !== undefined) return { ok: false, error: failure };
      // A store-version verdict precedes any destructive step: repair must not
      // truncate bytes and then report the store as unsupported.
      const header = readHeader();
      if (!header.ok) return header;
      if (!edge.exists(ledgerPath)) {
        return fail("state.store.torn", { path: ledgerPath, record: 1 });
      }
      const text = edge.readText(ledgerPath);
      const verification = verifyLedger(text, identity.schemaVersion);
      if (verification.status === "verified" || verification.status === "empty") {
        return ok({
          repaired: false,
          report: { removedBytes: 0, removedRecords: 0, path: ledgerPath },
          evidence: baseEvidence(verification.status === "verified" ? verification.records : []),
        });
      }
      if (verification.status === "schema") {
        return fail("state.schema.mismatch", { path: ledgerPath, record: verification.position });
      }
      if (verification.status !== "torn" || verification.variant !== "truncated-tail") {
        return torn(ledgerPath, verification.position);
      }
      const kept = text.lastIndexOf("\n") + 1;
      const removedBytes = text.length - kept;
      try {
        edge.truncateFile(ledgerPath, kept);
      } catch {
        return fail("state.write.failed", { path: ledgerPath, record: verification.position });
      }
      const after = verifiedState();
      if (!after.ok) return after;
      return ok({
        repaired: true,
        report: { removedBytes, removedRecords: removedBytes > 0 ? 1 : 0, path: ledgerPath },
        evidence: after.value.evidence,
      });
    },
  };
};
