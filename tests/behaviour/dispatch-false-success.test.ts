/**
 * TC-EVID-003 (phase-3 ledger slice) — a contradicted engine success claim is
 * durable as a false-success incident with bounded evidence references and its
 * completion timestamp; it is never counted clean. The exclusive window slice
 * is phase 6.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
} from "../../packages/core/src/app/dispatch-ledger";
import { classifyFalseSuccess } from "../../packages/core/src/domain/dispatch-comparison";
import { deriveDispatchResult } from "../../packages/core/src/domain/dispatch-result";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  COMPLETED_EVIDENCE,
  createDispatchState,
  DISPATCH_NOW,
} from "../fixtures/dispatch/harness";
import { makeAttemptFor } from "../fixtures/dispatch/ledger";
import {
  artifacts,
  ledger,
  prMerged,
  prNone,
  readFail,
  readOk,
  truthInput,
} from "../fixtures/dispatch/truth";

describe("TC-EVID-003 a false success is recorded, never clean", () => {
  test("an engine success claim contradicted by truth is a false-success incident", () => {
    // The engine claimed an open PR; independent truth reports no PR and no
    // pushed head, so the artifact-first derivation refuses the claim.
    const derivation = deriveDispatchResult(
      truthInput({
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
        ledger: readOk(ledger({ progressed: false })),
      }),
    );
    expect(derivation.token).toBe("failed");

    const falseSuccess = true;
    const corroboration = {
      pmNotes: "satisfied" as const,
      tracker: "unsatisfied" as const,
      ci: "unsatisfied" as const,
    };
    expect(
      classifyFalseSuccess({
        token: "pr-open",
        comparison: { class: "tracker-truth", token: "pr-open", outcome: "match" },
        corroboration,
      }),
    ).toBe(true);

    const state = createDispatchState("false-success");
    try {
      const attempt = makeAttemptFor("failed", {
        attemptId: "a-incident",
        falseSuccess,
        recordedAt: DISPATCH_NOW,
        evidenceRefs: ["tracker:no-open-pr", "ci:no-pushed-head"],
        corroboration,
      });
      expect(appendDispatchAttempt(state.store, state.fenceToken, attempt).ok).toBe(true);
      const read = readDispatchAttempts(state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records[0];
      expect(record?.falseSuccess).toBe(true);
      expect(record?.recordedAt).toBe(DISPATCH_NOW);
      expect(record?.evidenceRefs).toEqual(["tracker:no-open-pr", "ci:no-pushed-head"]);
      // Bounded references only: no raw provider payload or transcript canary.
      expect(JSON.stringify(record).includes("payload")).toBe(false);
    } finally {
      state.dispose();
    }
  });

  test("a corroborated success claim is not an incident", () => {
    expect(
      classifyFalseSuccess({
        token: "pr-open",
        comparison: { class: "tracker-truth", token: "pr-open", outcome: "match" },
        corroboration: { pmNotes: "not-applicable", tracker: "satisfied", ci: "not-applicable" },
      }),
    ).toBe(false);
  });

  test("a non-success token never claims success, so it is not an incident", () => {
    for (const token of [
      "failed",
      "partial",
      "max-restarts",
      "state-unverified",
      "noop-lane-permission",
    ] as const) {
      expect(
        classifyFalseSuccess({
          token,
          comparison: { class: "not-applicable", token: null, outcome: "not-applicable" },
          corroboration: {
            pmNotes: "not-applicable",
            tracker: "not-applicable",
            ci: "not-applicable",
          },
        }),
        token,
      ).toBe(false);
    }
  });
});

describe("TC-EVID-004 an unreadable corroboration source is unevaluable, not a contradiction", () => {
  test("the classifier distinguishes an unreadable source from a contradicted one", () => {
    expect(
      classifyFalseSuccess({
        token: "merged",
        comparison: {
          class: "tracker-truth",
          token: "merged",
          outcome: "match",
          urlResolved: true,
        },
        corroboration: { pmNotes: "satisfied", tracker: "satisfied", ci: "unsatisfied" },
        unreadable: ["ci"],
      }),
    ).toBe(false);
    expect(
      classifyFalseSuccess({
        token: "merged",
        comparison: {
          class: "tracker-truth",
          token: "merged",
          outcome: "match",
          urlResolved: true,
        },
        corroboration: { pmNotes: "satisfied", tracker: "satisfied", ci: "unsatisfied" },
      }),
    ).toBe(true);
  });

  test("a merged claim with an unreadable CI read blocks eligibility without resetting the window", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prMerged() })),
        ci: readFail("state", "ci.absent"),
        trackerToken: "merged",
        phasesComplete: true,
      }),
      gate: {},
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("merged");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records[0];
      // Recorded as uncorroborated — so the gate's corroboration condition is
      // unmet — but never as a false-success incident, so the window is intact.
      expect(record?.corroboration.ci).toBe("unsatisfied");
      expect(record?.falseSuccess).toBe(false);
      expect(record?.divergenceRef).toBeUndefined();

      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "github.com/owner/repo",
        "--json",
      ]);
      const data = summary.envelope?.data as {
        readonly incidents?: number;
        readonly windowStartReason?: string;
        readonly eligibility?: boolean;
        readonly corroboration?: { readonly unsatisfied?: number };
      };
      expect(data.incidents).toBe(0);
      // No reset: the unreadable source did not become a false-success incident.
      expect(data.windowStartReason).toBe("first-counted-dispatch");
      expect(data.corroboration?.unsatisfied).toBeGreaterThanOrEqual(1);
      expect(data.eligibility).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});
