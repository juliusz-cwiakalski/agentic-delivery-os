/**
 * TC-EVID-007 (phase-3 unit slice) / TC-TRUTH-002 / TC-TRUTH-003 — the one
 * declared comparison record shape and its four invariants across all eleven
 * tokens, the family-wise baseline, and divergence-if-and-only-if-mismatch.
 */
import { describe, expect, test } from "bun:test";
import {
  buildComparisonRecord,
  dispatchFamilyOf,
  isComparisonDivergence,
  isComparisonShapeValid,
} from "../../packages/core/src/domain/dispatch-comparison";
import {
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
} from "../../packages/core/src/contracts/index";
import { comparisonForToken } from "../fixtures/dispatch/ledger";

describe("TC-EVID-007 comparison record shape across the eleven tokens", () => {
  test("every token resolves one declared shape and the four invariants hold", () => {
    for (const token of DELIVERY_RESULT_TOKENS) {
      const record = comparisonForToken(token);
      expect(isComparisonShapeValid(record), token).toBe(true);
      expect(record.token === null, token).toBe(record.class === "not-applicable");
      expect(record.outcome === "not-applicable", token).toBe(record.class === "not-applicable");
    }
  });

  test("each family resolves to its declared class", () => {
    for (const token of DELIVERY_RESULT_TOKENS) {
      const family = dispatchFamilyOf(token);
      const record = comparisonForToken(token);
      const expected =
        family === "dispatch-session" || token === "state-unverified"
          ? "not-applicable"
          : family === "tracker-pr"
            ? "tracker-truth"
            : "verify-change";
      expect(record.class, token).toBe(expected);
    }
  });

  test("state-unverified and the dispatch-derived failures are not-applicable", () => {
    const unverified = comparisonForToken("state-unverified");
    expect(unverified).toMatchObject({
      class: "not-applicable",
      token: null,
      outcome: "not-applicable",
      reason: "comparison-source-unavailable",
    });
    expect(comparisonForToken("max-restarts").reason).toBe("dispatch-session-family");
    expect(comparisonForToken("noop-lane-permission").reason).toBe("dispatch-session-family");
    expect(comparisonForToken("noop-lane-nothing-to-do").reason).toBe("dispatch-session-family");
  });

  test("pr-open-unverified compares to independent tracker truth pr-open with urlResolved false", () => {
    const record = comparisonForToken("pr-open-unverified", { urlResolved: false });
    expect(record).toMatchObject({
      class: "tracker-truth",
      token: "pr-open",
      outcome: "match",
      urlResolved: false,
    });
    expect(isComparisonDivergence(record)).toBe(false);
  });
});

describe("TC-EVID-007 divergence exists if and only if the outcome is mismatch", () => {
  test("a mismatch is a divergence; match and not-applicable are not", () => {
    const mismatch = buildComparisonRecord({
      kind: "tracker-truth",
      engineToken: "pr-open",
      trackerToken: "blocked",
    });
    expect(mismatch.outcome).toBe("mismatch");
    expect(isComparisonDivergence(mismatch)).toBe(true);
    expect(isComparisonDivergence(comparisonForToken("pr-open"))).toBe(false);
    expect(isComparisonDivergence(comparisonForToken("max-restarts"))).toBe(false);
  });

  test("a verify-class token compares by exact token equality", () => {
    const match = buildComparisonRecord({
      kind: "verify-change",
      engineToken: "finished",
      ledgerOutcome: "finished",
    });
    expect(match.outcome).toBe("match");
    const differ = buildComparisonRecord({
      kind: "verify-change",
      engineToken: "finished",
      ledgerOutcome: "partial",
    });
    expect(differ.outcome).toBe("mismatch");
  });

  test("an unreadable verify-change source is not-applicable, never agreement", () => {
    const record = buildComparisonRecord({
      kind: "verify-change",
      engineToken: "finished",
      ledgerOutcome: null,
    });
    expect(record.class).toBe("not-applicable");
    expect(record.outcome).toBe("not-applicable");
  });
});

describe("TC-GATE-008 family isolation", () => {
  test("a cross-family pairing is rejected, not counted as agreement", () => {
    const verifyToken: DeliveryResultToken = "finished";
    expect(() =>
      buildComparisonRecord({
        kind: "tracker-truth",
        engineToken: verifyToken,
        trackerToken: "pr-open",
      }),
    ).toThrow();
    expect(() =>
      buildComparisonRecord({
        kind: "verify-change",
        engineToken: "pr-open",
        ledgerOutcome: "pr-open",
      }),
    ).toThrow();
    expect(() =>
      buildComparisonRecord({
        kind: "tracker-truth",
        engineToken: "pr-open",
        trackerToken: "finished",
      }),
    ).toThrow();
  });
});
