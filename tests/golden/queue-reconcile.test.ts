/**
 * TC-QLC-058 (GH-292) — the `queue reconcile` envelopes are pinned by
 * committed goldens: the first run's `removed` envelope, the repeat run's
 * truthful `noop` envelope (AC-F5-9), and the bounded human line. The goldens
 * are generated from the same deterministic harness the behaviour suites use;
 * the repeat run appends nothing, so the ledger is byte-identical across the
 * two runs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RECONCILE_PAYLOAD_KEYS, RECONCILE_REFS } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { ledgerDigest, ledgerText } from "../fixtures/state/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/reconcile/golden");
const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

/** Seed the TC-QLC-058 mixed fixture: done, canceled, ready, not-found. */
const seedMixed = (label: string) => {
  const harness = createReconcileHarness(label);
  harness.seedEntry({ ref: RECONCILE_REFS.done, priority: 1 });
  harness.seedEntry({ ref: RECONCILE_REFS.canceled, priority: 2 });
  harness.seedEntry({ ref: RECONCILE_REFS.ready, priority: 3 });
  harness.seedEntry({ ref: RECONCILE_REFS.unobserved, priority: 4 });
  harness.program(RECONCILE_REFS.done, { deliveryState: "done" });
  harness.program(RECONCILE_REFS.canceled, { deliveryState: "canceled" });
  harness.program(RECONCILE_REFS.ready, { deliveryState: "ready" });
  harness.program(RECONCILE_REFS.unobserved, { observation: "not-found" });
  return harness;
};

describe("queue reconcile golden", () => {
  test("the first-run envelope is byte-identical to the committed golden", async () => {
    const harness = seedMixed("golden-reconcile-first");
    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "reconcile-first-run.json"), "utf8"));
    // The exact payload key set: exactly the nine declared members.
    const data = json(run.stdout).data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(RECONCILE_PAYLOAD_KEYS);
    // The envelope top level is exactly the delivered five members.
    expect(Object.keys(json(run.stdout)).sort()).toEqual([
      "data",
      "exitCode",
      "runId",
      "schemaVersion",
      "timing",
    ]);
    // The removed members carry exactly `ref` and `reason`.
    const removed = data.removed as readonly { ref: string; reason: string }[];
    expect(removed.map((entry) => entry.ref).sort()).toEqual([
      RECONCILE_REFS.done,
      RECONCILE_REFS.canceled,
    ]);
    expect(removed.every((entry) => entry.reason === "reconciled")).toBe(true);
  });

  test("the repeat-run envelope is byte-identical and reports the second observation truthfully", async () => {
    const harness = seedMixed("golden-reconcile-second");
    const first = await harness.run(["queue", "reconcile", "--json"]);
    expect(first.exitCode).toBe(0);
    const digestAfterFirst = ledgerDigest(harness.composition.store.identity);
    const bytesAfterFirst = ledgerText(harness.composition.store.identity);

    const run = await harness.run(["queue", "reconcile", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "reconcile-second-run.json"), "utf8"));
    const data = json(run.stdout).data as {
      result: string;
      checked: number;
      removed: readonly unknown[];
      retained: readonly { ref: string }[];
      unobserved: readonly string[];
    };
    // AC-F5-9: the noop is truthful — only still-existing entries count, and
    // no already-removed ref is reported in any list.
    expect(data.result).toBe("noop");
    expect(data.checked).toBe(2);
    expect(data.removed).toEqual([]);
    const reported = JSON.stringify(data);
    for (const removedRef of [RECONCILE_REFS.done, RECONCILE_REFS.canceled]) {
      expect(reported).not.toContain(removedRef);
    }
    expect(data.retained.map((entry) => entry.ref)).toEqual([RECONCILE_REFS.ready]);
    expect(data.unobserved).toEqual([RECONCILE_REFS.unobserved]);
    // The repeat appended nothing: ledger bytes and digest are unchanged.
    expect(ledgerDigest(harness.composition.store.identity)).toBe(digestAfterFirst);
    expect(ledgerText(harness.composition.store.identity)).toBe(bytesAfterFirst);
    expect(harness.removalRecords()).toHaveLength(2);
  });

  test("the human form is byte-identical and names the counts", async () => {
    const harness = seedMixed("golden-reconcile-human");
    const run = await harness.run(["queue", "reconcile"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "reconcile-first-run.txt"), "utf8"));
    expect(run.stdout).toContain("result=removed");
    expect(run.stdout).toContain("checked=4");
    expect(run.stdout).toContain("removed=2");
    expect(run.stdout).toContain("retained=1");
    // Bounded output: one line, no unbounded member.
    expect(run.stdout.split("\n").filter((line) => line.length > 0)).toHaveLength(1);
  });
});
