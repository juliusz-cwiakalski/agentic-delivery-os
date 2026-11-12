/**
 * TC-QLC-086 (GH-292, AC-F5-9, AC-F2-5, AC-F3-3, NFR-10) — all three retirement
 * paths converge on re-run: a repeated closeout removal reports `satisfied`
 * with zero appends, a repeated absent-edge `dep remove` is a `noop` with zero
 * appends and zero events, and a repeated reconcile removes, appends, and
 * publishes nothing while counting only the entries that still exist. Each
 * first-run record is byte-identical after the repeat and the derived document
 * does not churn.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { queueRemovalForCloseout } from "../../packages/core/src/app/index";
import { queueGraphDocumentPath, readQueueFold } from "../../packages/core/src/app/queue";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  seedQueueEntry,
} from "../fixtures/closeout/queue-removal";
import { CONSUMER_REF, PRODUCER_REF } from "../fixtures/queue/depend/grammar-cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";
import { ledgerText, removeRoot } from "../fixtures/state/harness";

const REPEAT_NOW_ISO = "2026-11-12T10:05:00Z";
const REPEAT_NOW_MS = Date.parse(REPEAT_NOW_ISO);

const documentBytes = (identity: { readonly stateDirectory: string }): string =>
  readFileSync(queueGraphDocumentPath(identity), "utf8");

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-086 all three mutation paths converge on re-run", () => {
  test("the closeout retirement path: a repeat over a removed ref is satisfied with zero appends", async () => {
    const harness = createQueueRemovalHarness({ label: "convergence-closeout", apply: true });
    try {
      seedQueueEntry(harness, CLOSEOUT_WORK_ITEM_REF);
      const first = await harness.run();
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.queueRemoval).toEqual({
        outcome: "removed",
        ref: CLOSEOUT_WORK_ITEM_REF,
        reason: "landed",
      });
      const ledgerAfterFirst = ledgerText(harness.store.identity);
      const removalsAfterFirst = harness.store.readRecords();
      expect(removalsAfterFirst.ok).toBe(true);
      if (!removalsAfterFirst.ok) return;
      const countAfterFirst = removalsAfterFirst.value.records.length;

      // The repeat: the same hook over the same store inside one fence.
      const acquired = harness.store.acquireFence("convergence-closeout-repeat");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const repeat = queueRemovalForCloseout(harness.store, {
        mode: "apply",
        workItemRef: CLOSEOUT_WORK_ITEM_REF,
        mergedObserved: true,
        recordedAt: REPEAT_NOW_ISO,
        nowMs: REPEAT_NOW_MS,
        handle: acquired.value.handle,
      });
      harness.store.releaseFence(acquired.value.handle);
      expect(repeat).toEqual({ outcome: "satisfied", ref: CLOSEOUT_WORK_ITEM_REF });
      // Zero appends: the ledger is byte-identical after the repeat.
      expect(ledgerText(harness.store.identity)).toBe(ledgerAfterFirst);
      const removalsAfterRepeat = harness.store.readRecords();
      expect(removalsAfterRepeat.ok).toBe(true);
      if (!removalsAfterRepeat.ok) return;
      expect(removalsAfterRepeat.value.records.length).toBe(countAfterFirst);
      // The fold still reports the absence — the retirement held.
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (fold.ok) {
        expect(fold.value.entries.some((entry) => entry.ref === CLOSEOUT_WORK_ITEM_REF)).toBe(
          false,
        );
      }
    } finally {
      harness.dispose();
    }
  });

  test("the dependency path: a repeated absent-edge dep remove is noop with zero appends and zero events", async () => {
    const harness = createRemovalHarness("convergence-dep");
    harness.seedEntry({ ref: PRODUCER_REF });
    harness.seedEntry({ ref: CONSUMER_REF });
    harness.seedEdge({ ref: CONSUMER_REF, onRef: PRODUCER_REF });
    const identity = harness.composition.store.identity;
    const first = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(first.exitCode).toBe(0);
    expect((json(first.stdout).data as Record<string, unknown>).result).toBe("removed");
    const ledgerAfterFirst = ledgerText(identity);
    const documentAfterFirst = documentBytes(identity);
    const writeLog = harness.writeLog;
    expect(writeLog).toBeDefined();
    if (writeLog === undefined) return;
    writeLog.appends = 0;
    writeLog.replaces = 0;
    writeLog.fences = 0;
    writeLog.releases = 0;

    const repeat = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(repeat.exitCode).toBe(0);
    expect((json(repeat.stdout).data as Record<string, unknown>).result).toBe("noop");
    // Zero appends and zero events: events project only from appended
    // records, so the byte-identical ledger is the no-publication proof. The
    // single fence/release pair is the delivered park-recovery pass.
    expect(writeLog).toEqual({ appends: 0, replaces: 0, fences: 1, releases: 1 });
    expect(ledgerText(identity)).toBe(ledgerAfterFirst);
    expect(documentBytes(identity)).toBe(documentAfterFirst);
    expect(harness.removalRecords()).toHaveLength(0);
  });

  test("the reconcile path: a repeat counts only the still-existing entry and re-reports nothing", async () => {
    const harness = createReconcileHarness("convergence-reconcile");
    try {
      harness.seedEntry({ ref: "GH-241" });
      harness.seedEntry({ ref: "GH-242" });
      harness.seedEntry({ ref: "GH-243" });
      harness.program("GH-241", { deliveryState: "done" });
      harness.program("GH-242", { deliveryState: "canceled" });
      harness.program("GH-243", { deliveryState: "ready" });
      const identity = harness.composition.store.identity;

      const first = await harness.run(["queue", "reconcile", "--json"]);
      expect(first.exitCode).toBe(0);
      const firstData = json(first.stdout).data as Record<string, unknown>;
      expect(firstData.checked).toBe(3);
      expect(firstData.removed).toEqual([
        { ref: "GH-241", reason: "reconciled" },
        { ref: "GH-242", reason: "reconciled" },
      ]);
      expect(firstData.retained).toEqual([{ ref: "GH-243", deliveryState: "ready" }]);
      const ledgerAfterFirst = ledgerText(identity);
      const documentAfterFirst = documentBytes(identity);
      const removalRecordsAfterFirst = JSON.stringify(harness.removalRecords());
      const callsAfterFirst = harness.calls().length;
      const writeLog = harness.writeLog;
      expect(writeLog).toBeDefined();
      if (writeLog === undefined) return;
      writeLog.appends = 0;
      writeLog.replaces = 0;
      writeLog.fences = 0;
      writeLog.releases = 0;

      const repeat = await harness.run(["queue", "reconcile", "--json"]);
      expect(repeat.exitCode).toBe(0);
      const repeatData = json(repeat.stdout).data as Record<string, unknown>;
      // The truthful second observation: only the still-existing entry is
      // counted, and no already-removed ref appears in any list.
      expect(repeatData.checked).toBe(1);
      expect(repeatData.removed).toEqual([]);
      expect(repeatData.retained).toEqual([{ ref: "GH-243", deliveryState: "ready" }]);
      expect(repeatData.unobserved).toEqual([]);
      expect(repeat.stdout).not.toContain("GH-241");
      expect(repeat.stdout).not.toContain("GH-242");
      // Exactly one bounded read, for the surviving ref only.
      expect(harness.calls().length).toBe(callsAfterFirst + 1);
      expect(harness.calls()[callsAfterFirst]?.ref).toBe("GH-243");
      // Zero appends, zero events, zero churn. The single fence/release pair
      // is the delivered park-recovery pass that precedes every runtime
      // mutation; with no stale park it appends nothing.
      expect(writeLog).toEqual({ appends: 0, replaces: 0, fences: 1, releases: 1 });
      expect(ledgerText(identity)).toBe(ledgerAfterFirst);
      expect(documentBytes(identity)).toBe(documentAfterFirst);
      expect(JSON.stringify(harness.removalRecords())).toBe(removalRecordsAfterFirst);
    } finally {
      removeRoot(harness.composition.store.identity.stateDirectory);
    }
  });
});
