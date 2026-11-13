/**
 * TC-QLC-050/051 (GH-292) — a `done` or `canceled` work item retires the entry
 * with reason `reconciled`; the alias set is respected.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { listStoreFiles } from "../fixtures/state/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-050 a done entry is removed with reconciled", () => {
  test("one sweep, one removal, one record, and the fold loses the entry", async () => {
    const harness = createReconcileHarness("reconcile-done");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    const filesBefore = listStoreFiles(harness.composition.store.identity.stateDirectory);

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      result: string;
      checked: number;
      removed: readonly { ref: string; reason: string }[];
    };
    expect(data.result).toBe("removed");
    expect(data.checked).toBe(1);
    expect(data.removed).toEqual([{ ref: RECONCILE_REFS.done, reason: "reconciled" }]);

    // Exactly one removal record with reason reconciled.
    const removals = harness.removalRecords();
    expect(removals).toHaveLength(1);
    expect(removals[0]?.reason).toBe("reconciled");

    // The fold loses the entry; the derived document follows.
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.done)).toBe(false);
    const document = harness.graphDocument();
    expect(document).toBeDefined();

    // The file set changed only by the append-only ledger and the document.
    expect(listStoreFiles(harness.composition.store.identity.stateDirectory)).toEqual(filesBefore);

    // The read surfaces no longer show the entry.
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).not.toContain(RECONCILE_REFS.done);
    const plan = await harness.run(["queue", "plan", "--json"]);
    expect(plan.stdout).not.toContain(RECONCILE_REFS.done);
  });
});

describe("TC-QLC-051 a canceled entry is removed with reconciled", () => {
  test("canceled removes with the same mechanics; both stale states work in one run", async () => {
    const harness = createReconcileHarness("reconcile-canceled");
    harness.seedEntry({ ref: RECONCILE_REFS.canceled, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 2 });
    harness.program(RECONCILE_REFS.canceled, { deliveryState: "canceled" });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      result: string;
      removed: readonly { ref: string; reason: string }[];
    };
    expect(data.result).toBe("removed");
    // Deterministic order: the canonical ref sort.
    expect(data.removed).toEqual([
      { ref: RECONCILE_REFS.done, reason: "reconciled" },
      { ref: RECONCILE_REFS.canceled, reason: "reconciled" },
    ]);
    expect(harness.removalRecords()).toHaveLength(2);
  });
});
