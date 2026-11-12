/**
 * TC-QLC-080 (GH-292, AC-NFR-1, NFR-1) — every accepted mutation is one fenced,
 * post-verified transaction: the appends occur inside the fence handle, each
 * append is read back and verified before the derived-document replacement, and
 * a verification failure or an armed append failure leaves the ledger at its
 * pre-run digest with no partial record visible to the fold. A pre-fence
 * refusal acquires nothing; the closeout hook shares the caller's fence; a
 * reconcile removal is the ordinary fenced seam; and a state failure at the
 * CLI exits 2 with no event disclosure.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  addQueueDependency,
  declareQueueEntry,
  queueGraphDocumentPath,
  readQueueFold,
  removeQueueDependency,
  removeQueueEntry,
  removeQueueEntryWithinFence,
} from "../../packages/core/src/app/queue";
import type {
  StateAppendOutcome,
  StateAppendRequest,
  StateFailure,
  StateFenceHandle,
  StateResult,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { QUEUE_REMOVAL_RECORD_KIND } from "../../packages/core/src/contracts/index";
import type { QueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { createQueueEdgeHarness, NOW_ISO, NOW_MS, REPO_A } from "../fixtures/queue/cli/harness";
import { CONSUMER_REF, PRODUCER_REF } from "../fixtures/queue/depend/grammar-cases";
import type { ReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import {
  armAppendFailure,
  ledgerText,
  makeAuditStore,
  removeRoot,
} from "../fixtures/state/harness";

type StoreOperation =
  | "acquireFence"
  | "append"
  | "replaceDocument"
  | "releaseFence"
  | "readRecords";

type ObservingOptions = {
  /** Report the append as landed without writing it (verification mismatch). */
  readonly dropAppendFor?: (request: StateAppendRequest) => boolean;
  /** Fail the append with the state write failure. */
  readonly failAppendFor?: (request: StateAppendRequest) => boolean;
};

type ObservingStore = {
  readonly store: StateStorePort;
  readonly log: StoreOperation[];
  readonly countOf: (operation: StoreOperation) => number;
};

/** Wrap a store so every write seam and record read is logged in call order. */
const observingStore = (base: StateStorePort, options: ObservingOptions = {}): ObservingStore => {
  const log: StoreOperation[] = [];
  let droppedSequence = 9_000;
  const failAppend = (_request: StateAppendRequest): StateResult<StateAppendOutcome> => {
    log.push("append");
    const failure: StateFailure = {
      kind: "state",
      code: "state.write.failed",
      consequence: "not_landed",
      location: { path: base.identity.stateDirectory },
    };
    return { ok: false, error: failure };
  };
  const store: StateStorePort = new Proxy(base, {
    get(target, property) {
      if (property === "readRecords") {
        return () => {
          log.push("readRecords");
          return target.readRecords();
        };
      }
      if (property === "append") {
        return (handle: StateFenceHandle, request: StateAppendRequest) => {
          if (options.failAppendFor?.(request) === true) return failAppend(request);
          if (options.dropAppendFor?.(request) === true) {
            log.push("append");
            droppedSequence += 1;
            return {
              ok: true,
              value: { sequence: droppedSequence, checksum: "dropped", path: "dropped" },
            };
          }
          log.push("append");
          return target.append(handle, request);
        };
      }
      if (property === "replaceDocument") {
        return (
          handle: StateFenceHandle,
          request: Parameters<StateStorePort["replaceDocument"]>[1],
        ) => {
          log.push("replaceDocument");
          return target.replaceDocument(handle, request);
        };
      }
      if (property === "acquireFence") {
        return (token: string) => {
          log.push("acquireFence");
          return target.acquireFence(token);
        };
      }
      if (property === "releaseFence") {
        return (handle: StateFenceHandle) => {
          log.push("releaseFence");
          return target.releaseFence(handle);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function"
        ? (value as (...args: readonly unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return {
    store,
    log,
    countOf: (operation) => log.filter((entry) => entry === operation).length,
  };
};

const indicesOf = (log: readonly StoreOperation[], operation: StoreOperation): readonly number[] =>
  log.flatMap((entry, index) => (entry === operation ? [index] : []));

/** Assert the recorded order: one fence, appends inside, verify read, replace, release. */
const expectFencedVerifiedReplace = (log: readonly StoreOperation[]): void => {
  const acquires = indicesOf(log, "acquireFence");
  const releases = indicesOf(log, "releaseFence");
  const appends = indicesOf(log, "append");
  const replaces = indicesOf(log, "replaceDocument");
  expect(acquires).toHaveLength(1);
  expect(releases).toHaveLength(1);
  const acquire = acquires[0] ?? -1;
  const release = releases[0] ?? -1;
  expect(release).toBe(log.length - 1);
  for (const append of appends) {
    expect(append).toBeGreaterThan(acquire);
    expect(append).toBeLessThan(release);
  }
  expect(replaces).toHaveLength(1);
  const replace = replaces[0] ?? -1;
  const lastAppend = appends[appends.length - 1] ?? -1;
  expect(replace).toBeGreaterThan(lastAppend);
  const verifies = indicesOf(log, "readRecords").filter(
    (index) => index > lastAppend && index < replace,
  );
  expect(verifies.length).toBeGreaterThan(0);
};

const documentBytes = (store: StateStorePort): string | undefined => {
  try {
    return readFileSync(queueGraphDocumentPath(store.identity), "utf8");
  } catch {
    return undefined;
  }
};

const seedEntry = (store: StateStorePort, ref: string, deps?: readonly string[]): void => {
  const declared = declareQueueEntry(store, {
    ref,
    repository: REPO_A,
    repositoryRoot: "/work/repo-alpha",
    ...(deps === undefined ? {} : { edges: deps }),
    recordedAt: NOW_ISO,
    fenceToken: `atomicity-seed-${ref}`,
  });
  if (!declared.ok) throw new Error(`entry seed failed: ${JSON.stringify(declared)}`);
};

describe("TC-QLC-080 accepted mutations are one fenced, post-verified transaction", () => {
  test("an accepted removal: one fence, verified append, replace only after verification", () => {
    const fixture = makeAuditStore("atomicity-remove");
    try {
      seedEntry(fixture.store, REMOVAL_REF);
      const observed = observingStore(fixture.store);
      const removed = removeQueueEntry(observed.store, {
        ref: REMOVAL_REF,
        reason: "abandoned",
        recordedAt: NOW_ISO,
        nowMs: NOW_MS,
        fenceToken: "atomicity-remove-fence",
      });
      expect(removed.ok).toBe(true);
      expect(observed.countOf("acquireFence")).toBe(1);
      expect(observed.countOf("append")).toBe(1);
      expect(observed.countOf("replaceDocument")).toBe(1);
      expectFencedVerifiedReplace(observed.log);
      // The durable truth: the removal record joins the ledger (plus the
      // replaced derived-document record), and the entry is gone from the fold.
      const recordsAfter = fixture.store.readRecords();
      expect(recordsAfter.ok).toBe(true);
      if (recordsAfter.ok) {
        const removalRecords = recordsAfter.value.records.filter(
          (record) => record.kind === "queue.removal",
        );
        expect(removalRecords).toHaveLength(1);
        expect(removalRecords[0]?.key).toBe(`queue.removals:${REMOVAL_REF}`);
        expect(recordsAfter.value.records.length).toBeGreaterThan(0);
      }
      expect(ledgerText(fixture.identity)).toContain(`queue.removals:${REMOVAL_REF}`);
      const fold = readQueueFold(fixture.store);
      expect(fold.ok).toBe(true);
      if (fold.ok) {
        expect(fold.value.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(false);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an accepted dependency removal follows the same fence-verify-replace order", () => {
    const fixture = makeAuditStore("atomicity-dep");
    try {
      seedEntry(fixture.store, PRODUCER_REF);
      seedEntry(fixture.store, CONSUMER_REF);
      const added = addQueueDependency(fixture.store, {
        ref: CONSUMER_REF,
        onRef: PRODUCER_REF,
        recordedAt: NOW_ISO,
        fenceToken: "atomicity-dep-seed",
      });
      expect(added.ok).toBe(true);
      const observed = observingStore(fixture.store);
      const removed = removeQueueDependency(observed.store, {
        ref: CONSUMER_REF,
        onRef: PRODUCER_REF,
        recordedAt: NOW_ISO,
        fenceToken: "atomicity-dep-remove-fence",
      });
      expect(removed.ok).toBe(true);
      expect(observed.countOf("acquireFence")).toBe(1);
      expect(observed.countOf("append")).toBe(1);
      expect(observed.countOf("replaceDocument")).toBe(1);
      expectFencedVerifiedReplace(observed.log);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the closeout hook shares the caller's fence: no second acquisition", () => {
    const fixture = makeAuditStore("atomicity-closeout");
    try {
      seedEntry(fixture.store, REMOVAL_REF);
      const observed = observingStore(fixture.store);
      const acquired = observed.store.acquireFence("closeout-shared-fence");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const logLengthAtHookStart = observed.log.length;
      const removed = removeQueueEntryWithinFence(observed.store, {
        ref: REMOVAL_REF,
        reason: "landed",
        recordedAt: NOW_ISO,
        nowMs: NOW_MS,
        handle: acquired.value.handle,
      });
      expect(removed.ok).toBe(true);
      const hookLog = observed.log.slice(logLengthAtHookStart);
      // Fence-sharing: the hook body acquires and releases nothing itself.
      expect(hookLog.includes("acquireFence")).toBe(false);
      expect(hookLog.includes("releaseFence")).toBe(false);
      expect(hookLog.includes("append")).toBe(true);
      expect(hookLog.includes("replaceDocument")).toBe(true);
      observed.store.releaseFence(acquired.value.handle);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("reconcile removals are ordinary fenced removals: one fence and one append each", async () => {
    const harness: ReconcileHarness = createReconcileHarness("atomicity-reconcile");
    try {
      harness.seedEntry({ ref: "GH-241" });
      harness.seedEntry({ ref: "GH-242" });
      harness.program("GH-241", { deliveryState: "done" });
      harness.program("GH-242", { deliveryState: "canceled" });
      const writeLog = harness.writeLog;
      expect(writeLog).toBeDefined();
      if (writeLog === undefined) return;
      writeLog.appends = 0;
      writeLog.replaces = 0;
      writeLog.fences = 0;
      writeLog.releases = 0;
      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data: Record<string, unknown> }).data;
      expect(data.removed).toEqual([
        { ref: "GH-241", reason: "reconciled" },
        { ref: "GH-242", reason: "reconciled" },
      ]);
      // Deltas: one fenced removal per stale ref, plus the delivered
      // park-recovery pass fence that precedes every runtime mutation.
      expect(writeLog.appends).toBe(2);
      expect(writeLog.replaces).toBe(2);
      expect(writeLog.fences).toBe(3);
      expect(writeLog.releases).toBe(3);
    } finally {
      removeRoot(harness.composition.store.identity.stateDirectory);
    }
  });
});

describe("TC-QLC-080 verification failure cannot leave a half-mutation", () => {
  test("a dropped append is caught by the post-append verification: no replace, no fold change", () => {
    const fixture = makeAuditStore("atomicity-verify");
    try {
      seedEntry(fixture.store, REMOVAL_REF);
      const ledgerBefore = ledgerText(fixture.identity);
      const documentBefore = documentBytes(fixture.store);
      const observed = observingStore(fixture.store, {
        dropAppendFor: (request) => request.kind === QUEUE_REMOVAL_RECORD_KIND,
      });
      const removed = removeQueueEntry(observed.store, {
        ref: REMOVAL_REF,
        reason: "abandoned",
        recordedAt: NOW_ISO,
        nowMs: NOW_MS,
        fenceToken: "atomicity-verify-fence",
      });
      expect(removed.ok).toBe(false);
      if (removed.ok) return;
      expect(removed.kind).toBe("state");
      expect(removed.code).toBe("state.store.torn");
      // The verification failed before the derived document was touched.
      expect(observed.countOf("replaceDocument")).toBe(0);
      expect(observed.countOf("append")).toBe(1);
      expect(observed.countOf("acquireFence")).toBe(1);
      // The ledger is at its pre-run digest and no partial record is visible.
      expect(ledgerText(fixture.identity)).toBe(ledgerBefore);
      expect(documentBytes(fixture.store)).toBe(documentBefore);
      const fold = readQueueFold(fixture.store);
      expect(fold.ok).toBe(true);
      if (fold.ok) {
        expect(fold.value.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(true);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an armed append failure leaves the ledger byte-identical and classified as state", () => {
    const fixture = makeAuditStore("atomicity-armed");
    try {
      seedEntry(fixture.store, REMOVAL_REF);
      const ledgerBefore = ledgerText(fixture.identity);
      const documentBefore = documentBytes(fixture.store);
      const armed = armAppendFailure(fixture.edge, 1);
      try {
        const removed = removeQueueEntry(fixture.store, {
          ref: REMOVAL_REF,
          reason: "abandoned",
          recordedAt: NOW_ISO,
          nowMs: NOW_MS,
          fenceToken: "atomicity-armed-fence",
        });
        expect(removed.ok).toBe(false);
        if (removed.ok) return;
        expect(removed.kind).toBe("state");
        expect(removed.code).toBe("state.write.failed");
        // The fence was released by the seam's own finally, the ledger is at
        // its pre-run digest, and the fold still sees the entry.
        expect(ledgerText(fixture.identity)).toBe(ledgerBefore);
        expect(documentBytes(fixture.store)).toBe(documentBefore);
        const fold = readQueueFold(fixture.store);
        expect(fold.ok).toBe(true);
        if (fold.ok) {
          expect(fold.value.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(true);
        }
      } finally {
        armed.restore();
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a state failure at the CLI exits 2 with no data and no event disclosure", async () => {
    const harness: QueueEdgeHarness = createQueueEdgeHarness("atomicity-cli-exit", {
      wrapStore: (store) =>
        observingStore(store, {
          failAppendFor: (request) => request.kind === QUEUE_REMOVAL_RECORD_KIND,
        }).store,
    });
    seedEntry(harness.composition.store, REMOVAL_REF);
    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(run.exitCode).toBe(2);
    const envelope = JSON.parse(run.stdout) as { data?: unknown; error?: { code?: string } };
    expect(envelope.data).toBeUndefined();
    expect(envelope.error?.code).toBe("state.write.failed");
    // The run never continued to the event publication step.
    expect(run.stdout).not.toContain("queue.graph");
    const fold = readQueueFold(harness.composition.store);
    expect(fold.ok).toBe(true);
    if (fold.ok) {
      expect(fold.value.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(true);
    }
  });
});
