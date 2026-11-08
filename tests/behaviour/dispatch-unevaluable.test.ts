/**
 * TC-EVID-004 (phase-3 ledger slice) — record-level degradation is distinct
 * from window-level unverifiability. A non-success record whose comparison
 * source cannot be read stays unevaluable and exposure-only; a success claim
 * whose corroboration source cannot be read fails corroboration as one named
 * condition, creates no divergence, and resets no window.
 *
 * The window-level fixtures are asserted by phase 6.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
  readDispatchDivergences,
} from "../../packages/core/src/app/dispatch-ledger";
import { corroborationSatisfied } from "../../packages/core/src/domain/dispatch-comparison";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { makeAttemptFor } from "../fixtures/dispatch/ledger";

const withState = <T>(body: (state: ReturnType<typeof createDispatchState>) => T): T => {
  const state = createDispatchState("unevaluable");
  try {
    return body(state);
  } finally {
    state.dispose();
  }
};

describe("TC-EVID-004 record-level degradation degrades only that record", () => {
  test("fixture A: an unreadable comparison source is not-applicable and exposure-only", () => {
    withState(({ store, fenceToken }) => {
      const attempt = makeAttemptFor("state-unverified", {
        attemptId: "a-unevaluable",
        comparison: {
          class: "not-applicable",
          token: null,
          outcome: "not-applicable",
          reason: "comparison-source-unavailable",
        },
      });
      expect(appendDispatchAttempt(store, fenceToken, attempt).ok).toBe(true);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.comparison.class).toBe("not-applicable");
      expect(read.records[0]?.token).toBe("state-unverified");
      const divergences = readDispatchDivergences(store);
      expect(divergences.ok && divergences.records).toEqual([]);
    });
  });

  test("fixture B: an unreadable corroboration source fails corroboration, not the record", () => {
    withState(({ store, fenceToken }) => {
      const attempt = makeAttemptFor("pr-open", {
        attemptId: "a-uncorroborated",
        corroboration: { pmNotes: "not-applicable", tracker: "unsatisfied", ci: "not-applicable" },
      });
      expect(appendDispatchAttempt(store, fenceToken, attempt).ok).toBe(true);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records[0];
      expect(record?.token).toBe("pr-open");
      expect(record?.corroboration.tracker).toBe("unsatisfied");
      expect(corroborationSatisfied(record?.corroboration ?? { pmNotes: "satisfied", tracker: "satisfied", ci: "satisfied" })).toBe(false);
      // No divergence is created by a corroboration failure.
      const divergences = readDispatchDivergences(store);
      expect(divergences.ok && divergences.records).toEqual([]);
    });
  });

  test("the two degradation scopes are recorded as distinct facts", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("failed", {
          attemptId: "a-record-degraded",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "comparison-source-unavailable",
          },
        }),
      );
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("pr-open", {
          attemptId: "a-corroboration-degraded",
          corroboration: { pmNotes: "satisfied", tracker: "unsatisfied", ci: "satisfied" },
        }),
      );
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.comparison.class).toBe("not-applicable");
      expect(read.records[1]?.comparison.class).toBe("tracker-truth");
      expect(read.records).toHaveLength(2);
    });
  });
});
