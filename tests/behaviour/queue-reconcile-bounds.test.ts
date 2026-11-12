/**
 * TC-QLC-056 (GH-292) — the 100-entry cap is a hard bound: `truncated` plus an
 * exact remainder, no read and no removal beyond the cap, and `--ref` still
 * reaches a beyond-cap entry. The proof mutates 100 entries through the real
 * verified store (every removal re-reads and re-verifies the whole ledger), so
 * the test declares its own minutes-scale timeout; the default 5s budget is
 * for ordinary suites.
 */
import { describe, expect, test } from "bun:test";
import { RECONCILE_CAP } from "../fixtures/queue/reconcile/cases";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

/** The cap proof's budget: the 100 verified removals are minutes-scale. */
const CAP_PROOF_TIMEOUT_MS = 600_000;

/** Deterministic 3-digit ref sequence: GH-100..GH-204 (105 entries). */
const BEYOND_CAP_REF = "GH-204";

describe("TC-QLC-056 the 100-entry cap reports truncated and an exact remainder", () => {
  test(
    "105 entries: checked 100, truncated true, remainder 5, 100 reads, 100 removals",
    async () => {
      const harness = createReconcileHarness("reconcile-bounds");
      for (let index = 100; index <= 204; index += 1) {
        const ref = `GH-${index}`;
        harness.seedEntry({ ref, priority: index - 99 });
        harness.program(ref, { deliveryState: "done" });
      }

      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = json(run.stdout).data as {
        result: string;
        checked: number;
        truncated: boolean;
        remainder: number;
        removed: readonly { ref: string }[];
        retained: readonly unknown[];
        unobserved: readonly unknown[];
      };
      expect(data.checked).toBe(RECONCILE_CAP);
      expect(data.truncated).toBe(true);
      expect(data.remainder).toBe(5);
      expect(data.removed).toHaveLength(RECONCILE_CAP);
      expect(data.retained).toEqual([]);
      expect(data.unobserved).toEqual([]);

      // The tracker read count is exactly the cap: no read past it.
      expect(harness.calls()).toHaveLength(RECONCILE_CAP);
      expect(harness.calls().every((call) => call.ref !== BEYOND_CAP_REF)).toBe(true);
      // The five beyond-cap entries remain present and untouched.
      expect(harness.removalRecords()).toHaveLength(RECONCILE_CAP);
      const list = await harness.run(["queue", "list", "--json"]);
      expect(list.stdout).toContain(BEYOND_CAP_REF);

      // The documented narrowing path: `--ref` reaches a beyond-cap entry.
      const narrow = await harness.run(["queue", "reconcile", "--ref", BEYOND_CAP_REF, "--json"]);
      expect(narrow.exitCode).toBe(0);
      const narrowData = json(narrow.stdout).data as {
        checked: number;
        removed: readonly { ref: string }[];
      };
      expect(narrowData.checked).toBe(1);
      expect(narrowData.removed).toEqual([{ ref: BEYOND_CAP_REF, reason: "reconciled" }]);
      // Both lists are bounded by the cap in every payload.
      expect(data.removed.length).toBeLessThanOrEqual(RECONCILE_CAP);
    },
    CAP_PROOF_TIMEOUT_MS,
  );
});
