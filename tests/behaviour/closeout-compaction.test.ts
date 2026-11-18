/** TC-CAP-042 — the checkpoint content and the declared harness gap. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";

describe("TC-CAP-042 compaction checkpoint", () => {
  test("a checkpoint records bounded identities, flags, and the last commit", async () => {
    const change = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const capsule = makeCapsuleRuntime(change.changes);
      const facts = makeFacts({
        sessions: {
          available: true,
          sessionIds: ["session-a", "session-b"],
          lastVerifiedCommit: "a".repeat(40),
          unresolvedQuestions: 2,
          workingStateFlushed: true,
          eventLogFlushed: true,
        },
      });
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        facts,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "session-compaction");
      expect(step?.outcome).toBe("applied");
      const report = parseCapsuleEvents(readFileSync(`${change.folder}/events.jsonl`, "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const checkpoint = report.events.find(
        (event) => event.kind === "capsule.compaction-checkpoint",
      );
      expect(checkpoint?.payload).toMatchObject({
        sessions: ["session-a", "session-b"],
        sessionCount: 2,
        workingStateFlushed: true,
        eventLogFlushed: true,
        unresolvedQuestions: 2,
        lastVerifiedCommit: "a".repeat(40),
        gap: "harness-compaction-unavailable",
      });
    } finally {
      change.cleanup();
    }
  });
});
