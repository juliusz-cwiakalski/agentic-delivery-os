/** TC-CLOSE-053..056 — honest capability declarations and gap honesty. */
import { describe, expect, test } from "bun:test";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts, makeWorkItem, observed } from "../fixtures/closeout/harness";

describe("TC-CLOSE-053/055 GitHub and GitLab postures", () => {
  test("GitHub supports the six closeout-relevant operations and gaps two writes", () => {
    expect([...GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations]).toEqual([
      "read-work-item",
      "read-delivery-request",
      "read-pipeline-run",
      "write-work-item",
      "transition-work-item",
      "resolve-delivery-thread",
    ]);
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps).toEqual([
      { operation: "write-comment", reason: "adapter-not-implemented" },
      { operation: "write-delivery-request", reason: "adapter-not-implemented" },
    ]);
  });

  test("GitLab declares every write including thread resolution as a gap", () => {
    const gaps = new Set(GITLAB_ADAPTER_CONTRACT.capabilities.declaredGaps.map((gap) => gap.operation));
    for (const operation of [
      "read-work-item",
      "write-work-item",
      "transition-work-item",
      "write-delivery-request",
      "write-comment",
      "resolve-delivery-thread",
    ]) {
      expect(gaps.has(operation as never)).toBe(true);
    }
  });
});

describe("TC-CLOSE-056 unsupported operations never report success", () => {
  test("a GitLab-style declaration yields skipped-gap, never applied", () => {
    const facts = makeFacts();
    const plan = buildCloseoutPlan({
      ...facts,
      provider: {
        systemName: "gitlab",
        capabilities: GITLAB_ADAPTER_CONTRACT.capabilities,
      },
      observedWorkItem: observed(makeWorkItem()),
    });
    for (const step of plan.steps) {
      expect(["skipped-gap", "satisfied", "skipped-noop", "would-apply", "would-refuse"]).toContain(
        step.outcome,
      );
      expect(step.outcome).not.toBe("applied");
    }
    expect(plan.steps.find((step) => step.stepId === "ticket-to-done")?.outcome).toBe(
      "skipped-gap",
    );
  });
});
