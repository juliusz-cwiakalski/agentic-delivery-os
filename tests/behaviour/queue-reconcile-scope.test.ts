/**
 * TC-QLC-054 (GH-292) — `--ref` examines exactly one entry with one read; the
 * invoking checkout's store is the sweep scope.
 */
import { describe, expect, test } from "bun:test";
import { RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-054 --ref examines exactly one entry", () => {
  test("checked is 1, the read count is 1, and only the named ref is removed", async () => {
    const harness = createReconcileHarness("reconcile-scope");
    for (const [index, ref] of ["GH-241", "GH-242", "GH-243", "GH-244", "GH-245"].entries()) {
      harness.seedEntry({ ref, priority: index + 1 });
      harness.program(ref, { deliveryState: "done" });
    }
    const run = await harness.run(["queue", "reconcile", "--ref", "GH-242", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      result: string;
      checked: number;
      removed: readonly { ref: string }[];
    };
    expect(data.checked).toBe(1);
    expect(data.removed).toEqual([{ ref: "GH-242", reason: "reconciled" }]);
    expect(harness.calls()).toHaveLength(1);

    // The other four entries are untouched: records, fold presence, reads.
    const list = await harness.run(["queue", "list", "--json"]);
    for (const ref of ["GH-241", "GH-243", "GH-244", "GH-245"]) {
      expect(list.stdout).toContain(ref);
    }
    expect(list.stdout).not.toContain("GH-242");

    // The full sweep examines only the store's own entries.
    const full = await harness.run(["queue", "reconcile", "--json"]);
    const fullData = json(full.stdout).data as { checked: number };
    expect(fullData.checked).toBe(4);
    // Five reads in total across both runs: one for --ref, four for the sweep.
    expect(harness.calls()).toHaveLength(5);

    // A `--ref` for an entry outside this checkout's queue examines nothing.
    const absent = await harness.run(["queue", "reconcile", "--ref", "GH-999", "--json"]);
    expect(absent.exitCode).toBe(0);
    const absentData = json(absent.stdout).data as { checked: number; result: string };
    expect(absentData.checked).toBe(0);
    expect(absentData.result).toBe("noop");
    expect(harness.calls()).toHaveLength(5);
  });
});
