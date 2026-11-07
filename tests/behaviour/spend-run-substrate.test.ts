/**
 * TC-SPEND-019 — restarts and amplification share one run substrate: the event
 * count is bounded by the restart count, a capture-outcome-only run never
 * becomes the progress run, and the two evidence bases are disclosed together.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import { A01, A02, A06, A07, A08, A11, type AmplificationCase } from "../fixtures/spend/cases";
import { foldSeed, removeRoot, SYNTHETIC_BRAND } from "../fixtures/spend/harness";

const foldOf = (testCase: AmplificationCase, label: string) => {
  const folded = foldSeed(testCase.seed, label);
  if (folded.fold === undefined || !folded.fold.ok) {
    removeRoot(folded.root);
    throw new Error(`${testCase.id} fold failed`);
  }
  return { data: folded.fold.data, root: folded.root };
};

describe("TC-SPEND-019 one run substrate", () => {
  test("the event count never exceeds the restart count", () => {
    for (const testCase of [A01, A02, A06, A07, A08, A11]) {
      const { data, root } = foldOf(testCase, `substrate-${testCase.id}`);
      try {
        expect(data.amplification.events.length).toBeLessThanOrEqual(data.restarts);
        expect(data.amplification.events).toHaveLength(testCase.events.length);
      } finally {
        removeRoot(root);
      }
    }
  });

  test("a capture-outcome-only run raises restarts, adds no paid and raises no event", () => {
    const { data, root } = foldOf(A06, "substrate-a06");
    try {
      expect(data.restarts).toBe(2);
      expect(data.amplification.events).toHaveLength(1);
      expect(data.amplification.events[0]?.tokensWasted).toBe(500);
      expect(data.amplification.progressRun).toBeNull();
    } finally {
      removeRoot(root);
    }
  });

  test("a superseded zero-spend run diverges the two readouts exactly as pinned", () => {
    const { data, root } = foldOf(A07, "substrate-a07");
    try {
      expect(data.restarts).toBe(2);
      expect(data.amplification.events).toHaveLength(1);
      expect(data.amplification.progressRun).toBeNull();
    } finally {
      removeRoot(root);
    }
  });

  test("a duplicate identity counts once in both readouts", () => {
    const { data, root } = foldOf(A08, "substrate-a08");
    try {
      expect(data.restarts).toBe(0);
      expect(data.amplification.events).toEqual([]);
      expect(data.amplification.ratio).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("a capture-outcome-only run is never the progress run", () => {
    const { data, root } = foldOf(A11, "substrate-a11");
    try {
      expect(data.amplification.progressRun).toBeNull();
      expect(data.amplification.ratio).toBeNull();
      expect(data.restarts).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("the report discloses both bases in the same terms", () => {
    const { data, root } = foldOf(A01, "substrate-human-healthy");
    const amplified = foldOf(A02, "substrate-human-loop");
    try {
      const healthy = renderSpendHuman(data, {
        brand: SYNTHETIC_BRAND,
        amplification: true,
      });
      expect(healthy).toContain("(runs that reached closeout capture)");
      expect(healthy).toContain("no superseded record-bearing run");
      const loop = renderSpendHuman(amplified.data, {
        brand: SYNTHETIC_BRAND,
        amplification: true,
      });
      expect(loop).toContain("(runs that reached closeout capture)");
      expect(loop).toContain("events     3");
    } finally {
      removeRoot(root);
      removeRoot(amplified.root);
    }
  });
});
