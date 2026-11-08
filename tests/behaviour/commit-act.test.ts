/**
 * TC-EFFECT-005 / TC-RECON-007 / TC-ATOMIC (redrive) — the commit primitive's
 * crash window: the pre-commit intent, one bounded log read, no second commit,
 * and owner-side binding restoration through commit-without-record.
 */
import { describe, expect, test } from "bun:test";
import { createGitCommitSeam } from "../../packages/adapters/src/git";
import {
  beginCommitEffect,
  detectDaemonEffects,
  readOutboxEffects,
  recordRedriveRequest,
} from "../../packages/core/src/app/index";
import { COMMIT_CHANGE_DIRECTORY, withCommitHarness } from "../fixtures/commit/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { COMMIT_REF, commitCount, dataOf, transitionPayloads } from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("GH-238 commit crash safety", () => {
  test("the intent is durable before the commit primitive is invoked", async () => {
    const root = makeTempRoot("gh238-commit-act");
    try {
      const { store } = openStore(makeIdentity(root));
      let intentBeforeCommit = false;
      const commit = async (): Promise<{ sha: string }> => {
        const read = readOutboxEffects(store);
        intentBeforeCommit = read.ok && read.latest.has("effect-1");
        return { sha: "b".repeat(40) };
      };
      const intent = beginCommitEffect({
        store,
        fenceToken: "f1",
        effectId: "effect-1",
        intentId: "intent-1",
        ref: "GH-238",
        changeRef: "GH-238",
        phase: "delivery",
        baselineHead: "a".repeat(40),
        stagedPaths: ["src/a.ts"],
        payloadDigest: "digest",
        nowIso: "2026-11-08T10:00:00Z",
      });
      expect(intent.ok).toBe(true);
      await commit();
      expect(intentBeforeCommit).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the owner restores the phase binding from the redrive SHA without a second commit", async () => {
    let orphan = "";
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "orphan work\n");
        harness.repo.run(["add", "-A", "--", "src"]);
        harness.repo.run(["commit", "--no-verify", "--no-gpg-sign", "-m", "feat: orphan"]);
        orphan = harness.repo.head();
        const commits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.commitSha).toBe(orphan);
        expect(data.reconciliation).toMatchObject({ completed: "transition" });
        expect(commitCount(harness)).toBe(commits);
        const records = transitionPayloads(harness);
        expect(records[0]).toMatchObject({
          phaseId: "delivery",
          operation: "complete",
          commitIntent: "atomic",
          commitSha: orphan,
        });
      },
      {
        seedFiles: SEED,
        readRedriveEvidence: async () =>
          orphan.length === 0 ? undefined : { commitSha: orphan, source: "redrive" },
      },
    );
  });

  test("without the redrive evidence the crash leaves the phase bound to a fresh transition commit, not the orphan", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "orphan work\n");
        harness.repo.run(["add", "-A", "--", "src"]);
        harness.repo.run(["commit", "--no-verify", "--no-gpg-sign", "-m", "feat: orphan"]);
        const orphan = harness.repo.head();
        const commits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        // The completion writes the pm-notes transition before the commit act
        // (GH-242 staging scope), so without redrive evidence it lands a fresh
        // transition commit instead of a record-only no-op. The orphan work
        // commit is never adopted as the phase binding.
        expect(data.commitSha).toBeDefined();
        expect(data.commitSha).not.toBe(orphan);
        expect(commitCount(harness)).toBe(commits + 1);
        const records = transitionPayloads(harness);
        expect(records[0]).toMatchObject({ commitIntent: "atomic", commitSha: data.commitSha });
        expect(records[0]).not.toMatchObject({ commitSha: orphan });
      },
      { seedFiles: SEED },
    );
  });

  test("the production wrapper writes the intent before the commit and crash recovery converges", async () => {
    let orphan = "";
    let baseline = "";
    let intentBeforeCommit = false;
    let storeRef: Parameters<typeof readOutboxEffects>[0] | undefined;
    await withCommitHarness(
      async (harness) => {
        storeRef = harness.store;
        baseline = harness.repo.head();
        harness.repo.write("src/existing.ts", "orphan work\n");
        const crashed = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(crashed.exitCode).not.toBe(0);
        expect(orphan.length).toBe(40);
        expect(intentBeforeCommit).toBe(true);

        const effects = readOutboxEffects(harness.store);
        expect(effects.ok).toBe(true);
        if (!effects.ok) return;
        const effect = [...effects.records]
          .reverse()
          .find(
            (candidate) => candidate.changeRef === COMMIT_REF && candidate.phase === "delivery",
          );
        expect(effect).toBeDefined();
        expect(effect?.baselineHead).toBe(baseline);
        expect(effect?.stagedPaths).toEqual([
          `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`,
          "src/existing.ts",
        ]);
        expect(effect?.state).toBe("in-flight");

        const log = createGitCommitSeam({ cwd: harness.repo.root });
        const detected = await detectDaemonEffects({
          list: () => {
            const read = readOutboxEffects(harness.store);
            return read.ok ? read.records : [];
          },
          logSince: (head) => log.logSince(head, 32),
          record: (request) => {
            const appended = recordRedriveRequest(harness.store, "redrive-fence", {
              ...request,
              nowIso: "2026-11-09T01:00:00Z",
            });
            return appended.ok ? { ok: true } : { ok: false, code: appended.code };
          },
          nowIso: "2026-11-09T01:00:00Z",
        });
        expect(detected).toEqual({ ok: true, requests: 1 });

        const commitsAfterCrash = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.commitSha).toBe(orphan);
        expect(data.reconciliation).toMatchObject({ completed: "transition" });
        expect(commitCount(harness)).toBe(commitsAfterCrash);
        expect(transitionPayloads(harness)[0]).toMatchObject({
          phaseId: "delivery",
          operation: "complete",
          commitIntent: "atomic",
          commitSha: orphan,
        });
      },
      {
        seedFiles: SEED,
        readRedriveEvidenceFromStore: true,
        afterCommitLand: (sha) => {
          orphan = sha;
          if (storeRef !== undefined) {
            const read = readOutboxEffects(storeRef);
            intentBeforeCommit =
              read.ok &&
              [...read.records].some(
                (record) =>
                  record.changeRef === COMMIT_REF &&
                  record.phase === "delivery" &&
                  record.state === "in-flight",
              );
          }
          throw new Error(`killed after commit ${sha}`);
        },
      },
    );
  });
});
