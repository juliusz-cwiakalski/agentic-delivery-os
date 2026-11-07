/** TC-CAP-027 — the unavailable-diff gap and re-run stability. */
import { describe, expect, test } from "bun:test";
import { evaluateDiffSweep } from "../../packages/core/src/domain/closeout-diff-sweep";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-027 merged-diff gap", () => {
  test("no merge transaction is a declared skipped-gap", () => {
    const result = evaluateDiffSweep({ workItemRef: "GH-183" });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("merged-diff-unavailable");
    expect(result.hits).toEqual([]);
  });

  test("apply renders the step as skipped-gap and still closes", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "merged-diff-sweep");
      expect(step?.outcome).toBe("skipped-gap");
      expect(step?.reason).toBe("merged-diff-unavailable");
      expect(data.capsule?.closed).toBe(true);
    } finally {
      tree.cleanup();
    }
  });
});
