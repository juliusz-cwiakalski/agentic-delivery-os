/** TC-CAP-031 — thread residue is identity-only; no surface fabricates nothing. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../../packages/core/src/domain/closeout";
import { makeFacts, makeMergedRequest } from "../../fixtures/closeout/harness";

const BODY_CANARY = "SECRET-REVIEW-BODY-CANARY";

describe("TC-CAP-031 thread privacy", () => {
  test("residue carries only the thread id and author principal", () => {
    const plan = buildCloseoutPlan(
      makeFacts({
        threadAuthorFacts: [
          { threadId: "PRRT_9", authorPrincipal: "@reviewer-bob", authorKind: "human" },
        ],
        mergedRequest: {
          observation: "observed",
          value: {
            ...makeMergedRequest(),
            threads: [
              {
                threadId: "PRRT_9",
                resolved: false,
                commentCount: 1,
                authorLogin: "@reviewer-bob",
                authorKind: "human",
              },
            ],
          },
        },
      }),
    );
    const text = JSON.stringify(plan.residue);
    expect(text).toContain("PRRT_9");
    expect(text).toContain("@reviewer-bob");
    expect(text).not.toContain(BODY_CANARY);
    expect(text).not.toContain("rename retryPolicy");
  });

  test("a provider without a thread surface keeps its delivered gap and fabricates nothing", () => {
    const plan = buildCloseoutPlan(
      makeFacts({
        provider: {
          systemName: "github",
          capabilities: {
            supportedOperations: [],
            declaredGaps: [
              { operation: "resolve-delivery-thread", reason: "adapter-not-implemented" },
            ],
            writableCarriers: [],
            readableCarriers: [],
          },
        },
        threadAuthorFacts: undefined,
      }),
    );
    const step = plan.steps.find((entry) => entry.stepId === "comment-resolution");
    expect(step?.outcome).toBe("skipped-gap");
    expect(plan.residue ?? []).toEqual([]);
  });
});
