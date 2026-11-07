/**
 * TC-STAGE-005 — a standalone commit keeps the plan union when a plan exists,
 * while a plan-absent commit stages the change folder for the resolved ref and
 * leaves unrelated strays unstaged and disclosed.
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
