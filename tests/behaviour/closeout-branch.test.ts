/** TC-CLOSE-045..052 and TC-CLOSE-066 — squash-safe branch cleanup matrix. */
import { afterEach, describe, expect, test } from "bun:test";
import { createGitBranchSeam } from "../../packages/adapters/src/git/index";
import { evaluateBranchSafety } from "../../packages/core/src/domain/closeout";
import { BRANCH_CASES } from "../fixtures/closeout/branch";
import { createTempRepo, type TempRepo } from "../fixtures/closeout/temp-git";

let repo: TempRepo | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

describe("TC-CLOSE-045/046/048/049 local branch operations", () => {
  test("a matching merged head deletes exactly one local branch", async () => {
    repo = createTempRepo();
    const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 5_000 });
    await seam.restoreCheckout({ baseRef: repo.baseRef });
    const branches = await seam.listBranches({ workItemRef: "GH-183" });
    expect(branches.map((branch) => branch.name)).toEqual([repo.deliveryBranch]);
    const result = await seam.deleteBranch({ branch: repo.deliveryBranch });
    expect(result).toEqual({ ok: true });
    expect(await seam.readBranch({ branch: repo.deliveryBranch })).toBeUndefined();
  });

  test("an already-absent branch reads undefined", async () => {
    repo = createTempRepo();
    const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 5_000 });
    expect(await seam.readBranch({ branch: "feat/GH-183/missing" })).toBeUndefined();
  });

  test("a foreign worktree is detected", async () => {
    repo = createTempRepo();
    const seam = createGitBranchSeam({ cwd: repo.directory, timeoutMs: 5_000 });
    await seam.restoreCheckout({ baseRef: repo.baseRef });
    repo.run(["worktree", "add", `${repo.directory}-wt`, repo.deliveryBranch]);
    try {
      expect(await seam.isCheckedOutElsewhere({ branch: repo.deliveryBranch })).toBe(true);
    } finally {
      repo.run(["worktree", "remove", `${repo.directory}-wt`]);
    }
  });
});

describe("TC-CLOSE-047 protected refs and the safety matrix", () => {
  test("the BR matrix verdicts match the declared outcomes", () => {
    for (const testCase of BRANCH_CASES) {
      const verdict = evaluateBranchSafety({
        mergedObserved: testCase.mergedObserved,
        ...(testCase.sourceRef === undefined ? {} : { sourceRef: testCase.sourceRef }),
        branchName: testCase.branchName,
        localHead: testCase.localHead,
        ...(testCase.mergedHeadSha === undefined
          ? {}
          : { mergedHeadSha: testCase.mergedHeadSha }),
        protectedRefs: ["main-tools"],
        checkedOutElsewhere: testCase.checkedOutElsewhere,
        currentCheckout: "base",
        restoreRequired: testCase.restoreRequired ?? false,
        restoreSucceeded: testCase.restoreSucceeded ?? true,
        earlierFailure: false,
      });
      if (testCase.expected === "eligible") expect(verdict.safe, testCase.id).toBe(true);
      else expect(verdict.safe, testCase.id).toBe(false);
      if (testCase.reason !== undefined) expect(verdict.reason, testCase.id).toBe(testCase.reason);
    }
  });

  test("protected names are never attempted by the seam planner", () => {
    for (const name of ["main", "main-tools", "HEAD"]) {
      const verdict = evaluateBranchSafety({
        mergedObserved: true,
        sourceRef: name,
        branchName: name,
        localHead: "a".repeat(40),
        mergedHeadSha: "a".repeat(40),
        protectedRefs: ["main-tools"],
        checkedOutElsewhere: false,
        currentCheckout: "base",
        restoreRequired: false,
        restoreSucceeded: true,
        earlierFailure: false,
      });
      expect(verdict.safe, name).toBe(false);
    }
  });
});

describe("TC-CLOSE-052 provider failure retains the branch", () => {
  test("deletion is guarded by an earlier non-gap failure", () => {
    const verdict = evaluateBranchSafety({
      mergedObserved: true,
      sourceRef: "feat/GH-183/x",
      branchName: "feat/GH-183/x",
      localHead: "b".repeat(40),
      mergedHeadSha: "b".repeat(40),
      protectedRefs: ["main-tools"],
      checkedOutElsewhere: false,
      currentCheckout: "base",
      restoreRequired: false,
      restoreSucceeded: true,
      earlierFailure: true,
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe("earlier-failure");
  });
});
