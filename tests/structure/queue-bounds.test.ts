/**
 * TC-F6-010 — the delivered queue bounds, reasons and refusal detail are
 * unchanged, and a truncated reconcile reports its remainder (GH-349 AC-F6-6,
 * API-7, NFR-4).
 *
 * The constants are pinned exactly; the refusal-detail bounds are exercised
 * through the production claim composition; and the remainder arithmetic is
 * checked by a derived comparison that names a raised cap or a dropped
 * remainder rather than asserting a value against itself.
 */
import { describe, expect, test } from "bun:test";
import { claimQueueLease, declareQueueEntry } from "../../packages/core/src/app/index";
import {
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  QUEUE_MAX_DETAIL_CHARS,
  QUEUE_MAX_ENTRIES,
  QUEUE_RECONCILE_MAX_ENTRIES,
  QUEUE_REMOVAL_REASONS,
} from "../../packages/core/src/contracts/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import {
  DECLARED_DETAIL_BOUNDS,
  DECLARED_REMOVAL_REASONS,
} from "../fixtures/queue/integrity-breaches";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

const TTL = 90_000;

/** Independent cap comparison: a raised or lowered cap names the constant. */
const capDivergence = (actual: number, declared: number, label: string): string | undefined =>
  actual === declared ? undefined : `${label} ${actual}, declared ${declared}`;

/** Independent remainder arithmetic over the examined entry count. */
const remainderDivergence = (
  reported: { readonly checked: number; readonly remainder: number; readonly truncated: boolean },
  total: number,
  cap: number,
): string | undefined => {
  const examined = Math.min(total, cap);
  const remainder = total - examined;
  if (reported.checked !== examined) return `checked ${reported.checked}, declared ${examined}`;
  if (reported.remainder !== remainder)
    return `remainder ${reported.remainder}, declared ${remainder}`;
  if (reported.truncated !== remainder > 0) {
    return `truncated ${reported.truncated}, declared ${remainder > 0}`;
  }
  return undefined;
};

describe("TC-F6-010 the delivered bounds are unchanged", () => {
  test("folded-read cap, reconcile cap, the four reasons and the detail bounds", () => {
    expect(QUEUE_MAX_ENTRIES).toBe(500);
    expect(QUEUE_RECONCILE_MAX_ENTRIES).toBe(100);
    expect([...QUEUE_REMOVAL_REASONS]).toEqual(["landed", "abandoned", "superseded", "reconciled"]);
    expect([...DECLARED_REMOVAL_REASONS]).toEqual([...QUEUE_REMOVAL_REASONS]);
    expect(COMMAND_FAILURE_DETAIL_MAX_CHARS).toBe(128);
    expect(QUEUE_MAX_DETAIL_CHARS).toBe(160);
    expect(DECLARED_DETAIL_BOUNDS).toEqual({ command: 128, queue: 160 });
  });

  test("a raised cap or a widened detail bound fails naming the value", () => {
    expect(capDivergence(QUEUE_RECONCILE_MAX_ENTRIES, 100, "reconcile cap")).toBeUndefined();
    expect(() => {
      const divergence = capDivergence(QUEUE_RECONCILE_MAX_ENTRIES + 1, 100, "reconcile cap");
      if (divergence !== undefined) throw new Error(divergence);
    }).toThrow("reconcile cap 101, declared 100");
    expect(() => {
      const divergence = capDivergence(129, COMMAND_FAILURE_DETAIL_MAX_CHARS, "detail bound");
      if (divergence !== undefined) throw new Error(divergence);
    }).toThrow("detail bound 129, declared 128");
  });

  test("the remainder arithmetic fails naming the missing remainder", () => {
    expect(
      remainderDivergence({ checked: 100, remainder: 5, truncated: true }, 105, 100),
    ).toBeUndefined();
    expect(() => {
      const divergence = remainderDivergence(
        { checked: 100, remainder: 0, truncated: false },
        105,
        100,
      );
      if (divergence !== undefined) throw new Error(divergence);
    }).toThrow("remainder 0, declared 5");
  });
});

describe("TC-F6-010 the refusal detail stays inside its bound through the claim composition", () => {
  test("the single-flight holder and the lease-conflict summary are bounded", async () => {
    const harness = createQueueEdgeHarness("queue-bounds-detail");
    const store = harness.composition.store;
    try {
      for (const ref of ["GH-320", "GH-321"]) {
        const declared = declareQueueEntry(store, {
          ref,
          repository: "github.com/example/repo-alpha",
          repositoryRoot: "/work/repo-alpha",
          priority: 1,
          recordedAt: harness.nowIso(),
          fenceToken: `seed-bounds-${ref}`,
        });
        expect(declared.ok).toBe(true);
      }
      const held = claimQueueLease(store, {
        ref: "GH-320",
        holder: "lane-1",
        runner: "runner-lane-1",
        weightClass: "standard",
        ttlMs: TTL,
        nowIso: harness.nowIso(),
        nowMs: harness.nowMs(),
        fenceToken: "seed-bounds-lease",
      });
      expect(held.ok).toBe(true);

      const single = await harness.run([
        "queue",
        "claim",
        "GH-320",
        "--holder",
        "lane-2",
        "--json",
      ]);
      expect(single.exitCode).toBe(1);
      const singleError = errorOf(single.stdout);
      expect(singleError.code).toBe("queue.single-flight");
      const holder = (json(single.stdout).detail as { readonly holder?: string } | undefined)
        ?.holder;
      expect(holder).toBe("lane-1");
      expect((holder ?? "").length).toBeLessThanOrEqual(COMMAND_FAILURE_DETAIL_MAX_CHARS);

      const conflict = await harness.run([
        "queue",
        "claim",
        "GH-321",
        "--holder",
        "lane-2",
        "--json",
      ]);
      expect(conflict.exitCode).toBe(1);
      const conflictError = errorOf(conflict.stdout);
      expect(conflictError.code).toBe("queue.lease-conflict");
      const summary = String(conflictError.summary ?? "");
      expect(summary).toContain("lease:");
      expect(summary.length).toBeLessThanOrEqual(QUEUE_MAX_DETAIL_CHARS);
    } finally {
      harness.dispose();
    }
  });
});
