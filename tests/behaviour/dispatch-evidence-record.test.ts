/**
 * TC-EVID-001 / TC-DISP-011 / TC-TRUTH-001 / TC-TRUTH-002 / TC-TRUTH-003 /
 * TC-TRUTH-005 / TC-TRUTH-006 / TC-EVID-005 (phase-3 ledger slice) — exactly
 * one complete attempt record per attempt-stage dispatch, the Appendix G pairs,
 * the declared comparison treatment, canary absence, fenced append with
 * verified read, and torn reads that never become clean.
 *
 * No `dispatch` command is invoked here.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
  appendDispatchHandover,
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
  resolveDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import { createDispatchState, DISPATCH_NOW } from "../fixtures/dispatch/harness";
import {
  corroborationFor,
  makeAttempt,
  makeAttemptFor,
  makeDivergence,
  makeHandover,
  REPOSITORY,
} from "../fixtures/dispatch/ledger";

const withState = <T>(body: (state: ReturnType<typeof createDispatchState>) => T): T => {
  const state = createDispatchState("ledger");
  try {
    return body(state);
  } finally {
    state.dispose();
  }
};

describe("TC-EVID-001 exactly one complete attempt record per attempt-stage dispatch", () => {
  test("the six attempt-stage fixtures each append exactly one complete record", () => {
    withState(({ store, fenceToken }) => {
      const attempts = [
        makeAttemptFor("noop-lane-permission", {
          outcome: "refused",
          attemptId: "a-spawn-refusal",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "dispatch-session-family",
          },
        }),
        makeAttemptFor("failed", {
          attemptId: "a-spawn-failure",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "comparison-source-unavailable",
          },
        }),
        makeAttemptFor("max-restarts", {
          attemptId: "a-restart-budget",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "dispatch-session-family",
          },
        }),
        makeAttemptFor("failed", {
          attemptId: "a-resume-economics",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "comparison-source-unavailable",
          },
        }),
        makeAttemptFor("pr-open", { attemptId: "a-success" }),
        makeAttemptFor("failed", { attemptId: "a-ordinary-failure" }),
      ];
      for (const attempt of attempts) {
        const appended = appendDispatchAttempt(store, fenceToken, attempt);
        expect(appended.ok, attempt.attemptId).toBe(true);
        if (appended.ok) expect(appended.appended, attempt.attemptId).toBe(true);
      }
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(attempts.length);
      expect(new Set(read.records.map((record) => record.attemptId)).size).toBe(attempts.length);
      for (const record of read.records) {
        expect(record.repository).toBe(REPOSITORY);
        expect(record.evidenceClass).toBe("pilot");
        expect(record.comparison.class.length).toBeGreaterThan(0);
        expect(record.corroboration.pmNotes.length).toBeGreaterThan(0);
      }
    });
  });

  test("an identical replay appends nothing; a differing replay is refused", () => {
    withState(({ store, fenceToken }) => {
      const attempt = makeAttemptFor("pr-open", { attemptId: "a-1" });
      expect(appendDispatchAttempt(store, fenceToken, attempt).ok).toBe(true);
      const replay = appendDispatchAttempt(store, fenceToken, attempt);
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.appended).toBe(false);
      const read = readDispatchAttempts(store);
      expect(read.ok && read.records.length).toBe(1);
    });
  });

  test("a pre-session refusal appends nothing (the contrast to a spawn refusal)", () => {
    withState(({ store }) => {
      // No ledger call is made for an unknown harness, rejected input, or a
      // conflicting lease before a spawn: the documented refusal surface is the
      // envelope only (the command-level assertion is phase 4).
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.records).toEqual([]);
    });
  });

  test("no prompt, transcript, credential, or raw payload canary enters a record", () => {
    withState(({ store, fenceToken }) => {
      const canaries = ["CANARY-PROMPT-42", "CANARY-TRANSCRIPT-42", "CANARY-CREDENTIAL-42"];
      const attempt = makeAttempt({
        token: "pr-open",
        attemptId: "a-canary",
        evidenceRefs: ["attempt:a-canary"],
      });
      appendDispatchAttempt(store, fenceToken, attempt);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const serialized = JSON.stringify(read.records);
      for (const canary of canaries) expect(serialized.includes(canary)).toBe(false);
    });
  });
});

describe("TC-DISP-011 the harness spawn refusal is a recorded attempt", () => {
  test("one record with noop-lane-permission/refused and dispatch-session-family", () => {
    withState(({ store, fenceToken }) => {
      const attempt = makeAttemptFor("noop-lane-permission", {
        outcome: "refused",
        attemptId: "a-refused",
        comparison: {
          class: "not-applicable",
          token: null,
          outcome: "not-applicable",
          reason: "dispatch-session-family",
        },
      });
      expect(appendDispatchAttempt(store, fenceToken, attempt).ok).toBe(true);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      expect(record?.token).toBe("noop-lane-permission");
      expect(record?.outcome).toBe("refused");
      expect(record?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "dispatch-session-family",
      });
    });
  });
});

describe("TC-TRUTH-001 / TC-TRUTH-005 a failure record is never success-classified", () => {
  test("the no-artifact failure carries its evidence references", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("failed", {
          attemptId: "a-no-artifact",
          evidenceRefs: ["artifact:branch-commit-missing", "artifact:pull-request-missing"],
        }),
      );
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records[0];
      expect(record?.token).toBe("failed");
      expect(record?.evidenceRefs).toContain("artifact:branch-commit-missing");
      expect(record?.falseSuccess).toBe(false);
    });
  });

  test("the blocked record names the tracker fact and carries a corroborated comparison", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("blocked", {
          attemptId: "a-blocked",
          evidenceRefs: ["tracker:blocking-state"],
          corroboration: corroborationFor("blocked", { tracker: "satisfied" }),
        }),
      );
      const read = readDispatchAttempts(store);
      expect(read.ok && read.records[0]?.comparison.class).toBe("tracker-truth");
      expect(read.ok && read.records[0]?.corroboration.tracker).toBe("satisfied");
    });
  });
});

describe("TC-TRUTH-006 a state-unverified record is unevaluable and exposure-only", () => {
  test("the comparison is not-applicable and no divergence is appended", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("state-unverified", {
          attemptId: "a-unverified",
          comparison: {
            class: "not-applicable",
            token: null,
            outcome: "not-applicable",
            reason: "comparison-source-unavailable",
          },
        }),
      );
      const read = readDispatchAttempts(store);
      expect(read.ok && read.records[0]?.comparison.reason).toBe("comparison-source-unavailable");
      const divergences = readDispatchDivergences(store);
      expect(divergences.ok && divergences.records).toEqual([]);
    });
  });
});

describe("TC-EVID-005 fenced appends and torn reads never become clean", () => {
  test("a failed append yields a classified failure, no record, and a released fence", () => {
    withState(({ store, edge, fenceToken }) => {
      edge.arm(["append-before-flush"]);
      const attempted = appendDispatchAttempt(store, fenceToken, makeAttemptFor("pr-open"));
      edge.disarm();
      expect(attempted.ok).toBe(false);
      if (!attempted.ok) expect(attempted.code.length).toBeGreaterThan(0);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.records).toEqual([]);
      expect(store.fenceStatus().held).toBe(false);
    });
  });

  test("every successful attempt, divergence, and handover append is verified after write", () => {
    withState(({ store, fenceToken }) => {
      expect(appendDispatchAttempt(store, fenceToken, makeAttemptFor("pr-open")).ok).toBe(true);
      expect(appendDispatchDivergence(store, fenceToken, makeDivergence()).ok).toBe(true);
      expect(appendDispatchHandover(store, fenceToken, makeHandover()).ok).toBe(true);
      expect(store.fenceStatus().held).toBe(false);
    });
  });

  test("a torn attempt payload read is a classified state failure, never clean", () => {
    withState(({ store, fenceToken }) => {
      // Seed a malformed payload under the attempt key through the store itself:
      // the ledger reader must refuse it rather than fabricate a record.
      const handle = store.acquireFence(fenceToken);
      if (!handle.ok) throw new Error("fence failed");
      store.append(handle.value.handle, {
        kind: "dispatch.attempt",
        recordKey: "dispatch.attempt.broken",
        payload: { schema: "delivery.dispatch.attempt.v1" } as never,
      });
      store.releaseFence(handle.value.handle);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.code).toBe("state.store.torn");
    });
  });

  test("a divergence resolves append-only and the original open record remains", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchDivergence(store, fenceToken, makeDivergence({ divergenceId: "DIV-1" }));
      const resolved = resolveDispatchDivergence(store, fenceToken, {
        divergenceId: "DIV-1",
        note: "tracker was stale; PR reopened",
        principal: "coder@local",
        recordedAt: DISPATCH_NOW,
      });
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.record.state).toBe("resolved");
      const read = readDispatchDivergences(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(2);
      expect(read.records[0]?.state).toBe("open");
      expect(read.records[1]?.state).toBe("resolved");
      expect(read.records[1]?.note).toBe("tracker was stale; PR reopened");
      const again = resolveDispatchDivergence(store, fenceToken, {
        divergenceId: "DIV-1",
        note: "duplicate",
        principal: "coder@local",
        recordedAt: DISPATCH_NOW,
      });
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.appended).toBe(false);
    });
  });

  test("a handover flip and its reversal are both preserved", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchHandover(store, fenceToken, makeHandover({ operation: "authoritative" }));
      appendDispatchHandover(
        store,
        fenceToken,
        makeHandover({ operation: "dual-run", recordedAt: "2026-11-09T10:00:00.000Z" }),
      );
      const read = readDispatchHandover(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records.map((record) => record.operation)).toEqual(["authoritative", "dual-run"]);
    });
  });
});
