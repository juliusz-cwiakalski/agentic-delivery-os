/**
 * Deterministic two-handle claim controllers (GH-241 TC-COORD-094/096).
 *
 * Two independent store handles over one temp root. The contention controller
 * holds the winner's fence and forces the loser's acquire to see
 * `state.lock.busy` before any re-read; the serialization controller runs the
 * winner's full critical section (append + release) before the loser's acquire.
 * Neither uses a sleep, a timer, or a wall clock.
 */
import type {
  CoordinatorFenceRecord,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { coordinatorFenceKey, readCoordinatorRecords } from "../../../packages/core/src/state/index";
import { makeIdentity, openStore } from "../state/harness";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COORDINATOR_ID, EPOCH_ID, fenceRecord } from "./states";

export type ClaimHandles = {
  readonly root: string;
  readonly winner: StateStorePort;
  readonly loser: StateStorePort;
  readonly identity: ReturnType<typeof makeIdentity>;
};

/** Two independent store handles over one fresh temp root. */
export const openClaimHandles = (label = "claim"): ClaimHandles => {
  const root = mkdtempSync(join(tmpdir(), `gh241-${label}-`));
  const identity = makeIdentity(root);
  const winner = openStore(identity).store;
  const loser = openStore(identity).store;
  return { root, winner, loser, identity };
};

/** Append one lease record under an explicitly acquired fence. */
export const appendLease = (
  store: StateStorePort,
  token: string,
  record: CoordinatorFenceRecord,
): { readonly ok: boolean } => {
  const acquired = store.acquireFence(token);
  if (!acquired.ok) return { ok: false };
  try {
    const appended = store.append(acquired.value.handle, {
      kind: "coordinator.fence",
      recordKey: coordinatorFenceKey(COORDINATOR_ID),
      payload: { ...record },
    });
    return { ok: appended.ok };
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/**
 * The contention controller: the winner acquires and keeps the fence held, so
 * the loser's acquire returns `state.lock.busy` and the loser re-reads nothing.
 */
export const contentionController = (handles: ClaimHandles) => {
  const acquired = handles.winner.acquireFence("winner");
  if (!acquired.ok) throw new Error("winner could not acquire");
  return {
    /** The loser's forced acquire result (busy, never a lease). */
    loserAcquire: () => handles.loser.acquireFence("loser"),
    /** How many records the loser can see (no re-read is performed by it). */
    loserVisibleRecords: () => {
      const read = readCoordinatorRecords(handles.loser, COORDINATOR_ID);
      return read.ok ? read.fences.length : -1;
    },
    release: () => handles.winner.releaseFence(acquired.value.handle),
  };
};

/**
 * The serialization controller: the winner's full critical section (acquire,
 * append one lease, release) runs before the loser's acquire.
 */
export const serializationController = (handles: ClaimHandles) => {
  const acquired = handles.winner.acquireFence("winner");
  if (!acquired.ok) throw new Error("winner could not acquire");
  const record = fenceRecord({ instanceId: "instance-winner", recordedAt: "1970-01-01T00:16:40.000Z" });
  const appended = handles.winner.append(acquired.value.handle, {
    kind: "coordinator.fence",
    recordKey: coordinatorFenceKey(COORDINATOR_ID),
    payload: { ...record },
  });
  handles.winner.releaseFence(acquired.value.handle);
  return {
    appended: appended.ok,
    epochId: EPOCH_ID,
    /** The loser's acquire after the winner released: it must re-read and refuse. */
    loserRead: () => readCoordinatorRecords(handles.loser, COORDINATOR_ID),
  };
};
