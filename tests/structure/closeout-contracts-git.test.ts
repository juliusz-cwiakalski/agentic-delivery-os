/** TC-CAP-039 — the git seam gains one no-force, no-shell, local capability. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("TC-CAP-039 worktree git seam", () => {
  test("removal uses fixed argv with no force, shell, or remote token", () => {
    const source = readFileSync("packages/adapters/src/git/index.ts", "utf8");
    const removeBlock = source.slice(source.indexOf("removeWorktree:"));
    expect(removeBlock.includes('worktree", "remove"')).toBe(true);
    expect(removeBlock.includes("--force")).toBe(false);
    expect(removeBlock.includes('-f"')).toBe(false);
    expect(removeBlock.includes("execSync")).toBe(false);
    expect(removeBlock.includes("push")).toBe(false);
    expect(removeBlock.includes("remote")).toBe(false);
  });
});

describe("TC-CAP-039 remove-worktree records under the git engine", () => {
  test("the worktree operation uses the local git engine and a supported context", async () => {
    const { buildCloseoutPlan } = await import("../../packages/core/src/domain/closeout");
    const { makeFacts, BRANCH_NAME } = await import("../fixtures/closeout/harness");
    const plan = buildCloseoutPlan(
      makeFacts({
        worktree: {
          present: true,
          safe: true,
          path: "/tmp/delivery-worktree",
          head: "a".repeat(40),
          branch: BRANCH_NAME,
        },
      }),
    );
    const operation = plan.steps.find((step) => step.stepId === "worktree-cleanup")?.operations[0];
    expect(operation?.name).toBe("remove-worktree");
    expect(operation?.engine).toBe("git");
    expect(operation?.capabilityContext).toBe("supported");
    expect(operation?.arguments).toMatchObject({
      worktreePath: "/tmp/delivery-worktree",
      expectedHead: "a".repeat(40),
    });
  });
});
