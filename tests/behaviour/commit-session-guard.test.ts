/**
 * TC-COMMIT-004 / TC-ATOMIC-011 — the session-context guard is mechanical and
 * refuses every commit-capable invocation before any port is constructed.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  errorCodeOf,
  errorOf,
  head,
  ledgerLineCount,
  seedDirtyTree,
  status,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const SESSION = { insideDeliverySession: true, sessionId: "ses_fixture" } as const;

describe("TC-COMMIT-004 session-context refusal on the commit surface", () => {
  test("every commit invocation refuses with the user identity and mutates nothing", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const beforeStatus = status(harness);
        const beforeHead = head(harness);
        const beforeLedger = ledgerLineCount(harness);
        for (const args of [
          [COMMIT_REF],
          [COMMIT_REF, "--dry-run"],
          [COMMIT_REF, "--phase", "delivery"],
        ]) {
          const run = await harness.runCommit(args);
          expect(run.exitCode).toBe(1);
          expect(errorCodeOf(run)).toBe("commit.session.context-refused");
          expect(errorOf(run)).toMatchObject({
            category: "user",
            retryable: false,
            consequence: "not_landed",
          });
        }
        expect(status(harness)).toBe(beforeStatus);
        expect(head(harness)).toBe(beforeHead);
        expect(ledgerLineCount(harness)).toBe(beforeLedger);
        expect(harness.coreTransport.calls).toEqual([]);
        expect(harness.safety.calls).toEqual([]);

        harness.sessionFacts = { insideDeliverySession: false };
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const control = await harness.runCommit([COMMIT_REF]);
        expect(control.exitCode).toBe(0);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });
});

describe("TC-ATOMIC-011 session-context refusal on phase complete", () => {
  test("both flag shapes refuse and never append a record or commit", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        for (const args of [
          ["complete", COMMIT_REF, "delivery"],
          ["complete", COMMIT_REF, "delivery", "--no-commit"],
        ]) {
          const run = await harness.runPhase(args);
          expect(run.exitCode).toBe(1);
          expect(errorCodeOf(run)).toBe("commit.session.context-refused");
        }
        expect(harness.transitionPayloads()).toEqual([]);
        expect(harness.telemetryPayloads()).toEqual([]);
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
      },
      { seedFiles: SEED, sessionFacts: SESSION },
    );
  });
});
