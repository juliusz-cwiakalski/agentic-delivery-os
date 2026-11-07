/** TC-CAP-036 — the full predicate removes one local worktree without force. */
import { describe, expect, test } from "bun:test";
import { evaluateWorktreeSafety } from "../../packages/core/src/domain/closeout-worktree";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";

const safeInput = {
  present: true,
  mergedObserved: true,
  conventionMatch: true,
  localHead: "a".repeat(40),
  mergedHeadSha: "a".repeat(40),
  clean: true,
  isCurrent: false,
  locked: false,
  foreign: false,
  restoreSucceeded: true,
  earlierFailure: false,
} as const;

describe("TC-CAP-036 worktree removal", () => {
  test("the full predicate passes and plans one remove-worktree operation", () => {
    expect(evaluateWorktreeSafety(safeInput)).toEqual({ safe: true });
    const plan = buildCloseoutPlan(
      makeFacts({
        worktree: { present: true, safe: true, path: "/tmp/worktree", head: "a".repeat(40) },
      }),
    );
    const step = plan.steps.find((entry) => entry.stepId === "worktree-cleanup");
    expect(step?.outcome).toBe("would-apply");
    expect(step?.operations.map((operation) => operation.name)).toEqual(["remove-worktree"]);
  });

  test("worktree cleanup precedes branch cleanup", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const ids = plan.steps.map((step) => step.stepId);
    expect(ids.indexOf("worktree-cleanup")).toBeLessThan(ids.indexOf("branch-cleanup"));
  });
});

describe("TC-CAP-037 worktree removal re-checks head and cleanliness", () => {
  test("a stale expected head or a dirty worktree is refused immediately before removal", async () => {
    const { existsSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { createGitBranchSeam } = await import("../../packages/adapters/src/git");
    const { createTempRepo } = await import("../fixtures/closeout/temp-git");
    const repo = createTempRepo();
    const worktreePath = join(mkdtempSync(join(tmpdir(), "gh240-wt-")), "delivery");
    try {
      repo.run(["checkout", "main-tools"]);
      repo.run(["worktree", "add", worktreePath, repo.deliveryBranch]);
      const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 30_000 });
      const head = repo.run(["rev-parse", repo.deliveryBranch]);
      const stale = await seam.removeWorktree({
        path: worktreePath,
        expectedHead: "b".repeat(40),
      });
      expect(stale.ok).toBe(false);
      expect(existsSync(worktreePath)).toBe(true);
      writeFileSync(join(worktreePath, "dirty.txt"), "dirty\n");
      const dirty = await seam.removeWorktree({ path: worktreePath, expectedHead: head });
      expect(dirty.ok).toBe(false);
      expect(existsSync(worktreePath)).toBe(true);
    } finally {
      repo.remove();
    }
  });
});
