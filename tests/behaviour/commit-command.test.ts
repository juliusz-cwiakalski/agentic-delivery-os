/**
 * TC-COMMIT-001..006 and TC-MSG-004 — the `commit` surface over a real temp
 * git repository. Every assertion reads durable facts back from git and the
 * state ledger, not only the envelope.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  commitDataOf,
  commitPaths,
  dataOf,
  errorCodeOf,
  excludedOf,
  head,
  lastMessage,
  ledgerLineCount,
  seedDirtyTree,
  status,
  telemetryPayloads,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-COMMIT-001 standalone commit derives the message from tree and context", () => {
  test("lands one conventional commit with the computed staging set", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: { "src/new-file.ts": "export const n = 1;\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const data = commitDataOf(run);
        expect(data.subject).toBe(`feat(${COMMIT_REF}): deliver the fixture change`);
        expect(data.subject.length).toBeLessThanOrEqual(72);
        expect(data.commitSha).toBe(head(harness));
        expect(data.stagedFiles).toEqual(["src/existing.ts", "src/new-file.ts"]);
        expect(data.messageSource).toBe("model");
        expect(data.transport).toBe("core-inference");
        expect(data.atomic).toBe(false);
        expect(data.dryRun).toBeUndefined();
        expect(lastMessage(harness)).toContain(`feat(${COMMIT_REF}):`);
        expect(commitPaths(harness)).toEqual(["src/existing.ts", "src/new-file.ts"]);
        expect(harness.coreTransport.calls).toHaveLength(1);
        expect(harness.coreTransport.calls[0]?.skeleton).toMatchObject({
          ref: COMMIT_REF,
          type: "feat",
          scope: COMMIT_REF,
          breaking: false,
        });
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-COMMIT-002 dry-run prints message/staging/exclusions and mutates nothing", () => {
  test("status, HEAD, index, and ledger stay identical", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: {
            "src/new-file.ts": "export const n = 1;\n",
            "stray.txt": "stray\n",
          },
        });
        const beforeStatus = status(harness);
        const beforeHead = head(harness);
        const beforeLedger = ledgerLineCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF, "--dry-run"]);
        expect(run.exitCode).toBe(0);
        const data = commitDataOf(run);
        expect(data.dryRun).toBe(true);
        expect(data.subject).toBe(`feat(${COMMIT_REF}): deliver the fixture change`);
        expect(data.stagedFiles).toEqual(["src/existing.ts", "src/new-file.ts"]);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt"]);
        expect(status(harness)).toBe(beforeStatus);
        expect(head(harness)).toBe(beforeHead);
        expect(harness.repo.stagedPaths()).toEqual([]);
        expect(ledgerLineCount(harness)).toBe(beforeLedger);
        expect(harness.coreTransport.calls).toHaveLength(1);
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-COMMIT-003 dry-run determinism", () => {
  test("fixed tree and injected dependencies yield byte-identical output", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: { "src/new-file.ts": "export const n = 1;\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const first = await harness.runCommit([COMMIT_REF, "--dry-run"]);
        const second = await harness.runCommit([COMMIT_REF, "--dry-run"]);
        expect(first.stdout).toBe(second.stdout);
        expect(first.exitCode).toBe(0);
        expect(second.exitCode).toBe(0);
        expect(first.stdout).not.toContain(harness.repo.root);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-COMMIT-005 `commit --phase` exercises the same atomic primitive", () => {
  test("lands one record and one commit, then phase complete is a row-2 no-op", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: { "src/new-file.ts": "export const n = 1;\n" },
        });
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(
            undefined,
            "Complete the delivery phase with the transition and artifacts.",
          ),
        });
        const run = await harness.runCommit([COMMIT_REF, "--phase", "delivery"]);
        expect(run.exitCode).toBe(0);
        const data = commitDataOf(run);
        expect(data.atomic).toBe(true);
        expect(data.ledgerTransition).toBeDefined();
        expect(data.commitSha).toBe(head(harness));
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        const records = transitionPayloads(harness);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          phaseId: "delivery",
          operation: "complete",
          commitIntent: "atomic",
        });
        const telemetry = telemetryPayloads(harness);
        expect(telemetry).toHaveLength(1);
        expect(telemetry[0]).toMatchObject({
          phaseId: "delivery",
          commitSha: data.commitSha,
          messageSource: "model",
          transport: "core-inference",
        });

        const reRun = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(reRun.exitCode).toBe(0);
        expect(dataOf(reRun).outcome).toBe("no-op");
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-COMMIT-006 ref resolution order and plan-absent degradation", () => {
  test("an unresolvable ref is a classified input rejection and mutates nothing", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const beforeStatus = status(harness);
        const beforeHead = head(harness);
        const run = await harness.runCommit([], { json: true });
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("input.value.rejected");
        expect(status(harness)).toBe(beforeStatus);
        expect(head(harness)).toBe(beforeHead);
        expect(harness.coreTransport.calls).toEqual([]);
      },
      { seedFiles: SEED, resolvedRef: null },
    );
  });

  test("the resolution source is disclosed to the transport", async () => {
    for (const source of ["branch", "change-folder"] as const) {
      await withCommitHarness(
        async (harness) => {
          seedDirtyTree(harness);
          harness.coreTransport.push({ kind: "success", message: validMessage() });
          const run = await harness.runCommit([], { json: true });
          expect(run.exitCode).toBe(0);
          expect(harness.coreTransport.calls[0]?.skeleton.refSource).toBe(source);
        },
        { seedFiles: SEED, resolvedRef: { ref: COMMIT_REF, refSource: source } },
      );
    }
  });

  test("a plan-absent phase scope degrades and never stages untracked outside scope", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: { "stray.txt": "stray\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const data = commitDataOf(run);
        expect(data.degradedScope).toBe("plan-absent");
        expect(data.stagedFiles).toEqual(["src/existing.ts"]);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt"]);
      },
      { seedFiles: SEED, omitPlan: true },
    );
  });
});

describe("TC-MSG-004 zero model calls on empty or fully-excluded staging sets", () => {
  test("a clean tree is staging-blocked with no transport call", async () => {
    await withCommitHarness(
      async (harness) => {
        const beforeHead = head(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.staging-blocked-untracked");
        expect(head(harness)).toBe(beforeHead);
        expect(harness.coreTransport.calls).toEqual([]);
        expect(harness.safety.calls).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });

  test("only stray material is staging-blocked with no transport call", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("stray.txt", "stray\n");
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.staging-blocked-untracked");
        expect(harness.coreTransport.calls).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});
