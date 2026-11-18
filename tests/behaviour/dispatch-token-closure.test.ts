/**
 * TC-DISP-008 / TC-DISP-011 / TC-DISP-012 (phase-2 pure classification) — every
 * derivation branch emits only the eleven closed tokens, `partial` always
 * carries its outcome, a harness spawn refusal is `noop-lane-permission` with
 * outcome `refused`, the Appendix G failure pairs hold, and
 * `noop-lane-nothing-to-do` is derived only when no work remains.
 */
import { describe, expect, test } from "bun:test";
import {
  classifyDispatchFailure,
  classifySpawnRefusal,
  deriveDispatchResult,
} from "../../packages/core/src/domain/dispatch-result";
import { DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import {
  COMPLETED_EVIDENCE,
  PREMATURE_END_EVIDENCE,
  SPAWN_REFUSED_EVIDENCE,
  TIMED_OUT_EVIDENCE,
  TOOL_FAILURE_EVIDENCE,
} from "../fixtures/dispatch/harness";
import {
  blockedInput,
  exhaustedLaneInput,
  harnessFacts,
  ledger,
  mergedInput,
  noArtifactInput,
  prNone,
  readOk,
  spawnFailureInput,
  spawnRefusedInput,
  truthInput,
  unreadableInputs,
  unverifiedUrlInput,
} from "../fixtures/dispatch/truth";

const CLOSED = new Set<string>(DELIVERY_RESULT_TOKENS);

describe("TC-DISP-008 every derivation branch stays inside the eleven", () => {
  test("the whole branch matrix emits only closed tokens", () => {
    const branches = [
      noArtifactInput(),
      truthInput(),
      unverifiedUrlInput(),
      mergedInput(),
      blockedInput(),
      exhaustedLaneInput(),
      spawnRefusedInput(SPAWN_REFUSED_EVIDENCE),
      spawnFailureInput(),
      truthInput({ restarts: { count: 3, bound: 3 } }),
      truthInput({ resumeAdmission: { admitted: false, reason: "uneconomical" } }),
      truthInput({ resumeAdmission: { admitted: false, reason: "unreadable-facts" } }),
      ...unreadableInputs().map((entry) => entry.input),
    ];
    const emitted = branches.map((input) => deriveDispatchResult(input).token);
    for (const token of emitted) {
      expect(CLOSED.has(token), `${token} is outside the closed set`).toBe(true);
    }
    expect(emitted.length).toBeGreaterThan(0);
  });

  test("the restart-budget branch refuses a non-completed session at the bound", () => {
    for (const evidence of [TIMED_OUT_EVIDENCE, PREMATURE_END_EVIDENCE]) {
      const result = deriveDispatchResult(
        truthInput({
          harness: readOk(harnessFacts(evidence)),
          restarts: { count: 3, bound: 3 },
        }),
      );
      expect(result.token).toBe("max-restarts");
      expect(result.outcome).toBe("failed");
      expect(result.lastMessage).toContain("restart budget exhausted");
    }
    // The completed-session exemption is the F-16 contract: a completed harness
    // at an already-reached bound is never re-keyed to the restart refusal.
    const completed = deriveDispatchResult(truthInput({ restarts: { count: 3, bound: 3 } }));
    expect(completed.token).toBe("pr-open");
  });
});

describe("TC-DISP-011 partial carries outcome; spawn refusal is recorded", () => {
  test("completed-with-tool-failure and premature end both derive partial with an outcome", () => {
    for (const evidence of [TOOL_FAILURE_EVIDENCE, PREMATURE_END_EVIDENCE]) {
      const result = deriveDispatchResult(
        truthInput({
          harness: readOk(harnessFacts(evidence)),
          artifacts: readOk({ branchCommits: 2, pr: prNone }),
        }),
      );
      expect(result.token).toBe("partial");
      expect(result.outcome.length).toBeGreaterThan(0);
      expect(result.projectionClass).toBe("user-validation");
    }
  });

  test("a harness spawn refusal derives noop-lane-permission with outcome refused", () => {
    const result = deriveDispatchResult(spawnRefusedInput(SPAWN_REFUSED_EVIDENCE));
    expect(result.token).toBe("noop-lane-permission");
    expect(result.outcome).toBe("refused");
    expect(result.projectionClass).toBe("user-validation");

    const refusal = classifySpawnRefusal();
    expect(refusal.token).toBe("noop-lane-permission");
    expect(refusal.outcome).toBe("refused");
    expect(refusal.attemptRecords).toBe(1);
    expect(refusal.comparisonReason).toBe("dispatch-session-family");
  });

  test("a timed-out session derives max-restarts through the session token", () => {
    const result = deriveDispatchResult(
      truthInput({
        harness: readOk(harnessFacts(TIMED_OUT_EVIDENCE)),
        artifacts: readOk({ branchCommits: 2, pr: prNone }),
      }),
    );
    expect(result.token).toBe("max-restarts");
    expect(result.outcome).toBe("timed-out");
  });
});

describe("TC-DISP-012 noop-lane-nothing-to-do only with no remaining work", () => {
  test("the exhausted lane derives noop-lane-nothing-to-do", () => {
    const result = deriveDispatchResult(exhaustedLaneInput());
    expect(result.token).toBe("noop-lane-nothing-to-do");
    expect(result.projectionClass).toBe("success");
    expect(result.lastMessage).toContain("no remaining work");
  });

  test("an open-phase lane never derives the no-work token", () => {
    const inputs = [
      truthInput({
        artifacts: readOk({ branchCommits: 2, pr: prNone }),
        ledger: readOk(ledger({ completed: 5, total: 7, workRemaining: true, progressed: false })),
        harness: readOk(harnessFacts(PREMATURE_END_EVIDENCE)),
      }),
      noArtifactInput(),
    ];
    for (const input of inputs) {
      expect(deriveDispatchResult(input).token).not.toBe("noop-lane-nothing-to-do");
    }
  });

  test("the happy-path open-PR lane is not a no-work claim", () => {
    expect(
      deriveDispatchResult(truthInput({ harness: readOk(harnessFacts(COMPLETED_EVIDENCE)) })).token,
    ).toBe("pr-open");
  });
});

describe("Appendix G failure pairs", () => {
  test("spawn failure is failed/failed with comparison-source-unavailable", () => {
    const classified = classifyDispatchFailure({ kind: "spawn-failed" });
    expect(classified.token).toBe("failed");
    expect(classified.outcome).toBe("failed");
    expect(classified.code).toBe("dispatch.session.spawn-failed");
    expect(classified.comparisonReason).toBe("comparison-source-unavailable");
  });

  test("restart-budget refusal is max-restarts/failed with dispatch-session-family", () => {
    const classified = classifyDispatchFailure({ kind: "restart-budget-exceeded" });
    expect(classified.token).toBe("max-restarts");
    expect(classified.outcome).toBe("failed");
    expect(classified.comparisonReason).toBe("dispatch-session-family");
  });

  test("resume-economics refusal is failed/failed with comparison-source-unavailable", () => {
    const classified = classifyDispatchFailure({ kind: "resume-uneconomical" });
    expect(classified.token).toBe("failed");
    expect(classified.outcome).toBe("failed");
    expect(classified.comparisonReason).toBe("comparison-source-unavailable");
  });

  test("state-unverified is state-unverified/failed at exit 2", () => {
    const classified = classifyDispatchFailure({ kind: "state-unreadable" });
    expect(classified.token).toBe("state-unverified");
    expect(classified.outcome).toBe("failed");
    expect(classified.projectionClass).toBe("platform-provider");
    expect(classified.attemptRecords).toBe(1);
  });
});
