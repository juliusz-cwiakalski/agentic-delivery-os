/**
 * The Jira `WorkflowMap` (GH-188 DM-4) — native statuses mapped to delivery
 * aliases, each naming its transition mechanism.
 *
 * Transitions are read as data: this seed never executes one. The map is
 * declared, reviewable data; a native status outside the map fails the
 * normalization visibly instead of being flattened into a delivery state.
 */
import type {
  DeliveryStateAlias,
  WorkflowMap,
  WorkflowStateMapping,
  WorkflowTransitionMechanism,
} from "@delivery-os/core/contracts";

/** The Jira workflow truth for the read slice (GH-188 fixtures). */
export const JIRA_WORKFLOW_MAP: WorkflowMap = {
  systemName: "jira",
  states: [
    { nativeStatus: "Backlog", deliveryState: "backlog", transitionMechanism: "manual" },
    { nativeStatus: "To Do", deliveryState: "ready", transitionMechanism: "manual" },
    {
      nativeStatus: "In Progress",
      deliveryState: "in-progress",
      transitionMechanism: "field-update",
    },
    {
      nativeStatus: "In Review",
      deliveryState: "in-review",
      transitionMechanism: "api-transition",
    },
    { nativeStatus: "Done", deliveryState: "done", transitionMechanism: "api-transition" },
    { nativeStatus: "Won't Do", deliveryState: "canceled", transitionMechanism: "label-swap" },
  ],
};

const DELIVERY_STATES: ReadonlySet<string> = new Set<DeliveryStateAlias>([
  "backlog",
  "ready",
  "in-progress",
  "in-review",
  "done",
  "canceled",
]);

const TRANSITION_MECHANISMS: ReadonlySet<string> = new Set<WorkflowTransitionMechanism>([
  "api-transition",
  "field-update",
  "label-swap",
  "manual",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate a workflow map read from untrusted data (or a temp mutation copy).
 *
 * Every native status needs exactly one mapping; every mapping needs a delivery
 * alias and a named mechanism from the closed sets.
 */
export const validateWorkflowMap = (map: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(map)) return ["workflow map is not an object"];
  const systemName = map.systemName;
  if (typeof systemName !== "string" || systemName.trim().length === 0) {
    failures.push("workflow map requires a system name");
  }
  const states = map.states;
  if (!Array.isArray(states) || states.length === 0) {
    return [...failures, "workflow map requires at least one state mapping"];
  }
  const seen = new Set<string>();
  for (const [index, state] of states.entries()) {
    if (!isRecord(state)) {
      failures.push(`state mapping ${index} is not an object`);
      continue;
    }
    const nativeStatus = state.nativeStatus;
    const deliveryState = state.deliveryState;
    const mechanism = state.transitionMechanism;
    if (typeof nativeStatus !== "string" || nativeStatus.trim().length === 0) {
      failures.push(`state mapping ${index} requires a native status`);
    } else if (seen.has(nativeStatus)) {
      failures.push(`native status ${nativeStatus} is mapped more than once`);
    } else {
      seen.add(nativeStatus);
    }
    if (typeof deliveryState !== "string" || !DELIVERY_STATES.has(deliveryState)) {
      failures.push(`native status ${String(nativeStatus)} has no valid delivery alias`);
    }
    if (typeof mechanism !== "string" || !TRANSITION_MECHANISMS.has(mechanism)) {
      failures.push(`native status ${String(nativeStatus)} has no named transition mechanism`);
    }
  }
  return failures;
};

/** Look up exactly one mapping for a native status. */
export const stateMappingFor = (
  map: WorkflowMap,
  nativeStatus: string,
): WorkflowStateMapping | undefined =>
  map.states.find((state) => state.nativeStatus === nativeStatus);

/** Resolve the native status the workflow map declares for a delivery alias. */
export const nativeStatusForDeliveryState = (
  map: WorkflowMap,
  deliveryState: DeliveryStateAlias,
): string | undefined =>
  map.states.find((state) => state.deliveryState === deliveryState)?.nativeStatus;
