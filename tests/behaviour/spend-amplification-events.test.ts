/**
 * TC-SPEND-015 — one named, windowed, quantified amplification event per
 * superseded positive-spend run, with deterministic ordering and an unchanged
 * machine shape under either insertion order.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import { A02, A10_RECORDS } from "../fixtures/spend/cases";
import { foldSeed, removeRoot, SYNTHETIC_BRAND } from "../fixtures/spend/harness";
import { T0 } from "../fixtures/spend/transitions";

describe("TC-SPEND-015 amplification events", () => {
  test("exactly three events, one per superseded run, none for the progress run", () => {
    const { fold, root } = foldSeed(A02.seed, "amplification-events");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      const events = fold.data.amplification.events;
      expect(events).toHaveLength(3);
      expect(events.map((event) => event.tokensWasted)).toEqual([5_000_000, 3_000_000, 2_000_000]);
      for (const event of events) expect(event.cause).toBe("restart-loop prefill re-pay");
      expect(fold.data.amplification.progressRun).toBeNull();
    } finally {
      removeRoot(root);
    }
  });

  test("each window starts at the previous run's capture and ends at this run's", () => {
    const { fold, root } = foldSeed(A02.seed, "amplification-windows");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.amplification.events).toEqual(A02.events);
      expect(fold.data.amplification.events[0]?.window.start).toBe(T0);
    } finally {
      removeRoot(root);
    }
  });

  test("the wasted total equals paid minus progress", () => {
    const { fold, root } = foldSeed(A02.seed, "amplification-decomposition");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const wasted = fold.data.amplification.events.reduce(
        (sum, event) => sum + event.tokensWasted,
        0,
      );
      const progress = A02.progress;
      if (progress === null) throw new Error("fixture progress must be positive");
      expect(wasted).toBe(A02.paid - progress);
    } finally {
      removeRoot(root);
    }
  });

  test("a reversed insertion order yields the identical event array", () => {
    const { fold, root } = foldSeed(
      { records: A10_RECORDS, transitions: A02.seed.transitions },
      "amplification-permuted",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const baseline = foldSeed(A02.seed, "amplification-baseline");
      try {
        if (baseline.fold === undefined || !baseline.fold.ok) throw new Error("baseline failed");
        expect(fold.data.amplification).toEqual(baseline.fold.data.amplification);
        expect(fold.data.amplification.events).toEqual(A02.events);
      } finally {
        removeRoot(baseline.root);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a no-transition variant produces point windows for the first event", () => {
    const { fold, root } = foldSeed(
      { records: A02.seed.records, transitions: [] },
      "amplification-point-window",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const first = fold.data.amplification.events[0];
      expect(fold.data.amplification.events).toHaveLength(3);
      expect(first?.window.start).toBe(first?.window.end);
    } finally {
      removeRoot(root);
    }
  });

  test("the human section names each event with its window and wasted tokens", () => {
    const { fold, root } = foldSeed(A02.seed, "amplification-human");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: true,
      });
      expect(human).toContain("events     3");
      expect(human).toContain("restart-loop prefill re-pay [");
      expect(human).toContain("5000000 tokens wasted");
      const withoutFlag = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(withoutFlag).not.toContain("restart-loop prefill re-pay");
      expect(withoutFlag).not.toContain("events     3");
    } finally {
      removeRoot(root);
    }
  });
});
