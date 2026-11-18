/** TC-CAP-038 — absent is satisfied/no-worktree and a re-run removes nothing. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-038 worktree idempotency", () => {
  test("an absent worktree is satisfied with no-worktree", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const step = plan.steps.find((entry) => entry.stepId === "worktree-cleanup");
    expect(step?.outcome).toBe("satisfied");
    expect(step?.reason).toBe("no-worktree");
    expect(step?.operations).toEqual([]);
  });

  test("a re-run performs no second removal", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const capsule = makeCapsuleRuntime(tree.changes);
      const first = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
      });
      const second = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
      });
      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      const step = closeoutData(second.envelope).steps.find(
        (entry) => entry.stepId === "worktree-cleanup",
      );
      expect(step?.outcome).toBe("satisfied");
    } finally {
      tree.cleanup();
    }
  });
});
