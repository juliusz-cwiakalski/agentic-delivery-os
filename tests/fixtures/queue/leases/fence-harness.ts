/**
 * Deterministic claim harness for GH-237 (NFR-3, GAP-T3).
 *
 * The harness never relies on an OS race, a real sleep, a worker thread, or
 * multi-process memory. It drains claims in a declared order over the injected
 * state port and records the operation log so the suite can assert that the
 * in-fence verified read precedes every append.
 */
import type {
  StateAppendOutcome,
  StateAppendRequest,
  StateDocumentReplaceRequest,
  StateDocumentReport,
  StateFenceAcquisition,
  StateFenceHandle,
  StateFenceRecoveryReport,
  StateFenceReleaseReport,
  StateFenceStatus,
  StateIntegrityOutcome,
  StateReadOutcome,
  StateReadRequest,
  StateRepairOutcome,
  StateResult,
  StateSalvageOutcome,
  StateStoreArtifact,
  StateStoreArtifactReadRequest,
  StateStoreArtifactRequest,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import type {
  QueueLeaseRecord,
  QueueWeightClass,
} from "../../../../packages/core/src/contracts/index";
import type { QueueClaimResult } from "../../../../packages/core/src/app/queue";
import { claimQueueLease } from "../../../../packages/core/src/app/queue";

export const NOW_ISO = "2026-11-07T10:00:00Z";
export const NOW_MS = Date.parse(NOW_ISO);
export const REPO = "github.com/owner/repo-alpha";

export type Operation = "read" | "readRecords" | "acquireFence" | "append" | "releaseFence";

export type RecordingStore = {
  readonly store: StateStorePort;
  readonly log: Operation[];
  appends(): number;
  leaseRecords(): readonly QueueLeaseRecord[];
};

/** Wrap a store, recording the operations the claim path performs. */
export const recordingStore = (base: StateStorePort): RecordingStore => {
  const log: Operation[] = [];
  const appended: QueueLeaseRecord[] = [];
  const store: StateStorePort = {
    identity: base.identity,
    read(request: StateReadRequest): StateResult<StateReadOutcome> {
      log.push("read");
      return base.read(request);
    },
    readRecords() {
      log.push("readRecords");
      return base.readRecords();
    },
    append(handle: StateFenceHandle, request: StateAppendRequest): StateResult<StateAppendOutcome> {
      log.push("append");
      if (request.kind === "queue.lease") {
        appended.push(request.payload as unknown as QueueLeaseRecord);
      }
      return base.append(handle, request);
    },
    replaceDocument(
      handle: StateFenceHandle,
      request: StateDocumentReplaceRequest,
    ): StateResult<StateDocumentReport> {
      return base.replaceDocument(handle, request);
    },
    acquireFence(token: string): StateResult<StateFenceAcquisition> {
      log.push("acquireFence");
      return base.acquireFence(token);
    },
    releaseFence(handle: StateFenceHandle): StateResult<StateFenceReleaseReport> {
      log.push("releaseFence");
      return base.releaseFence(handle);
    },
    fenceStatus(): StateFenceStatus {
      return base.fenceStatus();
    },
    recoverFence(token: string): StateResult<StateFenceRecoveryReport> {
      return base.recoverFence(token);
    },
    checkIntegrity(): StateResult<StateIntegrityOutcome> {
      return base.checkIntegrity();
    },
    repairTornTail(): StateResult<StateRepairOutcome> {
      return base.repairTornTail();
    },
    salvage(handle: StateFenceHandle): StateResult<StateSalvageOutcome> {
      return base.salvage(handle);
    },
    readStoreArtifact(request: StateStoreArtifactReadRequest): StateResult<StateStoreArtifact> {
      return base.readStoreArtifact(request);
    },
    ensureStoreArtifact(request: StateStoreArtifactRequest): StateResult<StateStoreArtifact> {
      return base.ensureStoreArtifact(request);
    },
  };
  return {
    store,
    log,
    appends: () => appended.length,
    leaseRecords: () => appended,
  };
};

export type ScheduledClaim = {
  readonly holder: string;
  readonly result: QueueClaimResult;
};

/** Drain one claim per holder in declared order over the recording store. */
export const runScheduledClaims = (
  store: StateStorePort,
  input: {
    readonly ref: string;
    readonly holders: readonly string[];
    readonly repository: string;
    readonly runner?: string;
    readonly weightClass?: QueueWeightClass;
    readonly ttlMs?: number;
    readonly nowIso?: string;
    readonly nowMs?: number;
    readonly precheck?: () => { readonly ok: true };
  },
): readonly ScheduledClaim[] => {
  return input.holders.map((holder, index) => ({
    holder,
    result: claimQueueLease(store, {
      ref: input.ref,
      holder,
      runner: input.runner ?? "runner-a",
      weightClass: input.weightClass ?? "standard",
      ...(input.ttlMs === undefined ? {} : { ttlMs: input.ttlMs }),
      nowIso: input.nowIso ?? NOW_ISO,
      nowMs: input.nowMs ?? NOW_MS,
      fenceToken: `fence-${index}`,
      ...(input.precheck === undefined ? {} : { precheck: input.precheck }),
    }),
  }));
};

/** Assert the in-fence read precedes every append in the recorded log. */
export const inFenceReadPrecedesAppend = (log: readonly Operation[]): boolean => {
  let inFence = false;
  let readSinceFence = false;
  for (const operation of log) {
    if (operation === "acquireFence") {
      inFence = true;
      readSinceFence = false;
      continue;
    }
    if (operation === "releaseFence") {
      inFence = false;
      continue;
    }
    if (operation === "readRecords" && inFence) readSinceFence = true;
    if (operation === "append" && inFence && !readSinceFence) return false;
  }
  return true;
};

export const holders = (count: number): readonly string[] =>
  Array.from({ length: count }, (_, index) => `holder-${String(index + 1).padStart(2, "0")}`);
