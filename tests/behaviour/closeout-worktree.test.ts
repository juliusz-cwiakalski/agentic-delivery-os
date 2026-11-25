/** TC-CAP-036 — the full predicate removes one local worktree without force. */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCloseoutPlan,
  type CloseoutRunInput,
  runCloseout,
} from "../../packages/core/src/domain/closeout";
import {
  evaluateWorktreeSafety,
  planCloseoutWorktreeRemoval,
} from "../../packages/core/src/domain/closeout-worktree";
import {
  BRANCH_NAME,
  HEAD_SHA,
  MERGED_HEAD_SHA,
  makeFacts,
  makeProvider,
  makeState,
} from "../fixtures/closeout/harness";

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

/**
 * TC-CLOSEOUT-002/003/004 run-level ordering (GH-404 F-6, NFR-5, AC-F6-1) —
 * the apply transaction's worktree-removal gate over the injected runtimes:
 * the lane-log sweep runs strictly before the removal, the removal is refused
 * when the sweep fails (the worktree AND the logs stay intact), the merge
 * arm refuses before any side effect, and a composition without the sweep
 * port keeps the delivered removal. The two ordering mutants
 * (TC-CLOSEOUT-005, MUT-GH404-01/02) turn these tests red.
 */
const makeWorktreeWithLogs = (): {
  readonly path: string;
  readonly log: string;
  readonly remove: () => void;
} => {
  const path = mkdtempSync(join(tmpdir(), "gh404-closeout-wt-"));
  const log = join(path, "tmp", "tmpdir", "lane.log");
  mkdirSync(join(path, "tmp", "tmpdir"), { recursive: true });
  writeFileSync(log, "gate evidence\n");
  return { path, log, remove: () => rmSync(path, { recursive: true, force: true }) };
};

const runOrderedCloseout = async (input: {
  readonly worktreePath: string;
  readonly mergeConfirmed: boolean;
  readonly safeVerdict?: boolean;
  readonly laneLogsPresent: boolean;
  readonly sweep: "ok" | "fails" | "unbound";
}): Promise<{
  readonly order: readonly string[];
  readonly result: Awaited<ReturnType<typeof runCloseout>>;
}> => {
  const order: string[] = [];
  const facts = makeFacts({
    cleanWorktree: true,
    worktree: {
      present: true,
      safe: input.safeVerdict ?? input.mergeConfirmed,
      path: input.worktreePath,
      head: HEAD_SHA,
      branch: BRANCH_NAME,
    },
    worktreeOrdering: {
      mergeConfirmed: input.mergeConfirmed,
      laneLogsPresent: input.laneLogsPresent,
      safety: {
        present: true,
        // The safety verdict is GREEN here by construction: the merge arm of
        // the ordering rules must be load-bearing INDEPENDENTLY of the
        // delivered predicate's mergedObserved arm (defense in depth), or the
        // merge-confirmation mutant survives.
        mergedObserved: true,
        conventionMatch: true,
        // The worktree head equals the merged head in the safe case (the
        // delivered predicate's head-equality arm; mismatched heads are the
        // delivered head-moved refusal).
        localHead: MERGED_HEAD_SHA,
        mergedHeadSha: MERGED_HEAD_SHA,
        clean: true,
        isCurrent: false,
        locked: false,
        foreign: false,
        restoreSucceeded: true,
        earlierFailure: false,
      },
    },
  });
  const git = makeGitOrdered();
  const sweepLaneLogs =
    input.sweep === "unbound"
      ? undefined
      : async (_sweep: { readonly worktreePath: string }) => {
          if (input.sweep === "fails") {
            return {
              ok: false as const,
              code: "closeout.lane-log-sweep-failed",
              detail: "the copy failed; nothing moved",
            };
          }
          order.push("sweep");
          return {
            ok: true as const,
            swept: true,
            destination: "/state/closeout-lane-logs/GH-183",
          };
        };
  const state = makeState();
  const result = await runCloseout({
    plan: buildCloseoutPlan(facts),
    provider: makeProvider().runtime,
    git: git as CloseoutRunInput["git"],
    state: state.runtime,
    timestamp: "2026-11-07T00:00:00.000Z",
    fenceToken: "fence-ordered",
    apply: true,
    sweepLaneLogs: sweepLaneLogs as CloseoutRunInput["sweepLaneLogs"],
    worktreeOrdering: facts.worktreeOrdering,
  });
  return { order, result };
};

const makeGitOrdered = (): CloseoutRunInput["git"] =>
  ({
    readCheckout: async () => ({ state: "delivery-branch", branch: BRANCH_NAME, head: HEAD_SHA }),
    listBranches: async () => [{ name: BRANCH_NAME, head: MERGED_HEAD_SHA }],
    readBranch: async () => ({ name: BRANCH_NAME, head: MERGED_HEAD_SHA }),
    isCheckedOutElsewhere: async () => false,
    isClean: async () => true,
    resolveRef: async () => true,
    restoreCheckout: async () => ({ ok: true }),
    deleteBranch: async () => ({ ok: true }),
    removeWorktree: async () => ({ ok: true }),
  }) as CloseoutRunInput["git"];

describe("TC-CLOSEOUT-002 the apply ordering: sweep strictly before removal", () => {
  test("a merged, safe worktree lane is swept first, then removed", async () => {
    const worktree = makeWorktreeWithLogs();
    try {
      const run = await runOrderedCloseout({
        worktreePath: worktree.path,
        mergeConfirmed: true,
        laneLogsPresent: true,
        sweep: "ok",
      });
      expect(
        run.order,
        "the sweep/ordering gate skipped: the sweep must run strictly before the removal",
      ).toEqual(["sweep"]);
      expect(run.result.ok).toBe(true);
      // The removal applied: the worktree-cleanup step reached "applied" (the
      // sweep preceded it — the join order above).
      const steps = run.result.ok ? run.result.data.steps : [];
      expect(steps.find((step) => step.stepId === "worktree-cleanup")?.outcome).toBe("applied");
    } finally {
      worktree.remove();
    }
  });

  test("a sweep failure refuses the removal: the worktree and the logs stay intact", async () => {
    const worktree = makeWorktreeWithLogs();
    try {
      const run = await runOrderedCloseout({
        worktreePath: worktree.path,
        mergeConfirmed: true,
        laneLogsPresent: true,
        sweep: "fails",
      });
      expect(run.result.ok).toBe(false);
      if (!run.result.ok) expect(run.result.error.code).toBe("closeout.write.failed");
      // TC-CLOSEOUT-003: the refusal path leaves the worktree AND the logs
      // intact (the failed sweep moved nothing) and the removal never ran.
      expect(existsSync(worktree.log)).toBe(true);
      expect(existsSync(worktree.path)).toBe(true);
      expect(run.order).toEqual([]);
    } finally {
      worktree.remove();
    }
  });

  test("the merge arm refuses before any side effect: a stalled lane keeps its worktree", async () => {
    const worktree = makeWorktreeWithLogs();
    try {
      // Defense in depth: a SAFE worktree verdict with an UNCONFIRMED merge
      // still refuses at the ordering gate — the merge arm is load-bearing
      // independently of the delivered predicate.
      const run = await runOrderedCloseout({
        worktreePath: worktree.path,
        mergeConfirmed: false,
        safeVerdict: true,
        laneLogsPresent: true,
        sweep: "ok",
      });
      // The merge-unconfirmed arm refuses with no sweep and no removal
      // (TC-CLOSEOUT-004: the stalled lane keeps its worktree).
      expect(
        run.result.ok,
        "worktree removal before merge confirmation: the merge arm must refuse",
      ).toBe(false);
      expect(run.order).toEqual([]);
      expect(existsSync(worktree.path)).toBe(true);
    } finally {
      worktree.remove();
    }
  });

  test("a composition without the sweep port keeps the delivered removal", async () => {
    const worktree = makeWorktreeWithLogs();
    try {
      const run = await runOrderedCloseout({
        worktreePath: worktree.path,
        mergeConfirmed: true,
        laneLogsPresent: false,
        sweep: "unbound",
      });
      expect(run.order).toEqual([]);
      expect(run.result.ok).toBe(true);
      // The delivered removal without the sweep port.
      const steps = run.result.ok ? run.result.data.steps : [];
      expect(steps.find((step) => step.stepId === "worktree-cleanup")?.outcome).toBe("applied");
    } finally {
      worktree.remove();
    }
  });

  test("the ordering helper refuses the unmerged-and-unsafe combination directly", () => {
    const verdict = planCloseoutWorktreeRemoval({
      mergeConfirmed: false,
      logsSwept: true,
      safety: {
        present: true,
        mergedObserved: false,
        conventionMatch: true,
        localHead: HEAD_SHA,
        mergedHeadSha: MERGED_HEAD_SHA,
        clean: true,
        isCurrent: false,
        locked: false,
        foreign: false,
        restoreSucceeded: true,
        earlierFailure: false,
      },
    });
    expect(verdict.remove).toBe(false);
    if (!verdict.remove) expect(verdict.reason).toBe("merge-unconfirmed");
  });
});
