/**
 * GH-416 — the ticket AC-1 fixture (TC-LPUSH-001) and the AC-2 no-op arm
 * (TC-LPUSH-002).
 *
 * The lane-push use case runs over a REAL temporary repository checkout and a
 * fake remote keyed by ref: the fake remote records the ref it was asked to push
 * to, resolves `HEAD` against the checkout AT CALL TIME, stores the head per ref,
 * and applies the fast-forward rule. No wrapper classifies; the durable record
 * and the fake remote's stored head are the whole evidence.
 *
 * The act under test starts no push child (the fake remote is the transport).
 * Real git runs only in the fixture setup and in the fake remote's own `HEAD`
 * resolution, which the test plan declares.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DispatchLanePushActOutcome,
  DispatchLanePushPorts,
} from "../../packages/core/src/app/dispatch-lane-push";
import { runDispatchLanePush } from "../../packages/core/src/app/dispatch-lane-push";
import type { DispatchLanePushRecord } from "../../packages/core/src/contracts/index";

const REF = "GH-416";
const BRANCH = "feat/GH-416/lane-pushes-own-evidence-commit";
const REPOSITORY = "github.com/owner/repo";

const git = (cwd: string, args: readonly string[]): string =>
  execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();

type TempCheckout = {
  readonly directory: string;
  readonly head: () => string;
  readonly ledger: () => readonly string[];
  readonly commit: (message: string) => string;
  readonly dispose: () => void;
};

const createTempCheckout = (): TempCheckout => {
  const directory = mkdtempSync(join(tmpdir(), "gh416-lane-push-"));
  git(directory, ["init", "-q", "-b", "main"]);
  git(directory, ["config", "user.email", "fixture@example.invalid"]);
  git(directory, ["config", "user.name", "Fixture"]);
  writeFileSync(join(directory, "README.md"), "fixture\n");
  git(directory, ["add", "README.md"]);
  git(directory, ["commit", "-q", "-m", "initial"]);
  git(directory, ["checkout", "-q", "-b", BRANCH]);
  const commit = (message: string): string => {
    writeFileSync(join(directory, `${message.replace(/[^a-z0-9]+/giu, "-")}.txt`), `${message}\n`);
    git(directory, ["add", "."]);
    git(directory, ["commit", "-q", "-m", message]);
    return git(directory, ["rev-parse", "HEAD"]);
  };
  return {
    directory,
    head: () => git(directory, ["rev-parse", "HEAD"]),
    ledger: () => git(directory, ["log", "--format=%H %s"]).split("\n").filter(Boolean),
    commit,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
};

type FakeRemote = {
  readonly push: (input: { readonly branch: string }) => Promise<DispatchLanePushActOutcome>;
  readonly refs: () => readonly string[];
  readonly headFor: (ref: string) => string | undefined;
  readonly invocations: () => number;
};

const createFakeRemote = (checkout: TempCheckout): FakeRemote => {
  const refs: string[] = [];
  const heads = new Map<string, string>();
  let invocations = 0;
  return {
    push: async ({ branch }) => {
      invocations += 1;
      refs.push(branch);
      const head = checkout.head();
      const previous = heads.get(branch);
      if (previous !== undefined && previous !== head) {
        // Fast-forward rule: the new head must descend from the stored head.
        const result = (() => {
          try {
            execFileSync("git", ["merge-base", "--is-ancestor", previous, head], {
              cwd: checkout.directory,
            });
            return true;
          } catch {
            return false;
          }
        })();
        if (!result) return { outcome: "rejected", detail: "non-fast-forward" };
      }
      heads.set(branch, head);
      return { outcome: "accepted" };
    },
    refs: () => refs,
    headFor: (ref) => heads.get(ref),
    invocations: () => invocations,
  };
};

type FixtureRun = {
  readonly result: Awaited<ReturnType<typeof runDispatchLanePush>>;
  readonly records: readonly DispatchLanePushRecord[];
  readonly remote: FakeRemote;
  readonly checkout: TempCheckout;
};

const driveLaneEnd = async (options: {
  readonly checkout: TempCheckout;
  readonly remote: FakeRemote;
  readonly records: DispatchLanePushRecord[];
  readonly withIdentity: boolean;
  readonly appendOk?: boolean;
}): Promise<FixtureRun> => {
  const ports: DispatchLanePushPorts = {
    repository: REPOSITORY,
    readBranchDeclaration: () => BRANCH,
    listBranches: async () => [{ name: BRANCH, head: options.checkout.head() }],
    readCheckoutHead: async () => options.checkout.head(),
    readLaneIdentity: () =>
      options.withIdentity ? { attemptId: "attempt-GH-416-1", sessionId: "ses-gh-416" } : undefined,
    pushChangeBranch: options.remote.push,
    appendRecord: (record) => {
      if (options.appendOk === false) return { ok: false };
      options.records.push(record);
      return { ok: true };
    },
    nowIso: () => "2026-11-27T00:00:00.000Z",
  };
  const result = await runDispatchLanePush(ports, { ref: REF });
  return { result, records: options.records, remote: options.remote, checkout: options.checkout };
};

describe("GH-416 TC-LPUSH-001 the defect case is closed by fixture", () => {
  test("no wrapper alive: one act, the remote head equals the checkout head, nothing authored", async () => {
    const checkout = createTempCheckout();
    try {
      // The lane's last evidence commits: the PR-URL note and the phase completion.
      checkout.commit("note the pull request URL");
      checkout.commit("complete the pr_creation phase");
      const ledgerBefore = checkout.ledger();
      const headBefore = checkout.head();

      const records: DispatchLanePushRecord[] = [];
      const remote = createFakeRemote(checkout);
      const run = await driveLaneEnd({
        checkout,
        remote,
        records,
        withIdentity: true,
      });

      expect(run.result.kind).toBe("answered");
      const lanePush = run.result.kind === "answered" ? run.result.data.lanePush : undefined;
      expect(lanePush?.verdict).toBe("pushed");
      expect(lanePush?.recorded).toBe(true);
      expect(lanePush?.branch).toBe(BRANCH);

      // Exactly one push invocation, for the resolved branch.
      expect(remote.invocations()).toBe(1);
      expect(remote.refs()).toEqual([BRANCH]);
      // The fake remote resolved the head itself at call time; it equals the
      // checkout's branch head after the phase-completion commit.
      expect(remote.headFor(BRANCH)).toBe(headBefore);
      expect(lanePush?.head).toBe(headBefore);
      expect(run.records[0]?.head).toBe(headBefore);

      // Nothing landed after the act, and the act authored or amended nothing.
      expect(checkout.head()).toBe(headBefore);
      expect(checkout.ledger()).toEqual(ledgerBefore);

      // The durable record carries the pushed head and the identity.
      expect(run.records).toHaveLength(1);
      expect(run.records[0]?.attemptId).toBe("attempt-GH-416-1");
      expect(run.records[0]?.sessionId).toBe("ses-gh-416");
    } finally {
      checkout.dispose();
    }
  });
});

describe("GH-416 TC-LPUSH-002 the second push of an equal head is a non-error", () => {
  test("a repeat act is accepted, exit-shaped as pushed, with no cause and a second record", async () => {
    const checkout = createTempCheckout();
    try {
      checkout.commit("note the pull request URL");
      checkout.commit("complete the pr_creation phase");
      const records: DispatchLanePushRecord[] = [];
      const remote = createFakeRemote(checkout);
      const first = await driveLaneEnd({ checkout, remote, records, withIdentity: false });
      expect(first.result.kind).toBe("answered");
      expect(first.records).toHaveLength(1);

      // No intervening commit: the head is already on the fake remote.
      const second = await driveLaneEnd({ checkout, remote, records, withIdentity: false });
      const lanePush = second.result.kind === "answered" ? second.result.data.lanePush : undefined;
      expect(lanePush?.verdict).toBe("pushed");
      expect(lanePush?.cause).toBeUndefined();
      expect(remote.invocations()).toBe(2);
      // Append-only latest-wins: two records, the newest is the new verdict.
      expect(second.records).toHaveLength(2);
      expect(second.records.at(-1)?.verdict).toBe("pushed");
      expect(remote.headFor(BRANCH)).toBe(checkout.head());
    } finally {
      checkout.dispose();
    }
  });
});
