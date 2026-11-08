/**
 * TC-STAGE-005 — a standalone commit keeps the plan union when a plan exists,
 * while a plan-absent commit stages the change folder for the resolved ref and
 * leaves unrelated strays unstaged and disclosed. Also pins the `commit
 * --phase --dry-run` preview scope (F-6): the preview is the same DEC-4 union a
 * real lifecycle completion stages.
 */
import { describe, expect, test } from "bun:test";
import { COMMIT_CHANGE_DIRECTORY, withCommitHarness } from "../fixtures/commit/harness";
import { COMMIT_REF, dataOf, excludedOf } from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-STAGE-005 standalone commit scope", () => {
  test("with a plan, the staged set is the plan union only", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("src/new-file.ts", "export const n = 1;\n");
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).stagedFiles).toEqual(["src/existing.ts", "src/new-file.ts"]);
      },
      { seedFiles: SEED },
    );
  });

  test("without a plan, the change folder stages and a stray is disclosed", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write(`${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-spec.md`, "# spec\n");
        harness.repo.write(
          `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-test-plan.md`,
          "# tests\n",
        );
        harness.repo.write("stray.txt", "stray\n");
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).stagedFiles).toEqual([
          `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-spec.md`,
          `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-test-plan.md`,
        ]);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt"]);
      },
      { seedFiles: SEED, omitPlan: true },
    );
  });
});

describe("F-6 commit --phase --dry-run previews the DEC-4 completion union", () => {
  test("the preview stages plan-phase scope plus the change folder and excludes strays", async () => {
    const spec = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-spec.md`;
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("src/new-file.ts", "export const n = 1;\n");
        harness.repo.write(spec, "# spec\n");
        harness.repo.write("stray.txt", "stray\n");
        const beforeStatus = harness.repo.statusPorcelain();
        const beforeHead = harness.repo.head();
        const beforeCommits = harness.repo.commitCount();
        const run = await harness.runCommit([COMMIT_REF, "--phase", "delivery", "--dry-run"]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.dryRun).toBe(true);
        expect(data.stagedFiles).toEqual([spec, "src/existing.ts", "src/new-file.ts"]);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt"]);
        expect(harness.repo.statusPorcelain()).toBe(beforeStatus);
        expect(harness.repo.head()).toBe(beforeHead);
        expect(harness.repo.commitCount()).toBe(beforeCommits);
      },
      { seedFiles: SEED },
    );
  });
});
