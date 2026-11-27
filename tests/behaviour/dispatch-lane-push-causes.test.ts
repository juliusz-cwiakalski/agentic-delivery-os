/**
 * GH-416 — the push seam's closed refusal cause (TC-LCAUSE-001, TC-LCAUSE-002,
 * TC-LRES-004 step 7, TC-LBND-001 seam cells).
 *
 * Every arm drives the delivered `createGitPushSeam` over an injected child
 * runner: zero real processes, zero network. The seam classifies git's bounded
 * failure text into one of the seven recordable causes and never lets the raw
 * text leave; the guards stay before any child; the engine's parity act
 * consumes the outcome only (NG-3).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitPushSeam,
  type GitPushChildRunner,
  type GitPushRunnerResult,
} from "../../packages/adapters/src/git/index";
import { PROTECTED_REF_NAMES } from "../../packages/core/src/contracts/index";
import {
  createParityHarness,
  type ParityObservation,
  readableParityTransport,
} from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";
import {
  type ConfiguredCheckout,
  createConfiguredCheckout,
} from "../fixtures/dispatch/parity/temp-repo";

const ROOT = process.cwd();
const BRANCH = "feat/GH-416/lane-pushes-own-evidence-commit";
const PARITY_BRANCH = "feat/GH-347/parity";
const REMOTE_HEAD = "fedcba9876543210";
/** The push remote the seam's one configuration read resolves for these arms. */
const REMOTE_NAME = "origin";

/** A configuration-only checkout declaring that one remote, for the seam arms. */
let seamCheckout: ConfiguredCheckout;

beforeAll(() => {
  seamCheckout = createConfiguredCheckout({
    label: "lane-push-causes-remote",
    remotes: [REMOTE_NAME],
  });
});

afterAll(() => {
  seamCheckout.dispose();
});

type RecordingRunner = {
  readonly childRunner: GitPushChildRunner;
  readonly calls: () => number;
  readonly argv: () => readonly (readonly string[])[];
};

const recordingRunner = (result: GitPushRunnerResult): RecordingRunner => {
  let calls = 0;
  const argv: string[][] = [];
  return {
    childRunner: async (file, args) => {
      calls += 1;
      argv.push([file, ...args]);
      return result;
    },
    calls: () => calls,
    argv: () => argv,
  };
};

const rejection = (stderr: string, status = 1, stdout = ""): GitPushRunnerResult => ({
  stdout,
  stderr,
  status,
  timedOut: false,
});

const seamResult = async (
  result: GitPushRunnerResult,
): Promise<{ readonly outcome: unknown; readonly recorder: RecordingRunner }> => {
  const recorder = recordingRunner(result);
  // The seam resolves its push remote from one bounded configuration read, so
  // this arm declares the destination in a fixture checkout: the argv assertion
  // then names the value the read yields instead of depending on the host.
  const seam = createGitPushSeam({
    cwd: seamCheckout.directory,
    childRunner: recorder.childRunner,
  });
  const outcome = await seam.pushChangeBranch({ branch: BRANCH });
  return { outcome, recorder };
};

/* ------------------------------------------------------------------------- */
/* The seven recordable child-act outcomes, each naming one closed cause.     */
/* ------------------------------------------------------------------------- */

describe("GH-416 the seam names one closed cause on each child-act outcome (TC-LCAUSE-001)", () => {
  const childActCases: readonly {
    readonly label: string;
    readonly result: GitPushRunnerResult;
    readonly outcome: unknown;
  }[] = [
    {
      label: "non-fast-forward",
      result: rejection("! [rejected] main -> main (non-fast-forward)"),
      outcome: { outcome: "rejected", detail: "non-fast-forward" },
    },
    {
      label: "auth-rejected",
      result: rejection(
        "fatal: Authentication failed for 'https://example.invalid/repo.git/'",
        128,
      ),
      outcome: { outcome: "rejected", detail: "auth-rejected" },
    },
    {
      label: "remote-unavailable",
      result: rejection("fatal: unable to access: Could not resolve host: example.invalid", 128),
      outcome: { outcome: "rejected", detail: "remote-unavailable" },
    },
    {
      label: "protected-ref from a server-side decline",
      result: rejection(
        "remote: error: GH006: Protected branch update failed\n ! [remote rejected] (protected branch hook declined)",
      ),
      outcome: { outcome: "rejected", detail: "protected-ref" },
    },
    {
      label: "unclassified fallback",
      result: rejection("something entirely unexpected happened"),
      outcome: { outcome: "rejected", detail: "unclassified" },
    },
    {
      label: "spawn-failed",
      result: { stdout: "", stderr: "", status: 1, timedOut: false, spawnFailed: true },
      outcome: { outcome: "failed", detail: "spawn-failed" },
    },
    {
      label: "timed-out",
      result: { stdout: "", stderr: "", status: 1, timedOut: true },
      outcome: { outcome: "timed-out" },
    },
  ];

  for (const entry of childActCases) {
    test(`${entry.label} yields exactly one closed cause and one child invocation`, async () => {
      const { outcome, recorder } = await seamResult(entry.result);
      expect(outcome).toEqual(entry.outcome);
      expect(recorder.calls()).toBe(1);
      // The corrected argv: one repository argument (the remote the one
      // configuration read resolved), one refspec, no force, no `--ff-only`.
      expect(recorder.argv()[0]).toEqual(["git", "push", REMOTE_NAME, `HEAD:refs/heads/${BRANCH}`]);
    });
  }

  test("a non-zero exit never yields an exit-code string", async () => {
    const { outcome } = await seamResult(rejection("some unclassifiable text", 128));
    expect(JSON.stringify(outcome)).not.toContain("git-exit-");
  });

  test("a locale-flavoured text still yields one closed token, never a throw", async () => {
    const { outcome } = await seamResult(
      rejection("Fehler: Konnte den Host nicht auflösen (unbekannt)", 128),
    );
    expect(outcome).toEqual({ outcome: "rejected", detail: "unclassified" });
  });
});

/* ------------------------------------------------------------------------- */
/* Raw text never leaves the seam (TC-LCAUSE-002, §20).                       */
/* ------------------------------------------------------------------------- */

describe("GH-416 git's raw failure text never leaves the seam (TC-LCAUSE-002)", () => {
  test("a URL carrying user info and a token-shaped fragment is classified away", async () => {
    const secret = "https://example.invalid/repo.git";
    const { outcome } = await seamResult(
      rejection(
        `fatal: Authentication failed for '${secret}' (token tok_live_abcdefghijklmnop)`,
        128,
      ),
    );
    expect(outcome).toEqual({ outcome: "rejected", detail: "auth-rejected" });
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("tok_live_abcdefghijklmnop");
    expect(serialized).not.toContain("user:");
    expect(serialized).not.toContain("Authentication failed");
  });

  test("the seam declares no `protected-branch` alias and imports the closed set", () => {
    const source = readFileSync(join(ROOT, "packages/adapters/src/git/push.ts"), "utf8");
    expect(source).not.toContain("protected-branch");
    expect(source).toContain("DISPATCH_PUSH_RECORDABLE_CAUSES");
  });
});

/* ------------------------------------------------------------------------- */
/* The guard layer: rejected before any child (TC-LCAUSE-001 steps 2 and 5).  */
/* ------------------------------------------------------------------------- */

describe("GH-416 the guards refuse before any child, for a direct consumer", () => {
  test("an unsafe name is rejected `unsafe-branch` with zero child invocations", async () => {
    const recorder = recordingRunner(rejection("never reached"));
    const seam = createGitPushSeam({ childRunner: recorder.childRunner });
    const result = await seam.pushChangeBranch({ branch: "bad~name" });
    expect(result).toEqual({ outcome: "rejected", detail: "unsafe-branch" });
    expect(recorder.calls()).toBe(0);
  });

  for (const name of PROTECTED_REF_NAMES) {
    test(`the protected name ${name} is rejected \`protected-ref\` with zero children`, async () => {
      const recorder = recordingRunner(rejection("never reached"));
      const seam = createGitPushSeam({ childRunner: recorder.childRunner });
      const result = await seam.pushChangeBranch({ branch: name });
      expect(result).toEqual({ outcome: "rejected", detail: "protected-ref" });
      expect(recorder.calls()).toBe(0);
    });
  }
});

/* ------------------------------------------------------------------------- */
/* The engine consumes the outcome only (NG-3, TC-LCAUSE-001 step 7).         */
/* ------------------------------------------------------------------------- */

const openPull = (sha: string): unknown => ({
  number: 501,
  state: "open",
  head: { ref: PARITY_BRANCH, sha },
  base: { ref: "main-tools" },
  mergeable: true,
  mergeable_state: "clean",
  changed_files: 2,
});

const runEnginePush = async (
  label: string,
  push: () => GitPushRunnerResult,
): Promise<ParityObservation> => {
  const harness = createParityHarness({
    label,
    pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
    push,
    transport: readableParityTransport({ openPulls: [openPull(REMOTE_HEAD)] }),
  });
  try {
    await harness.run();
    return harness.observe();
  } finally {
    harness.dispose();
  }
};

describe("GH-416 the engine's parity act consumes the outcome only (NG-3)", () => {
  test("two different rejection causes leave the engine's verdict and evidence identical", async () => {
    const first = await runEnginePush("cause-ff", () =>
      rejection("! [rejected] main -> main (non-fast-forward)"),
    );
    const second = await runEnginePush("cause-auth", () =>
      rejection("fatal: Authentication failed", 128),
    );

    expect(first.exit).toBe(second.exit);
    expect(first.token).toBe(second.token);
    expect(first.exit).toBe(1);
    expect(first.token).toBe("failed");

    const firstAttempt = first.attempts[0];
    const secondAttempt = second.attempts[0];
    // The attempt identity is per-run; every other evidence reference is identical.
    const nonIdentityRefs = (refs: readonly string[] | undefined): readonly string[] =>
      (refs ?? []).filter((ref) => !ref.startsWith("attempt:"));
    expect(nonIdentityRefs(firstAttempt?.evidenceRefs)).toEqual(
      nonIdentityRefs(secondAttempt?.evidenceRefs),
    );
    expect(firstAttempt?.comparison).toEqual(secondAttempt?.comparison);
    expect(firstAttempt?.outcome).toBe(secondAttempt?.outcome);
    expect(firstAttempt?.token).toBe(secondAttempt?.token);
    expect(firstAttempt?.evidenceRefs).toContain("push:failed");

    const firstPushBlock = first.envelopes[0]?.data.push;
    const secondPushBlock = second.envelopes[0]?.data.push;
    expect(firstPushBlock).toEqual(secondPushBlock);
    // The GH-386 parity block keeps its four keys and carries no cause member.
    expect(Object.keys(firstPushBlock ?? {}).sort()).toEqual([
      "localHead",
      "parity",
      "remoteHead",
      "verdict",
    ]);
    expect(JSON.stringify(first.envelopes)).not.toContain("lane-push");
    expect(JSON.stringify(first.envelopes)).not.toContain("non-fast-forward");
    expect(JSON.stringify(second.envelopes)).not.toContain("auth-rejected");
    // Exactly one engine push invocation per classification; no retry.
    expect(first.invocations.filter((entry) => entry.seam === "push")).toHaveLength(1);
    expect(second.invocations.filter((entry) => entry.seam === "push")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------- */
/* The command-path arms (phase 3): each recordable cause names itself in the  */
/* answer and in one durable record; `unsafe-branch` never reaches a record.   */
/* ------------------------------------------------------------------------- */

const HEAD40 = "0123456789abcdef0123456789abcdef01234567";

const runCommandPush = async (
  push: () => GitPushRunnerResult,
): Promise<{
  readonly exit: number;
  readonly lanePush: Record<string, unknown>;
  readonly pushes: number;
  readonly records: readonly unknown[];
}> => {
  const guarded = createGuardedRunner({ head: HEAD40, push });
  const harness = createParityHarness({
    label: "lane-push-causes-command",
    localHead: HEAD40,
    guarded,
    transport: readableParityTransport(),
  });
  try {
    const run = await harness.run(["push", "GH-347", "--json"]);
    const raw = harness.store.readRecords();
    const records =
      raw.ok === true
        ? raw.value.records
            .filter((record) => record.kind === "dispatch.lane-push")
            .map((record) => record.payload)
        : [];
    const data = run.envelope?.data as { readonly lanePush?: Record<string, unknown> } | undefined;
    return {
      exit: run.exit,
      lanePush: data?.lanePush ?? {},
      pushes: guarded.pushes,
      records,
    };
  } finally {
    harness.dispose();
  }
};

describe("GH-416 the command records each of the seven causes (TC-LCAUSE-001)", () => {
  const cases: readonly {
    readonly cause: string;
    readonly result: () => GitPushRunnerResult;
  }[] = [
    {
      cause: "non-fast-forward",
      result: () => ({
        stdout: "",
        stderr: "! [rejected] (non-fast-forward)",
        status: 1,
        timedOut: false,
      }),
    },
    {
      cause: "auth-rejected",
      result: () => ({
        stdout: "",
        stderr: "fatal: Authentication failed",
        status: 128,
        timedOut: false,
      }),
    },
    {
      cause: "remote-unavailable",
      result: () => ({
        stdout: "",
        stderr: "fatal: Could not resolve host: example.invalid",
        status: 128,
        timedOut: false,
      }),
    },
    {
      cause: "protected-ref",
      result: () => ({
        stdout: "",
        stderr: "remote rejected (protected branch hook declined)",
        status: 1,
        timedOut: false,
      }),
    },
    {
      cause: "unclassified",
      result: () => ({ stdout: "", stderr: "unrecognised wording", status: 1, timedOut: false }),
    },
    {
      cause: "spawn-failed",
      result: () => ({ stdout: "", stderr: "", status: 1, timedOut: false, spawnFailed: true }),
    },
    {
      cause: "timed-out",
      result: () => ({ stdout: "", stderr: "", status: 1, timedOut: true }),
    },
  ];

  for (const entry of cases) {
    test(`${entry.cause}: failed verdict, one child, one record with the cause`, async () => {
      const run = await runCommandPush(entry.result);
      expect(run.exit).toBe(1);
      expect(run.lanePush.verdict).toBe("failed");
      expect(run.lanePush.cause).toBe(entry.cause);
      expect(run.lanePush.recorded).toBe(true);
      expect(run.pushes).toBe(1);
      expect(run.records).toHaveLength(1);
      expect((run.records[0] as { readonly cause?: string }).cause).toBe(entry.cause);
    });
  }
});

/* ------------------------------------------------------------------------- */
/* The two classification boundaries spec v1.6 DM-4 states with the corrected  */
/* act: a missing destination and a non-repository path are `remote-unavailable`*/
/* and an HTTPS 403 is `auth-rejected`, never `remote-unavailable`.            */
/* ------------------------------------------------------------------------- */

describe("GH-416 the corrected act's two classification boundaries (TC-LCAUSE-001)", () => {
  const boundaries: readonly {
    readonly label: string;
    readonly stderr: string;
    readonly status: number;
    readonly cause: string;
  }[] = [
    {
      label: "a checkout with no configured push destination",
      stderr:
        "fatal: No configured push destination.\nEither specify the URL from the command-line",
      status: 128,
      cause: "remote-unavailable",
    },
    {
      label: "a remote path that is no repository",
      stderr:
        "fatal: '/tmp/gone/remote.git' does not appear to be a git repository\nfatal: Could not read from remote repository.",
      status: 128,
      cause: "remote-unavailable",
    },
    {
      label: "an HTTPS 403 on the request",
      stderr:
        "fatal: unable to access 'https://example.invalid/repo.git/': The requested URL returned error: 403",
      status: 128,
      cause: "auth-rejected",
    },
    {
      label: "a not-granted write",
      stderr:
        "remote: Write access to repository not granted.\nfatal: unable to access the repository",
      status: 128,
      cause: "auth-rejected",
    },
  ];

  for (const boundary of boundaries) {
    test(`${boundary.label} is \`${boundary.cause}\``, async () => {
      const { outcome, recorder } = await seamResult(rejection(boundary.stderr, boundary.status));
      expect(outcome).toEqual({ outcome: "rejected", detail: boundary.cause });
      expect(recorder.calls()).toBe(1);
    });
  }

  test("a 403 never falls through to `remote-unavailable` or `unclassified`", async () => {
    for (const text of [
      "fatal: unable to access 'https://example.invalid/r.git/': The requested URL returned error: 403",
      "remote: Write access to repository not granted.",
    ]) {
      const { outcome } = await seamResult(rejection(text, 128));
      expect(outcome).toEqual({ outcome: "rejected", detail: "auth-rejected" });
      expect(JSON.stringify(outcome)).not.toContain("remote-unavailable");
      expect(JSON.stringify(outcome)).not.toContain("unclassified");
    }
  });

  // The same two wordings through the command path: the seam's classification and
  // the command's answer/record are one contract, so the combined case runs at
  // both layers rather than being composed from two separate proofs.
  const commandPathWordings: readonly {
    readonly label: string;
    readonly stderr: string;
    readonly status: number;
    readonly cause: string;
  }[] = [
    {
      label: "a missing push destination",
      stderr:
        "fatal: No configured push destination.\nEither specify the URL from the command-line",
      status: 128,
      cause: "remote-unavailable",
    },
    {
      label: "an HTTPS 403",
      stderr:
        "fatal: unable to access 'https://example.invalid/repo.git/': The requested URL returned error: 403",
      status: 128,
      cause: "auth-rejected",
    },
  ];

  for (const wording of commandPathWordings) {
    test(`${wording.label} wording answers and records \`${wording.cause}\` through \`push <ref>\``, async () => {
      const run = await runCommandPush(() => ({
        stdout: "",
        stderr: wording.stderr,
        status: wording.status,
        timedOut: false,
      }));
      expect(run.exit).toBe(1);
      expect(run.lanePush.verdict).toBe("failed");
      expect(run.lanePush.cause).toBe(wording.cause);
      expect(run.lanePush.recorded).toBe(true);
      expect(run.pushes).toBe(1);
      expect(run.records).toHaveLength(1);
      expect((run.records[0] as { readonly cause?: string }).cause).toBe(wording.cause);
    });
  }
});
