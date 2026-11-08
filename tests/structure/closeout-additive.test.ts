/** TC-CAP-050/051 — twelve-step vocabulary, schema identity, consumer tolerance. */
import { describe, expect, test } from "bun:test";
import {
  CLOSEOUT_SCHEMA_ID,
  CLOSEOUT_STEP_IDS,
  type CloseoutData,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";
import { consumeCloseout } from "../fixtures/closeout/legacy-consumer";

const APPENDIX_C = [
  "ticket-to-done",
  "lifecycle-label-sweep",
  "unassign",
  "owed-flip-sweep",
  "comment-resolution",
  "checkout-restore",
  "worktree-cleanup",
  "branch-cleanup",
  "merged-diff-sweep",
  "retro-coverage-move",
  "session-compaction",
  "capsule",
] as const;

describe("TC-CAP-050/051 closeout additive contract", () => {
  test("the step ids are exactly the Appendix C order and the schema id is unchanged", () => {
    expect([...CLOSEOUT_STEP_IDS]).toEqual([...APPENDIX_C]);
    expect(CLOSEOUT_SCHEMA_ID).toBe("delivery.closeout.v1");
  });

  test("a legacy consumer resolves by stepId and tolerates an injected unknown step", () => {
    const plan = buildCloseoutPlan(makeFacts());
    const data = {
      schemaId: "delivery.closeout.v1" as const,
      command: "closeout" as const,
      workItemRef: plan.workItemRef,
      mode: "plan" as const,
      baseRef: plan.baseRef,
      steps: [
        ...plan.steps,
        {
          stepId: "future-step",
          label: "future",
          outcome: "satisfied" as const,
          operations: [],
          evidence: [],
          future: true,
        },
      ],
      summary: plan.summary,
      ledgerKey: "closeout.operations:GH-183",
    } as unknown as CloseoutData;
    const view = consumeCloseout(data as never);
    expect(view.outcomes.capsule).toBe("would-apply");
    expect(view.outcomes["future-step"]).toBe("satisfied");
    expect(Object.keys(view.outcomes).length).toBe(APPENDIX_C.length + 1);
  });
});
