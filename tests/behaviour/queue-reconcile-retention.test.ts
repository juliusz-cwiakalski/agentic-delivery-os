/**
 * TC-QLC-052 (GH-292) — only `done`/`canceled` remove; every open delivery
 * state (and a tracker kind with no read surface) is retained and reported
 * with its observed alias.
 */
import { describe, expect, test } from "bun:test";
import {
  OPEN_DELIVERY_STATES,
  RECONCILE_REFS,
} from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-052 open delivery states are retained", () => {
  test("the four open states survive with their observed aliases and zero removals", async () => {
    const harness = createReconcileHarness("reconcile-retain");
    const refs: string[] = [];
    for (const [index, state] of OPEN_DELIVERY_STATES.entries()) {
      const ref = `GH-24${index}`;
      refs.push(ref);
      harness.seedEntry({ ref, priority: index + 1 });
      harness.program(ref, { deliveryState: state });
    }

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      result: string;
      removed: readonly unknown[];
      retained: readonly { ref: string; deliveryState: string }[];
    };
    expect(data.result).toBe("noop");
    expect(data.removed).toEqual([]);
    // Deterministic order: the canonical ref sort; aliases observed as-is.
    expect(data.retained.map((entry) => entry.ref)).toEqual(refs);
    expect(data.retained.map((entry) => entry.deliveryState)).toEqual([
      ...OPEN_DELIVERY_STATES,
    ]);
    expect(harness.removalRecords()).toHaveLength(0);

    // All four entries are still present in the fold and in `queue list`.
    const list = await harness.run(["queue", "list", "--json"]);
    for (const ref of refs) expect(list.stdout).toContain(ref);
  });

  test("a tracker kind with no read surface is retained as an unobserved observation", async () => {
    const harness = createReconcileHarness("reconcile-retain-nosurface");
    harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 1 });
    // A tracker kind whose read surface answers `not-found` (A-2): the entry
    // is retained and reported unobserved, and zero removals are appended.
    harness.program(RECONCILE_REFS.ready, { observation: "not-found" });
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as {
      removed: readonly unknown[];
      retained: readonly unknown[];
      unobserved: readonly string[];
    };
    expect(data.removed).toEqual([]);
    expect(data.retained).toEqual([]);
    expect(data.unobserved).toEqual([RECONCILE_REFS.ready]);
    expect(harness.removalRecords()).toHaveLength(0);
  });
});
