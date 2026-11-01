/** TC-CLOSE-027..030 — explicit unassign that never infers from absence. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts, makeWorkItem, observed } from "../fixtures/closeout/harness";

const unassign = (facts: Parameters<typeof buildCloseoutPlan>[0]) =>
  buildCloseoutPlan(facts).steps.find((step) => step.stepId === "unassign");

describe("TC-CLOSE-027/028 explicit clear", () => {
  test("an assigned item schedules the canonical clear", () => {
    const step = unassign(makeFacts());
    expect(step?.operations).toHaveLength(1);
    expect(step?.operations[0]?.arguments).toEqual({ assignee: "none" });
  });

  test("an absent assignee signal still schedules the clear", () => {
    const step = unassign(
      makeFacts({ observedWorkItem: observed(makeWorkItem({ assignee: undefined })) }),
    );
    expect(step?.operations).toHaveLength(1);
    expect(step?.operations[0]?.arguments).toEqual({ assignee: "none" });
  });
});

describe("TC-CLOSE-029/030 gaps and re-runs", () => {
  test("a provider without label writes declares a gap", () => {
    const facts = makeFacts();
    const step = unassign({
      ...facts,
      provider: {
        ...facts.provider,
        capabilities: {
          supportedOperations: ["read-work-item"],
          declaredGaps: [{ operation: "write-work-item", reason: "adapter-not-implemented" }],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
    });
    expect(step?.outcome).toBe("skipped-gap");
    expect(step?.reason).toBe("adapter-not-implemented");
  });
});
