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
  artifacts,
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

  test("the persisted-bound re-key is NARROWED to the restart-eligible timeout", () => {
    // DELIVERED EXPECTATION UPDATE (GH-347 §8.5 "Persisted-bound re-key
    // narrowed", AC-F6-4, AC-F6-6, Appendix F(D), DEC-5): a harness-reported
    // timeout at the bound keeps `max-restarts` with its delivered identity, and
    // every CLEAN session exit at the bound keeps its own classification.
    const timedOut = deriveDispatchResult(
      truthInput({
        harness: readOk(harnessFacts(TIMED_OUT_EVIDENCE)),
        restarts: { count: 3, bound: 3 },
      }),
    );
    expect(timedOut.token).toBe("max-restarts");
    expect(timedOut.outcome).toBe("failed");
    expect(timedOut.lastMessage).toContain("restart budget exhausted");

    // A premature end at the bound keeps `partial` (Appendix F(C)(9)).
    const premature = deriveDispatchResult(
      truthInput({
        harness: readOk(harnessFacts(PREMATURE_END_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
        restarts: { count: 3, bound: 3 },
      }),
    );
    expect(premature.token).toBe("partial");

    // The completed-session exemption is unchanged: never re-keyed.
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
          artifacts: readOk({ branchCommits: 2, pr: prNone, pmNotes: "complete" }),
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
        artifacts: readOk({ branchCommits: 2, pr: prNone, pmNotes: "complete" }),
      }),
    );
    expect(result.token).toBe("max-restarts");
    expect(result.outcome).toBe("timed-out");
  });
});

describe("TC-DISP-012 noop-lane-nothing-to-do only under the shell arm", () => {
  test("a complete ledger with commits resolves the artifact arm (ledger arm retired)", () => {
    // DELIVERED EXPECTATION UPDATE: the phase-ledger no-work arm is RETIRED
    // (spec §8.5 "Phase-ledger no-work arm retired"; AC-F8-4; DEC-6). A complete
    // ledger with commits resolves `finished`/`partial`, never nothing-to-do.
    const result = deriveDispatchResult(exhaustedLaneInput());
    expect(result.token).toBe("finished");
    expect(result.projectionClass).toBe("success");
    expect(result.token).not.toBe("noop-lane-nothing-to-do");
  });

  test("the shell arm is no commits, no PR, and a readable non-done non-blocked tracker", () => {
    const result = deriveDispatchResult(noArtifactInput());
    expect(result.token).toBe("noop-lane-nothing-to-do");
    expect(result.projectionClass).toBe("success");
  });

  test("a non-completed session never derives the no-work token", () => {
    const result = deriveDispatchResult(
      truthInput({
        artifacts: readOk({ branchCommits: 2, pr: prNone, pmNotes: "complete" }),
        ledger: readOk(ledger({ completed: 5, total: 7, workRemaining: true, progressed: false })),
        harness: readOk(harnessFacts(PREMATURE_END_EVIDENCE)),
      }),
    );
    expect(result.token).not.toBe("noop-lane-nothing-to-do");
    expect(result.token).toBe("partial");
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
