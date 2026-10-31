/**
 * TC-CONF-001 / TC-CONF-005 — flow registry shape and structural non-vacuity.
 *
 * The registry is validated as untrusted data so mutation controls can feed
 * deliberately malformed copies without casts. Adapter-level coverage lands in
 * this module as the registrations and coverage gates are delivered.
 */
import { describe, expect, test } from "bun:test";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import { CONFORMANCE_FLOWS, findFlow } from "@delivery-os/testkit";

const CLOSED_OPERATIONS = new Set<string>(ADAPTER_OPERATIONS);
const EXPECTED_FLOW_IDS = ["change-lifecycle", "comment-provenance", "label-semantics"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

/**
 * Pure flow-registry validator. It operates on untrusted data and names the
 * offending flow, step, or operation in every failure.
 */
export const flowRegistryViolations = (flows: readonly unknown[]): string[] => {
  const violations: string[] = [];
  if (flows.length === 0) return ["registry: flow set is empty"];

  const flowIds = new Set<string>();
  const stepIds = new Set<string>();
  const operations = new Set<string>();

  for (const [flowIndex, rawFlow] of flows.entries()) {
    if (!isRecord(rawFlow)) {
      violations.push(`registry: flow ${flowIndex} is not an object`);
      continue;
    }
    const flowId = text(rawFlow, "flowId");
    if (flowId === undefined || flowId.trim().length === 0) {
      violations.push(`registry: flow ${flowIndex} has no flowId`);
      continue;
    }
    if (flowIds.has(flowId)) violations.push(`registry: duplicate flow id ${flowId}`);
    flowIds.add(flowId);
    if (text(rawFlow, "name") === undefined) {
      violations.push(`${flowId}: flow has no name`);
    }
    const steps = rawFlow.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      violations.push(`${flowId}: flow has no steps`);
      continue;
    }
    for (const [stepIndex, rawStep] of steps.entries()) {
      if (!isRecord(rawStep)) {
        violations.push(`${flowId}: step ${stepIndex} is not an object`);
        continue;
      }
      const stepId = text(rawStep, "stepId");
      if (stepId === undefined || stepId.trim().length === 0) {
        violations.push(`${flowId}: step ${stepIndex} has no stepId`);
        continue;
      }
      if (stepIds.has(stepId)) violations.push(`registry: duplicate step id ${stepId}`);
      stepIds.add(stepId);
      const operation = text(rawStep, "operation");
      if (operation === undefined) {
        violations.push(`${stepId}: step has no operation`);
      } else if (!CLOSED_OPERATIONS.has(operation)) {
        violations.push(`${stepId}: unknown operation ${operation}`);
      } else {
        operations.add(operation);
      }
      if (text(rawStep, "assertionFamily") === undefined) {
        violations.push(`${stepId}: step has no assertion family`);
      }
    }
  }

  if (flowIds.size !== EXPECTED_FLOW_IDS.length) {
    violations.push(
      `registry: expected ${EXPECTED_FLOW_IDS.length} flows but observed ${flowIds.size}`,
    );
  }
  for (const flowId of EXPECTED_FLOW_IDS) {
    if (!flowIds.has(flowId)) violations.push(`registry: missing flow ${flowId}`);
  }
  for (const operation of ADAPTER_OPERATIONS) {
    if (!operations.has(operation)) violations.push(`registry: missing operation ${operation}`);
  }
  return violations;
};

const withoutOperation = (operation: string): unknown => ({
  flowId: "change-lifecycle",
  name: "Change lifecycle",
  steps: [
    {
      stepId: "change-lifecycle.read-work-item",
      operation,
      assertionFamily: "work-item",
    },
  ],
});

describe("TC-CONF-001 flow registry shape", () => {
  test("exactly three flows and twelve ordered steps with unique ids", () => {
    expect(flowRegistryViolations(CONFORMANCE_FLOWS)).toEqual([]);
    expect(CONFORMANCE_FLOWS.map((flow) => flow.flowId)).toEqual([...EXPECTED_FLOW_IDS]);
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(12);
  });

  test("every closed operation is represented exactly by the registry data", () => {
    const operations = new Set(
      CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.operation)),
    );
    expect([...operations].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
    for (const operation of ADAPTER_OPERATIONS) {
      expect(operations.has(operation), operation).toBe(true);
    }
  });

  test("the public helpers are reachable through the root export", () => {
    expect(findFlow("change-lifecycle")?.steps[0]?.stepId).toBe("change-lifecycle.read-work-item");
    expect(findFlow("comment-provenance")?.steps[1]?.requiresCarrier).toBe(true);
    expect(findFlow("label-semantics")?.flowId).toBe("label-semantics");
    expect(findFlow("missing-flow")).toBeUndefined();
  });
});

describe("TC-CONF-005 flow non-vacuity and mutation controls", () => {
  test("the registry carries no empty flow, duplicate id, or unknown operation", () => {
    expect(flowRegistryViolations(CONFORMANCE_FLOWS)).toEqual([]);
    expect(CONFORMANCE_FLOWS.every((flow) => flow.steps.length > 0)).toBe(true);
  });

  test("an empty registry fails with a non-vacuity message", () => {
    expect(flowRegistryViolations([]).some((message) => message.includes("empty"))).toBe(true);
  });

  test("a fourth flow fails naming it", () => {
    const mutated: unknown[] = [
      ...CONFORMANCE_FLOWS,
      {
        flowId: "extra-flow",
        name: "Extra",
        steps: [
          {
            stepId: "extra-flow.read",
            operation: "read-work-item",
            assertionFamily: "work-item",
          },
        ],
      },
    ];
    expect(flowRegistryViolations(mutated)).toContain("registry: expected 3 flows but observed 4");
  });

  test("a duplicate step id fails naming the id", () => {
    const mutated: unknown[] = [
      ...CONFORMANCE_FLOWS,
      {
        flowId: "extra-flow",
        name: "Extra",
        steps: [
          {
            stepId: "change-lifecycle.read-work-item",
            operation: "read-work-item",
            assertionFamily: "work-item",
          },
        ],
      },
    ];
    expect(
      flowRegistryViolations(mutated).some((message) =>
        message.includes("duplicate step id change-lifecycle.read-work-item"),
      ),
    ).toBe(true);
  });

  test("an unknown operation fails naming the step and operation", () => {
    expect(
      flowRegistryViolations([withoutOperation("read-orbit")]).some((message) =>
        message.includes("unknown operation read-orbit"),
      ),
    ).toBe(true);
  });

  test("a removed operation fails naming the missing operation", () => {
    const flows = CONFORMANCE_FLOWS.map((flow) => ({
      ...flow,
      steps: flow.steps.filter((step) => step.operation !== "transition-work-item"),
    }));
    expect(
      flowRegistryViolations(flows).some((message) =>
        message.includes("missing operation transition-work-item"),
      ),
    ).toBe(true);
  });

  test("an empty flow fails naming the flow", () => {
    const mutated: unknown[] = [{ flowId: "empty-flow", name: "Empty", steps: [] }];
    expect(
      flowRegistryViolations(mutated).some((message) =>
        message.includes("empty-flow: flow has no steps"),
      ),
    ).toBe(true);
  });
});
