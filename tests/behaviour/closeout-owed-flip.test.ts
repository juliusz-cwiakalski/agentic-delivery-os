/**
 * TC-CLOSE-034/036 (signal-level half) — no reverse surface is a provider-level
 * gap, but a present surface with an unavailable signal is a signal-level skip.
 */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import {
  makeFacts,
  makeDependent,
  observed,
  testDependent,
} from "../fixtures/closeout/harness";
import {
  eligibleDependent,
  unavailableRelationDependent,
} from "../fixtures/closeout/dependents";

const owed = (facts: Parameters<typeof buildCloseoutPlan>[0]) =>
  buildCloseoutPlan(facts).steps.find((step) => step.stepId === "owed-flip-sweep");

describe("TC-CLOSE-036 no reverse-read surface is a provider-level gap", () => {
  test("a provider without read-work-item declares provider-unsupported", () => {
    const facts = makeFacts();
    const step = owed({
      ...facts,
      provider: {
        ...facts.provider,
        capabilities: {
          supportedOperations: ["read-delivery-request"],
          declaredGaps: [
            { operation: "read-work-item", reason: "provider-unsupported" },
            { operation: "write-work-item", reason: "provider-unsupported" },
          ],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
    });
    expect(step?.outcome).toBe("skipped-gap");
    expect(step?.reason).toBe("provider-unsupported");
  });
});

describe("TC-CLOSE-034 relation-signal split", () => {
  test("an unavailable current signal is skipped-noop, never an empty blocker set", () => {
    const step = owed(makeFacts({ dependents: observed([unavailableRelationDependent()]) }));
    expect(step?.outcome).toBe("skipped-noop");
    expect(step?.reason).toBe("relation-signal-unavailable");
    expect(step?.operations).toEqual([]);
  });

  test("a provider-asserted empty blocked-by set is eligible", () => {
    const step = owed(makeFacts({ dependents: observed([eligibleDependent("200")]) }));
    expect(step?.operations).toHaveLength(1);
  });

  test("an open blocker prevents a flip while an eligible sibling flips", () => {
    const step = owed(
      makeFacts({
        dependents: observed([
          eligibleDependent("200"),
          testDependent(
            makeDependent("201"),
            observed([
              makeDependent("202", {
                status: { nativeStatus: "open", deliveryState: "in-progress" },
              }),
            ]),
          ),
        ]),
      }),
    );
    expect(step?.operations.map((operation) => operation.target.entityId)).toEqual(["200"]);
    expect(step?.evidence.find((field) => field.name === "skipped")?.value).toBe(1);
  });
});
