/** TC-CLOSE-037/038/039 — thread resolution expansion, gaps, and no-request. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { CLOSEOUT_MAX_THREADS } from "../../packages/core/src/contracts/index";
import { makeFacts, makeMergedRequest, observed } from "../fixtures/closeout/harness";
import { manyThreads } from "../fixtures/closeout/threads";

const threadsStep = (facts: Parameters<typeof buildCloseoutPlan>[0]) =>
  buildCloseoutPlan(facts).steps.find((step) => step.stepId === "comment-resolution");

describe("TC-CLOSE-037 unresolved threads resolve once", () => {
  test("only unresolved threads produce operations in identity order", () => {
    const step = threadsStep(
      makeFacts({
        mergedRequest: observed(
          makeMergedRequest({
            threads: [
              { threadId: "PRRT_3", resolved: false, commentCount: 1 },
              { threadId: "PRRT_1", resolved: true, commentCount: 2 },
              { threadId: "PRRT_2", resolved: false, commentCount: 1 },
            ],
          }),
        ),
      }),
    );
    expect(step?.operations.map((operation) => ("threadId" in operation.arguments ? operation.arguments.threadId : ""))).toEqual([
      "PRRT_2",
      "PRRT_3",
    ]);
  });

  test("the 100 cap truncates deterministically", () => {
    const step = threadsStep(
      makeFacts({
        mergedRequest: observed(makeMergedRequest({ threads: manyThreads(CLOSEOUT_MAX_THREADS + 1) })),
      }),
    );
    expect(step?.operations).toHaveLength(CLOSEOUT_MAX_THREADS);
    expect(step?.truncation).toEqual({ truncated: true, omitted: 1, cap: CLOSEOUT_MAX_THREADS });
  });
});

describe("TC-CLOSE-038/039 gaps and no merged request", () => {
  test("a provider without thread resolution declares provider-unsupported", () => {
    const facts = makeFacts();
    const step = threadsStep({
      ...facts,
      provider: {
        ...facts.provider,
        capabilities: {
          supportedOperations: ["read-work-item", "write-work-item", "transition-work-item"],
          declaredGaps: [
            { operation: "read-delivery-request", reason: "provider-unsupported" },
            { operation: "resolve-delivery-thread", reason: "provider-unsupported" },
          ],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
    });
    expect(step?.outcome).toBe("skipped-gap");
    expect(step?.reason).toBe("provider-unsupported");
  });

  test("no merged request is skipped-noop with no-delivery-request", () => {
    const step = threadsStep(makeFacts({ mergedRequest: { observation: "unavailable" } }));
    expect(step?.outcome).toBe("skipped-noop");
    expect(step?.reason).toBe("no-delivery-request");
  });
});
