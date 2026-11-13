/**
 * TC-QLC-055 (GH-292) — a not-found tracker item is retained and reported
 * unobserved; absence is not evidence that work landed (DEC-11).
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-055 a not-found work item is unobserved and retained", () => {
  test("the ref lands in unobserved only, keeps its fold entry, and removed stays empty", async () => {
    const harness = createReconcileHarness("reconcile-unobserved");
    harness.seedEntry({ ref: RECONCILE_REFS.unobserved, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 2 });
    harness.program(RECONCILE_REFS.unobserved, { observation: "not-found" });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      checked: number;
      removed: readonly { ref: string }[];
      retained: readonly { ref: string }[];
      unobserved: readonly string[];
    };
    expect(data.checked).toBe(2);
    expect(data.unobserved).toEqual([RECONCILE_REFS.unobserved]);
    expect(data.removed).toEqual([{ ref: RECONCILE_REFS.done, reason: "reconciled" }]);
    expect(data.retained).toEqual([]);

    // Zero removal records for the unobserved ref; it is still in the fold.
    const removals = harness.removalRecords();
    expect(removals.map((record) => record.ref)).toEqual([RECONCILE_REFS.done]);
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.unobserved)).toBe(true);
  });
});
