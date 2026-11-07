/**
 * TC-SPEND-010 — capture-time phase attribution over transition windows, the
 * terminal rule, one entry per phase id, integer floored share, and the
 * partition of total spend across the phase entries.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeSessionRecord,
  removeRoot,
  type SpendSeed,
  SYNTHETIC_BRAND,
  tokens,
} from "../fixtures/spend/harness";
import {
  P_SHARED_STAMP,
  P01,
  P05,
  P06,
  P09,
  STAMPS,
  T0,
  T1,
  T2,
  T2A,
} from "../fixtures/spend/transitions";

const recordAt = (capturedAt: string, amount: number, suffix = capturedAt) =>
  makeSessionRecord({
    runId: `run-${suffix}`,
    sessionId: `ses-${suffix}`,
    capturedAt,
    tokens: tokens({ input: amount }),
  });

const withTransitions = (
  transitions: SpendSeed["transitions"],
  records: SpendSeed["records"],
): SpendSeed => ({ transitions, records });

describe("TC-SPEND-010 capture-time attribution", () => {
  test("P-01..P-04 select the window containing the stamp, boundary inclusive", () => {
    const { fold, root } = foldSeed(
      withTransitions(P01, [
        recordAt(STAMPS.beforeFirst, 100, "before"),
        recordAt(STAMPS.afterClarify, 200, "after-clarify"),
        recordAt(STAMPS.atSpecificationComplete, 300, "at-complete"),
        recordAt(T2 + 30 * 60_000, 400, "terminal"),
      ]),
      "attribution-p01",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.perPhase).toEqual([
        { phase: "clarify_scope", calls: 1, tokens: 100, share: 10 },
        { phase: "specification", calls: 2, tokens: 500, share: 50 },
        { phase: "delivery_planning", calls: 1, tokens: 400, share: 40 },
      ]);
      const total = fold.data.perPhase.reduce((sum, entry) => sum + entry.tokens, 0);
      expect(total).toBe(1000);
      expect(total).toBe(fold.data.tokensByClass.input);
    } finally {
      removeRoot(root);
    }
  });

  test("P-05/P-06 reopen the same phase and aggregate one entry per phase id", () => {
    const p05 = foldSeed(
      withTransitions(P05, [recordAt(T2A, 100, "reopen"), recordAt(T2 + 60_000, 50, "open")]),
      "attribution-p05",
    );
    const p06 = foldSeed(
      withTransitions(P06, [
        recordAt(T2 + 60_000, 100, "first-open"),
        recordAt(T2A + 60_000, 200, "second-open"),
      ]),
      "attribution-p06",
    );
    try {
      if (p05.fold === undefined || !p05.fold.ok) throw new Error("p05 fold failed");
      if (p06.fold === undefined || !p06.fold.ok) throw new Error("p06 fold failed");
      expect(p05.fold.data.perPhase).toEqual([
        { phase: "delivery_planning", calls: 2, tokens: 150, share: 100 },
      ]);
      expect(p06.fold.data.perPhase).toEqual([
        { phase: "delivery_planning", calls: 2, tokens: 300, share: 100 },
      ]);
    } finally {
      removeRoot(p05.root);
      removeRoot(p06.root);
    }
  });

  test("a shared complete/reopen stamp attributes to the reopened phase", () => {
    const { fold, root } = foldSeed(
      withTransitions(P_SHARED_STAMP, [recordAt(T2, 90, "shared")]),
      "attribution-shared",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.perPhase[0]?.phase).toBe("delivery_planning");
      expect(fold.data.tokensByClass.input).toBe(90);
    } finally {
      removeRoot(root);
    }
  });

  test("P-08 shares floor at 33 each and may not sum to 100", () => {
    const { fold, root } = foldSeed(
      withTransitions(P01, [
        recordAt(STAMPS.beforeFirst, 300, "clarify"),
        recordAt(STAMPS.afterClarify, 300, "spec"),
        recordAt(T2 + 60_000, 300, "planning"),
      ]),
      "attribution-shares",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.perPhase.map((entry) => entry.share)).toEqual([33, 33, 33]);
      const sum = fold.data.perPhase.reduce((total, entry) => total + entry.share, 0);
      expect(sum).toBe(99);
    } finally {
      removeRoot(root);
    }
  });

  test("P-10 a zero-token total yields share 0 with no division artefact", () => {
    const allNull = makeSessionRecord({
      runId: "run-null",
      capturedAt: T0,
      tokens: {
        input: null,
        output: null,
        reasoning: null,
        cacheRead: null,
        cacheWrite: null,
      },
    });
    const { fold, root } = foldSeed(withTransitions(P01, [allNull]), "attribution-zero");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.perPhase).toEqual([
        { phase: "clarify_scope", calls: 1, tokens: 0, share: 0 },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  test("P-09 a single terminal window carries the whole spend at share 100", () => {
    const { fold, root } = foldSeed(
      withTransitions(P09, [recordAt(T1, 250, "terminal-only")]),
      "attribution-terminal",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.perPhase).toEqual([
        { phase: "clarify_scope", calls: 1, tokens: 250, share: 100 },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  test("the human digest names the basis and renders one deterministic line per phase", () => {
    const { fold, root } = foldSeed(
      withTransitions(P01, [
        recordAt(STAMPS.beforeFirst, 100, "cl"),
        recordAt(STAMPS.afterClarify, 200, "sp"),
      ]),
      "attribution-human",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).toContain("capture-time windows (phase.transition)");
      expect(human).toContain("- clarify_scope: 1 calls, 100 tokens (33%)");
      expect(human).toContain("- specification: 1 calls, 200 tokens (66%)");
      const again = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(again).toBe(human);
    } finally {
      removeRoot(root);
    }
  });
});
