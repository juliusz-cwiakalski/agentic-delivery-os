/**
 * TC-SPEND-004 / TC-SPEND-033 — null token classes are excluded from every sum
 * and never fabricated, and warnings from both telemetry families are counted
 * by their closed reason.
 */
import { describe, expect, test } from "bun:test";
import { HARNESS_WARNING_REASONS } from "../../packages/core/src/contracts/index";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeOutcomeRecord,
  makeSessionRecord,
  removeRoot,
  SYNTHETIC_BRAND,
  tokens,
  warning,
  type SpendSeed,
} from "../fixtures/spend/harness";

const degraded: SpendSeed = {
  records: [
    makeSessionRecord({
      runId: "run-R1",
      tokens: tokens({
        input: 10,
        output: 10,
        reasoning: 10,
        cacheRead: 10,
        cacheWrite: 10,
      }),
    }),
    makeSessionRecord({
      runId: "run-R1",
      sessionId: "ses-degraded-1",
      tokens: tokens({ input: 20, output: 20, reasoning: null }),
      warnings: [warning("optional-field-absent")],
    }),
    makeSessionRecord({
      runId: "run-R2",
      sessionId: "ses-degraded-2",
      tokens: tokens({ input: 30, cacheWrite: null }),
      warnings: [warning("non-numeric-value", "tokens.cacheWrite")],
    }),
    makeSessionRecord({
      runId: "run-R2",
      sessionId: "ses-degraded-3",
      tokens: tokens({ input: 40 }),
      cost: null,
      warnings: [warning("cost-missing", "cost")],
    }),
    makeSessionRecord({
      runId: "run-R3",
      sessionId: "ses-degraded-4",
      tokens: tokens({ input: 50 }),
      warnings: [warning("truncated", "toolCounts")],
    }),
  ],
  outcomes: [
    makeOutcomeRecord({
      runId: "run-R2",
      degraded: 2,
      warnings: [warning("session-capture-failed", "sessions")],
    }),
  ],
};

describe("TC-SPEND-004 null classes are excluded, never fabricated", () => {
  test("each class total equals the non-null oracle and the record still counts", () => {
    const { fold, root } = foldSeed(degraded, "degradation");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.tokensByClass).toEqual({
        input: 150,
        output: 30,
        reasoning: 10,
        cacheRead: 10,
        cacheWrite: 10,
      });
      // The null-class records still contribute their non-null classes and calls.
      expect(fold.data.perAgent[0]?.calls).toBe(5);
    } finally {
      removeRoot(root);
    }
  });

  test("degradation counts records bearing warnings, not warning instances", () => {
    const { fold, root } = foldSeed(degraded, "degradation-counts");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.degradation.records).toBe(5);
      expect(fold.data.degradation.byReason).toEqual({
        "optional-field-absent": 1,
        "non-numeric-value": 1,
        "cost-missing": 1,
        "version-drift": 0,
        "malformed-line": 0,
        truncated: 1,
        "session-capture-failed": 1,
        "unattributable-session": 0,
        "invalid-session-identity": 0,
      });
      expect(Object.keys(fold.data.degradation.byReason).sort()).toEqual(
        [...HARNESS_WARNING_REASONS].sort(),
      );
    } finally {
      removeRoot(root);
    }
  });

  test("the digest renders the disclosure in band and the report still succeeds", () => {
    const { fold, root } = foldSeed(degraded, "degradation-human");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).toContain("degradation 5 record(s) with warnings");
      expect(human).toContain("optional-field-absent=1");
      expect(human).toContain("session-capture-failed=1");
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-SPEND-033 capture-outcome warnings never vanish", () => {
  test("an outcome-side warning is accounted while the session records are clean", () => {
    const { fold, root } = foldSeed(
      {
        records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }) })],
        outcomes: [
          makeOutcomeRecord({
            runId: "run-R1",
            captured: 0,
            failed: 1,
            warnings: [warning("session-capture-failed", "sessions")],
          }),
        ],
      },
      "degradation-outcome-warning",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.degradation.byReason["session-capture-failed"]).toBe(1);
      expect(fold.data.degradation.records).toBe(1);
      expect(fold.data.tokensByClass.input).toBe(10);
    } finally {
      removeRoot(root);
    }
  });

  test("a session-side truncation is counted while the outcome side stays zero", () => {
    const { fold, root } = foldSeed(
      {
        records: [
          makeSessionRecord({
            runId: "run-R1",
            tokens: tokens({ input: 10 }),
            warnings: [warning("truncated", "toolCounts")],
          }),
        ],
        outcomes: [makeOutcomeRecord({ runId: "run-R1", warnings: [] })],
      },
      "degradation-session-warning",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.degradation.byReason.truncated).toBe(1);
      expect(fold.data.degradation.byReason["session-capture-failed"]).toBe(0);
      expect(fold.data.degradation.records).toBe(1);
    } finally {
      removeRoot(root);
    }
  });
});
