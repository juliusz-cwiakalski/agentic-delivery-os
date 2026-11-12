/**
 * The reconcile harness (GH-292 TC-QLC-050..058): the real edge program over
 * the delivered cli harness with an injected recording tracker port whose
 * observations are programmable per ref, an exact call log, and an in-flight
 * guard (the port rejects concurrent invocation). The suite never reaches a
 * real tracker (GAP-T2).
 */
import type { QueueComposition } from "../../../../packages/cli/src/edge";
import {
  addQueueDependency,
  claimQueueLease,
  declareQueueEntry,
} from "../../../../packages/core/src/app/index";
import type {
  DeliveryStateAlias,
  QueueTrackerRead,
} from "../../../../packages/core/src/contracts/index";
import type { QueueEdgeHarness, StoreWriteLog } from "../cli/harness";
import { createQueueEdgeHarness, REPO_A } from "../cli/harness";

const TTL = 90_000;

/** One programmed observation for a ref. */
export type ProgrammedRead =
  | { readonly deliveryState: DeliveryStateAlias }
  | { readonly observation: "not-found" }
  | { readonly failureCode: string };

export type TrackerCall = { readonly ref: string; readonly ordinal: number };

export type ReconcileHarness = QueueEdgeHarness & {
  readonly writeLog: StoreWriteLog;
  readonly seedEntry: (input: {
    readonly ref: string;
    readonly priority?: number;
    readonly deps?: readonly string[];
  }) => void;
  readonly seedLease: (input: { readonly ref: string; readonly holder: string }) => void;
  /** Seed one declared edge through the production dependency writer. */
  readonly seedEdge: (input: { readonly ref: string; readonly onRef: string }) => void;
  /** Programme the observation the port returns for a ref. */
  readonly program: (ref: string, read: ProgrammedRead) => void;
  /** The exact call log: one entry per read, in call order. */
  readonly calls: () => readonly TrackerCall[];
  /** The removed refs reported by the sweep, observed through the ledger. */
  readonly removalRecords: () => readonly { readonly ref: string; readonly reason: string }[];
};

export type ReconcileHarnessOptions = {
  readonly label: string;
};

/** Build the reconcile harness with a programmable recording tracker port. */
export const createReconcileHarness = (label: string): ReconcileHarness => {
  const programmed = new Map<string, ProgrammedRead>();
  const callLog: TrackerCall[] = [];
  let inFlight = 0;
  let ordinal = 0;
  const port = async (ref: string): Promise<QueueTrackerRead> => {
    if (inFlight > 0) throw new Error("concurrent tracker read rejected");
    inFlight += 1;
    try {
      ordinal += 1;
      callLog.push({ ref, ordinal });
      const read = programmed.get(ref);
      if (read === undefined) {
        return { ok: true, kind: "state", deliveryState: "backlog" };
      }
      if ("failureCode" in read) return { ok: false, failureCode: read.failureCode };
      if ("observation" in read) return { ok: true, kind: "not-found" };
      return { ok: true, kind: "state", deliveryState: read.deliveryState };
    } finally {
      inFlight -= 1;
    }
  };
  const base = createQueueEdgeHarness(label, {
    countWrites: true,
    overrides: {
      readTrackerDeliveryState: port,
    } as Partial<QueueComposition>,
  });
  const harness = base as ReconcileHarness;
  const store = base.composition.store;
  harness.seedEntry = (input): void => {
    const declared = declareQueueEntry(store, {
      ref: input.ref,
      repository: REPO_A,
      repositoryRoot: "/work/repo-alpha",
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.deps === undefined ? {} : { deps: input.deps }),
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
      ttlMs: TTL,
      nowIso: base.nowIso(),
      nowMs: base.nowMs(),
      fenceToken: `seed-lease-${input.holder}`,
    });
    if (!claimed.ok) throw new Error(`lease seed failed: ${JSON.stringify(claimed)}`);
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
  harness.program = (ref, read): void => {
    programmed.set(ref, read);
  };
  harness.calls = (): readonly TrackerCall[] => callLog;
  harness.removalRecords = (): readonly { readonly ref: string; readonly reason: string }[] => {
    const records = store.readRecords();
    if (!records.ok) throw new Error("ledger read failed");
    return records.value.records
      .filter((record) => record.kind === "queue.removal")
      .map((record) => {
        const payload = record.payload as { ref?: string; reason?: string };
        return { ref: payload.ref ?? "", reason: payload.reason ?? "" };
      });
  };
  return harness;
};

export { REPO_A };
