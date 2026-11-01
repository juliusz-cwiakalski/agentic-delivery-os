/** TC-CLOSE-020..025 — ticket-to-done and lifecycle label disposition. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts, makeWorkItem, observed } from "../fixtures/closeout/harness";
import { FULL_LABEL_SET, SWEPT_LABEL_SET } from "../fixtures/closeout/labels";

const step = (facts: Parameters<typeof buildCloseoutPlan>[0], stepId: string) =>
  buildCloseoutPlan(facts).steps.find((entry) => entry.stepId === stepId);

describe("TC-CLOSE-020/021 ticket-to-done", () => {
  test("an open item schedules one done transition", () => {
    const ticket = step(makeFacts(), "ticket-to-done");
    expect(ticket?.outcome).toBe("would-apply");
    expect(ticket?.operations).toHaveLength(1);
    expect(ticket?.operations[0]?.arguments).toEqual({ deliveryState: "done" });
  });

  test("an already-done item is satisfied with zero writes", () => {
    const ticket = step(
      makeFacts({
        observedWorkItem: observed(
          makeWorkItem({ status: { nativeStatus: "closed", deliveryState: "done" } }),
        ),
      }),
      "ticket-to-done",
    );
    expect(ticket?.outcome).toBe("satisfied");
    expect(ticket?.operations).toEqual([]);
  });

  test("a missing transition capability is a declared gap", () => {
    const facts = makeFacts();
    const ticket = step(
      {
        ...facts,
        provider: {
          ...facts.provider,
          capabilities: {
            supportedOperations: ["read-work-item"],
            declaredGaps: [{ operation: "transition-work-item", reason: "provider-unsupported" }],
            writableCarriers: [],
            readableCarriers: [],
          },
        },
      },
      "ticket-to-done",
    );
    expect(ticket?.outcome).toBe("skipped-gap");
    expect(ticket?.reason).toBe("provider-unsupported");
  });
});

describe("TC-CLOSE-023..025 lifecycle label sweep", () => {
  test("all six lifecycle labels are removed, change and vendor labels kept, delivered added", () => {
    const labels = step(makeFacts(), "lifecycle-label-sweep");
    const removed = labels?.operations.flatMap((operation) =>
      "remove" in operation.arguments ? (operation.arguments.remove ?? []) : [],
    );
    expect(removed).toEqual([
      "planning",
      "spec-ready",
      "readiness-passed",
      "in-progress",
      "review",
      "blocked",
    ]);
    const added = labels?.operations.flatMap((operation) =>
      "add" in operation.arguments ? (operation.arguments.add ?? []) : [],
    );
    expect(added).toEqual(["delivered"]);
    expect(FULL_LABEL_SET).toContain("vendor-label");
  });

  test("an already-swept set is satisfied with zero writes", () => {
    const labels = step(
      makeFacts({ observedWorkItem: observed(makeWorkItem({ labels: [...SWEPT_LABEL_SET] })) }),
      "lifecycle-label-sweep",
    );
    expect(labels?.outcome).toBe("satisfied");
    expect(labels?.operations).toEqual([]);
  });

  test("an unavailable label signal is skipped-noop with evidence", () => {
    const labels = step(
      makeFacts({
        observedWorkItem: {
          observation: "observed",
          value: makeWorkItem(),
          signals: { labels: "unavailable" },
        },
      }),
      "lifecycle-label-sweep",
    );
    expect(labels?.outcome).toBe("skipped-noop");
    expect(labels?.reason).toBe("label-signal-unavailable");
    expect(labels?.operations).toEqual([]);
  });
});
