/**
 * TC-WT-001 / TC-WT-002 unit halves — the addWorktree seam against a real
 * temporary git repository (GH-404 F-1, AC-F1-1, NFR-1): a linked worktree on
 * a new branch at the base tip, the linked-only enumeration, and every git
 * refusal surfaced as a typed refusal with zero retries. The house-style
 * source-scan canary lives in tests/checks/worktree-seam-house-style.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitBranchSeam } from "@delivery-os/adapters/git";
import { createTempRepo } from "../fixtures/closeout/temp-git";

describe("TC-WT-001 addWorktree creates a linked worktree at the base tip", () => {
  test("the created worktree is linked, on the new branch, at the base tip", async () => {
    const repo = createTempRepo();
    try {
      const target = join(repo.directory, "..", `${repo.directory}-wt-GH-1`);
      const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 10_000 });
      const added = await seam.addWorktree({
        path: target,
        newBranch: "lane/GH-1",
        baseRef: repo.baseRef,
      });
      expect(added).toEqual({ ok: true, path: target, branch: "lane/GH-1" });
      // The worktree exists, is checked out on the new branch, and the branch
      // tip equals the base tip.
      const head = repo.run(["-C", target, "rev-parse", "HEAD"]);
      expect(head).toBe(repo.run(["rev-parse", repo.baseRef]));
      const branch = repo.run(["-C", target, "rev-parse", "--abbrev-ref", "HEAD"]);
      expect(branch).toBe("lane/GH-1");
      // The linked-only enumeration includes it; the main checkout is absent.
      const linked = await seam.listWorktrees();
      expect(linked.some((fact) => fact.path === target)).toBe(true);
      expect(linked.some((fact) => fact.path === repo.directory)).toBe(false);
      // The branch-checked-out-elsewhere check reads linked worktrees only.
      expect(await seam.isCheckedOutElsewhere({ branch: "lane/GH-1" })).toBe(true);
      expect(await seam.isCheckedOutElsewhere({ branch: repo.baseRef })).toBe(false);
    } finally {
      repo.remove();
    }
  });

  test("a refusal is typed, final, and leaves no worktree behind", async () => {
    const repo = createTempRepo();
    try {
      const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 10_000 });
      // The branch already exists.
      const duplicateBranch = await seam.addWorktree({
        path: join(mkdtempSync(join(tmpdir(), "gh404-wt-")), "wt"),
        newBranch: repo.deliveryBranch,
        baseRef: repo.baseRef,
      });
      expect(duplicateBranch.ok).toBe(false);
      if (!duplicateBranch.ok) expect(duplicateBranch.code).toBe("worktree-add-refused");
      // The target path already exists.
      const occupied = await seam.addWorktree({
        path: repo.directory,
        newBranch: "lane/GH-2",
        baseRef: repo.baseRef,
      });
      expect(occupied.ok).toBe(false);
      // An unsafe base ref is a plan restriction, never a git call.
      const unsafeBase = await seam.addWorktree({
        path: join(tmpdir(), "gh404-wt-unsafe"),
        newBranch: "lane/GH-3",
        baseRef: "../escape",
      });
      expect(unsafeBase).toEqual({
        ok: false,
        code: "plan-restriction",
        detail: "unsafe base ref",
      });
      // The refusal matrix created no worktrees.
      const linked = await seam.listWorktrees();
      expect(linked).toEqual([]);
    } finally {
      repo.remove();
    }
  });
});

describe("TC-IDENT-002 (behaviour half) the linked-only enumeration over real git", () => {
  test("the linked-only enumeration over real git holds with real porcelain", async () => {
    const repo = createTempRepo();
    const sibling = mkdtempSync(join(tmpdir(), "gh404-enum-"));
    const target = join(sibling, "worktree");
    try {
      repo.run(["worktree", "add", target, "-b", "lane/GH-2", repo.baseRef]);
      const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 10_000 });
      const linked = await seam.listWorktrees();
      expect(linked).toHaveLength(1);
      expect(linked[0]?.path).toBe(target);
      expect(linked[0]?.branch).toBe("lane/GH-2");
    } finally {
      repo.run(["worktree", "remove", target]);
      rmSync(sibling, { recursive: true, force: true });
      repo.remove();
    }
  });
});
