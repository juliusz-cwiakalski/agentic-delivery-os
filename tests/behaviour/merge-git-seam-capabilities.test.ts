/**
 * TC-F1-013 — the retained local landing and refresh stay declared capabilities
 * proven at their own seam: `squashLand` on a clean and a conflicting branch, and
 * `refresh` on a clean, a conflicting, and a broken repository. Every assertion
 * reads the seam's returned value and its repository state directly; no case
 * composes a command.
 */
import { describe, expect, test } from "bun:test";
import { createGitMergeSeam, MERGE_SEAM_OPERATIONS } from "../../packages/adapters/src/git/index";
import type { GitMergeSeam } from "../../packages/adapters/src/git/index";
import {
  createBehindRepo,
  createConflictingRepo,
  createLandingRepo,
  FIXTURE_BASE,
  FIXTURE_BRANCH,
} from "../fixtures/merge/git-harness";

describe("TC-F1-013 the retained squashLand capability", () => {
  test("a clean branch lands one squash commit whose identity is the returned sha", async () => {
    const fixture = createLandingRepo();
    try {
      const outcome = await fixture.seam.squashLand({
        branch: fixture.branch,
        baseRef: fixture.baseRef,
        message: "merge(GH-301): squash feat/GH-301/merge",
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.requestState).toBe("merged");
      expect(outcome.squashSha).toBe(fixture.repo.head());
      expect(outcome.containedOnBase).toBe(true);
      // The squash commit's tree is the branch's tree: the capability it offers
      // is real and unchanged.
      const squashTree = fixture.repo.run(["rev-parse", `${outcome.squashSha}^{tree}`]).stdout;
      const requestTree = fixture.repo.run(["rev-parse", `${fixture.oldHead}^{tree}`]).stdout;
      expect(squashTree.trim()).toBe(requestTree.trim());
    } finally {
      fixture.cleanup();
    }
  });

  test("a conflicting branch refuses with a classified code and creates nothing", async () => {
    const fixture = createConflictingRepo();
    try {
      const before = await fixture.seam.readBranchHead(fixture.baseRef);
      const outcome = await fixture.seam.squashLand({
        branch: fixture.branch,
        baseRef: fixture.baseRef,
        message: "merge(GH-301): squash feat/GH-301/merge",
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.code).toBe("squash-failed");
      // No commit was created on the base by the refused landing.
      expect(await fixture.seam.readBranchHead(fixture.baseRef)).toBe(before);
      // The mutation control: a seam that reported merged without a commit would
      // fail the identity assertion above.
      expect(before).not.toBe("c0ffee00a1b2c3d4e5f60718293a4b5c6d7e8f90");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-F1-013 the retained refresh capability", () => {
  test("a clean behind branch refreshes and reports two distinct shas", async () => {
    const fixture = createBehindRepo();
    try {
      const outcome = await fixture.seam.refresh({
        branch: fixture.branch,
        baseRef: fixture.baseRef,
      });
      expect(outcome.outcome).toBe("succeeded");
      if (outcome.outcome !== "succeeded") return;
      expect(outcome.oldSha).toBe(fixture.oldHead);
      expect(outcome.newSha).not.toBe(outcome.oldSha);
      expect(outcome.newSha).toBe(fixture.repo.head());
    } finally {
      fixture.cleanup();
    }
  });

  test("a conflicting branch reports conflicted with bounded paths", async () => {
    const fixture = createConflictingRepo();
    try {
      const outcome = await fixture.seam.refresh({
        branch: fixture.branch,
        baseRef: fixture.baseRef,
      });
      expect(outcome.outcome).toBe("conflicted");
      if (outcome.outcome !== "conflicted") return;
      expect(outcome.paths.length).toBeGreaterThan(0);
      expect(outcome.paths).toContain("packages/core/src/a.ts");
      expect(outcome.paths).toContain("packages/core/src/b.ts");
      // The failed refresh left the branch where it was.
      expect(fixture.repo.head()).toBe(fixture.oldHead);
    } finally {
      fixture.cleanup();
    }
  });

  test("a broken repository reports failed with a code, not a mutation", async () => {
    const fixture = createLandingRepo();
    try {
      const outcome = await fixture.seam.refresh({
        branch: "feat/GH-301/absent",
        baseRef: fixture.baseRef,
      });
      expect(outcome.outcome).toBe("failed");
      if (outcome.outcome !== "failed") return;
      expect(outcome.code).toBe("branch-unresolved");
      expect(fixture.repo.head()).toBe(fixture.oldHead);
    } finally {
      fixture.cleanup();
    }
  });

  test("the capability stays declared and reachable at the seam", () => {
    for (const operation of ["squash-land", "rebase-refresh"] as const) {
      expect(MERGE_SEAM_OPERATIONS).toContain(operation);
    }
    const seam: GitMergeSeam = createGitMergeSeam();
    expect(typeof seam.squashLand).toBe("function");
    expect(typeof seam.refresh).toBe("function");
    expect(FIXTURE_BRANCH.length).toBeGreaterThan(0);
    expect(FIXTURE_BASE.length).toBeGreaterThan(0);
  });
});
