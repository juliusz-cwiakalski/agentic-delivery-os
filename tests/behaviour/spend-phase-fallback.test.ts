/**
 * TC-SPEND-011 — a ref with captured telemetry and no transition history puts
 * every record in the single named `unknown` window and discloses the fallback.
 */
import { describe, expect, test } from "bun:test";
import { SPEND_PHASE_UNKNOWN } from "../../packages/core/src/contracts/index";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeSessionRecord,
  removeRoot,
  SYNTHETIC_BRAND,
  tokens,
} from "../fixtures/spend/harness";

const seed = {
  transitions: [],
  records: [
    makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 100 }), calls: 2 }),
    makeSessionRecord({
      runId: "run-R1",
      sessionId: "ses-2",
      agent: "coder",
      model: "opus",
      tokens: tokens({ output: 50 }),
      calls: 1,
    }),
  ],
};

describe("TC-SPEND-011 no transitions falls back to the named unknown window", () => {
  test("every record lands in the single unknown entry with all the spend", () => {
    const { fold, root } = foldSeed(seed, "phase-fallback");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.perPhase).toEqual([{ phase: "unknown", calls: 3, tokens: 150, share: 100 }]);
      expect(SPEND_PHASE_UNKNOWN).toBe("unknown");
      expect(fold.data.tokensByClass.input).toBe(100);
      expect(fold.data.tokensByClass.output).toBe(50);
    } finally {
      removeRoot(root);
    }
  });

  test("the human digest names the attribution fallback explicitly", () => {
    const { fold, root } = foldSeed(seed, "phase-fallback-human");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).toContain(
        "- unknown: 3 calls, 150 tokens (100%) (no phase evidence; attribution fallback)",
      );
      expect(human).not.toContain("clarify_scope");
    } finally {
      removeRoot(root);
    }
  });

  test("an absent transition history is a success, never telemetry-absent", () => {
    const { fold, read, root } = foldSeed(seed, "phase-fallback-success");
    try {
      expect(read.ok).toBe(true);
      expect(fold?.ok).toBe(true);
      if (read.ok) expect(read.value.transitionsPresent).toBe(false);
    } finally {
      removeRoot(root);
    }
  });
});
