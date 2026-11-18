/**
 * The removal harness (GH-292 TC-QLC-001..011): the real edge program over the
 * delivered cli harness, with the queue ledgers seeded through the production
 * writers (`declareQueueEntry`, `claimQueueLease`, the delivered park record
 * shape), a write-count log, and the derived-document bytes exposed.
 */

import {
  addQueueDependency,
  claimQueueLease,
  declareQueueEntry,
  queueDependencyRecordKey,
  queueParkRecordKey,
  readQueueRemovals,
} from "../../../../packages/core/src/app/index";
import {
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_DEPENDENCY_SCHEMA,
  QUEUE_PARK_RECORD_KIND,
  type QueueRemovalRecord,
  type StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import { createParkRecord } from "../../../../packages/core/src/domain/index";
import type { StoreWriteLog } from "../cli/harness";
import {
  type QueueEdgeHarness,
  createQueueEdgeHarness,
  NOW_ISO,
  NOW_MS,
  REPO_A,
} from "../cli/harness";

const TTL_MS = 90_000;

export type RemovalHarness = QueueEdgeHarness & {
  readonly writeLog: StoreWriteLog;
  /** Seed one observed entry through the production declare writer. */
  readonly seedEntry: (input: {
    readonly ref: string;
    readonly priority?: number;
    readonly deps?: readonly string[];
  }) => void;
  /** Seed one live lease through the production claim writer. */
  readonly seedLease: (input: { readonly ref: string; readonly holder: string }) => void;
  /** Seed one active delivered park record for the ref. */
  readonly seedPark: (input: { readonly ref: string }) => void;
  /** Seed one declared edge through the production dependency writer. */
  readonly seedEdge: (input: { readonly ref: string; readonly onRef: string }) => void;
  /** Raw-seed one declared edge without the add-only cycle check. */
  readonly seedEdgeRaw: (input: { readonly ref: string; readonly onRef: string }) => void;
  /** The verified removal ledger, oldest first. */
  readonly removalRecords: () => readonly QueueRemovalRecord[];
};

export type RemovalHarnessOptions = {
  readonly label: string;
};

/** Build the removal harness over the real edge composition. */
export const createRemovalHarness = (label: string): RemovalHarness => {
  const base = createQueueEdgeHarness(label, { countWrites: true });
  const harness = base as RemovalHarness;
  const store: StateStorePort = base.composition.store;
  harness.seedEntry = (input): void => {
    const declared = declareQueueEntry(store, {
      ref: input.ref,
      repository: REPO_A,
      repositoryRoot: "/work/repo-alpha",
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.deps === undefined ? {} : { edges: input.deps }),
      recordedAt: base.nowIso(),
      fenceToken: `seed-entry-${input.ref}-${base.nowMs()}`,
    });
    if (!declared.ok) throw new Error(`entry seed failed: ${JSON.stringify(declared)}`);
  };
  harness.seedLease = (input): void => {
    const claimed = claimQueueLease(store, {
      ref: input.ref,
      holder: input.holder,
      runner: `runner-${input.holder}`,
      weightClass: "standard",
      ttlMs: TTL_MS,
      nowIso: base.nowIso(),
      nowMs: base.nowMs(),
      fenceToken: `seed-lease-${input.holder}`,
    });
    if (!claimed.ok) throw new Error(`lease seed failed: ${JSON.stringify(claimed)}`);
  };
  harness.seedPark = (input): void => {
    const park = createParkRecord({
      ref: input.ref,
      repository: REPO_A,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-07T09:00:00Z" },
      recheckMs: 60_000,
      evaluatedAt: base.nowIso(),
      recordedAt: base.nowIso(),
    });
    const acquired = store.acquireFence(`seed-park-${input.ref}`);
    if (!acquired.ok) throw new Error("park seed fence failed");
    try {
      const appended = store.append(acquired.value.handle, {
        kind: QUEUE_PARK_RECORD_KIND,
        recordKey: queueParkRecordKey(input.ref),
        payload: park as never,
      });
      if (!appended.ok) throw new Error(`park seed failed: ${JSON.stringify(appended)}`);
    } finally {
      store.releaseFence(acquired.value.handle);
    }
  };
  harness.seedEdge = (input): void => {
    const added = addQueueDependency(store, {
      ref: input.ref,
      onRef: input.onRef,
      recordedAt: base.nowIso(),
      fenceToken: `seed-edge-${input.ref}-${input.onRef}`,
    });
    if (!added.ok) throw new Error(`edge seed failed: ${JSON.stringify(added)}`);
  };
  // Raw-seed one declared edge without the add-only cycle check: the legacy/
  // foreign two-node cycle a case deliberately constructs (TC-QLC-033).
  harness.seedEdgeRaw = (input): void => {
    const acquired = store.acquireFence(`seed-edge-raw-${input.ref}-${input.onRef}`);
    if (!acquired.ok) throw new Error("raw edge seed fence failed");
    try {
      const appended = store.append(acquired.value.handle, {
        kind: QUEUE_DEPENDENCY_RECORD_KIND,
        recordKey: queueDependencyRecordKey(input.ref),
        payload: {
          schema: QUEUE_DEPENDENCY_SCHEMA,
          ref: input.ref,
          edges: [input.onRef],
          recordedAt: base.nowIso(),
          callerPrincipal: { kind: "local-same-user", id: null },
        } as never,
      });
      if (!appended.ok) throw new Error(`raw edge seed failed: ${JSON.stringify(appended)}`);
    } finally {
      store.releaseFence(acquired.value.handle);
    }
  };
  harness.removalRecords = (): readonly QueueRemovalRecord[] => {
    const read = readQueueRemovals(store);
    if (!read.ok) throw new Error(`removal ledger read failed: ${read.code}`);
    return read.records;
  };
  return harness;
};

export { NOW_ISO, NOW_MS, REPO_A };
