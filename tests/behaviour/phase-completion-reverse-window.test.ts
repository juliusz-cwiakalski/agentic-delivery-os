/**
 * TC-STAGE-009/010 — a failed commit act after the pm-notes write restores the
 * pre-write bytes and a retry converges to exactly one transition and one
 * commit; a failed restoration exits 2 with a classified platform fault and a
 * reconciliation instruction.
 */
import { describe, expect, test } from "bun:test";
import {
  COMMIT_CHANGE_DIRECTORY,
  type CommitHarness,
  withCommitHarness,
} from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitCount,
  dataOf,
  errorCodeOf,
  head,
  telemetryPayloads,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const NOTES = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`;
const BODY = "Complete the fixture delivery phase with its artifacts.";

const arm = (harness: CommitHarness, mode: "safety" | "staging" | "commitlint" | "abort"): void => {
  if (mode === "safety") {
    harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
  }
  if (mode === "staging") harness.faults.staging = true;
  if (mode === "commitlint") {
    harness.commitlint.push({ status: "invalid", errors: ["injected commitlint failure"] });
  }
  if (mode === "abort") harness.faults.commitObject = true;
};

const disarm = (
  harness: CommitHarness,
  mode: "safety" | "staging" | "commitlint" | "abort",
): void => {
  if (mode === "safety") harness.safety.setOutcome({ ok: true, findings: [] });
  if (mode === "staging") harness.faults.staging = false;
  if (mode === "abort") harness.faults.commitObject = false;
};

const expectFailure = (
  mode: "safety" | "staging" | "commitlint" | "abort",
): { readonly exitCode: number; readonly code: string } =>
  mode === "safety" || mode === "commitlint"
    ? {
        exitCode: 1,
        code: mode === "safety" ? "commit.safety.secret-suspected" : "commit.commitlint-failed",
      }
    : { exitCode: 2, code: "commit.atomic-abort" };

describe("TC-STAGE-009 reverse window: failed commit act restores pre-write bytes", () => {
  for (const mode of ["safety", "staging", "commitlint", "abort"] as const) {
    test(`${mode} failure leaves the document, HEAD, ledger, and commit count unchanged`, async () => {
      await withCommitHarness(
        async (harness) => {
          harness.repo.write("src/existing.ts", "export const v = 2;\n");
          const snapshot = harness.repo.read(NOTES);
          const beforeHead = head(harness);
          const beforeCommits = commitCount(harness);
          arm(harness, mode);

          const expected = expectFailure(mode);
          const failed = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
          expect(failed.exitCode).toBe(expected.exitCode);
          expect(errorCodeOf(failed)).toBe(expected.code);
          expect(harness.repo.read(NOTES)).toBe(snapshot);
          expect(head(harness)).toBe(beforeHead);
          expect(commitCount(harness)).toBe(beforeCommits);
          expect(transitionPayloads(harness)).toHaveLength(0);
          expect(telemetryPayloads(harness)).toHaveLength(0);

          disarm(harness, mode);
          harness.coreTransport.push({ kind: "success", message: validMessage(undefined, BODY) });
          const retried = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
          expect(retried.exitCode).toBe(0);
          expect(dataOf(retried).outcome).toBe("landed");
          expect(transitionPayloads(harness)).toHaveLength(1);
          expect(commitCount(harness)).toBe(beforeCommits + 1);
          expect(harness.repo.read(NOTES)).not.toBe(snapshot);

          const third = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
          expect(third.exitCode).toBe(0);
          expect(dataOf(third).outcome).toBe("no-op");
          expect(transitionPayloads(harness)).toHaveLength(1);
          expect(commitCount(harness)).toBe(beforeCommits + 1);
        },
        { seedFiles: SEED },
      );
    });
  }
});

describe("TC-STAGE-010 failed restoration exits 2 with a reconciliation instruction", () => {
  test("the fault is classified, names the document and snapshot, and a later retry converges", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        const snapshot = harness.repo.read(NOTES);
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        harness.faults.commitObject = true;
        harness.faults.documentWrites = ["ok", "fail"];

        const failed = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(failed.exitCode).toBe(2);
        expect(errorCodeOf(failed)).toBe("fallback.internal");
        const error = failed.envelope?.error as { category?: string; summary?: string };
        expect(error.category).toBe("platform");
        expect(error.summary ?? "").toContain(NOTES);
        expect(error.summary ?? "").toContain("snapshot");
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(0);

        harness.faults.commitObject = false;
        harness.coreTransport.push({ kind: "success", message: validMessage(undefined, BODY) });
        const retried = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(retried.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(harness.repo.read(NOTES)).not.toBe(snapshot);
      },
      { seedFiles: SEED },
    );
  });
});
