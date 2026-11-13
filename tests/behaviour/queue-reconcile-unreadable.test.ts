/**
 * TC-QLC-053 (GH-292) — an unreadable tracker removes nothing and returns the
 * provider identity: no `queue.*` code, no partial sweep, one read per examined
 * entry, and the run stops at the failure.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { PROVIDER_FAILURES, RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { ledgerDigest, ledgerText } from "../fixtures/state/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-053 an unreadable tracker fails closed", () => {
  test("each provider failure class exits on its own identity with zero removals", async () => {
    for (const failure of PROVIDER_FAILURES) {
      const harness = createReconcileHarness(`reconcile-fail-${failure.code}`);
      harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
      harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 2 });
      // Both entries fail the read, so nothing is removed on this path.
      harness.program(RECONCILE_REFS.done, { failureCode: failure.code });
      harness.program(RECONCILE_REFS.ready, { failureCode: failure.code });
      const digestBefore = ledgerDigest(harness.composition.store.identity);
      const bytesBefore = ledgerText(harness.composition.store.identity);

      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode, failure.code).toBe(failure.exit);
      expect(errorOf(run.stdout).code, failure.code).toBe(failure.code);
      // Zero removal records, zero derived-document replacements.
      expect(harness.removalRecords()).toHaveLength(0);
      expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
      expect(ledgerText(harness.composition.store.identity)).toBe(bytesBefore);
      // The `done` entry is still present.
      const list = await harness.run(["queue", "list", "--json"]);
      expect(list.stdout).toContain(RECONCILE_REFS.done);
      // The failure stops the run at the first unreadable read: exactly one
      // read per examined entry (1), no retry.
      expect(harness.calls()).toHaveLength(1);
    }
  });

  test("a mid-sweep failure changes nothing: no removal precedes the failed read", async () => {
    const harness = createReconcileHarness("reconcile-fail-mid");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 2 });
    harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
    harness.program(RECONCILE_REFS.ready, { failureCode: "provider.outage" });
    const digestBefore = ledgerDigest(harness.composition.store.identity);
    const bytesBefore = ledgerText(harness.composition.store.identity);

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(2);
    expect(errorOf(run.stdout).code).toBe("provider.outage");
    // The failure stops the run: exactly 2 reads, no retry.
    expect(harness.calls()).toHaveLength(2);
    // The failure carries no queue identity; the payload is not emitted.
    expect(json(run.stdout).error).toBeDefined();
    expect(JSON.stringify(json(run.stdout).error)).not.toContain("queue.");
    // Fail-closed is unconditional: the stale `done` entry read before the
    // failure is still removed by nothing — zero appends, byte-identical
    // ledger, the entry still present (AC-F5-4, F-5 no partial success).
    expect(harness.removalRecords()).toHaveLength(0);
    expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
    expect(ledgerText(harness.composition.store.identity)).toBe(bytesBefore);
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.done)).toBe(true);
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.stdout).toContain(RECONCILE_REFS.done);
  });

  test("the fold is untouched when the first read fails before any removal", async () => {
    const harness = createReconcileHarness("reconcile-fail-fold");
    harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
    harness.program(RECONCILE_REFS.done, { failureCode: "provider.auth.rejected" });
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(1);
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === RECONCILE_REFS.done)).toBe(true);
    expect(harness.calls()).toHaveLength(1);
  });
});
