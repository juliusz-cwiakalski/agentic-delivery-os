/**
 * TC-CONVERGE-001..008 — total four-state convergence over durable evidence.
 * Every single-side state is constructed directly (a simulated hard
 * interruption) and re-run twice for stability.
 */
import { describe, expect, test } from "bun:test";
import { type CommitHarness, withCommitHarness } from "../fixtures/commit/harness";
import {
  appendCompletionRecord,
  appendTelemetryRecord,
  COMMIT_REF,
  commitCount,
  dataOf,
  head,
  telemetryPayloads,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

const dirty = (harness: CommitHarness): void => {
  harness.repo.write("src/existing.ts", "export const v = 2;\n");
  harness.repo.write("src/new-file.ts", "export const n = 1;\n");
};

const preCommit = (harness: CommitHarness): string => {
  dirty(harness);
  harness.repo.run(["add", "-A", "--", "src"]);
  harness.repo.run([
    "commit",
    "--no-verify",
    "--no-gpg-sign",
    "-m",
    `feat(${COMMIT_REF}): pre-landed`,
  ]);
  return harness.repo.head();
};

describe("TC-CONVERGE-001 record with intent atomic → complete the missing commit", () => {
  test("lands exactly one commit, no new record, then a stable no-op", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness);
        appendCompletionRecord(harness, { intent: "atomic" });
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).reconciliation).toMatchObject({ completed: "commit" });
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(second.exitCode).toBe(0);
        expect(dataOf(second).outcome).toBe("no-op");
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-002 commit only → append the transition, no re-commit", () => {
  test("the durable commit is not repeated and the record carries atomic intent", async () => {
    await withCommitHarness(
      async (harness) => {
        const sha = preCommit(harness);
        appendTelemetryRecord(harness, { commitSha: sha });
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).reconciliation).toMatchObject({ completed: "transition" });
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(transitionPayloads(harness)[0]).toMatchObject({ commitIntent: "atomic" });
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-003 both landed → no-op citing the existing completion", () => {
  test("a dirty tree cannot manufacture a record or commit", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        const beforeRecords = transitionPayloads(harness).length;
        const beforeTelemetry = telemetryPayloads(harness).length;
        harness.repo.write("src/new-file.ts", "export const n = 99;\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({ outcome: "no-op", commitSkipped: "no-op" });
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(beforeRecords);
        expect(telemetryPayloads(harness)).toHaveLength(beforeTelemetry);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-004 neither landed → normal atomic path", () => {
  test("one record and one commit land with no reconciliation evidence", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).reconciliation).toBeUndefined();
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-005/007 record-only states converge to intentional no-ops", () => {
  for (const basis of ["opt-out-flag", "config-disabled", "skipped-no-pending-work"] as const) {
    test(`${basis}: no commit despite a dirty tree; the stored basis is disclosed`, async () => {
      await withCommitHarness(
        async (harness) => {
          appendCompletionRecord(harness, { intent: "record-only", basis });
          dirty(harness);
          const beforeCommits = commitCount(harness);
          const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
          expect(run.exitCode).toBe(0);
          expect(dataOf(run)).toMatchObject({
            outcome: "no-op",
            commitSkipped: basis,
            reconciliation: { completed: "intentional-no-op", basis },
          });
          expect(commitCount(harness)).toBe(beforeCommits);
          expect(transitionPayloads(harness)).toHaveLength(1);
          expect(telemetryPayloads(harness)).toEqual([]);
          const reRun = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
          expect(dataOf(reRun).commitSkipped).toBe(basis);
          expect(transitionPayloads(harness)).toHaveLength(1);
        },
        { seedFiles: SEED },
      );
    });
  }
});

describe("TC-CONVERGE-006 record-only with no pending work does not create an empty commit", () => {
  test("the stored skipped-no-pending-work basis is disclosed", async () => {
    await withCommitHarness(
      async (harness) => {
        appendCompletionRecord(harness, {
          intent: "record-only",
          basis: "skipped-no-pending-work",
        });
        const beforeHead = head(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSkipped).toBe("skipped-no-pending-work");
        expect(head(harness)).toBe(beforeHead);
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-008 intent discrimination is evidence-driven, not mode-guessing", () => {
  test("atomic intent commits even when --no-commit is passed", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness);
        appendCompletionRecord(harness, { intent: "atomic" });
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery", "--no-commit"]);
        expect(run.exitCode).toBe(0);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(transitionPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });

  test("record-only intent does not commit even with the default mode", async () => {
    await withCommitHarness(
      async (harness) => {
        appendCompletionRecord(harness, { intent: "record-only", basis: "opt-out-flag" });
        dirty(harness);
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(harness.coreTransport.calls).toHaveLength(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-CONVERGE-009 both-landed evidence is durable to later commits", () => {
  test("a later phase's atomic commit moving HEAD does not degrade the earlier phase", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "specification work\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const first = await harness.runPhase(["complete", COMMIT_REF, "specification"]);
        expect(first.exitCode).toBe(0);
        expect(dataOf(first).outcome).toBe("landed");

        harness.repo.write("src/existing.ts", "delivery work\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(second.exitCode).toBe(0);
        expect(dataOf(second).outcome).toBe("landed");
        expect(head(harness)).toBe(dataOf(second).commitSha);

        const commits = commitCount(harness);
        const records = transitionPayloads(harness).length;
        const telemetry = telemetryPayloads(harness).length;
        const calls = harness.coreTransport.calls.length;

        harness.repo.write("src/existing.ts", "must not land\n");
        const reRun = await harness.runPhase(["complete", COMMIT_REF, "specification"]);
        expect(reRun.exitCode).toBe(0);
        expect(dataOf(reRun)).toMatchObject({
          outcome: "no-op",
          commitSkipped: "no-op",
          reconciliation: { completed: "existing-completion" },
        });
        expect(commitCount(harness)).toBe(commits);
        expect(transitionPayloads(harness)).toHaveLength(records);
        expect(telemetryPayloads(harness)).toHaveLength(telemetry);
        expect(harness.coreTransport.calls.length).toBe(calls);
      },
      { seedFiles: SEED },
    );
  });

  test("a manual commit moving HEAD does not manufacture a duplicate commit", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "specification work\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const first = await harness.runPhase(["complete", COMMIT_REF, "specification"]);
        expect(first.exitCode).toBe(0);

        harness.repo.write("src/existing.ts", "manual follow-up\n");
        harness.repo.run(["add", "-A", "--", "src"]);
        harness.repo.run(["commit", "--no-verify", "--no-gpg-sign", "-m", "chore: follow-up"]);

        const commits = commitCount(harness);
        harness.repo.write("src/existing.ts", "must not land\n");
        const reRun = await harness.runPhase(["complete", COMMIT_REF, "specification"]);
        expect(reRun.exitCode).toBe(0);
        expect(dataOf(reRun).outcome).toBe("no-op");
        expect(commitCount(harness)).toBe(commits);
      },
      { seedFiles: SEED },
    );
  });

  test("commit-without-record is still detected when the orphan commit is at HEAD", async () => {
    await withCommitHarness(
      async (harness) => {
        const sha = preCommit(harness);
        appendTelemetryRecord(harness, { commitSha: sha });
        expect(head(harness)).toBe(sha);
        const commits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).reconciliation).toMatchObject({ completed: "transition" });
        expect(commitCount(harness)).toBe(commits);
      },
      { seedFiles: SEED },
    );
  });
});
