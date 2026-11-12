/**
 * TC-QLC-057 (GH-292) — every reconcile removal is an ordinary F-1 removal:
 * park withdrawal before the removal, no cascade, one append, one event per
 * removed ref with reason `reconciled`.
 */
import { describe, expect, test } from "bun:test";
import { queueParkRecordKey } from "../../packages/core/src/app/index";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { QUEUE_PARK_RECORD_KIND } from "../../packages/core/src/contracts/index";
import { createParkRecord } from "../../packages/core/src/domain/index";
import { RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness, REPO_A } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-057 reconcile removals obey every F-1 invariant", () => {
  test("park withdrawal precedes the removal; dependents are untouched and held", async () => {
    const harness = createReconcileHarness("reconcile-invariants");
    // A done entry with an active park and a dependent; a second done entry
    // with no park.
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedEntry({ ref: "GH-242", priority: 2 });
    harness.seedEntry({ ref: RECONCILE_REFS.canceled, priority: 3 });
    harness.seedEdge({ ref: "GH-242", onRef: RECONCILE_REFS.done });
    // Active park for GH-241 through the delivered record shape.
    const park = createParkRecord({
      ref: RECONCILE_REFS.done,
      repository: REPO_A,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-07T09:00:00Z" },
      recheckMs: 60_000,
      evaluatedAt: harness.nowIso(),
      recordedAt: harness.nowIso(),
    });
    const store = harness.composition.store;
    const fence = store.acquireFence("seed-reconcile-park");
    if (!fence.ok) throw new Error("fence failed");
    try {
      const appended = store.append(fence.value.handle, {
        kind: QUEUE_PARK_RECORD_KIND,
        recordKey: queueParkRecordKey(RECONCILE_REFS.done),
        payload: park as never,
      });
      if (!appended.ok) throw new Error("park seed failed");
    } finally {
      store.releaseFence(fence.value.handle);
    }
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    harness.program(RECONCILE_REFS.canceled, { deliveryState: "canceled" });
    harness.program("GH-242", { deliveryState: "ready" });

    const before = store.readRecords();
    if (!before.ok) throw new Error("read failed");
    const dependentRecords = before.value.records.filter(
      (record) => record.key === `queue.deps:GH-242`,
    );

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      result: string;
      removed: readonly { ref: string; reason: string }[];
    };
    expect(data.removed).toEqual([
      { ref: RECONCILE_REFS.done, reason: "reconciled" },
      { ref: RECONCILE_REFS.canceled, reason: "reconciled" },
    ]);

    // The parked ref: one released park record precedes its removal.
    const after = store.readRecords();
    if (!after.ok) throw new Error("read failed");
    const records = after.value.records;
    const removalIndexes = records.reduce<number[]>((acc, record, index) => {
      if (record.kind === "queue.removal") acc.push(index);
      return acc;
    }, []);
    const lastParkIndex = records.reduce(
      (last, record, index) => (record.kind === QUEUE_PARK_RECORD_KIND ? index : last),
      -1,
    );
    expect(removalIndexes.length).toBe(2);
    expect(lastParkIndex).toBeLessThan(removalIndexes[0] ?? Number.MAX_SAFE_INTEGER);
    // The second removed ref had no park: no park record was appended for it.
    const parks = records.filter((record) => record.kind === QUEUE_PARK_RECORD_KIND);
    expect(
      parks.every((record) => (record.payload as { ref?: string }).ref === RECONCILE_REFS.done),
    ).toBe(true);

    // No cascade: the dependent's records are byte-identical and it is held.
    const dependentAfter = records.filter((record) => record.key === `queue.deps:GH-242`);
    expect(dependentAfter).toEqual(dependentRecords);
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.stdout).toContain("GH-242");
    expect(list.stdout).toContain("dependency-unobserved");

    // The fold holds no removed ref.
    const fold = readQueueFold(store);
    if (!fold.ok) throw new Error("fold failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.done)).toBe(false);
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.canceled)).toBe(false);
  });

  test("a live lease refuses the reconcile removal until release clears it", async () => {
    const harness = createReconcileHarness("reconcile-lease-refusal");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedLease({ ref: RECONCILE_REFS.done, holder: "lane-1" });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    const appendsBefore = harness.writeLog?.appends ?? 0;

    const refused = await harness.run(["queue", "reconcile", "--json"]);
    expect(refused.exitCode).toBe(1);
    const error = errorOf(refused.stdout);
    // The delivered F-1 precondition identity, with the holder named.
    expect(error.code).toBe("queue.precondition.unmet");
    expect(refused.stdout).toContain("lease-held");
    expect(refused.stdout).toContain("lane-1");
    // The refusal appends nothing: the sweep leaves the ledger unchanged and
    // the entry in the fold.
    expect(harness.writeLog?.appends, "zero appends on the refusal").toBe(appendsBefore);
    expect(harness.removalRecords()).toHaveLength(0);
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.done)).toBe(true);

    // The delivered release is the supported precondition-clearing verb; the
    // same sweep now removes with reason `reconciled` through the F-1 seam.
    const released = await harness.run([
      "queue",
      "release",
      RECONCILE_REFS.done,
      "--holder",
      "lane-1",
      "--json",
    ]);
    expect(released.exitCode).toBe(0);
    const applied = await harness.run(["queue", "reconcile", "--json"]);
    expect(applied.exitCode).toBe(0);
    const data = json(applied.stdout).data as {
      readonly removed: readonly { readonly ref: string; readonly reason: string }[];
    };
    expect(data.removed).toEqual([{ ref: RECONCILE_REFS.done, reason: "reconciled" }]);
    expect(harness.removalRecords()).toEqual([{ ref: RECONCILE_REFS.done, reason: "reconciled" }]);
  });
});
