/** TC-CAP-055 — a restart re-run converges: nothing duplicates. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts, makeState } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-055 restart convergence", () => {
  test("a re-run appends nothing, duplicates no decision, and converges", async () => {
    const change = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const capsule = makeCapsuleRuntime(change.changes);
      const state = makeState();
      const facts = makeFacts({
        sessions: {
          available: true,
          sessionIds: ["session-a"],
          lastVerifiedCommit: "a".repeat(40),
        },
      });
      const first = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        facts,
        state,
      });
      expect(first.exitCode).toBe(0);
      const bytes = readFileSync(`${change.folder}/events.jsonl`, "utf8");
      const second = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        facts,
        state,
      });
      expect(second.exitCode).toBe(0);
      expect(readFileSync(`${change.folder}/events.jsonl`, "utf8")).toBe(bytes);
      const outcomes = closeoutData(second.envelope).steps.map((step) => step.outcome);
      expect(
        outcomes.every(
          (outcome) =>
            outcome === "satisfied" || outcome === "skipped-noop" || outcome === "skipped-gap",
        ),
      ).toBe(true);
    } finally {
      change.cleanup();
    }
  });
});
