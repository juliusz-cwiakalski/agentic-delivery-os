/**
 * TC-STAGE-007 — the legacy post-commit window (commit landed, document write
 * later failed) converges from the stored transition without a second commit.
 */
import { describe, expect, test } from "bun:test";
import { COMMIT_CHANGE_DIRECTORY, withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  dataOf,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const NOTES = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`;

describe("TC-STAGE-007 post-commit/pre-document convergence", () => {
  test("a stale document converges from the stored transition without a new commit", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "Complete the fixture delivery phase."),
        });
        const first = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(first.exitCode).toBe(0);
        const beforeCommits = commitCount(harness);
        const committedNotes = harness.repo.run(["show", `HEAD:${NOTES}`]).stdout;
        const staleNotes = harness.repo.run(["show", `HEAD~1:${NOTES}`]).stdout;
        expect(staleNotes).not.toBe(committedNotes);
        harness.repo.write(NOTES, staleNotes);

        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(second.exitCode).toBe(0);
        expect(dataOf(second).outcome).toBe("no-op");
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(harness.repo.read(NOTES)).toBe(committedNotes);

        const third = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(third.exitCode).toBe(0);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(harness.repo.read(NOTES)).toBe(committedNotes);
      },
      { seedFiles: SEED },
    );
  });
});
