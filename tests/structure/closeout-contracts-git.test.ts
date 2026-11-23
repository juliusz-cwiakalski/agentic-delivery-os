/** TC-CAP-039 — the git seam gains one no-force, no-shell, local capability. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("TC-CAP-039 worktree git seam", () => {
  test("removal uses fixed argv with no force, shell, or remote token", () => {
    const source = readFileSync("packages/adapters/src/git/index.ts", "utf8");
    // The slice is the IMPLEMENTATION's removal block only (the type member and
    // the module tail both carry the name; GH-386's push-seam export tail
    // legitimately names its own operation, so the local-only property this
    // suite pins must be measured on the removal implementation itself).
    const removeStart = source.lastIndexOf("removeWorktree:");
    const removeBlock = source.slice(removeStart, source.indexOf("isClean:", removeStart));
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
