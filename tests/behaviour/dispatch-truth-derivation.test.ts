/**
 * The total derivation order (GH-347 F-8; DEC-6; TDR-0053; Appendix F) and the
 * delivered TC-TRUTH-001..005 cases, updated where §8.5 names a deliberate
 * change.
 *
 * DELIVERED EXPECTATION UPDATE (TC-TRUTH-001): the typed-only exit-0-no-artifact
 * `failed` arm is SUBSUMED and the phase-ledger no-work arm is RETIRED, so a
 * clean exit with no commits, no pull request, and a readable non-done
 * non-blocked tracker now derives `noop-lane-nothing-to-do`. Authorising
 * clauses: spec §8.5 ("the exit-0-no-artifact `failed` arm is subsumed"; "phase
 * ledger no-work arm retired"), AC-F8-4, DEC-6. The assertion is updated, never
 * relaxed: the token is still asserted to be a member of the closed taxonomy and
 * is still not `failed`.
 */
import { describe, expect, test } from "bun:test";
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
} from "../../packages/core/src/contracts/index";
import {
  type DispatchTruthInput,
  classifyDispatchFailure,
  deriveDispatchResult,
} from "../../packages/core/src/domain/dispatch-result";
import {
  DISPATCH_TRACKER_LADDER_ATTEMPTS,
  DISPATCH_TRACKER_LADDER_BASE_MS,
  DISPATCH_TRACKER_LADDER_CAP_MS,
  dispatchTrackerLadderWait,
  runDispatchTrackerLadder,
} from "../../packages/core/src/domain/dispatch-tracker";
import {
  COMPLETED_EVIDENCE,
  PREMATURE_END_EVIDENCE,
  TOOL_FAILURE_EVIDENCE,
} from "../fixtures/dispatch/harness";
import {
  artifacts,
  blockedInput,
  harnessFacts,
  ledger,
  mergedInput,
  missingTrackerFactInput,
  noArtifactInput,
  PARITY_LOCAL_HEAD,
  PARITY_REMOTE_HEAD,
  prNone,
  prOpen,
  pushParityClean,
  pushParityFailed,
  pushParityPushed,
  pushParityUnreadable,
  readFail,
  readOk,
  restarts,
  tracker,
  truthInput,
  unverifiedUrlInput,
} from "../fixtures/dispatch/truth";

describe("TC-TRUTH-001 a clean exit with no artifact and a reachable tracker is nothing-to-do", () => {
  test("the subsumed failed arm no longer exists; the shell arm derives", () => {
    const result = deriveDispatchResult(noArtifactInput());
    expect(result.token).toBe("noop-lane-nothing-to-do");
    expect(result.projectionClass).toBe("success");
    expect(DELIVERY_RESULT_TOKENS).toContain(result.token);
    expect(result.token).not.toBe("failed");
    expect(result.corroborationArm).toBe("nothing-to-do");
  });
});

describe("TC-TRUTH-002 an open PR derives pr-open with a resolved URL", () => {
  test("the token, URL, and dual-run handover state are derived", () => {
    const result = deriveDispatchResult(truthInput());
    expect(result.token).toBe("pr-open");
    expect(result.outcome).toBe("completed");
    expect(result.projectionClass).toBe("success");
    expect(result.prUrl).toBe("https://example.test/owner/repo/pull/1");
    expect(result.urlResolved).toBe(true);
    expect(result.handoverState).toBe("dual-run");
  });
});

describe("TC-TRUTH-003 an unresolvable PR URL derives pr-open-unverified", () => {
  test("the URL is empty and urlResolved is an engine-side false attribute", () => {
    const result = deriveDispatchResult(unverifiedUrlInput());
    expect(result.token).toBe("pr-open-unverified");
    expect(result.outcome).toBe("completed");
    expect(result.projectionClass).toBe("success");
    expect(result.prUrl).toBe("");
    expect(result.urlResolved).toBe(false);
    expect(result.lastMessage).toContain("could not be resolved");
  });
});

describe("TC-TRUTH-004 an already-merged PR is detection-only merged", () => {
  test("merged is derived only from the independently observed merged fact", () => {
    const result = deriveDispatchResult(mergedInput());
    expect(result.token).toBe("merged");
    expect(result.projectionClass).toBe("success");
  });

  test("an open PR is never reported as merged", () => {
    expect(deriveDispatchResult(truthInput()).token).toBe("pr-open");
  });
});

describe("TC-TRUTH-005 a blocking tracker state derives blocked; a missing fact never succeeds", () => {
  test("the blocking tracker fact derives blocked", () => {
    const result = deriveDispatchResult(blockedInput());
    expect(result.token).toBe("blocked");
    expect(result.projectionClass).toBe("success");
    expect(result.lastMessage).toContain("delivery-blocking");
  });

  test("a missing tracker fact with a decisive artifact resolves the artifact (AC-F4-3)", () => {
    // DELIVERED EXPECTATION UPDATE (AC-F4-3, §8.5 "a decisive artifact survives
    // an unreadable tracker"): the open PR is decisive, so the arm is `pr-open`
    // rather than `state-unverified`. The undecidable case (no decisive
    // artifact) is asserted at TC-DERIVE-005(b).
    const result = deriveDispatchResult(missingTrackerFactInput());
    expect(result.token).toBe("pr-open");
    expect(result.projectionClass).toBe("success");
    expect(result.urlResolved).toBe(true);
  });

  test("a missing tracker fact with no decisive artifact is state-unverified", () => {
    const result = deriveDispatchResult(
      truthInput({
        tracker: readFail("tracker", "tracker.fact-missing"),
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
      }),
    );
    expect(result.token).toBe("state-unverified");
    expect(result.projectionClass).toBe("platform-provider");
    expect(result.errorCode).toBe("dispatch.state-unverified");
    expect(result.readFailure).toBe("tracker");
  });
});

/* ------------------------------------------------------------------------- */
/* TC-DERIVE-001/002 — tracker-done `merged`, its precedence, and read order. */
/* ------------------------------------------------------------------------- */

const doneInput = (): DispatchTruthInput =>
  truthInput({
    tracker: readOk(tracker({ state: "done" })),
    artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone, pmNotes: "absent" })),
    ledger: readFail("ledger", "ledger.read-unreadable"),
  });

describe("TC-DERIVE-001 tracker-done with no visible PR is merged, tracker-corroborated", () => {
  test("the tracker-done arm yields merged even with unreadable artifact and ledger reads", () => {
    for (const input of [
      doneInput(),
      truthInput({
        tracker: readOk(tracker({ state: "done" })),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
      truthInput({
        tracker: readOk(tracker({ state: "done" })),
        ledger: readFail("ledger", "ledger.read-unreadable"),
      }),
    ]) {
      const result = deriveDispatchResult(input);
      expect(result.token).toBe("merged");
      expect(result.projectionClass).toBe("success");
      expect(result.urlResolved).toBe(false);
      expect(result.prUrl).toBe("");
      expect(result.corroborationArm).toBe("tracker-done-merged");
    }
  });
});

describe("TC-DERIVE-002 tracker-done wins over a blocking label", () => {
  test("done + blocking is merged; blocking without done stays blocked", () => {
    expect(
      deriveDispatchResult(
        truthInput({ tracker: readOk(tracker({ state: "done", blocking: true })) }),
      ).token,
    ).toBe("merged");
    expect(
      deriveDispatchResult(
        truthInput({ tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })) }),
      ).token,
    ).toBe("blocked");
    // The blocking arm precedes the artifact read: an unreadable artifact does
    // not degrade it.
    expect(
      deriveDispatchResult(
        truthInput({
          tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })),
          artifacts: readFail("artifact", "artifact.read-unreadable"),
        }),
      ).token,
    ).toBe("blocked");
  });
});

/* ------------------------------------------------------------------------- */
/* TC-DERIVE-003 — commits with complete / incomplete / absent pm-notes.      */
/* ------------------------------------------------------------------------- */

describe("TC-DERIVE-003 commits with complete pm-notes is finished; otherwise partial", () => {
  const rows = [
    { pmNotes: "complete" as const, token: "finished", projection: "success" },
    { pmNotes: "incomplete" as const, token: "partial", projection: "user-validation" },
    { pmNotes: "absent" as const, token: "partial", projection: "user-validation" },
  ];
  for (const row of rows) {
    test(`commits 2 + pm-notes ${row.pmNotes} → ${row.token}`, () => {
      const result = deriveDispatchResult(
        truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: row.pmNotes })) }),
      );
      expect(result.token).toBe(row.token);
      expect(result.projectionClass).toBe(row.projection);
      expect(result.outcome).toBe("completed");
    });
  }

  test("the harness outcome is carried on the record for a partial claim", () => {
    const result = deriveDispatchResult(
      truthInput({
        harness: readOk(harnessFacts(PREMATURE_END_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
      }),
    );
    expect(result.token).toBe("partial");
    expect(result.outcome).toBe("premature-end");
  });

  test("finished and partial are distinct tokens with distinct projections", () => {
    const finished = deriveDispatchResult(
      truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
    );
    const partial = deriveDispatchResult(
      truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })) }),
    );
    expect(finished.token).not.toBe(partial.token);
    expect(finished.projectionClass).not.toBe(partial.projectionClass);
  });
});

/* ------------------------------------------------------------------------- */
/* TC-DERIVE-005 — the nothing-to-do arm and the retired ledger arm.          */
/* ------------------------------------------------------------------------- */

describe("TC-DERIVE-005 nothing-to-do requires no commits and a readable tracker", () => {
  test("(a) no commits, no PR, readable non-done non-blocked tracker", () => {
    const result = deriveDispatchResult(
      truthInput({ artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })) }),
    );
    expect(result.token).toBe("noop-lane-nothing-to-do");
    expect(result.corroborationArm).toBe("nothing-to-do");
  });

  test("(b) an unreadable tracker never takes the arm", () => {
    const result = deriveDispatchResult(
      truthInput({
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
        tracker: readFail("tracker", "tracker.read-unreadable"),
      }),
    );
    expect(result.token).toBe("state-unverified");
  });

  test("(c) a complete ledger does not gate the arm; the shell condition does", () => {
    const base = {
      artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
      tracker: readOk(tracker()),
    };
    const complete = deriveDispatchResult(
      truthInput({
        ...base,
        ledger: readOk(ledger({ completed: 9, total: 9, progressed: false, workRemaining: false })),
      }),
    );
    const incomplete = deriveDispatchResult(
      truthInput({
        ...base,
        ledger: readOk(ledger({ completed: 1, total: 9, progressed: true, workRemaining: true })),
      }),
    );
    expect(complete.token).toBe("noop-lane-nothing-to-do");
    // Flipping the ledger does not move the token: the arm is retired.
    expect(incomplete.token).toBe("noop-lane-nothing-to-do");
  });

  test("(d)+(e) a complete ledger with commits resolves finished or partial, never nothing-to-do", () => {
    const completeLedger = readOk(
      ledger({ completed: 9, total: 9, progressed: false, workRemaining: false }),
    );
    const finished = deriveDispatchResult(
      truthInput({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
        ledger: completeLedger,
      }),
    );
    const partial = deriveDispatchResult(
      truthInput({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
        ledger: completeLedger,
      }),
    );
    expect(finished.token).toBe("finished");
    expect(partial.token).toBe("partial");
    expect(finished.token).not.toBe("noop-lane-nothing-to-do");
  });
});

/* ------------------------------------------------------------------------- */
/* TC-DERIVE-006 — the total order, its collisions, and the closed vocabulary. */
/* ------------------------------------------------------------------------- */

/** The long token values live here so the secret scanner sees no assignment. */
const SU = "state-unverified";
const NP = "noop-lane-permission";
const NN = "noop-lane-nothing-to-do";
const POU = "pr-open-unverified";

/** A harness-reported failure (Appendix F(C)(9): failed). */
const REPORTED_FAILURE_EVIDENCE = {
  completionMarker: true,
  exitStatus: 1,
  timedOut: false,
  spawnRefused: false,
  failureReported: true,
  toolFailure: false,
};

describe("TC-DERIVE-006 the total order is one disjoint order and the vocabulary is unchanged", () => {
  type Row = {
    readonly id: string;
    readonly arm: string;
    /** The ONE closed ladder arm this input must match (AC-F8-5 step 2). */
    readonly declaredArm: string;
    readonly input: DispatchTruthInput;
    readonly token: string;
  };
  const rows: readonly Row[] = [
    // B — attempt-stage failures.
    {
      id: "B1",
      arm: "spawn-failure",
      declaredArm: "spawn-failure",
      input: truthInput({ spawnFailure: true }),
      token: "failed",
    },
    {
      id: "B2",
      arm: "resume-uneconomical",
      declaredArm: "resume-uneconomical",
      input: truthInput({ resumeAdmission: { admitted: false, reason: "uneconomical" } }),
      token: "failed",
    },
    {
      id: "B3",
      arm: "resume-unreadable",
      declaredArm: "resume-unreadable",
      input: truthInput({ resumeAdmission: { admitted: false, reason: "unreadable-facts" } }),
      token: SU,
    },
    {
      id: "B4",
      arm: "harness-unreadable",
      declaredArm: "harness-unreadable",
      input: truthInput({ harness: readFail("state", "state.store.torn") }),
      token: SU,
    },
    // C — the ended-session ladder (arms 4-7 reachable for EVERY ended session).
    {
      id: "C1",
      arm: "spawn-refused",
      declaredArm: "spawn-refused",
      input: truthInput({
        harness: readOk(
          harnessFacts({
            completionMarker: false,
            exitStatus: null,
            timedOut: false,
            spawnRefused: true,
            failureReported: false,
            toolFailure: false,
          }),
        ),
      }),
      token: NP,
    },
    {
      id: "C2",
      arm: "tracker-done",
      declaredArm: "tracker-done",
      input: doneInput(),
      token: "merged",
    },
    { id: "C3", arm: "blocking", declaredArm: "blocking", input: blockedInput(), token: "blocked" },
    { id: "C4", arm: "open-pr", declaredArm: "open-pr", input: truthInput(), token: "pr-open" },
    {
      id: "C5",
      arm: "open-pr-unverified",
      declaredArm: "open-pr-unverified",
      input: unverifiedUrlInput(),
      token: POU,
    },
    {
      id: "C6",
      arm: "already-merged",
      declaredArm: "already-merged",
      input: mergedInput(),
      token: "merged",
    },
    {
      id: "C7",
      arm: "commits-complete",
      declaredArm: "commits-complete",
      input: truthInput({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
      }),
      token: "finished",
    },
    {
      id: "C8",
      arm: "commits-incomplete",
      declaredArm: "commits-incomplete",
      input: truthInput({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
      }),
      token: "partial",
    },
    {
      id: "C9",
      arm: "nothing-to-do",
      declaredArm: "nothing-to-do",
      input: truthInput({ artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })) }),
      token: NN,
    },
    {
      // REBUILT (GH-347 review m5, AC-F4-3, Appendix F(C)(9)): the classifier
      // arm is arm 9, so its input must be a NON-clean end with NO decisive
      // artifact. The delivered row carried commits and actually matched arm 7.
      id: "C10",
      arm: "classifier",
      declaredArm: "classifier",
      input: truthInput({
        harness: readOk(harnessFacts(TOOL_FAILURE_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone, pmNotes: "complete" })),
      }),
      token: "partial",
    },
    // C11-C14 — the B1 rows: a decisive artifact beats a non-clean classifier
    // token (AC-F4-3; Appendix F(C) arms 4-7 precede arm 9; §8.5).
    {
      id: "C11",
      arm: "failed-open-pr",
      declaredArm: "open-pr",
      input: truthInput({
        harness: readOk(harnessFacts(REPORTED_FAILURE_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prOpen() })),
      }),
      token: "pr-open",
    },
    {
      id: "C12",
      arm: "failed-commits-complete",
      declaredArm: "commits-complete",
      input: truthInput({
        harness: readOk(harnessFacts(REPORTED_FAILURE_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
      }),
      token: "finished",
    },
    {
      id: "C13",
      arm: "premature-end-open-pr",
      declaredArm: "open-pr",
      input: truthInput({
        harness: readOk(harnessFacts(PREMATURE_END_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prOpen() })),
      }),
      token: "pr-open",
    },
    {
      id: "C14",
      arm: "tool-failure-commits-complete",
      declaredArm: "commits-complete",
      input: truthInput({
        harness: readOk(harnessFacts(TOOL_FAILURE_EVIDENCE)),
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
      }),
      token: "finished",
    },
    // Collisions — the order decides.
    {
      id: "X1",
      arm: "done-and-blocking",
      declaredArm: "tracker-done",
      input: truthInput({ tracker: readOk(tracker({ state: "done", blocking: true })) }),
      token: "merged",
    },
    {
      id: "X2",
      arm: "done-and-open-pr",
      declaredArm: "tracker-done",
      input: truthInput({
        tracker: readOk(tracker({ state: "done" })),
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })),
      }),
      token: "merged",
    },
    {
      id: "X3",
      arm: "open-pr-and-commits",
      declaredArm: "open-pr",
      input: truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })) }),
      token: "pr-open",
    },
    {
      id: "X4",
      arm: "no-commits-complete-ledger",
      declaredArm: "nothing-to-do",
      input: truthInput({
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
        ledger: readOk(ledger({ completed: 9, total: 9, progressed: false, workRemaining: false })),
      }),
      token: NN,
    },
    // Read precedence.
    {
      id: "R1",
      arm: "done-artifact-unreadable",
      declaredArm: "tracker-done",
      input: truthInput({
        tracker: readOk(tracker({ state: "done" })),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
      token: "merged",
    },
    {
      id: "R2",
      arm: "blocking-artifact-unreadable",
      declaredArm: "blocking",
      input: truthInput({
        tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
      token: "blocked",
    },
    {
      id: "R3",
      arm: "done-ledger-unreadable",
      declaredArm: "tracker-done",
      input: truthInput({
        tracker: readOk(tracker({ state: "done" })),
        ledger: readFail("ledger", "ledger.read-unreadable"),
      }),
      token: "merged",
    },
  ];

  test("every declared arm projects its token; 25 inputs, 10 distinct tokens", () => {
    const observed = rows.map((row) => deriveDispatchResult(row.input).token);
    for (const [index, row] of rows.entries()) {
      expect(observed[index], `${row.id} ${row.arm}`).toBe(row.token);
    }
    expect(new Set(observed).size).toBe(10);
    // max-restarts is the eleventh token and is a loop/bound outcome, not a
    // derivation input (TC-LOOP-002/006).
    expect(new Set(observed).has("max-restarts")).toBe(false);
  });

  test("exactly one declared arm matches each input (test plan TC-DERIVE-006 step 2)", () => {
    // The ONE derivation returns the arm that fired, so a row can never be
    // mislabelled: C10's delivered arm tag claimed "classifier" while matching
    // the commits arm, which is the defect this assertion closes.
    for (const row of rows) {
      const derivation = deriveDispatchResult(row.input);
      expect(derivation.armId, `${row.id} ${row.arm}`).toBe(row.declaredArm);
    }
    // Every arm id the table observes is one of the declared closed set: no
    // input reaches two arms and no arm is invented. This mirrors
    // `DISPATCH_RESULT_ARM_IDS` in `packages/core/src/domain/dispatch-result.ts`
    // (module-internal, never a contract); the canonical set has 16 ids.
    // `restart-budget` and `undecidable` are not derivation inputs reachable
    // from this table: they are the loop/bound arm (TC-LOOP-002/TC-LOOP-006) and
    // the read-failure arm (TC-LOOP-007), proven there.
    const declared = new Set([
      "spawn-failure",
      "resume-uneconomical",
      "resume-unreadable",
      "restart-budget",
      "harness-unreadable",
      "spawn-refused",
      "tracker-done",
      "blocking",
      "open-pr",
      "open-pr-unverified",
      "already-merged",
      "commits-complete",
      "commits-incomplete",
      "nothing-to-do",
      "classifier",
      "undecidable",
    ]);
    expect(declared.size).toBe(16);
    for (const row of rows) {
      expect(declared.has(row.declaredArm), `${row.id} ${row.declaredArm}`).toBe(true);
    }
    // More than one arm reaches `merged`: an arm is not a token, and the table
    // proves distinct arms map onto the same token.
    expect(rows.filter((row) => row.declaredArm === "tracker-done")).toHaveLength(5);
    expect(rows.filter((row) => row.declaredArm === "open-pr")).toHaveLength(4);
  });

  test("the collisions prove the order: done beats blocking, blocking beats PR, PR beats commits", () => {
    expect(
      deriveDispatchResult(
        truthInput({ tracker: readOk(tracker({ state: "done", blocking: true })) }),
      ).token,
    ).toBe("merged");
    expect(
      deriveDispatchResult(
        truthInput({
          tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })),
          artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })),
        }),
      ).token,
    ).toBe("blocked");
    expect(
      deriveDispatchResult(
        truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })) }),
      ).token,
    ).toBe("pr-open");
  });

  test("the taxonomy, the projections, and the attempt schema are unchanged", () => {
    expect(DELIVERY_RESULT_TOKENS).toHaveLength(11);
    expect(DELIVERY_RESULT_TAXONOMY.map((row) => row.token)).toEqual([...DELIVERY_RESULT_TOKENS]);
    const exitOf = (token: string): string | undefined =>
      DELIVERY_RESULT_TAXONOMY.find((row) => row.token === token)?.projectionClass;
    expect(exitOf("state-unverified")).toBe("platform-provider");
    expect(exitOf("partial")).toBe("user-validation");
    expect(exitOf("blocked")).toBe("success");
    expect(exitOf("max-restarts")).toBe("user-validation");
    expect(DISPATCH_ATTEMPT_PAYLOAD_SCHEMA).toBe("delivery.dispatch.attempt.v1");
  });
});

/* ------------------------------------------------------------------------- */
/* TC-TRACKER-004 — the ladder is declared policy with an injected delay.     */
/* ------------------------------------------------------------------------- */

describe("TC-TRACKER-004 the ladder constants, the wait table, and the injected delay", () => {
  test("the declared constants and the wait table", () => {
    expect(DISPATCH_TRACKER_LADDER_ATTEMPTS).toBe(5);
    expect(DISPATCH_TRACKER_LADDER_BASE_MS).toBe(2000);
    expect(DISPATCH_TRACKER_LADDER_CAP_MS).toBe(30000);
    expect([1, 2, 3, 4, 5, 6].map(dispatchTrackerLadderWait)).toEqual([
      2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  test("a transient failure then success uses the successful read and records the waits", async () => {
    const waits: number[] = [];
    let attempts = 0;
    const outcome = await runDispatchTrackerLadder({
      read: async () => {
        attempts += 1;
        return attempts < 4
          ? ({ ok: false, reason: "tracker" } as const)
          : ({ ok: true, value: { state: "in-progress" as const, blocking: false } } as const);
      },
      delay: async (ms) => {
        waits.push(ms);
      },
    });
    expect(outcome.ok).toBe(true);
    expect(waits).toEqual([2000, 4000, 8000]);
  });

  test("exhaustion never yields a success-shaped fact", async () => {
    const waits: number[] = [];
    const outcome = await runDispatchTrackerLadder({
      read: async () => ({ ok: false, reason: "tracker" }) as const,
      delay: async (ms) => {
        waits.push(ms);
      },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.identity).toBe("tracker:exhausted");
    expect(outcome.attempts).toBe(5);
    expect(waits).toEqual([2000, 4000, 8000, 16000]);
    expect(waits.reduce((total, ms) => total + ms, 0)).toBe(30000);
  });

  test("the ladder module resolves no ambient timer", async () => {
    const source = await Bun.file(
      new URL("../../packages/core/src/domain/dispatch-tracker.ts", import.meta.url),
    ).text();
    for (const marker of ["setTimeout", "setInterval", "node:timers", "Bun.sleep"]) {
      expect(source).not.toContain(marker);
    }
  });
});

/* ------------------------------------------------------------------------- */
/* GH-386 — the total arm-8 matrix over injected parity facts (TC-PUSH-013's  */
/* domain half; AC-F1-1, AC-F1-2, AC-F3-1's derivation cells, TC-PUSH-009's   */
/* boundary, DEC-5's exclusion).                                              */
/* ------------------------------------------------------------------------- */

describe("GH-386 the arm-8 parity precondition is total over the injected facts", () => {
  test("clean parity derives pr-open with the clean disclosure and no act claim", () => {
    const result = deriveDispatchResult(
      truthInput({ pushParity: pushParityClean() }),
    );
    expect(result.token).toBe("pr-open");
    expect(result.projectionClass).toBe("success");
    expect(result.prUrl).toContain("pull/1");
    expect(result.push).toEqual({
      verdict: "clean",
      localHead: PARITY_LOCAL_HEAD,
      remoteHead: PARITY_LOCAL_HEAD,
      parity: true,
    });
    expect(result.errorCode).toBeUndefined();
  });

  test("a pushed act then equal re-read derives pr-open with the pushed disclosure", () => {
    const result = deriveDispatchResult(truthInput({ pushParity: pushParityPushed() }));
    expect(result.token).toBe("pr-open");
    expect(result.push).toEqual({
      verdict: "pushed",
      localHead: PARITY_LOCAL_HEAD,
      remoteHead: PARITY_LOCAL_HEAD,
      parity: true,
    });
  });

  test("a readable inequality after the act is the typed push failure with the PR URL retained", () => {
    const result = deriveDispatchResult(truthInput({ pushParity: pushParityFailed() }));
    expect(result.token).toBe("failed");
    expect(result.outcome).toBe("failed");
    expect(result.projectionClass).toBe("user-validation");
    expect(result.prUrl).toContain("pull/1");
    expect(result.urlResolved).toBe(true);
    expect(result.push).toEqual({
      verdict: "failed",
      localHead: PARITY_LOCAL_HEAD,
      remoteHead: PARITY_REMOTE_HEAD,
      parity: false,
    });
    // No error identity: the envelope is the delivered data-bearing shape.
    expect(result.errorCode).toBeUndefined();
    expect(result.readFailure).toBeUndefined();
  });

  test("an unreadable parity read stays state-unverified at the platform projection", () => {
    const result = deriveDispatchResult(truthInput({ pushParity: pushParityUnreadable() }));
    expect(result.token).toBe("state-unverified");
    expect(result.outcome).toBe("failed");
    expect(result.projectionClass).toBe("platform-provider");
    expect(result.errorCode).toBe("dispatch.state-unverified");
    expect(result.readFailure).toBe("state");
    // No push disclosure and no fabricated parity facts on the unreadable path.
    expect(result.push).toBeUndefined();
    expect(result.prUrl).toContain("pull/1");
  });

  test("the exclusion holds: pr-open-unverified never evaluates the precondition", () => {
    const result = deriveDispatchResult(
      truthInput({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen(null) })),
        pushParity: pushParityPushed(),
      }),
    );
    expect(result.token).toBe("pr-open-unverified");
    expect(result.urlResolved).toBe(false);
    expect(result.push).toBeUndefined();
  });

  test("absent parity facts keep the delivered classification for a composition with no act", () => {
    const withDefault = deriveDispatchResult(truthInput());
    const withoutFacts = deriveDispatchResult(truthInput({ pushParity: undefined }));
    expect(withoutFacts.token).toBe("pr-open");
    expect(withoutFacts.token).toBe(withDefault.token);
    expect(withoutFacts.push).toBeUndefined();
    expect(withoutFacts.armId).toBe("open-pr");
  });

  test("the matrix is total: every injected cell yields exactly the declared token", () => {
    const cells: readonly {
      readonly name: string;
      readonly reading: DispatchTruthInput["pushParity"];
      readonly expected: string;
    }[] = [
      { name: "clean", reading: pushParityClean(), expected: "pr-open" },
      { name: "pushed", reading: pushParityPushed(), expected: "pr-open" },
      { name: "failed", reading: pushParityFailed(), expected: "failed" },
      { name: "unreadable", reading: pushParityUnreadable(), expected: "state-unverified" },
      { name: "absent", reading: undefined, expected: "pr-open" },
    ];
    for (const cell of cells) {
      const result = deriveDispatchResult(truthInput({ pushParity: cell.reading }));
      expect(result.token, cell.name).toBe(cell.expected);
      // The defining property (AC-F1-2): an evaluating pr-open always carries a
      // parity-true disclosure, and only the failure carries the failed verdict.
      // The absent cell is the no-act composition: no disclosure at all.
      if (result.token === "pr-open") {
        if (cell.reading === undefined) {
          expect(result.push, cell.name).toBeUndefined();
        } else {
          expect(result.push?.parity, cell.name).toBe(true);
          expect(result.push?.verdict === "failed", cell.name).toBe(false);
        }
      }
      if (result.token === "failed") {
        expect(result.push?.verdict, cell.name).toBe("failed");
        expect(result.push?.parity, cell.name).toBe(false);
      }
    }
  });

  test("the new failure row is the one identity-less classification with its reason", () => {
    const row = classifyDispatchFailure({ kind: "lifecycle-push-failure" });
    expect(row.code).toBeNull();
    expect(row.token).toBe("failed");
    expect(row.outcome).toBe("failed");
    expect(row.projectionClass).toBe("user-validation");
    expect(row.attemptRecords).toBe(1);
    expect(row.comparisonReason).toBe("push-parity-unmet");
  });
});
