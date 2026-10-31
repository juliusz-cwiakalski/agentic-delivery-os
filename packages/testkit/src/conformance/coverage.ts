/**
 * Structural and runtime conformance coverage gates (GH-189 F-5, D-13).
 *
 * Every violation names the provider and the flow, step, or operation it
 * concerns. Structural checks accept untrusted data so mutation controls can
 * feed malformed registries without casts.
 */
import { ADAPTER_OPERATIONS, type AdapterOperation } from "@delivery-os/core/contracts";
import type { ConformanceAdapterRegistration, ConformanceReport } from "./types.js";

/** The explicit closed read-only subset for the live tier (D-13). */
export const LIVE_READ_OPERATIONS = [
  "read-work-item",
  "read-delivery-request",
  "read-pipeline-run",
] as const satisfies readonly AdapterOperation[];

const CLOSED_OPERATIONS = new Set<string>(ADAPTER_OPERATIONS);
const CLOSED_GAP_REASONS = new Set([
  "provider-unsupported",
  "adapter-not-implemented",
  "plan-restriction",
]);
const LIVE_READS = new Set<string>(LIVE_READ_OPERATIONS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: Record<string, unknown>, key: string): string | undefined => {
  const field = value[key];
  return typeof field === "string" && field.trim().length > 0 ? field : undefined;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const stepOperations = (flows: readonly unknown[]): Set<string> => {
  const operations = new Set<string>();
  for (const flow of flows) {
    if (!isRecord(flow) || !Array.isArray(flow.steps)) continue;
    for (const step of flow.steps) {
      if (isRecord(step)) {
        const operation = text(step, "operation");
        if (operation !== undefined) operations.add(operation);
      }
    }
  }
  return operations;
};

const hasCarrierStep = (flows: readonly unknown[]): boolean => {
  for (const flow of flows) {
    if (!isRecord(flow) || !Array.isArray(flow.steps)) continue;
    for (const step of flow.steps) {
      if (isRecord(step) && step.requiresCarrier === true) return true;
    }
  }
  return false;
};

const flowViolations = (flows: readonly unknown[]): string[] => {
  const violations: string[] = [];
  if (flows.length === 0) return ["flows: registry is empty"];
  const flowIds = new Set<string>();
  const stepIds = new Set<string>();
  for (const flow of flows) {
    if (!isRecord(flow)) {
      violations.push("flows: flow is not an object");
      continue;
    }
    const flowId = text(flow, "flowId");
    if (flowId === undefined) {
      violations.push("flows: flow has no id");
      continue;
    }
    if (flowIds.has(flowId)) violations.push(`${flowId}: duplicate flow id`);
    flowIds.add(flowId);
    if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
      violations.push(`${flowId}: flow has no steps`);
      continue;
    }
    for (const step of flow.steps) {
      if (!isRecord(step)) {
        violations.push(`${flowId}: step is not an object`);
        continue;
      }
      const stepId = text(step, "stepId");
      if (stepId === undefined) {
        violations.push(`${flowId}: step has no id`);
        continue;
      }
      if (stepIds.has(stepId)) violations.push(`${flowId}: duplicate step id ${stepId}`);
      stepIds.add(stepId);
      const operation = text(step, "operation");
      if (operation === undefined) {
        violations.push(`${stepId}: step has no operation`);
      } else if (!CLOSED_OPERATIONS.has(operation)) {
        violations.push(`${stepId}: unknown operation ${operation}`);
      }
    }
  }
  const operations = stepOperations(flows);
  for (const operation of ADAPTER_OPERATIONS) {
    if (!operations.has(operation)) violations.push(`flows: missing operation ${operation}`);
  }
  return violations;
};

const adapterViolations = (adapters: readonly unknown[], flows: readonly unknown[]): string[] => {
  const violations: string[] = [];
  if (adapters.length === 0) return ["adapters: registration set is empty"];
  const providers = new Set<string>();
  const operations = stepOperations(flows);
  const carrierStep = hasCarrierStep(flows);

  for (const adapter of adapters) {
    if (!isRecord(adapter)) {
      violations.push("adapters: registration is not an object");
      continue;
    }
    const provider = text(adapter, "provider");
    if (provider === undefined) {
      violations.push("adapters: registration has no provider");
      continue;
    }
    if (providers.has(provider)) violations.push(`${provider}: duplicate registration`);
    providers.add(provider);

    const contract = adapter.contract;
    if (!isRecord(contract)) {
      violations.push(`${provider}: registration has no contract`);
      continue;
    }
    if (text(contract, "adapterName") !== provider) {
      violations.push(
        `${provider}: contract adapterName ${text(contract, "adapterName") ?? "missing"} does not match`,
      );
    }
    const capabilities = contract.capabilities;
    if (!isRecord(capabilities)) {
      violations.push(`${provider}: contract has no capabilities`);
      continue;
    }
    const supported = stringArray(capabilities.supportedOperations);
    const rawGaps = Array.isArray(capabilities.declaredGaps) ? capabilities.declaredGaps : [];
    const gapOperations = new Set<string>();
    const gapReasons = new Map<string, string>();
    for (const rawGap of rawGaps) {
      if (!isRecord(rawGap)) {
        violations.push(`${provider}: gap record is not an object`);
        continue;
      }
      const operation = text(rawGap, "operation");
      const reason = text(rawGap, "reason");
      if (operation === undefined || !CLOSED_OPERATIONS.has(operation)) {
        violations.push(`${provider}: gap names unknown operation ${operation ?? "missing"}`);
        continue;
      }
      if (reason === undefined || !CLOSED_GAP_REASONS.has(reason)) {
        violations.push(`${provider}: gap ${operation} has invalid reason ${reason ?? "missing"}`);
        continue;
      }
      if (gapOperations.has(operation)) {
        violations.push(`${provider}: duplicate gap for ${operation}`);
      }
      gapOperations.add(operation);
      gapReasons.set(operation, reason);
    }

    for (const operation of supported) {
      if (!CLOSED_OPERATIONS.has(operation)) {
        violations.push(`${provider}: supported operation ${operation} is outside the closed set`);
      }
      if (gapOperations.has(operation)) {
        violations.push(`${provider}: operation ${operation} is both supported and a gap`);
      }
      if (!operations.has(operation)) {
        violations.push(`${provider}: supported operation ${operation} has no step`);
      }
    }
    for (const operation of gapOperations) {
      if (!operations.has(operation)) {
        violations.push(`${provider}: declared gap ${operation} has no step`);
      }
    }
    const declared = new Set([...supported, ...gapOperations]);
    for (const operation of ADAPTER_OPERATIONS) {
      if (!declared.has(operation)) {
        violations.push(`${provider}: operation ${operation} is neither supported nor a gap`);
      }
    }
    if (supported.length === 0 && gapOperations.size === 0) {
      violations.push(`${provider}: adapter declares no operations`);
    }

    const writable = stringArray(capabilities.writableCarriers);
    const readable = stringArray(capabilities.readableCarriers);
    if ((writable.length > 0 || readable.length > 0) && !carrierStep) {
      violations.push(`${provider}: declared carrier has no carrier step`);
    }
  }
  return violations;
};

/**
 * Prove the flow registry and every adapter declaration are structurally
 * complete and non-vacuous.
 */
export const structuralCoverageViolations = (input: {
  readonly flows: readonly unknown[];
  readonly adapters: readonly unknown[];
}): string[] => {
  const violations = [
    ...flowViolations(input.flows),
    ...adapterViolations(input.adapters, input.flows),
  ];
  for (const provider of new Set(
    input.adapters.flatMap((adapter) =>
      isRecord(adapter) && text(adapter, "provider") !== undefined
        ? [text(adapter, "provider") as string]
        : [],
    ),
  )) {
    if (provider.trim().length === 0) violations.push("adapters: empty provider name");
  }
  return violations;
};

/**
 * Prove the execution report is non-vacuous for every supplied adapter.
 *
 * `live-read-only` deferrals satisfy supported-operation coverage only in live
 * mode (D-13); in mock mode a supported operation must execute.
 */
export const runtimeCoverageViolations = (
  report: ConformanceReport,
  adapters: readonly ConformanceAdapterRegistration[],
  tier: "mock" | "live",
): string[] => {
  const violations: string[] = [];
  if (adapters.length === 0) violations.push("adapters: registration set is empty");
  for (const adapter of adapters) {
    const provider = adapter.provider;
    const providerResult = report.providers.find((entry) => entry.provider === provider);
    if (providerResult === undefined) {
      violations.push(`${provider}: no provider result in the report`);
      continue;
    }
    const steps = report.steps.filter((step) => step.provider === provider);
    if (!steps.some((step) => step.status === "executed")) {
      violations.push(`${provider}: no executed step`);
    }
    for (const operation of adapter.contract.capabilities.supportedOperations) {
      const executed = steps.some(
        (step) => step.operation === operation && step.status === "executed",
      );
      if (executed) continue;
      const deferredInLive =
        tier === "live" &&
        !LIVE_READS.has(operation) &&
        steps.some(
          (step) =>
            step.operation === operation &&
            step.status === "skipped" &&
            step.skipKind === "live-read-only",
        );
      if (!deferredInLive) {
        violations.push(`${provider}: supported operation ${operation} was not executed`);
      }
    }
    for (const gap of adapter.contract.capabilities.declaredGaps) {
      const encountered = steps.some(
        (step) =>
          step.operation === gap.operation &&
          step.status === "skipped" &&
          step.skipKind === "declared-gap" &&
          step.skipReason === gap.reason,
      );
      if (!encountered) {
        violations.push(
          `${provider}: declared gap ${gap.operation} (${gap.reason}) was not encountered`,
        );
      }
    }
    const carriers = adapter.contract.capabilities;
    if (carriers.writableCarriers.length > 0 && carriers.readableCarriers.length > 0) {
      const exercised = steps.some(
        (step) =>
          step.stepId === "comment-provenance.carrier-roundtrip" && step.status === "executed",
      );
      if (!exercised) violations.push(`${provider}: declared carrier was not exercised`);
    }
    if (steps.some((step) => step.status === "failed") && providerResult.status === "passed") {
      violations.push(`${provider}: failed step counted as passed`);
    }
  }
  return violations;
};
