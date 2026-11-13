/**
 * TC-QLC-058 (GH-292, AC-F5-8, AC-F5-9, NFR-6) — the `queue reconcile` payload
 * is exactly the nine declared keys with bounded, identifier-only values; every
 * removal publishes exactly one `queue.graph/remove` through the real
 * projector; and a repeat run over already-reconciled entries exits 0,
 * removes/appends/publishes nothing, and reports the second observation
 * truthfully.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { createEventProjector } from "../../packages/core/src/domain/index";
import { RECONCILE_PAYLOAD_KEYS, RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { ledgerDigest, ledgerText } from "../fixtures/state/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

type ReconcileData = {
  readonly result: string;
  readonly checked: number;
  readonly removed: readonly { readonly ref: string; readonly reason: string }[];
  readonly retained: readonly { readonly ref: string; readonly deliveryState: string }[];
  readonly unobserved: readonly string[];
  readonly readySet: readonly string[];
  readonly truncated: boolean;
  readonly remainder: number;
  readonly degraded: readonly string[];
};

const dataOf = (stdout: string): ReconcileData => json(stdout).data as ReconcileData;

describe("TC-QLC-058 the payload is exactly the nine declared keys", () => {
  test("the key set is exact in both directions and every value is bounded", async () => {
    const harness = createReconcileHarness("reconcile-payload");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 2 });
    harness.seedEntry({ ref: RECONCILE_REFS.unobserved, priority: 3 });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    harness.program(RECONCILE_REFS.ready, { deliveryState: "in-review" });
    harness.program(RECONCILE_REFS.unobserved, { observation: "not-found" });

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = dataOf(run.stdout);

    // Two-sided exact key equality with the declared payload.
    expect(Object.keys(data).sort()).toEqual([...RECONCILE_PAYLOAD_KEYS].sort());
    expect([...RECONCILE_PAYLOAD_KEYS].sort()).toEqual(Object.keys(data).sort());

    // Every list member carries exactly its declared fields (no tracker echo).
    expect(data.removed).toEqual([{ ref: RECONCILE_REFS.done, reason: "reconciled" }]);
    expect(Object.keys(data.removed[0] ?? {}).sort()).toEqual(["reason", "ref"]);
    expect(data.retained).toEqual([{ ref: RECONCILE_REFS.ready, deliveryState: "in-review" }]);
    expect(Object.keys(data.retained[0] ?? {}).sort()).toEqual(["deliveryState", "ref"]);
    expect(data.unobserved).toEqual([RECONCILE_REFS.unobserved]);

    // Scalar members: the recomputed ready set, the derived degraded set, and
    // the un-truncated bounds report.
    expect(typeof data.checked).toBe("number");
    expect(data.checked).toBe(3);
    expect(data.truncated).toBe(false);
    expect(data.remainder).toBe(0);
    expect(Array.isArray(data.readySet)).toBe(true);
    expect(data.readySet.every((ref) => typeof ref === "string")).toBe(true);
    expect(data.degraded).toEqual(["daemon-unreachable"]);
    expect(data.result).toBe("removed");

    // Bounded output (NFR-6): every list is within the declared cap and the
    // machine payload carries identifiers and closed values only.
    const payloadText = run.stdout;
    expect(data.removed.length).toBeLessThanOrEqual(100);
    expect(data.retained.length).toBeLessThanOrEqual(100);
    expect(data.unobserved.length).toBeLessThanOrEqual(100);
    expect(payloadText).not.toContain("title");
    expect(payloadText).not.toContain("labels");
  });
});

describe("TC-QLC-058 the removal publishes exactly one remove event per ref", () => {
  test("the real projector emits one remove with the declared payload keys", async () => {
    const harness = createReconcileHarness("reconcile-payload-events");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.canceled, priority: 2 });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    harness.program(RECONCILE_REFS.canceled, { deliveryState: "canceled" });

    const projector = createEventProjector();
    const before = harness.composition.store.readRecords();
    if (!before.ok) throw new Error("ledger read failed");
    // The first observation baselines the populated store: nothing replays.
    expect(projector.project(before.value.records)).toEqual([]);

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    const after = harness.composition.store.readRecords();
    if (!after.ok) throw new Error("ledger read failed");
    const events = projector.project(after.value.records);
    const removes = events.filter((event) => event.kind === "remove");
    expect(removes).toHaveLength(2);
    for (const remove of removes) {
      expect(remove.topic).toBe("queue.graph");
      expect(remove.lane).toBe(remove.ref);
      expect(Object.keys(remove.payload).sort()).toEqual(["reason", "recordedAt", "ref"]);
      expect(remove.payload.reason).toBe("reconciled");
    }
    expect([...removes].map((remove) => remove.ref).sort()).toEqual([
      RECONCILE_REFS.done,
      RECONCILE_REFS.canceled,
    ]);
  });
});

describe("TC-QLC-058 a repeat run over reconciled entries converges truthfully", () => {
  test("second run exits 0, removes/appends/publishes nothing, counts only existing", async () => {
    const harness = createReconcileHarness("reconcile-payload-repeat");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 2 });
    harness.seedEntry({ ref: RECONCILE_REFS.unobserved, priority: 3 });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    harness.program(RECONCILE_REFS.ready, { deliveryState: "backlog" });
    harness.program(RECONCILE_REFS.unobserved, { observation: "not-found" });

    const first = await harness.run(["queue", "reconcile", "--json"]);
    expect(first.exitCode).toBe(0);
    const firstData = dataOf(first.stdout);
    expect(firstData.result).toBe("removed");
    expect(firstData.checked).toBe(3);
    const removedRef = RECONCILE_REFS.done;

    const projector = createEventProjector();
    const mid = harness.composition.store.readRecords();
    if (!mid.ok) throw new Error("ledger read failed");
    projector.project(mid.value.records);

    const digestBefore = ledgerDigest(harness.composition.store.identity);
    const bytesBefore = ledgerText(harness.composition.store.identity);
    const foldBefore = readQueueFold(harness.composition.store);
    if (!foldBefore.ok) throw new Error("fold read failed");
    const existingRefs = foldBefore.value.entries.map((entry) => entry.ref);

    const second = await harness.run(["queue", "reconcile", "--json"]);
    expect(second.exitCode).toBe(0);
    const secondData = dataOf(second.stdout);
    // The second observation is truthful: only still-existing entries count,
    // nothing was removed, and the already-removed ref appears in no list.
    expect(secondData.result).toBe("noop");
    expect(secondData.checked).toBe(existingRefs.length);
    expect(secondData.checked).toBe(2);
    expect(secondData.removed).toEqual([]);
    expect(JSON.stringify(secondData)).not.toContain(removedRef);
    expect(secondData.retained.map((entry) => entry.ref)).toEqual([RECONCILE_REFS.ready]);
    expect(secondData.unobserved).toEqual([RECONCILE_REFS.unobserved]);

    // Zero appends: ledger bytes, digest, and removal records are unchanged.
    expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
    expect(ledgerText(harness.composition.store.identity)).toBe(bytesBefore);
    expect(harness.removalRecords()).toHaveLength(1);

    // Zero events: the projector's delta over the unchanged ledger is empty.
    const afterSecond = harness.composition.store.readRecords();
    if (!afterSecond.ok) throw new Error("ledger read failed");
    expect(projector.project(afterSecond.value.records)).toEqual([]);

    // The fold is unchanged and the ready set is stable across both runs.
    const foldAfter = readQueueFold(harness.composition.store);
    if (!foldAfter.ok) throw new Error("fold read failed");
    expect(foldAfter.value.entries.length).toBe(foldBefore.value.entries.length);
    expect(secondData.readySet).toEqual(firstData.readySet);
  });
});
