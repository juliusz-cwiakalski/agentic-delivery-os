/**
 * TC-SESS-002 (phase-2 half) — an in-session `phase complete` records the
 * transition with and without a commit and never refuses. Artifact staging and
 * completion ordering are phase-3 assertions.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  errorCodeOf,
  head,
  seedDirtyTree,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const SESSION = { insideDeliverySession: true, sessionId: "ses_fixture" } as const;

describe("TC-SESS-002 in-session phase complete", () => {
  test("the default completion lands exactly one transition and one commit", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const baselineCommits = commitCount(harness);
        const baselineHead = head(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(errorCodeOf(run)).toBeUndefined();
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(baselineCommits + 1);
        expect(head(harness)).not.toBe(baselineHead);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });

  test("--no-commit records the transition alone and a re-run is a stable no-op", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const baselineCommits = commitCount(harness);
        const first = await harness.runPhase(["complete", COMMIT_REF, "delivery", "--no-commit"]);
        expect(first.exitCode).toBe(0);
        expect(errorCodeOf(first)).toBeUndefined();
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(baselineCommits);

        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery", "--no-commit"]);
        expect(second.exitCode).toBe(0);
        expect(errorCodeOf(second)).toBeUndefined();
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(baselineCommits);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });
});
