/**
 * TC-STAGE-006 — the pm-notes transition is written before the commit act and
 * is part of the same completion commit; the parent commit does not contain it.
 */
import { describe, expect, test } from "bun:test";
import { COMMIT_CHANGE_DIRECTORY, withCommitHarness } from "../fixtures/commit/harness";
import { COMMIT_REF, dataOf, head } from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const NOTES = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`;

describe("TC-STAGE-006 completion ordering", () => {
  test("the document write precedes the commit act and lands in the commit", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        const parentNotes = harness.repo.run(["show", `HEAD:${NOTES}`]).stdout;
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSha).toBe(head(harness));

        const writeIndex = harness.events.indexOf("document-write");
        const commitIndex = harness.events.indexOf("commit-object");
        expect(writeIndex).toBeGreaterThanOrEqual(0);
        expect(commitIndex).toBeGreaterThan(writeIndex);

        const names = harness.repo.run(["show", "--name-only", "HEAD"]).stdout;
        expect(names).toContain(NOTES);
        const committedNotes = harness.repo.run(["show", `HEAD:${NOTES}`]).stdout;
        expect(committedNotes).not.toBe(parentNotes);
      },
      { seedFiles: SEED },
    );
  });
});
