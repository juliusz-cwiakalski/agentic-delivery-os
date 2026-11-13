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
  type StateSalvageOutcome,
  type StateStoreArtifact,
  type StateStoreArtifactReadRequest,
  type StateStoreArtifactRequest,
  type StateStoreIdentity,
  type StateStorePort,
} from "#contracts";
import {
  createJsonlStrategy,
  createSqliteStrategy,
  type StateReadStrategy,
} from "./driver/strategy.js";
import type { StateRuntimeEdge } from "./edge.js";
import {
  analyzeTear,
  buildRecord,
  buildSalvageRecord,
  serializeRecord,
  verifyLedger,
} from "./ledger.js";
import { isStorageExhaustion } from "./storage-error.js";

export {
  STATE_DRIVER_KINDS,
  STATE_LEVELS,
  STATE_SCHEMA_VERSION,
  type StateDriverKind,
} from "#contracts";
export { createArtifactBoundary, type StateArtifactBoundary } from "./artifact-boundary.js";
export {
  type AuditAppendOutcome,
  appendAuditInvocation,
  assembleAuditInvocation,
  assembleAuditReservation,
  auditChainValue,
  createAuditBoundary,
  ensureAuditChainKey,
  readAuditChainKey,
  readAuditLedger,
  readAuditRecords,
  verifyAuditChain,
} from "./audit.js";
export {
  appendBlockerAnswer,
  appendBlockerQuestion,
  BLOCKER_ANSWER_RECORD_KEY_PREFIX,
  BLOCKER_QUESTION_RECORD_KEY_PREFIX,
  BLOCKERS_ARTIFACT_BOUNDARY,
  BLOCKERS_RECORD_KEY_PREFIX,
  type BlockerLedgerRead,
  type BlockerRecordAppendOutcome,
  blockerAnswerRecordKey,
  blockerQuestionRecordKey,
  readBlockerLedger,
} from "./blockers.js";
export {
  appendCloseoutOutcome,
  CLOSEOUT_OPERATION_RECORD_KEY_PREFIX,
  closeoutOperationRecordKey,
  foldCloseoutHistory,
  readCloseoutHistory,
} from "./closeout.js";
export {
  appendCommitTelemetry,
  commitTelemetryRecordKey,
  readCommitTelemetry,
} from "./commit-telemetry.js";
export {
  appendCoordinatorExhaustion,
  appendCoordinatorFence,
  appendCoordinatorIteration,
  appendCoordinatorPayload,
  appendCoordinatorRestart,
  appendCoordinatorStuck,
  appendCoordinatorWake,
  COORDINATOR_STATE_ERROR_IDENTITIES,
  type CoordinatorAppendOutcome,
  type CoordinatorRecordsRead,
  coordinatorExhaustionKey,
  coordinatorFenceKey,
  coordinatorIterationKey,
  coordinatorKeyFor,
  coordinatorRestartKey,
  coordinatorStuckKey,
  coordinatorWakeKey,
  foldCoordinatorDecision,
  foldCoordinatorStuck,
  foldCoordinatorWake,
  readCoordinatorRecords,
} from "./coordinator.js";
export { createNodeRetroSidecarIo, createNodeStateEdge } from "./driver/runtime-edge.js";
export {
  appendEconomicsRestartEvent,
  createEconomicsResumeStorePort,
  type EconomicsResumeStorePortOptions,
  economicsRecordKey,
  ensureEconomicsExhaustionRecord,
  readEconomicsRecords,
} from "./economics.js";
export type {
  StateEdgeFaultPoint,
  StateIndexRow,
  StatePathKind,
  StatePlatform,
  StateRuntimeEdge,
} from "./edge.js";
export {
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
  harnessTelemetryCaptureKey,
  harnessTelemetryRecordKey,
  readHarnessCaptureOutcome,
  readHarnessCaptureOutcomes,
  readHarnessTelemetry,
} from "./harness-telemetry.js";
export {
  appendMergeGateVerification,
  appendMergeTransaction,
  appendMergeWaiver,
  MERGE_GATE_VERIFICATION_RECORD_KEY_PREFIX,
  MERGE_TRANSACTION_RECORD_KEY_PREFIX,
  MERGE_WAIVER_RECORD_KEY_PREFIX,
  type MergeStateAppend,
  type MergeStateRead,
  type MergeStateReadReason,
  mergeGateVerificationRecordKey,
  mergeTransactionRecordKey,
  mergeWaiverRecordKey,
  readAllMergeWaivers,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
} from "./merge.js";
export {
  appendOwnerGateSlaDecision,
  OWNER_GATE_SLA_DECISION_RECORD_KEY_PREFIX,
  type OwnerGateSlaDecisionAppendOutcome,
  type OwnerGateSlaDecisionsRead,
  ownerGateSlaDecisionRecordKey,
  readOwnerGateSlaDecisions,
} from "./owner-gate-sla.js";
export {
  appendPhaseTransition,
  foldPhaseState,
  PHASE_TRANSITION_RECORD_KEY_PREFIX,
  type PhaseProjectionOutcome,
  type PhaseProjectionRebuildOutcome,
  type PhaseTransitionAppendOutcome,
  type PhaseTransitionRequest,
  type PhaseTransitionsRead,
  type PhaseTransitionsTolerantRead,
  phaseStateDocumentName,
  phaseTransitionRecordKey,
  readChangeTransitions,
  readChangeTransitionsTolerant,
  rebuildPhaseProjection,
  replacePhaseProjection,
} from "./registry.js";
export {
  appendRetroRegistryRecord,
  type RetroRegistryRead,
  readRetroLevels,
  readRetroRegistry,
  readRetroRuns,
  readRetroTriggers,
  recordRetroRun,
  seedRetroRegistry,
} from "./retro-registry.js";
export { createRetroSidecar, type RetroSidecar } from "./retro-sidecar.js";
export { readSpendLedger } from "./spend-reads.js";
export {
  appendTelemetryBaseline,
  appendTelemetryStep,
  captureTelemetryBaseline,
  readTelemetryBaselines,
  readTelemetryFamilies,
  readTelemetrySteps,
  readTelemetryStepsAtVersion,
  TELEMETRY_STORAGE_NEXT_VERSION,
  TELEMETRY_STORAGE_READ_VERSIONS,
  type TelemetryFamiliesRead,
  type TelemetrySessionTotalsRead,
  type TelemetryStepRecordAtVersion,
  type TelemetryStorageReadVersion,
  telemetryBaselineKey,
  telemetryStepAtVersion,
  telemetryStepKey,
} from "./telemetry.js";

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

/** A failed write is exhaustion (fail-closed full disk) or a generic write error. */
const writeFailure = (error: unknown, path: string, record?: number): StateResult<never> => {
  const location: StateSafeLocation = record === undefined ? { path } : { path, record };
  return isStorageExhaustion(error)
    ? fail("state.storage.exhausted", location)
    : fail("state.write.failed", location);
};

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
  // Quarantine artifacts live outside the documents and index namespaces and
  // are never served as content (GH-222 DM-2).
  const quarantineDirectory = `${stateDirectory}/quarantine.${workspace}`;

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
    if (edge.exists(quarantineDirectory)) {
      if (!edge.verifyPermissions(quarantineDirectory, "directory")) {
        return {
          kind: "state",
          code: "state.permission.denied",
          consequence: "not_landed",
          location: { path: quarantineDirectory },
        };
      }
      for (const name of edge.listDirectory(quarantineDirectory)) {
        const path = `${quarantineDirectory}/${name}`;
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
    } catch (error) {
      return writeFailure(error, ledgerPath, sequence);
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

  const artifactPathFor = (name: string): string => `${stateDirectory}/${name}`;

  const readArtifactFile = (name: string): StateResult<{ path: string; content: string }> => {
    const path = artifactPathFor(name);
    if (!isSafeDocumentName(name)) return fail("state.write.failed", { path });
    if (!edge.exists(path)) return fail("state.keys.missing", { path });
    if (!edge.verifyPermissions(path, "file")) {
      return fail("state.permission.denied", { path });
    }
    try {
      return ok({ path, content: edge.readText(path) });
    } catch {
      return torn(path, 0);
    }
  };

  const ensureArtifact = (request: StateStoreArtifactRequest): StateResult<StateStoreArtifact> => {
    if (failure !== undefined) return { ok: false, error: failure };
    const path = artifactPathFor(request.name);
    if (!isSafeDocumentName(request.name)) return fail("state.write.failed", { path });
    if (edge.exists(path)) {
      const existing = readArtifactFile(request.name);
      if (!existing.ok) return existing;
      return ok({
        name: request.name,
        path,
        created: false,
        content: existing.value.content,
      });
    }
    // An artifact absent while the store already carries guarded records is a
    // non-first open: the key must never be silently regenerated.
    const verified = verifiedState();
    if (!verified.ok) return verified;
    if (verified.value.records.some((record) => request.guardKinds.includes(record.kind))) {
      return fail("state.keys.missing", { path });
    }
    const content = request.create(edge.randomHex(request.randomBytes));
    let created: boolean;
    try {
      if (!edge.exists(stateDirectory)) edge.ensureDirectory(stateDirectory);
      created = edge.createExclusiveFile(path, content);
    } catch (error) {
      return writeFailure(error, path);
    }
    if (!created) {
      const existing = readArtifactFile(request.name);
      if (!existing.ok) return existing;
      return ok({
        name: request.name,
        path,
        created: false,
        content: existing.value.content,
      });
    }
    if (!edge.verifyPermissions(path, "file")) {
      return fail("state.permission.denied", { path });
    }
    return ok({ name: request.name, path, created: true, content });
  };

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

    readRecords(): StateResult<{
      readonly records: readonly StateRecord[];
      readonly evidence: StateReadEvidence;
    }> {
      if (failure !== undefined) return { ok: false, error: failure };
      const verified = verifiedState();
      if (!verified.ok) return verified;
      return ok({ records: verified.value.records, evidence: verified.value.evidence });
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
      } catch (error) {
        // The target is still the previous version; the document replace did
        // not land even though its intent record did (DEC-8).
        return writeFailure(error, target, record.value.sequence);
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
      // A terminal tail is repairable only when every complete line before it
      // verifies: a break among those lines survives any truncation at the last
      // newline, so repair refuses here with zero byte mutation as well.
      const tear = analyzeTear(text, identity.schemaVersion);
      if (tear === undefined || tear.topology === "mid-record") {
        return torn(ledgerPath, tear?.position ?? verification.position);
      }
      const kept = tear.validPrefixCharacters;
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

    salvage(handle: StateFenceHandle): StateResult<StateSalvageOutcome> {
      if (failure !== undefined) return { ok: false, error: failure };
      // A store-version verdict precedes any destructive step: salvage must not
      // truncate bytes and then report the store as unsupported.
      const header = readHeader();
      if (!header.ok) return header;
      const fence = requireFence(handle);
      if (!fence.ok) return fence;
      if (!edge.exists(ledgerPath)) {
        return ok({ salvaged: false, evidence: baseEvidence([]) });
      }
      let text: string;
      try {
        text = edge.readText(ledgerPath);
      } catch {
        return torn(ledgerPath, 1);
      }
      const verification = verifyLedger(text, identity.schemaVersion);
      if (verification.status === "schema") {
        return fail("state.schema.mismatch", { path: ledgerPath, record: verification.position });
      }
      if (verification.status !== "torn") {
        // Nothing to salvage: a reported no-op, never a destructive step.
        return ok({
          salvaged: false,
          evidence: baseEvidence(verification.status === "verified" ? verification.records : []),
        });
      }
      const tear = analyzeTear(text, identity.schemaVersion);
      if (tear === undefined) return torn(ledgerPath, verification.position);
      if (tear.topology === "mid-record") {
        // DEC-2: a non-terminal break refuses with zero byte mutation.
        return torn(ledgerPath, tear.position);
      }
      const tail = text.slice(tear.validPrefixCharacters);
      const quarantineName = `tail-${tear.position}-${tear.validPrefixBytes}-${tear.tailBytes}.bytes`;
      const quarantinePath = `${quarantineDirectory}/${quarantineName}`;
      let createdQuarantine = false;
      const removeQuarantineQuietly = (): void => {
        try {
          edge.removeFile(quarantinePath);
        } catch {
          // Best effort: the ledger is the truth and it stays unchanged.
        }
      };
      try {
        if (!edge.exists(quarantineDirectory)) edge.ensureDirectory(quarantineDirectory);
        edge.raiseFault("salvage-quarantine-write");
        const existing = edge.exists(quarantinePath) ? edge.readText(quarantinePath) : undefined;
        if (existing === undefined) {
          edge.writeFile(quarantinePath, tail);
          createdQuarantine = true;
          edge.applyPermissions(quarantinePath, "file");
        } else if (existing !== tail) {
          // Never overwrite preserved evidence with a different extent.
          return fail("state.write.failed", { path: quarantinePath });
        }
        if (!edge.verifyPermissions(quarantinePath, "file")) {
          if (createdQuarantine) removeQuarantineQuietly();
          return fail("state.permission.denied", { path: quarantinePath });
        }
      } catch (error) {
        if (createdQuarantine) removeQuarantineQuietly();
        return writeFailure(error, quarantinePath);
      }

      const keptRecords = tear.position - 1;
      const record = buildSalvageRecord(
        keptRecords + 1,
        tear,
        quarantinePath,
        identity.schemaVersion,
      );
      try {
        // Pre-commit seam: the truncate-and-append commit has not started.
        edge.raiseFault("salvage-ledger-write");
        edge.truncateFile(ledgerPath, tear.validPrefixBytes);
        edge.appendFile(ledgerPath, serializeRecord(record));
      } catch (error) {
        if (createdQuarantine) removeQuarantineQuietly();
        // Nothing landed: restore the pre-salvage ledger bytes (TR-2).
        try {
          edge.writeFile(ledgerPath, text);
        } catch {
          // Best effort under a storage fault; the classified failure still
          // reports `not_landed`.
        }
        return writeFailure(error, ledgerPath, record.sequence);
      }

      // The index is never truth here: salvage does not read or mutate it, and
      // the next indexed read rebuilds from the salvaged ledger (F-4).
      const after = verifiedState();
      if (!after.ok) return after;
      return ok({
        salvaged: true,
        report: {
          ledgerPath,
          truncationOffset: tear.validPrefixBytes,
          quarantinedBytes: tear.tailBytes,
          quarantinePath,
          keptRecords,
          discardedFrames: tear.discardedFrames,
          sequence: record.sequence,
        },
        evidence: after.value.evidence,
      });
    },

    readStoreArtifact(request: StateStoreArtifactReadRequest): StateResult<StateStoreArtifact> {
      if (failure !== undefined) return { ok: false, error: failure };
      const read = readArtifactFile(request.name);
      if (!read.ok) return read;
      return ok({
        name: request.name,
        path: read.value.path,
        created: false,
        content: read.value.content,
      });
    },

    ensureStoreArtifact(request: StateStoreArtifactRequest): StateResult<StateStoreArtifact> {
      return ensureArtifact(request);
    },
  };
};

/** The daemon-owned lock artifact (GH-238 F-2), distinct from the state fence. */
export { createDaemonLockPort } from "./daemon-lock.js";
