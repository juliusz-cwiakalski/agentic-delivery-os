/** TC-CAP-037 — every failing condition refuses and names the retained worktree. */
import { describe, expect, test } from "bun:test";
import { evaluateWorktreeSafety } from "../../packages/core/src/domain/closeout-worktree";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";

const base = {
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

describe("TC-CAP-037 worktree refusal", () => {
  for (const [label, override] of [
    ["dirty", { clean: false }],
    ["moved head", { localHead: "b".repeat(40) }],
    ["current checkout", { isCurrent: true }],
    ["locked", { locked: true }],
    ["foreign", { foreign: true }],
    ["restore failure", { restoreSucceeded: false }],
    ["earlier failure", { earlierFailure: true }],
    ["unknown head", { localHead: undefined }],
    ["not merged", { mergedObserved: false }],
  ] as const) {
    test(`${label} refuses without removal`, () => {
      const verdict = evaluateWorktreeSafety({ ...base, ...override } as never);
      expect(verdict.safe).toBe(false);
    });
  }

  test("the plan refuses with closeout.branch.unsafe and retains the worktree in residue", () => {
    const plan = buildCloseoutPlan(
      makeFacts({
        worktree: {
          present: true,
          safe: false,
          reason: "dirty",
          path: "/tmp/worktree",
          head: "a".repeat(40),
        },
      }),
    );
    const step = plan.steps.find((entry) => entry.stepId === "worktree-cleanup");
    expect(step?.outcome).toBe("would-refuse");
    expect(step?.reason).toBe("closeout.branch.unsafe");
    expect(step?.detail).toMatchObject({ retained: 1, path: "/tmp/worktree", condition: "dirty" });
    expect(plan.residue?.some((item) => item.kind === "worktree-retained")).toBe(true);
  });
});
