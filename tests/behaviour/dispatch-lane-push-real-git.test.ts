/**
 * GH-416 — the real-git arm for the push seam (TC-LGIT-001).
 *
 * Every other push proof in this repository injects a child runner that returns
 * scripted text, so it validates the argv LITERALLY rather than against git's
 * grammar: an argv git rejects would keep those suites green. This suite runs
 * the seam's DEFAULT runner and DEFAULT timeout against a temporary checkout and
 * a LOCAL BARE REMOTE (a filesystem path, never a URL) and proves what only real
 * git can: the corrected `git push <resolved remote> HEAD:refs/heads/<branch>`
 * is accepted, a repeat push of an equal head is accepted, a moved remote is a
 * `non-fast-forward` refusal, the guard names are refused before any child, a
 * missing destination is `remote-unavailable`, and each of the four push-remote
 * precedence positions pushes to the expected remote.
 *
 * Offline: every configured remote is a local path, no case opens a network
 * connection, and the user and system git configuration is neutralized for the
 * suite so no host setting decides an outcome.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createGitPushSeam,
  type GitPushChildRunner,
  type GitPushRunnerResult,
} from "../../packages/adapters/src/git/index";
import { PROTECTED_REF_NAMES } from "../../packages/core/src/contracts/index";
import {
  createGitFixture,
  type GitEnvironmentIsolation,
  type GitFixture,
  isolateGitConfiguration,
} from "../fixtures/dispatch/parity/temp-repo";

const BRANCH = "feat/GH-416/lane-pushes-own-evidence-commit";

let isolation: GitEnvironmentIsolation;

beforeAll(() => {
  isolation = isolateGitConfiguration();
});

afterAll(() => {
  isolation.restore();
});

/** One fixture per arm: the arm owns its checkout, its remotes, and its cleanup. */
const withFixture = async <T>(
  input: { readonly label: string; readonly commits?: number },
  body: (fixture: GitFixture) => Promise<T> | T,
): Promise<T> => {
  const fixture = createGitFixture({
    label: input.label,
    branch: BRANCH,
    ...(input.commits === undefined ? {} : { commits: input.commits }),
  });
  try {
    return await body(fixture);
  } finally {
    fixture.dispose();
  }
};

describe("GH-416 TC-LGIT-001 the corrected argv is one real git accepts", () => {
  test("a first push is accepted and the bare remote holds the checkout head", async () => {
    await withFixture({ label: "first-push" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      fixture.addRemote("origin", origin);
      const seam = createGitPushSeam({ cwd: fixture.checkout });
      const outcome = await seam.pushChangeBranch({ branch: BRANCH });
      expect(outcome).toEqual({ outcome: "accepted" });
      expect(fixture.remoteHead("origin", `refs/heads/${BRANCH}`)).toBe(fixture.head());
    });
  });

  test("a repeat push of the same head is accepted and the remote ref does not move", async () => {
    await withFixture({ label: "repeat-push" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      fixture.addRemote("origin", origin);
      const seam = createGitPushSeam({ cwd: fixture.checkout });
      expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({ outcome: "accepted" });
      const head = fixture.head();
      expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({ outcome: "accepted" });
      expect(fixture.remoteHead("origin", `refs/heads/${BRANCH}`)).toBe(head);
      // The idempotence is git's own `Everything up-to-date` exit 0, proven by
      // the real child rather than by a scripted status.
      expect(fixture.remoteRefs("origin")).toEqual([`refs/heads/${BRANCH}`]);
    });
  });

  test("a moved remote is refused `non-fast-forward` and the remote ref stays put", async () => {
    await withFixture({ label: "non-fast-forward" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      fixture.addRemote("origin", origin);
      const seam = createGitPushSeam({ cwd: fixture.checkout });
      expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({ outcome: "accepted" });

      // A second clone advances the remote branch by one commit; the original
      // checkout then pushes a head the remote no longer fast-forwards from.
      const clone = fixture.cloneOf("origin", "second-clone");
      fixture.commitIn(clone, "remote-move.txt");
      const advanced = fixture.runIn(clone, ["rev-parse", "HEAD"]);
      fixture.runIn(clone, ["push", "--quiet", "origin", `HEAD:refs/heads/${BRANCH}`]);
      expect(fixture.remoteHead("origin", `refs/heads/${BRANCH}`)).toBe(advanced);

      expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({
        outcome: "rejected",
        detail: "non-fast-forward",
      });
      expect(fixture.remoteHead("origin", `refs/heads/${BRANCH}`)).toBe(advanced);
    });
  });
});

describe("GH-416 TC-LGIT-001 the guards refuse before any child", () => {
  test("an unsafe name and each protected name are refused with no ref on the remote", async () => {
    await withFixture({ label: "guards" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      fixture.addRemote("origin", origin);
      const seam = createGitPushSeam({ cwd: fixture.checkout });

      expect(await seam.pushChangeBranch({ branch: "bad~name" })).toEqual({
        outcome: "rejected",
        detail: "unsafe-branch",
      });
      for (const name of PROTECTED_REF_NAMES) {
        expect(await seam.pushChangeBranch({ branch: name })).toEqual({
          outcome: "rejected",
          detail: "protected-ref",
        });
      }
      // A child would have pushed (`HEAD -> refs/heads/main` is a fast-forward
      // into an empty remote); the bare remote still holds nothing.
      expect(fixture.remoteRefs("origin")).toEqual([]);
    });
  });

  test("no child starts for a guard refusal or a missing destination (ordering probe)", async () => {
    await withFixture({ label: "ordering" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      fixture.addRemote("origin", origin);
      let calls = 0;
      const counting: GitPushChildRunner = async (): Promise<GitPushRunnerResult> => {
        calls += 1;
        return { stdout: "", stderr: "", status: 0, timedOut: false };
      };
      const guarded = createGitPushSeam({ cwd: fixture.checkout, childRunner: counting });
      expect(await guarded.pushChangeBranch({ branch: "bad~name" })).toEqual({
        outcome: "rejected",
        detail: "unsafe-branch",
      });
      for (const name of PROTECTED_REF_NAMES) {
        await guarded.pushChangeBranch({ branch: name });
      }
      expect(calls).toBe(0);

      // The one bounded configuration read follows both guards and precedes the
      // child: a checkout with no remote at all answers before any act.
      const bare = createGitFixture({ label: "ordering-no-remote", branch: BRANCH });
      try {
        const seam = createGitPushSeam({ cwd: bare.checkout, childRunner: counting });
        expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({
          outcome: "rejected",
          detail: "remote-unavailable",
        });
        expect(calls).toBe(0);
        // Both guards still run before the configuration read: on a checkout
        // with no destination, an unsafe name and each protected name answer
        // their own guard instead of `remote-unavailable`, and start no child.
        // A read moved above the guards would answer `remote-unavailable`.
        expect(await seam.pushChangeBranch({ branch: "bad~name" })).toEqual({
          outcome: "rejected",
          detail: "unsafe-branch",
        });
        for (const name of PROTECTED_REF_NAMES) {
          expect(await seam.pushChangeBranch({ branch: name }), name).toEqual({
            outcome: "rejected",
            detail: "protected-ref",
          });
        }
        expect(calls).toBe(0);
      } finally {
        bare.dispose();
      }
    });
  });
});

describe("GH-416 TC-LGIT-001 a missing destination is a typed refusal", () => {
  test("no configured destination answers `remote-unavailable` and changes nothing", async () => {
    await withFixture({ label: "no-destination" }, async (fixture) => {
      const configBefore = fixture.run(["config", "--local", "--list"]);
      const headBefore = fixture.head();
      const outcome = await createGitPushSeam({ cwd: fixture.checkout }).pushChangeBranch({
        branch: BRANCH,
      });
      expect(outcome).toEqual({ outcome: "rejected", detail: "remote-unavailable" });
      expect(fixture.run(["config", "--local", "--list"])).toBe(configBefore);
      expect(fixture.head()).toBe(headBefore);
      expect(fixture.remoteUrls()).toEqual([]);
    });
  });
});

describe("GH-416 TC-LGIT-001 the push-remote precedence against real git configuration", () => {
  const positions: readonly {
    readonly label: string;
    readonly configure: (fixture: GitFixture, remotes: Readonly<Record<string, string>>) => void;
    readonly expected: string;
  }[] = [
    {
      label: "branch.<branch>.pushRemote wins over every other position",
      configure: (fixture, remotes) => {
        fixture.setConfig(`branch.${BRANCH}.pushRemote`, "pushed");
        fixture.setConfig("remote.pushDefault", "defaulted");
        fixture.setConfig(`branch.${BRANCH}.remote`, "tracked");
        for (const [name, path] of Object.entries(remotes)) fixture.addRemote(name, path);
      },
      expected: "pushed",
    },
    {
      label: "remote.pushDefault wins over the branch's tracking remote",
      configure: (fixture, remotes) => {
        fixture.setConfig("remote.pushDefault", "defaulted");
        fixture.setConfig(`branch.${BRANCH}.remote`, "tracked");
        for (const [name, path] of Object.entries(remotes)) fixture.addRemote(name, path);
      },
      expected: "defaulted",
    },
    {
      label: "branch.<branch>.remote is used when no push default exists",
      configure: (fixture, remotes) => {
        fixture.setConfig(`branch.${BRANCH}.remote`, "tracked");
        for (const [name, path] of Object.entries(remotes)) fixture.addRemote(name, path);
      },
      expected: "tracked",
    },
    {
      label: "origin is the fallback when no push position is configured",
      configure: (fixture, remotes) => {
        for (const [name, path] of Object.entries(remotes)) fixture.addRemote(name, path);
      },
      expected: "origin",
    },
  ];

  for (const position of positions) {
    test(position.label, async () => {
      await withFixture({ label: "precedence" }, async (fixture) => {
        const remotes: Record<string, string> = {
          origin: fixture.createBareRemote("origin"),
          pushed: fixture.createBareRemote("pushed"),
          defaulted: fixture.createBareRemote("defaulted"),
          tracked: fixture.createBareRemote("tracked"),
        };
        position.configure(fixture, remotes);
        const seam = createGitPushSeam({ cwd: fixture.checkout });
        expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({ outcome: "accepted" });
        expect(fixture.remoteHead(position.expected, `refs/heads/${BRANCH}`)).toBe(fixture.head());
        for (const name of Object.keys(remotes)) {
          if (name === position.expected) continue;
          expect(fixture.remoteRefs(name), name).toEqual([]);
        }
      });
    });
  }

  test("an annotated section header resolves the push remote git itself resolves", async () => {
    await withFixture({ label: "annotated-header" }, async (fixture) => {
      const origin = fixture.createBareRemote("origin");
      const pushed = fixture.createBareRemote("pushed");
      fixture.addRemote("origin", origin);
      fixture.addRemote("pushed", pushed);
      // git never writes an annotation itself, so the header is written raw: git
      // reads the trailing text as a comment and keeps the key in the section.
      appendFileSync(
        join(fixture.checkout, ".git", "config"),
        `[branch "${BRANCH}"] # hand-annotated header\n\tpushRemote = pushed\n`,
      );
      expect(fixture.run(["config", "--local", "--get", `branch.${BRANCH}.pushRemote`])).toBe(
        "pushed",
      );
      const seam = createGitPushSeam({ cwd: fixture.checkout });
      expect(await seam.pushChangeBranch({ branch: BRANCH })).toEqual({ outcome: "accepted" });
      // git's own reading is the oracle: the annotation must not divert the act.
      expect(fixture.remoteHead("pushed", `refs/heads/${BRANCH}`)).toBe(fixture.head());
      expect(fixture.remoteRefs("origin")).toEqual([]);
    });
  });

  test("every configured remote is a local path, so no arm can reach a network", async () => {
    await withFixture({ label: "no-network" }, async (fixture) => {
      fixture.addRemote("origin", fixture.createBareRemote("origin"));
      fixture.addRemote("tracked", fixture.createBareRemote("tracked"));
      const urls = fixture.remoteUrls();
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url).not.toContain("://");
        expect(url.startsWith(fixture.root)).toBe(true);
      }
    });
  });
});

describe("GH-416 TC-LGIT-001 determinism and hygiene", () => {
  test("the accepted and repeat arms are identical across two independent runs", async () => {
    const outcomes: string[] = [];
    for (const label of ["determinism-a", "determinism-b"]) {
      await withFixture({ label }, async (fixture) => {
        fixture.addRemote("origin", fixture.createBareRemote("origin"));
        const seam = createGitPushSeam({ cwd: fixture.checkout });
        const first = await seam.pushChangeBranch({ branch: BRANCH });
        const second = await seam.pushChangeBranch({ branch: BRANCH });
        outcomes.push(JSON.stringify([first, second]));
      });
    }
    expect(outcomes[0]).toBe(JSON.stringify([{ outcome: "accepted" }, { outcome: "accepted" }]));
    expect(outcomes[1]).toBe(outcomes[0]);
  });

  test("a linked worktree resolves through its .git pointer and pushes", async () => {
    // A dispatch-provisioned lane runs in a worktree, where `.git` is a pointer
    // file and the repository configuration lives in the main checkout: the one
    // bounded read must follow `commondir`.
    await withFixture({ label: "worktree" }, async (fixture) => {
      fixture.addRemote("origin", fixture.createBareRemote("origin"));
      const worktreeBranch = "feat/GH-416/worktree-arm";
      const worktree = fixture.addWorktree("lane-worktree", worktreeBranch);
      expect(fixture.runIn(worktree, ["rev-parse", "--show-toplevel"])).toBe(worktree);
      expect(existsSync(join(worktree, ".git"))).toBe(true);
      fixture.commitIn(worktree, "evidence.txt");
      const seam = createGitPushSeam({ cwd: worktree });
      expect(await seam.pushChangeBranch({ branch: worktreeBranch })).toEqual({
        outcome: "accepted",
      });
      expect(fixture.remoteHead("origin", `refs/heads/${worktreeBranch}`)).toBe(
        fixture.runIn(worktree, ["rev-parse", "HEAD"]),
      );
    });
  });

  test("a disposed fixture leaves no temporary directory behind", async () => {
    const fixture = createGitFixture({ label: "hygiene", branch: BRANCH });
    expect(existsSync(fixture.root)).toBe(true);
    fixture.dispose();
    expect(existsSync(fixture.root)).toBe(false);
  });
});
