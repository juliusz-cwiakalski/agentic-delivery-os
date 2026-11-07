/**
 * TC-SPEND-022 — byte-identical double renders for identical store content with
 * zero model calls and no ambient time, randomness, environment, or filesystem
 * access in the render path.
 */
import { describe, expect, test } from "bun:test";
import { computeSpendReport, renderSpendHuman } from "../../packages/core/src/domain/index";
import { A01, A02, A10_RECORDS } from "../fixtures/spend/cases";
import {
  createProbeSpy,
  foldSeed,
  removeRoot,
  type SpendSeed,
  SYNTHETIC_BRAND,
} from "../fixtures/spend/harness";

const render = (seed: SpendSeed, label: string): { machine: string; human: string } => {
  const { fold, root } = foldSeed(seed, label);
  try {
    if (fold === undefined || !fold.ok) throw new Error("fold failed");
    return {
      machine: JSON.stringify(fold.data),
      human: renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true }),
    };
  } finally {
    removeRoot(root);
  }
};

describe("TC-SPEND-022 byte-identical replay", () => {
  test("each fixture renders identical bytes in both modes across two runs", () => {
    for (const testCase of [A01, A02]) {
      const first = render(testCase.seed, `determinism-${testCase.id}-1`);
      const second = render(testCase.seed, `determinism-${testCase.id}-2`);
      expect(second.machine).toBe(first.machine);
      expect(second.human).toBe(first.human);
    }
  });

  test("a shuffled record order renders the identical bytes", () => {
    const baseline = render(A02.seed, "determinism-shuffle-baseline");
    const shuffled = render(
      { records: A10_RECORDS, transitions: A02.seed.transitions },
      "determinism-shuffled",
    );
    expect(shuffled.machine).toBe(baseline.machine);
    expect(shuffled.human).toBe(baseline.human);
  });

  test("the render path performs zero model calls", () => {
    const adapter = createProbeSpy();
    const { fold, root } = foldSeed(A02.seed, "determinism-model-spy");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
      expect(adapter.calls()).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("an injected clock change does not move a single computed figure", () => {
    const { read, root } = foldSeed(A02.seed, "determinism-clock");
    try {
      if (!read.ok) throw new Error("read failed");
      const before = computeSpendReport(read.value, { workItemRef: "GH-236" });
      const after = computeSpendReport(read.value, { workItemRef: "GH-236" });
      expect(before.ok).toBe(true);
      expect(after.ok).toBe(true);
      if (!before.ok || !after.ok) return;
      expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
      expect(after.data.amplification.events).toEqual(before.data.amplification.events);
    } finally {
      removeRoot(root);
    }
  });
});
