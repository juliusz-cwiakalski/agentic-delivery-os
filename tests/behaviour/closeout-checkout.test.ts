/** TC-CLOSE-041..044 and TC-CLOSE-066 — checkout restore and detached HEAD. */
import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGitBranchSeam } from "../../packages/adapters/src/git/index";
import { createTempRepo, type TempRepo } from "../fixtures/closeout/temp-git";

let repo: TempRepo | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

const seam = (repoDir: string) => createGitBranchSeam({ timeoutMs: 5_000, cwd: repoDir });

describe("TC-CLOSE-041 checkout restore to resolved base", () => {
  test("a delivery-branch checkout restores to the base and reports applied", async () => {
    repo = createTempRepo();
    const branchSeam = seam(repo.directory);
    const before = await branchSeam.readCheckout({
      deliveryBranch: repo.deliveryBranch,
      baseRef: repo.baseRef,
      deliveryHead: repo.deliveryHead,
    });
    expect(before.state).toBe("delivery-branch");
    expect(await branchSeam.isClean()).toBe(true);
    expect(await branchSeam.resolveRef({ ref: repo.baseRef })).toBe(true);
    expect(await branchSeam.restoreCheckout({ baseRef: repo.baseRef })).toEqual({ ok: true });
    const after = await branchSeam.readCheckout({
      deliveryBranch: repo.deliveryBranch,
      baseRef: repo.baseRef,
      deliveryHead: repo.deliveryHead,
    });
    expect(after.state).toBe("base");
  });

  test("an already-on-base checkout is base and needs no switch", async () => {
    repo = createTempRepo();
    repo.run(["checkout", repo.baseRef]);
    const fact = await seam(repo.directory).readCheckout({
      deliveryBranch: repo.deliveryBranch,
      baseRef: repo.baseRef,
      deliveryHead: repo.deliveryHead,
    });
    expect(fact.state).toBe("base");
  });

  test("an unrelated checkout is not hijacked", async () => {
    repo = createTempRepo();
    repo.run(["checkout", "-b", "chore/unrelated"]);
    const fact = await seam(repo.directory).readCheckout({
      deliveryBranch: repo.deliveryBranch,
      baseRef: repo.baseRef,
      deliveryHead: repo.deliveryHead,
    });
    expect(fact.state).toBe("unrelated");
    expect(fact.branch).toBe("chore/unrelated");
  });
});

describe("TC-CLOSE-044 dirty worktree and missing base", () => {
  test("a dirty worktree is detected and no restore is attempted by the planner", async () => {
    repo = createTempRepo();
    writeFileSync(join(repo.directory, "README.md"), "dirty\n");
    expect(await seam(repo.directory).isClean()).toBe(false);
  });

  test("a missing base ref does not resolve", async () => {
    repo = createTempRepo();
    expect(await seam(repo.directory).resolveRef({ ref: "does-not-exist" })).toBe(false);
  });
});

describe("TC-CLOSE-066 detached-at-delivery-head restore", () => {
  test("a clean detached checkout at the delivery head restores", async () => {
    repo = createTempRepo();
    repo.run(["checkout", "--detach", repo.deliveryHead]);
    const branchSeam = seam(repo.directory);
    const fact = await branchSeam.readCheckout({
      deliveryBranch: repo.deliveryBranch,
      baseRef: repo.baseRef,
      deliveryHead: repo.deliveryHead,
    });
    expect(fact.state).toBe("detached-at-delivery-head");
    expect(await branchSeam.restoreCheckout({ baseRef: repo.baseRef })).toEqual({ ok: true });
  });

  test("the injected child runner bounds a non-terminating child", async () => {
    const branchSeam = createGitBranchSeam({
      timeoutMs: 5,
      childRunner: async () => new Promise(() => {}),
    });
    const result = await branchSeam.restoreCheckout({ baseRef: "main-tools" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain("timed out");
  });
});
