/**
 * GH-386 — the ensure-push act through the real command path (TC-PUSH-001..013
 * behaviour cells, TC-PUSH-018's compat half, OQ-1's spawn-level failure).
 *
 * Every case drives the composed production program (driver D1) over injected
 * parity facts and push outcomes: zero live network, zero real remotes, zero
 * real child processes, zero wall-clock waits. The injected runner records every
 * invocation and refuses a requested shell by name.
 */
import { describe, expect, test } from "bun:test";
import { createGitPushSeam, type GitPushRunnerResult } from "../../packages/adapters/src/git/index";
import {
  createParityHarness,
  type ParityObservation,
  readableParityTransport,
} from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";
import { createConfiguredCheckout } from "../fixtures/dispatch/parity/temp-repo";

/** The deterministic full-hex head facts (fixture literals, committed). */
const LOCAL_HEAD = "0123456789abcdef";
const REMOTE_HEAD = "fedcba9876543210";
const BRANCH = "feat/GH-347/parity";
/**
 * The push remote the parity checkout declares. The harness checkout carries one
 * `[remote "origin"]` section, so the seam's one bounded configuration read
 * resolves `origin` and the act names it as the repository argument.
 */
const REMOTE_NAME = "origin";

/** One scripted open pull whose head the parity read compares against. */
const openPull = (sha: string): unknown => ({
  number: 501,
  state: "open",
  head: { ref: BRANCH, sha },
  base: { ref: "main-tools" },
  mergeable: true,
  mergeable_state: "clean",
  changed_files: 2,
});

/** One open pull with a non-addressable entity id: the URL cannot resolve (DEC-5). */
const numberlessPull = (sha: string): unknown => ({
  number: "not-numeric",
  state: "open",
  head: { ref: BRANCH, sha },
  base: { ref: "main-tools" },
});

/** The declared push-outcome classes (test plan §6). */
const pushOutcomes: Record<string, () => GitPushRunnerResult> = {
  "fast-forward-accepted": () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
  "non-fast-forward-rejected": () => ({
    stdout: "",
    stderr: "! [rejected] (non-fast-forward)",
    status: 1,
    timedOut: false,
  }),
  "protected-branch-rejected": () => ({
    stdout: "",
    stderr: "remote rejected (protected ref hook declined)",
    status: 1,
    timedOut: false,
  }),
  "credential-rejected": () => ({
    stdout: "",
    stderr: "fatal: Authentication failed",
    status: 128,
    timedOut: false,
  }),
  "spawn-failed": () => ({
    stdout: "",
    stderr: "",
    status: 1,
    timedOut: false,
    spawnFailed: true,
  }),
};

const runScenario = async (input: {
  readonly label: string;
  readonly localHead?: string;
  readonly push?: keyof typeof pushOutcomes;
  readonly pullHeadCalls?: readonly (string | "unreadable")[];
  readonly pushTimeoutMs?: number;
  readonly requests?: string[];
}): Promise<ParityObservation> => {
  const h = createParityHarness({
    label: input.label,
    ...(input.localHead === undefined ? {} : { localHead: input.localHead }),
    ...(input.push === undefined ? {} : { push: pushOutcomes[input.push] }),
    ...(input.pullHeadCalls === undefined ? {} : { pullHeadCalls: input.pullHeadCalls }),
    ...(input.pushTimeoutMs === undefined ? {} : { pushTimeoutMs: input.pushTimeoutMs }),
    transport: readableParityTransport({
      openPulls: [openPull(input.pullHeadCalls?.[0] ?? LOCAL_HEAD)],
      ...(input.requests === undefined ? {} : { requests: input.requests }),
    }),
  });
  try {
    await h.run();
    return h.observe();
  } finally {
    h.dispose();
  }
};

const pushInvocationsOf = (observation: ParityObservation) =>
  observation.invocations.filter((invocation) => invocation.seam === "push");

const attemptOf = (observation: ParityObservation) => observation.attempts[0];

describe("TC-PUSH-001 clean parity: no push act, pr-open with push:clean", () => {
  test("equal heads perform zero push invocations and carry the clean disclosure", async () => {
    const requests: string[] = [];
    const observation = await runScenario({
      label: "push-001-clean",
      requests,
    });
    expect(observation.exit).toBe(0);
    expect(observation.token).toBe("pr-open");
    expect(pushInvocationsOf(observation)).toHaveLength(0);
    const attempt = attemptOf(observation);
    expect(attempt?.evidenceRefs).toContain("push:clean");
    expect(attempt?.comparison).toMatchObject({ class: "tracker-truth", outcome: "match" });
    const data = observation.envelopes[0]?.data;
    expect(data?.result).toBe("pr-open");
    expect(data?.push).toEqual({
      verdict: "clean",
      localHead: LOCAL_HEAD,
      remoteHead: LOCAL_HEAD,
      parity: true,
    });
    // Exactly one parity read: the truth read plus the parity read, nothing else.
    expect(requests.filter((url) => url.includes("/pulls?state=open"))).toHaveLength(2);
  });
});

describe("TC-PUSH-002 local ahead: one push, one re-read, pr-open with push:pushed", () => {
  test("the act reconciles parity before the token derives, in the declared order", async () => {
    const requests: string[] = [];
    const observation = await runScenario({
      label: "push-002-pushed",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
      push: "fast-forward-accepted",
      requests,
    });
    expect(observation.exit).toBe(0);
    expect(observation.token).toBe("pr-open");
    const pushes = pushInvocationsOf(observation);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.args).toEqual(["push", REMOTE_NAME, `HEAD:refs/heads/${BRANCH}`]);
    const attempt = attemptOf(observation);
    expect(attempt?.evidenceRefs).toContain("push:pushed");
    const data = observation.envelopes[0]?.data;
    expect(data?.push).toEqual({
      verdict: "pushed",
      localHead: LOCAL_HEAD,
      remoteHead: LOCAL_HEAD,
      parity: true,
    });
    // Truth read + parity read + exactly one re-read (NFR-2's per-case bound).
    expect(requests.filter((url) => url.includes("/pulls?state=open"))).toHaveLength(3);
  });
});

describe("TC-PUSH-003..006 every non-successful act class type-fails identically", () => {
  for (const outcome of [
    "non-fast-forward-rejected",
    "protected-branch-rejected",
    "credential-rejected",
  ] as const) {
    test(`${outcome} is the typed failure with the PR URL retained`, async () => {
      const observation = await runScenario({
        label: `push-${outcome}`,
        pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
        push: outcome,
      });
      expect(observation.exit).toBe(1);
      expect(observation.token).toBe("failed");
      const attempt = attemptOf(observation);
      expect(observation.attempts).toHaveLength(1);
      expect(attempt?.evidenceRefs).toContain("push:failed");
      expect(attempt?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "push-parity-unmet",
      });
      const data = observation.envelopes[0]?.data;
      expect(data?.result).toBe("failed");
      expect(data?.outcome).toBe("failed");
      expect(data?.error).toBeUndefined();
      expect(data?.prUrl).toContain("pull/501");
      expect(data?.push).toEqual({
        verdict: "failed",
        localHead: LOCAL_HEAD,
        remoteHead: REMOTE_HEAD,
        parity: false,
      });
      // No divergence and no retry: exactly one push invocation.
      expect(observation.divergences).toBe(0);
      expect(pushInvocationsOf(observation)).toHaveLength(1);
      expect(observation.violations).toEqual([]);
    });
  }

  test("TC-PUSH-006 a timed-out act is a failure-class input, never a hang or a retry", async () => {
    const observation = await runScenario({
      label: "push-006-timeout",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
      push: "timed-out",
    });
    expect(observation.token).toBe("failed");
    expect(observation.exit).toBe(1);
    expect(attemptOf(observation)?.evidenceRefs).toContain("push:failed");
    expect(pushInvocationsOf(observation)).toHaveLength(1);
  });

  test("OQ-1 a spawn-level act failure is `fails` under the same row (no second shape)", async () => {
    const observation = await runScenario({
      label: "push-oq1-spawn-failed",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
      push: "spawn-failed",
    });
    expect(observation.token).toBe("failed");
    expect(observation.exit).toBe(1);
    const attempt = attemptOf(observation);
    expect(attempt?.comparison).toMatchObject({ reason: "push-parity-unmet" });
    expect(attempt?.evidenceRefs).toContain("push:failed");
    expect(pushInvocationsOf(observation)).toHaveLength(1);
  });
});

describe("TC-PUSH-007 a landed push betrayed by a stale re-read type-fails", () => {
  test("pr-open never trusts the pre-push inequality or the stale provider head away", async () => {
    const observation = await runScenario({
      label: "push-007-stale-reread",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, REMOTE_HEAD],
      push: "fast-forward-accepted",
    });
    expect(observation.token).toBe("failed");
    expect(observation.exit).toBe(1);
    expect(attemptOf(observation)?.evidenceRefs).toContain("push:failed");
    // One push, one re-read, and no further act.
    expect(pushInvocationsOf(observation)).toHaveLength(1);
  });
});

describe("TC-PUSH-008 remote ahead type-fails; the act never widens its scope", () => {
  test("a fast-forward push cannot resolve the state and no force variant exists", async () => {
    const observation = await runScenario({
      label: "push-008-remote-ahead",
      localHead: "fedcba9876543210",
      pullHeadCalls: [LOCAL_HEAD, LOCAL_HEAD],
      push: "non-fast-forward-rejected",
    });
    expect(observation.token).toBe("failed");
    expect(observation.exit).toBe(1);
    const pushes = pushInvocationsOf(observation);
    expect(pushes).toHaveLength(1);
    const argv = pushes[0]?.args ?? [];
    // No force-capable flag in any argv element; the single refspec names only
    // the change branch (NG-5, pinned at the argv level).
    for (const element of argv) {
      expect(element.startsWith("-f") || element.startsWith("--force"), element).toBe(false);
    }
    expect(argv).toEqual(["push", REMOTE_NAME, `HEAD:refs/heads/${BRANCH}`]);
  });
});

describe("TC-PUSH-009 an unreadable parity read stays the undecidable-truth semantics", () => {
  test("state-unverified at exit 2, never the push-failure row, zero push invocations", async () => {
    const observation = await runScenario({
      label: "push-009-unreadable",
      pullHeadCalls: [REMOTE_HEAD, "unreadable"],
    });
    expect(observation.token).toBe("state-unverified");
    expect(observation.exit).toBe(2);
    const attempt = attemptOf(observation);
    expect(attempt?.evidenceRefs).not.toContain("push:failed");
    expect(attempt?.comparison).not.toMatchObject({ reason: "push-parity-unmet" });
    const data = observation.envelopes[0]?.data;
    expect(data?.push).toBeUndefined();
    expect(pushInvocationsOf(observation)).toHaveLength(0);
  });
});

describe("TC-PUSH-010 pr-open-unverified stays outside the precondition", () => {
  test("no parity read, no act, no push evidence, no envelope block", async () => {
    const requests: string[] = [];
    const h = createParityHarness({
      label: "push-010-unverified",
      transport: readableParityTransport({
        openPulls: [numberlessPull(LOCAL_HEAD)],
        requests,
      }),
    });
    try {
      await h.run();
      const observation = h.observe();
      expect(observation.token).toBe("pr-open-unverified");
      expect(observation.exit).toBe(0);
      const data = observation.envelopes[0]?.data as Record<string, unknown> | undefined;
      expect(data?.push).toBeUndefined();
      expect(attemptOf(observation)?.evidenceRefs.join(" ")).not.toContain("push:");
      expect(pushInvocationsOf(observation)).toHaveLength(0);
      // Only the truth read's open-request read happened; no parity read exists.
      expect(requests.filter((url) => url.includes("/pulls?state=open"))).toHaveLength(1);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-PUSH-012 the act contract: bounded, fixed-argv, non-shell, injectable timeout", () => {
  test("one attempt per classification, fixed argv, and the injected small budget", async () => {
    const observation = await runScenario({
      label: "push-012-act-contract",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
      push: "fast-forward-accepted",
      pushTimeoutMs: 500,
    });
    const pushes = pushInvocationsOf(observation);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.file).toBe("git");
    expect(pushes[0]?.args).toEqual(["push", REMOTE_NAME, `HEAD:refs/heads/${BRANCH}`]);
    // The 60 000 ms production default is injectable through the seam options;
    // no new configuration key exists on any path.
    expect(pushes[0]?.timeout).toBe(500);
    // The literal non-shell spawn: the guard's by-name refusal never fired.
    expect(observation.violations).toEqual([]);
  });
});

describe("TC-PUSH-018 pre-change attempts without push references read unchanged", () => {
  test("the delivered sixteen-field projection invents no parity facts", async () => {
    const { appendDispatchAttempt } = await import("../../packages/core/src/app/dispatch-ledger");
    const { DISPATCH_ATTEMPT_PAYLOAD_SCHEMA } = await import(
      "../../packages/core/src/contracts/index"
    );
    const h = createParityHarness({ label: "push-018-pre-change" });
    try {
      const appended = appendDispatchAttempt(h.store, "seed-pre-change", {
        schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
        attemptId: "attempt-pre-change",
        repository: "github.com/owner/repo",
        ref: "GH-347",
        harness: "opencode",
        evidenceClass: "pilot",
        startedAt: "2026-11-08T10:00:00.000Z",
        finishedAt: "2026-11-08T10:00:00.000Z",
        handoverState: "dual-run",
        outcome: "completed",
        token: "pr-open",
        comparison: { class: "tracker-truth", token: "pr-open", outcome: "match" },
        falseSuccess: false,
        corroboration: {
          pmNotes: "not-applicable",
          tracker: "satisfied",
          ci: "not-applicable",
        },
        evidenceRefs: ["attempt:attempt-pre-change"],
        recordedAt: "2026-11-08T10:00:00.000Z",
      });
      expect(appended.ok).toBe(true);
      const result = await h.run(["dispatch", "attempts", "--ref", "GH-347", "--json"]);
      expect(result.exit).toBe(0);
      const data = result.envelope?.data as
        | { readonly attempts?: readonly Record<string, unknown>[] }
        | undefined;
      const seeded = data?.attempts?.find((entry) => entry.attemptId === "attempt-pre-change");
      expect(seeded).toBeDefined();
      const refs = (seeded?.evidenceRefs as readonly string[]) ?? [];
      expect(refs.some((ref) => ref.startsWith("push:"))).toBe(false);
      expect(seeded?.providerProfile).toBeNull();
    } finally {
      h.dispose();
    }
  });
});

describe("TC-PUSH-013 the defect pin at the behaviour level", () => {
  test("no injected cell resolves pr-open without a readable equality", {
    timeout: 30_000,
  }, async () => {
    const cells: readonly {
      readonly name: string;
      readonly scenario: () => Promise<ParityObservation>;
      readonly expectedToken: string;
      readonly expectedExit: number;
    }[] = [
      {
        name: "clean",
        scenario: () => runScenario({ label: "pin-clean" }),
        expectedToken: "pr-open",
        expectedExit: 0,
      },
      {
        name: "ahead-then-equal",
        scenario: () =>
          runScenario({
            label: "pin-ahead-equal",
            pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
            push: "fast-forward-accepted",
          }),
        expectedToken: "pr-open",
        expectedExit: 0,
      },
      {
        name: "rejected",
        scenario: () =>
          runScenario({
            label: "pin-rejected",
            pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
            push: "non-fast-forward-rejected",
          }),
        expectedToken: "failed",
        expectedExit: 1,
      },
      {
        name: "timed-out",
        scenario: () =>
          runScenario({
            label: "pin-timed-out",
            pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
            push: "timed-out",
          }),
        expectedToken: "failed",
        expectedExit: 1,
      },
      {
        name: "stale-reread",
        scenario: () =>
          runScenario({
            label: "pin-stale",
            pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, REMOTE_HEAD],
            push: "fast-forward-accepted",
          }),
        expectedToken: "failed",
        expectedExit: 1,
      },
      {
        name: "remote-ahead",
        scenario: () =>
          runScenario({
            label: "pin-remote-ahead",
            localHead: "fedcba9876543210",
            pullHeadCalls: [LOCAL_HEAD, LOCAL_HEAD],
            push: "non-fast-forward-rejected",
          }),
        expectedToken: "failed",
        expectedExit: 1,
      },
      {
        name: "unreadable",
        scenario: () =>
          runScenario({
            label: "pin-unreadable",
            pullHeadCalls: [REMOTE_HEAD, "unreadable"],
          }),
        expectedToken: "state-unverified",
        expectedExit: 2,
      },
      {
        name: "url-unresolved",
        scenario: async () => {
          const h = createParityHarness({
            label: "pin-unresolved",
            transport: readableParityTransport({ openPulls: [numberlessPull(LOCAL_HEAD)] }),
          });
          try {
            await h.run();
            return h.observe();
          } finally {
            h.dispose();
          }
        },
        expectedToken: "pr-open-unverified",
        expectedExit: 0,
      },
    ];
    for (const cell of cells) {
      const observation = await cell.scenario();
      expect(observation.token, cell.name).toBe(cell.expectedToken);
      expect(observation.exit, cell.name).toBe(cell.expectedExit);
      // The defining property (AC-F1-2): a pr-open classification always
      // carries a parity-true disclosure, and the act structurally preceded it.
      if (observation.token === "pr-open") {
        expect(observation.envelopes[0]?.data?.push?.parity, cell.name).toBe(true);
      } else {
        expect(observation.envelopes[0]?.data?.push === undefined, cell.name).toBe(
          observation.token === "pr-open-unverified" || observation.token === "state-unverified",
        );
      }
    }
  });
});

describe("TC-PUSH-011 resume re-enters the same arm (the precondition binds resumes)", () => {
  test("a recorded lane's terminal classification re-evaluates parity idempotently", async () => {
    const { seedDispatchLane } = await import("../fixtures/dispatch/parity/lane");
    const h = createParityHarness({
      label: "push-011-resume",
      transport: readableParityTransport({ openPulls: [openPull(LOCAL_HEAD)] }),
    });
    try {
      seedDispatchLane(h.store, {
        ref: "GH-347",
        sessionId: "ses-347",
        state: "terminal",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      await h.run(["dispatch", "GH-347", "--resume-prompt", "continue", "--json"]);
      const observation = h.observe();
      expect(observation.token).toBe("pr-open");
      expect(observation.exit).toBe(0);
      expect(observation.spawns).toBe(0);
      expect(observation.resumes).toBe(1);
      // Idempotent on an equal branch: zero pushes, zero spawns charged.
      expect(pushInvocationsOf(observation)).toHaveLength(0);
      expect(attemptOf(observation)?.resumeMode).toBe("attach-continue");
      expect(attemptOf(observation)?.evidenceRefs).toContain("push:clean");
    } finally {
      h.dispose();
    }
  });

  test("a resumed lane with the local head ahead reconciles by one push", async () => {
    const { seedDispatchLane } = await import("../fixtures/dispatch/parity/lane");
    const h = createParityHarness({
      label: "push-011-resume-ahead",
      transport: readableParityTransport({ openPulls: [openPull(REMOTE_HEAD)] }),
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
      push: pushOutcomes["fast-forward-accepted"],
    });
    try {
      seedDispatchLane(h.store, {
        ref: "GH-347",
        sessionId: "ses-347",
        state: "terminal",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      await h.run(["dispatch", "GH-347", "--resume-prompt", "continue", "--json"]);
      const observation = h.observe();
      expect(observation.token).toBe("pr-open");
      expect(observation.resumes).toBe(1);
      expect(pushInvocationsOf(observation)).toHaveLength(1);
      expect(attemptOf(observation)?.evidenceRefs).toContain("push:pushed");
    } finally {
      h.dispose();
    }
  });
});

describe("TC-BND-002 the guarded runner covers the push seam (behaviour half)", () => {
  test("the recording runner refuses a requested shell or script path by name", async () => {
    const guarded = createGuardedRunner();
    await expect(
      guarded.pushRunner("bash", ["push", REMOTE_NAME, "HEAD"], {
        timeout: 1,
        killSignal: "SIGKILL",
      }),
    ).rejects.toThrow(/shell invocation recorded/u);
    await expect(
      guarded.pushRunner("git", ["push", "scripts/deliver-ticket.sh"], {
        timeout: 1,
        killSignal: "SIGKILL",
      }),
    ).rejects.toThrow(/script path recorded/u);
    expect(guarded.violations.length).toBeGreaterThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------------- */
/* GH-416 (additive) — the seam-level class table: one closed cause per       */
/* rejection class, read from the contracts vocabulary, never an exit code.   */
/* ------------------------------------------------------------------------- */

describe("GH-416 the seam's rejection detail is the closed cause token (TC-LCAUSE-001)", () => {
  const BRANCH_UNDER_TEST = "feat/GH-416/lane-pushes-own-evidence-commit";
  const classTable: readonly {
    readonly label: string;
    readonly result: GitPushRunnerResult;
    readonly cause: string;
  }[] = [
    {
      label: "non-fast-forward",
      result: { stdout: "", stderr: "! [rejected] (non-fast-forward)", status: 1, timedOut: false },
      cause: "non-fast-forward",
    },
    {
      label: "auth-rejected",
      result: { stdout: "", stderr: "fatal: Authentication failed", status: 128, timedOut: false },
      cause: "auth-rejected",
    },
    {
      label: "remote-unavailable",
      result: {
        stdout: "",
        stderr: "fatal: unable to access: Could not resolve host",
        status: 128,
        timedOut: false,
      },
      cause: "remote-unavailable",
    },
    {
      label: "protected-ref (server-side decline)",
      result: {
        stdout: "",
        stderr: "remote rejected (protected branch hook declined)",
        status: 1,
        timedOut: false,
      },
      cause: "protected-ref",
    },
    {
      label: "unclassified",
      result: { stdout: "", stderr: "unrecognised text", status: 1, timedOut: false },
      cause: "unclassified",
    },
  ];

  for (const entry of classTable) {
    test(`${entry.label} is \`rejected\` with cause ${entry.cause}`, async () => {
      let calls = 0;
      // The seam resolves its destination from one bounded configuration read,
      // so this arm declares that destination itself rather than inheriting the
      // host checkout's remotes.
      const checkout = createConfiguredCheckout({ label: "push-class-table" });
      try {
        const seam = createGitPushSeam({
          cwd: checkout.directory,
          childRunner: async () => {
            calls += 1;
            return entry.result;
          },
        });
        const result = await seam.pushChangeBranch({ branch: BRANCH_UNDER_TEST });
        expect(result).toEqual({ outcome: "rejected", detail: entry.cause });
        expect(JSON.stringify(result)).not.toContain("git-exit-");
        expect(calls).toBe(1);
      } finally {
        checkout.dispose();
      }
    });
  }
});
