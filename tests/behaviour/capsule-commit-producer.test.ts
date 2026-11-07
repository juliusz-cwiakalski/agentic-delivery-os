/**
 * TC-CAP-008 — the `commit` producer.
 *
 * One `commit.landed` event per landed commit, keyed by the commit SHA, with a
 * body-free and diff-free payload, and non-gating disclosure on failure.
 */
import { describe, expect, test } from "bun:test";
import { withCommitHarness } from "../fixtures/commit/harness";
import { makeRecordingProducer } from "../fixtures/capsule/producer";
import {
  COMMIT_REF,
  commitDataOf,
  dataOf,
  head,
  seedDirtyTree,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-CAP-008 commit capsule producer", () => {
  test("one landed commit appends one body-free commit.landed event", async () => {
    const producer = makeRecordingProducer();
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: { "src/new-file.ts": "export const n = 1;\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(producer.calls.length).toBe(1);
        const request = producer.calls[0];
        expect(request?.writer).toBe("commit");
        expect(request?.kind).toBe("commit.landed");
        expect(request?.eventKey).toBe(commitDataOf(run).commitSha as string);
        expect(request?.payload.commitSha).toBe(commitDataOf(run).commitSha as string);
        expect(request?.payload.changeRef).toBe(COMMIT_REF);
        expect(request?.payload).not.toHaveProperty("body");
        expect(request?.payload).not.toHaveProperty("diff");
        expect(JSON.stringify(request?.payload)).not.toContain("fixture change");
        const capsule = dataOf(run).capsule as Record<string, unknown>;
        expect(capsule.appended).toBe(true);
      },
      { seedFiles: SEED, capsule: producer.port },
    );
  });

  test("the phase-scoped commit appends phase.transition and commit.landed", async () => {
    const producer = makeRecordingProducer();
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 3;\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF, "--phase", "delivery"]);
        expect(run.exitCode).toBe(0);
        const kinds = producer.calls.map((call) => call.kind).sort();
        expect(kinds).toEqual(["commit.landed", "phase.transition"]);
        const phase = producer.calls.find((call) => call.kind === "phase.transition");
        expect(phase?.payload.commitSha).toBe(commitDataOf(run).commitSha as string);
      },
      { seedFiles: SEED, capsule: producer.port },
    );
  });

  test("a busy capsule lock is disclosed and the commit still lands", async () => {
    const producer = makeRecordingProducer("busy");
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 4;\n" },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const before = head(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        const capsule = data.capsule as Record<string, unknown>;
        expect(capsule.code).toBe("state.lock.busy");
        expect(capsule.retryable).toBe(true);
        expect(capsule.appended).toBe(false);
        expect(head(harness)).not.toBe(before);
      },
      { seedFiles: SEED, capsule: producer.port },
    );
  });
});
