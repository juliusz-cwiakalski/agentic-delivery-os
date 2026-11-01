/**
 * The pure closeout planner and rendering domain (GH-183 F-2, F-5, F-7..F-13).
 *
 * Everything here is a deterministic function of observed facts, declared
 * contract data, and persisted terminal outcomes. No wall clock, randomness,
 * environment, or I/O enters this tier; the apply orchestrator takes injected
 * runtimes as parameters (Phase 3).
 */

import type {
  AdapterCapabilityDeclaration,
  CapabilityGapReason,
  DeliveryRequest,
  ProviderQualifiedIdentity,
  WorkItem,
} from "#contracts";
import {
  BLOCKED_LABEL,
  CHANGE_LABEL,
  CLOSEOUT_INTEGRATION_BASE,
  CLOSEOUT_MAX_DEPENDENTS,
  CLOSEOUT_MAX_HUMAN_BYTES,
  CLOSEOUT_MAX_HUMAN_LINES,
  CLOSEOUT_MAX_MACHINE_BYTES,
  CLOSEOUT_MAX_THREADS,
  CLOSEOUT_SCHEMA_ID,
  type CloseoutApplyOutcome,
  type CloseoutBranchFact,
  type CloseoutCanonicalArguments,
  type CloseoutCapabilityContext,
  type CloseoutCheckoutFacts,
  type CloseoutData,
  type CloseoutDeleteArguments,
  type CloseoutDeliverySummary,
  type CloseoutEvidence,
  type CloseoutEvidenceField,
  type CloseoutGapReason,
  type CloseoutGitRuntime,
  type CloseoutLabelArguments,
  type CloseoutOperation,
  type CloseoutOperationIdentityInputs,
  type CloseoutOperationName,
  type CloseoutOperationRecord,
  type CloseoutOutcome,
  type CloseoutPlan,
  type CloseoutPlanOutcome,
  type CloseoutProviderRuntime,
  type CloseoutReadObservation,
  type CloseoutRestoreArguments,
  type CloseoutReverseDependentObservation,
  type CloseoutStateRuntime,
  type CloseoutStep,
  type CloseoutStepId,
  type CloseoutSummary,
  type CloseoutThreadArguments,
  type CloseoutTransitionArguments,
  type CloseoutWriteOutcome,
  DELIVERED_LABEL,
  LIFECYCLE_LABEL_DISPOSITIONS,
  OWNER_ATTENTION_LABEL,
  PROTECTED_REF_NAMES,
} from "#contracts";
import { sha256Hex } from "./sha256.js";

/** The seven step definitions in binding order (PIN-2). */
export const closeoutStepDefinitions = [
  { stepId: "ticket-to-done", label: "ticket to done" },
  { stepId: "lifecycle-label-sweep", label: "lifecycle label sweep" },
  { stepId: "unassign", label: "unassign" },
  { stepId: "owed-flip-sweep", label: "owed-flip sweep" },
  { stepId: "comment-resolution", label: "comment resolution" },
  { stepId: "checkout-restore", label: "checkout restore" },
  { stepId: "branch-cleanup", label: "squash-safe local branch cleanup" },
] as const;

/** One candidate dependent with its own provider-asserted blocker observation. */
export type CloseoutDependentFact = {
  readonly item: WorkItem;
  readonly blockers: CloseoutReadObservation<readonly WorkItem[]>;
};

/** The provider facts a plan consumes. */
export type CloseoutPlanProvider = {
  readonly systemName: string;
  readonly capabilities: AdapterCapabilityDeclaration;
};

/** The pure planner input (facts only, never runtimes). */
export type CloseoutPlanFacts = {
  readonly workspaceId: string;
  readonly workItemRef: string;
  readonly provider: CloseoutPlanProvider;
  readonly observedWorkItem: CloseoutReadObservation<WorkItem>;
  readonly mergedRequest: CloseoutReadObservation<DeliveryRequest>;
  readonly dependents: CloseoutReverseDependentObservation<readonly CloseoutDependentFact[]>;
  readonly checkout: CloseoutCheckoutFacts;
  readonly cleanWorktree: boolean;
  readonly baseRefExists: boolean;
  readonly branches: readonly CloseoutBranchFact[];
  readonly checkedOutElsewhere: readonly string[];
  readonly persisted: Readonly<Record<string, CloseoutOperationRecord>>;
};

/** The branch-selection outcome. */
export type CloseoutBranchSelection =
  | { readonly kind: "none" }
  | { readonly kind: "unique"; readonly branch: CloseoutBranchFact }
  | { readonly kind: "ambiguous"; readonly branches: readonly CloseoutBranchFact[] };

/** The branch-safety input (BR-01..BR-14). */
export type CloseoutBranchSafetyInput = {
  readonly mergedObserved: boolean;
  readonly sourceRef?: string;
  readonly branchName: string;
  readonly localHead?: string;
  readonly mergedHeadSha?: string;
  readonly protectedRefs: readonly string[];
  readonly checkedOutElsewhere: boolean;
  readonly currentCheckout: CloseoutCheckoutFacts["state"];
  readonly restoreRequired: boolean;
  readonly restoreSucceeded: boolean;
  readonly earlierFailure: boolean;
};

/** The branch-safety verdict. */
export type CloseoutBranchSafetyVerdict = {
  readonly safe: boolean;
  readonly reason?: string;
};

const TERMINAL_OUTCOMES: ReadonlySet<string> = new Set([
  "applied",
  "satisfied",
  "skipped-gap",
  "skipped-noop",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const evidence = (...fields: CloseoutEvidenceField[]): CloseoutEvidence => fields;

const field = (name: string, value: string | number | boolean): CloseoutEvidenceField => ({
  name,
  value,
});

const planStep = (
  stepId: CloseoutStepId,
  outcome: CloseoutPlanOutcome,
  options: {
    readonly operations?: readonly CloseoutOperation[];
    readonly reason?: string;
    readonly evidence?: CloseoutEvidence;
    readonly truncation?: CloseoutStep["truncation"];
  } = {},
): CloseoutStep => {
  const label =
    closeoutStepDefinitions.find((definition) => definition.stepId === stepId)?.label ?? stepId;
  return {
    stepId,
    label,
    outcome,
    ...(options.reason === undefined ? {} : { reason: options.reason }),
    operations: options.operations ?? [],
    evidence: options.evidence ?? [],
    ...(options.truncation === undefined ? {} : { truncation: options.truncation }),
  };
};

/**
 * Canonical JSON: sorted object keys, no insignificant whitespace, arrays in
 * declaration order. `undefined` object properties are omitted.
 */
export const canonicalCloseoutJson = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalCloseoutJson(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalCloseoutJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return "null";
};

/** Derive the deterministic 64-lowercase-hex operation identity (DM-9, PIN-12). */
export const deriveCloseoutOperationId = (inputs: CloseoutOperationIdentityInputs): string =>
  sha256Hex(
    canonicalCloseoutJson({
      workspaceId: inputs.workspaceId,
      workItemRef: inputs.workItemRef,
      engine: inputs.engine,
      capabilityContext: inputs.capabilityContext,
      operation: inputs.operation,
      arguments: inputs.arguments,
      target: inputs.target,
    }),
  );

/** Resolve the checkout base: the merged target ref, else the v1 integration base. */
export const resolveCloseoutBaseRef = (
  mergedRequest: CloseoutReadObservation<DeliveryRequest>,
): string =>
  mergedRequest.observation === "observed"
    ? mergedRequest.value.targetRef
    : CLOSEOUT_INTEGRATION_BASE;

/** A protected ref is an exact member of the declared set or an injected extra. */
export const isProtectedRef = (ref: string, extras: readonly string[] = []): boolean =>
  [...PROTECTED_REF_NAMES, ...extras].includes(ref);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const branchConvention = (workItemRef: string): RegExp =>
  new RegExp(`^[a-z][a-z0-9-]*/${escapeRegExp(workItemRef)}/.+$`);

/** Select the local branch matching the branch convention and merged head (F-10). */
export const selectMatchingBranch = (input: {
  readonly branches: readonly CloseoutBranchFact[];
  readonly workItemRef: string;
  readonly mergedHeadSha?: string;
}): CloseoutBranchSelection => {
  const pattern = branchConvention(input.workItemRef);
  const matching = input.branches.filter((branch) => pattern.test(branch.name));
  if (matching.length === 0) return { kind: "none" };
  if (matching.length === 1) return { kind: "unique", branch: matching[0] as CloseoutBranchFact };
  const mergedHead = input.mergedHeadSha;
  if (mergedHead !== undefined) {
    const selected = matching.filter((branch) => branch.head === mergedHead);
    if (selected.length === 1) {
      return { kind: "unique", branch: selected[0] as CloseoutBranchFact };
    }
  }
  return { kind: "ambiguous", branches: matching };
};

/** Evaluate the full squash-safety predicate (BR-01..BR-14). */
export const evaluateBranchSafety = (
  input: CloseoutBranchSafetyInput,
): CloseoutBranchSafetyVerdict => {
  if (isProtectedRef(input.branchName, input.protectedRefs)) {
    return { safe: false, reason: "protected-ref" };
  }
  if (!input.mergedObserved) return { safe: false, reason: "merged-request-unobserved" };
  if (input.sourceRef === undefined || input.sourceRef !== input.branchName) {
    return { safe: false, reason: "source-ref-mismatch" };
  }
  if (input.mergedHeadSha === undefined) return { safe: false, reason: "merged-head-unknown" };
  if (input.localHead === undefined || input.localHead !== input.mergedHeadSha) {
    return { safe: false, reason: "merged-head-mismatch" };
  }
  if (input.checkedOutElsewhere) return { safe: false, reason: "foreign-worktree" };
  if (input.restoreRequired && !input.restoreSucceeded) {
    return { safe: false, reason: "restore-refused" };
  }
  if (input.earlierFailure) return { safe: false, reason: "earlier-failure" };
  return { safe: true };
};

/** Fold persisted records: the first terminal outcome per operation id is authoritative. */
export const foldCloseoutOutcomes = (
  records: readonly CloseoutOperationRecord[],
): Readonly<Record<string, CloseoutOperationRecord>> => {
  const terminal: Record<string, CloseoutOperationRecord> = {};
  const failed: Record<string, CloseoutOperationRecord> = {};
  for (const record of records) {
    if (TERMINAL_OUTCOMES.has(record.outcome)) {
      if (terminal[record.operationId] === undefined) terminal[record.operationId] = record;
      continue;
    }
    if (record.outcome === "failed" && failed[record.operationId] === undefined) {
      failed[record.operationId] = record;
    }
  }
  for (const [operationId, record] of Object.entries(failed)) {
    if (terminal[operationId] === undefined) terminal[operationId] = record;
  }
  return terminal;
};

/** Summarize the ordered steps by outcome (F-13). */
export const summarizeCloseout = (steps: readonly CloseoutStep[]): CloseoutSummary => {
  const counts: Record<CloseoutOutcome, number> = {
    "would-apply": 0,
    satisfied: 0,
    "skipped-gap": 0,
    "skipped-noop": 0,
    "would-refuse": 0,
    applied: 0,
    failed: 0,
    refused: 0,
  };
  for (const step of steps) counts[step.outcome] += 1;
  const totalOperations = steps.reduce((total, step) => total + step.operations.length, 0);
  return {
    totalOperations,
    counts,
    gaps: counts["skipped-gap"],
    noops: counts["skipped-noop"],
    failures: counts.failed,
    refusals: counts.refused,
  };
};

const capabilityContextFor = (
  capabilities: AdapterCapabilityDeclaration,
  operation: CloseoutOperationName,
): CloseoutCapabilityContext => {
  if (operation === "restore-checkout" || operation === "delete-branch") return "supported";
  const adapterOperation =
    operation === "resolve-delivery-thread"
      ? "resolve-delivery-thread"
      : operation === "transition-work-item"
        ? "transition-work-item"
        : "write-work-item";
  if (capabilities.supportedOperations.includes(adapterOperation)) return "supported";
  return (
    capabilities.declaredGaps.find((gap) => gap.operation === adapterOperation)?.reason ??
    "adapter-not-implemented"
  );
};

const supports = (
  capabilities: AdapterCapabilityDeclaration,
  operation:
    | "read-work-item"
    | "write-work-item"
    | "transition-work-item"
    | "resolve-delivery-thread",
): boolean => capabilities.supportedOperations.includes(operation);

const gapReasonFor = (
  capabilities: AdapterCapabilityDeclaration,
  operation: "write-work-item" | "transition-work-item" | "resolve-delivery-thread",
): CloseoutGapReason =>
  (capabilities.declaredGaps.find((gap) => gap.operation === operation)?.reason as
    | CapabilityGapReason
    | undefined) ?? "adapter-not-implemented";

const operationFor = (
  facts: CloseoutPlanFacts,
  name: CloseoutOperationName,
  target: ProviderQualifiedIdentity,
  args: CloseoutCanonicalArguments,
): CloseoutOperation => {
  const engine =
    name === "restore-checkout" || name === "delete-branch" ? "git" : facts.provider.systemName;
  const capabilityContext = capabilityContextFor(facts.provider.capabilities, name);
  const operationId = deriveCloseoutOperationId({
    workspaceId: facts.workspaceId,
    workItemRef: facts.workItemRef,
    engine,
    capabilityContext,
    operation: name,
    arguments: args,
    target,
  });
  return {
    operationId,
    name,
    engine,
    capabilityContext,
    target,
    arguments: args,
  };
};

const isTerminal = (
  persisted: Readonly<Record<string, CloseoutOperationRecord>>,
  operation: CloseoutOperation,
): boolean => {
  const record = persisted[operation.operationId];
  return record !== undefined && TERMINAL_OUTCOMES.has(record.outcome);
};

const outcomeFor = (
  persisted: Readonly<Record<string, CloseoutOperationRecord>>,
  operations: readonly CloseoutOperation[],
  fallback: CloseoutPlanOutcome,
): CloseoutPlanOutcome => {
  if (operations.length === 0) return fallback;
  return operations.every((operation) => isTerminal(persisted, operation))
    ? "satisfied"
    : "would-apply";
};

const deliverySummary = (request: DeliveryRequest): CloseoutDeliverySummary => ({
  systemName: request.identity.systemName,
  entityId: request.identity.entityId,
  sourceRef: request.sourceRef,
  targetRef: request.targetRef,
  ...(request.headSha === undefined ? {} : { headSha: request.headSha }),
});

const ticketStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const observation = facts.observedWorkItem;
  if (observation.observation === "not-found") {
    return planStep("ticket-to-done", "would-refuse", {
      reason: "closeout.target.unobserved",
      evidence: evidence(field("observation", "not-found")),
    });
  }
  if (observation.observation === "unavailable") {
    return planStep("ticket-to-done", "skipped-gap", {
      reason: "provider-unsupported",
      evidence: evidence(field("observation", "unavailable")),
    });
  }
  if (observation.observation === "invalid") {
    return planStep("ticket-to-done", "would-refuse", {
      reason: "provider.payload.invalid",
      evidence: evidence(field("observation", "invalid")),
    });
  }
  const workItem = observation.value;
  const target = workItem.identity;
  if (workItem.status.deliveryState === "done") {
    return planStep("ticket-to-done", "satisfied", {
      evidence: evidence(field("deliveryState", "done")),
    });
  }
  if (!supports(facts.provider.capabilities, "transition-work-item")) {
    return planStep("ticket-to-done", "skipped-gap", {
      reason: gapReasonFor(facts.provider.capabilities, "transition-work-item"),
      evidence: evidence(field("operation", "transition-work-item")),
    });
  }
  const args: CloseoutTransitionArguments = { deliveryState: "done" };
  const operation = operationFor(facts, "transition-work-item", target, args);
  return planStep("ticket-to-done", outcomeFor(facts.persisted, [operation], "satisfied"), {
    operations: [operation],
    evidence: evidence(field("operation", "transition-work-item")),
  });
};

const labelStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const observation = facts.observedWorkItem;
  if (observation.observation !== "observed") {
    return planStep("lifecycle-label-sweep", "skipped-noop", {
      reason: "label-signal-unavailable",
      evidence: evidence(field("signal", "unavailable")),
    });
  }
  if (observation.signals?.labels === "unavailable") {
    return planStep("lifecycle-label-sweep", "skipped-noop", {
      reason: "label-signal-unavailable",
      evidence: evidence(field("signal", "unavailable")),
    });
  }
  if (!supports(facts.provider.capabilities, "write-work-item")) {
    return planStep("lifecycle-label-sweep", "skipped-gap", {
      reason: gapReasonFor(facts.provider.capabilities, "write-work-item"),
      evidence: evidence(field("operation", "write-work-item")),
    });
  }
  const labels = observation.value.labels;
  const operations: CloseoutOperation[] = [];
  for (const disposition of LIFECYCLE_LABEL_DISPOSITIONS) {
    if (disposition.disposition === "remove" && labels.includes(disposition.label)) {
      const args: CloseoutLabelArguments = { remove: [disposition.label] };
      operations.push(operationFor(facts, "write-work-item", observation.value.identity, args));
    }
  }
  if (!labels.includes(DELIVERED_LABEL)) {
    const args: CloseoutLabelArguments = { add: [DELIVERED_LABEL] };
    operations.push(operationFor(facts, "write-work-item", observation.value.identity, args));
  }
  const kept = labels.filter(
    (label) =>
      label === CHANGE_LABEL ||
      !LIFECYCLE_LABEL_DISPOSITIONS.some(
        (entry) => entry.disposition === "remove" && entry.label === label,
      ),
  );
  return planStep("lifecycle-label-sweep", outcomeFor(facts.persisted, operations, "satisfied"), {
    operations,
    evidence: evidence(
      field("present", labels.length),
      field("kept", kept.length),
      field("removed", operations.filter((operation) => "remove" in operation.arguments).length),
    ),
  });
};

const unassignStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const observation = facts.observedWorkItem;
  if (observation.observation !== "observed") {
    // A read that is not observed says nothing about write support. The gap is
    // the provider-level read gap, exactly as `ticketStep` reports it; it is
    // never misattributed to a write capability the adapter may actually have.
    return planStep("unassign", "skipped-gap", {
      reason: "provider-unsupported",
      evidence: evidence(field("observation", observation.observation)),
    });
  }
  if (!supports(facts.provider.capabilities, "write-work-item")) {
    return planStep("unassign", "skipped-gap", {
      reason: gapReasonFor(facts.provider.capabilities, "write-work-item"),
      evidence: evidence(field("operation", "write-work-item")),
    });
  }
  const args = { assignee: "none" } as const;
  const operation = operationFor(facts, "write-work-item", observation.value.identity, args);
  return planStep("unassign", outcomeFor(facts.persisted, [operation], "satisfied"), {
    operations: [operation],
    evidence: evidence(field("operation", "write-work-item")),
  });
};

const isOpen = (item: WorkItem): boolean =>
  item.status.deliveryState !== "done" && item.status.deliveryState !== "canceled";

const owedFlipStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  if (!supports(facts.provider.capabilities, "read-work-item")) {
    return planStep("owed-flip-sweep", "skipped-gap", {
      reason: "provider-unsupported",
      evidence: evidence(field("surface", "absent")),
    });
  }
  const dependents = facts.dependents;
  if (dependents.observation === "no-surface") {
    // The provider has no bounded reverse-dependent surface. This is a
    // provider-level capability gap, never a signal-level skip (AC-F7-6).
    return planStep("owed-flip-sweep", "skipped-gap", {
      reason: "provider-unsupported",
      evidence: evidence(field("surface", "absent")),
    });
  }
  if (dependents.observation !== "observed") {
    return planStep("owed-flip-sweep", "skipped-noop", {
      reason: "relation-signal-unavailable",
      evidence: evidence(field("signal", dependents.observation)),
    });
  }
  if (!supports(facts.provider.capabilities, "write-work-item")) {
    return planStep("owed-flip-sweep", "skipped-gap", {
      reason: gapReasonFor(facts.provider.capabilities, "write-work-item"),
      evidence: evidence(field("operation", "write-work-item")),
    });
  }
  const candidates = [...dependents.value].sort((left, right) =>
    left.item.identity.entityId.localeCompare(right.item.identity.entityId),
  );
  const bounded = candidates.slice(0, CLOSEOUT_MAX_DEPENDENTS);
  const operations: CloseoutOperation[] = [];
  let evaluated = 0;
  let skipped = 0;
  let unavailableSignals = 0;
  let openBlockerTotal = 0;
  let maxOpenBlockers = 0;
  for (const candidate of bounded) {
    evaluated += 1;
    if (!isOpen(candidate.item)) {
      skipped += 1;
      continue;
    }
    const blockers = candidate.blockers;
    if (blockers.observation !== "observed") {
      skipped += 1;
      unavailableSignals += 1;
      continue;
    }
    const openBlockers = blockers.value.filter(isOpen);
    if (openBlockers.length > 0) {
      skipped += 1;
      openBlockerTotal += openBlockers.length;
      maxOpenBlockers = Math.max(maxOpenBlockers, openBlockers.length);
      continue;
    }
    const hasHandBack = candidate.item.labels.includes(OWNER_ATTENTION_LABEL);
    const hasBlocked = candidate.item.labels.includes(BLOCKED_LABEL);
    if (hasHandBack && !hasBlocked) continue;
    const args: CloseoutLabelArguments = hasHandBack
      ? { remove: [BLOCKED_LABEL] }
      : { add: [OWNER_ATTENTION_LABEL], remove: [BLOCKED_LABEL] };
    operations.push(operationFor(facts, "write-work-item", candidate.item.identity, args));
  }
  const truncated = candidates.length > CLOSEOUT_MAX_DEPENDENTS;
  const fallback: CloseoutPlanOutcome =
    operations.length === 0 && unavailableSignals > 0 ? "skipped-noop" : "satisfied";
  return planStep("owed-flip-sweep", outcomeFor(facts.persisted, operations, fallback), {
    ...(fallback === "skipped-noop" ? { reason: "relation-signal-unavailable" } : {}),
    operations,
    evidence: evidence(
      field("evaluated", evaluated),
      field("flipped", operations.length),
      field("skipped", skipped),
      field("openBlockers", openBlockerTotal),
      field("maxOpenBlockers", maxOpenBlockers),
      field("unavailableSignals", unavailableSignals),
    ),
    ...(truncated
      ? {
          truncation: {
            truncated: true,
            omitted: candidates.length - CLOSEOUT_MAX_DEPENDENTS,
            cap: CLOSEOUT_MAX_DEPENDENTS,
          },
        }
      : {}),
  });
};

const threadStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  if (!supports(facts.provider.capabilities, "resolve-delivery-thread")) {
    return planStep("comment-resolution", "skipped-gap", {
      reason: gapReasonFor(facts.provider.capabilities, "resolve-delivery-thread"),
      evidence: evidence(field("operation", "resolve-delivery-thread")),
    });
  }
  const merged = facts.mergedRequest;
  if (merged.observation === "invalid") {
    return planStep("comment-resolution", "would-refuse", {
      reason: "provider.payload.invalid",
      evidence: evidence(field("observation", "invalid")),
    });
  }
  if (merged.observation !== "observed") {
    return planStep("comment-resolution", "skipped-noop", {
      reason: "no-delivery-request",
      evidence: evidence(field("observation", merged.observation)),
    });
  }
  const unresolved = [...merged.value.threads]
    .filter((thread) => !thread.resolved)
    .sort((left, right) => left.threadId.localeCompare(right.threadId));
  const bounded = unresolved.slice(0, CLOSEOUT_MAX_THREADS);
  const operations = bounded.map((thread) => {
    const args: CloseoutThreadArguments = {
      deliveryRequest: merged.value.identity,
      threadId: thread.threadId,
    };
    return operationFor(facts, "resolve-delivery-thread", merged.value.identity, args);
  });
  const truncated = unresolved.length > CLOSEOUT_MAX_THREADS;
  return planStep("comment-resolution", outcomeFor(facts.persisted, operations, "satisfied"), {
    operations,
    evidence: evidence(
      field("unresolved", unresolved.length),
      field("resolved", operations.length),
    ),
    ...(truncated
      ? {
          truncation: {
            truncated: true,
            omitted: unresolved.length - CLOSEOUT_MAX_THREADS,
            cap: CLOSEOUT_MAX_THREADS,
          },
        }
      : {}),
  });
};

const checkoutStep = (facts: CloseoutPlanFacts, baseRef: string): CloseoutStep => {
  const checkout = facts.checkout;
  if (checkout.state === "base") {
    return planStep("checkout-restore", "satisfied", {
      evidence: evidence(field("checkout", "base"), field("baseRef", baseRef)),
    });
  }
  if (checkout.state === "unrelated") {
    return planStep("checkout-restore", "satisfied", {
      reason: "already-elsewhere",
      evidence: evidence(field("checkout", "unrelated")),
    });
  }
  if (checkout.state === "missing") {
    return planStep("checkout-restore", "would-refuse", {
      reason: "closeout.branch.unsafe",
      evidence: evidence(field("checkout", "missing")),
    });
  }
  if (!facts.cleanWorktree) {
    return planStep("checkout-restore", "would-refuse", {
      reason: "closeout.branch.unsafe",
      evidence: evidence(field("worktree", "dirty")),
    });
  }
  if (!facts.baseRefExists) {
    return planStep("checkout-restore", "would-refuse", {
      reason: "closeout.branch.unsafe",
      evidence: evidence(field("baseRef", "missing")),
    });
  }
  const args: CloseoutRestoreArguments = { baseRef };
  const operation = operationFor(
    facts,
    "restore-checkout",
    { systemName: "git", entityId: baseRef },
    args,
  );
  return planStep("checkout-restore", outcomeFor(facts.persisted, [operation], "satisfied"), {
    operations: [operation],
    evidence: evidence(field("checkout", checkout.state), field("baseRef", baseRef)),
  });
};

const branchStep = (
  facts: CloseoutPlanFacts,
  baseRef: string,
  checkout: CloseoutStep,
): CloseoutStep => {
  const merged = facts.mergedRequest;
  const mergedHeadSha = merged.observation === "observed" ? merged.value.headSha : undefined;
  const selection = selectMatchingBranch({
    branches: facts.branches,
    workItemRef: facts.workItemRef,
    ...(mergedHeadSha === undefined ? {} : { mergedHeadSha }),
  });
  if (selection.kind === "none") {
    return planStep("branch-cleanup", "satisfied", {
      reason: "no-branch",
      evidence: evidence(field("branches", 0)),
    });
  }
  if (selection.kind === "ambiguous") {
    return planStep("branch-cleanup", "would-refuse", {
      reason: "closeout.target.ambiguous",
      evidence: evidence(field("matchingBranches", selection.branches.length)),
    });
  }
  const branch = selection.branch;
  if (isProtectedRef(branch.name, [baseRef])) {
    return planStep("branch-cleanup", "skipped-noop", {
      reason: "protected-ref",
      evidence: evidence(field("branch", branch.name)),
    });
  }
  const sourceRef = merged.observation === "observed" ? merged.value.sourceRef : undefined;
  const restoreRequired =
    checkout.stepId === "checkout-restore" &&
    (checkout.operations.length > 0 || checkout.outcome !== "satisfied");
  const verdict = evaluateBranchSafety({
    mergedObserved: merged.observation === "observed",
    ...(sourceRef === undefined ? {} : { sourceRef }),
    branchName: branch.name,
    ...(branch.head === undefined ? {} : { localHead: branch.head }),
    ...(mergedHeadSha === undefined ? {} : { mergedHeadSha }),
    protectedRefs: [baseRef],
    checkedOutElsewhere: facts.checkedOutElsewhere.includes(branch.name),
    currentCheckout: facts.checkout.state,
    restoreRequired,
    restoreSucceeded: checkout.outcome !== "would-refuse",
    earlierFailure: false,
  });
  if (!verdict.safe) {
    return planStep("branch-cleanup", "would-refuse", {
      reason: "closeout.branch.unsafe",
      evidence: evidence(field("branch", branch.name), field("reason", verdict.reason ?? "unsafe")),
    });
  }
  const args: CloseoutDeleteArguments = { branch: branch.name };
  const operation = operationFor(
    facts,
    "delete-branch",
    { systemName: "git", entityId: branch.name },
    args,
  );
  return planStep("branch-cleanup", outcomeFor(facts.persisted, [operation], "satisfied"), {
    operations: [operation],
    evidence: evidence(field("branch", branch.name), field("head", branch.head)),
  });
};

/** Build the deterministic seven-step plan from pure facts (F-2). */
export const buildCloseoutPlan = (facts: CloseoutPlanFacts): CloseoutPlan => {
  const baseRef = resolveCloseoutBaseRef(facts.mergedRequest);
  const steps: CloseoutStep[] = [];
  steps.push(ticketStep(facts));
  steps.push(labelStep(facts));
  steps.push(unassignStep(facts));
  steps.push(owedFlipStep(facts));
  steps.push(threadStep(facts));
  const checkout = checkoutStep(facts, baseRef);
  steps.push(checkout);
  steps.push(branchStep(facts, baseRef, checkout));
  const ordered = steps.map((step, index) => {
    const definition = closeoutStepDefinitions[index];
    return definition === undefined ? step : { ...step, stepId: definition.stepId };
  });
  return {
    schemaId: CLOSEOUT_SCHEMA_ID,
    workItemRef: facts.workItemRef,
    baseRef,
    ...(facts.mergedRequest.observation === "observed"
      ? { deliveryRequest: deliverySummary(facts.mergedRequest.value) }
      : {}),
    steps: ordered,
    summary: summarizeCloseout(ordered),
  };
};

const boundedOperations = (
  operations: readonly CloseoutOperation[],
  budget: number,
): readonly CloseoutOperation[] => operations.slice(0, Math.max(0, budget));

/** UTF-8 byte length of a string (the bound is declared in bytes, not code units). */
const utf8ByteLength = (text: string): number => new TextEncoder().encode(text).length;

/**
 * Bound the machine payload deterministically (64 KiB). When the payload is
 * over the bound, trailing operations are dropped first and the affected step
 * records a truncation marker; the shape of the payload never changes.
 */
export const boundCloseoutData = (data: CloseoutData): CloseoutData => {
  if (utf8ByteLength(JSON.stringify(data)) <= CLOSEOUT_MAX_MACHINE_BYTES) return data;
  let steps = [...data.steps];
  while (utf8ByteLength(JSON.stringify({ ...data, steps })) > CLOSEOUT_MAX_MACHINE_BYTES) {
    const last = steps[steps.length - 1];
    if (last === undefined) break;
    if (last.operations.length > 0) {
      const omitted = last.operations.length;
      steps = [
        ...steps.slice(0, -1),
        {
          ...last,
          operations: boundedOperations(last.operations, last.operations.length - 1),
          truncation: {
            truncated: true,
            omitted: (last.truncation?.omitted ?? 0) + 1,
            cap: last.truncation?.cap ?? omitted,
          },
        },
      ];
      continue;
    }
    if (last.evidence.length > 0) {
      steps = [...steps.slice(0, -1), { ...last, evidence: last.evidence.slice(0, -1) }];
      continue;
    }
    steps = steps.slice(0, -1);
  }
  return { ...data, steps, summary: summarizeCloseout(steps) };
};

/** The apply-orchestrator input (Phase 3, F-3, D6). */
export type CloseoutRunInput = {
  readonly plan: CloseoutPlan;
  readonly provider: CloseoutProviderRuntime;
  readonly git: CloseoutGitRuntime;
  readonly state: CloseoutStateRuntime;
  readonly timestamp: string;
  readonly fenceToken: string;
  readonly apply: boolean;
};

/** The apply-orchestrator result: bounded data or a classified identity. */
export type CloseoutRunResult =
  | { readonly ok: true; readonly data: CloseoutData }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: string;
        readonly code: string;
        readonly summary?: string;
      };
    };

const PLAN_TO_APPLY: Readonly<Record<string, CloseoutOutcome>> = {
  "would-apply": "applied",
  satisfied: "satisfied",
  "skipped-gap": "skipped-gap",
  "skipped-noop": "skipped-noop",
  "would-refuse": "refused",
};

const operationOutcome = (result: CloseoutWriteOutcome): "applied" | "satisfied" =>
  result.ok && result.alreadyApplied === true ? "satisfied" : "applied";

const executeOperation = async (
  operation: CloseoutOperation,
  provider: CloseoutProviderRuntime,
  git: CloseoutGitRuntime,
  expectedHead?: string,
): Promise<CloseoutWriteOutcome> => {
  const args = operation.arguments;
  if (operation.name === "transition-work-item" && "deliveryState" in args) {
    return provider.transitionWorkItem({
      entityId: operation.target.entityId,
      deliveryState: "done",
    });
  }
  if (
    operation.name === "write-work-item" &&
    ("add" in args || "remove" in args || "assignee" in args)
  ) {
    return provider.writeWorkItem({
      entityId: operation.target.entityId,
      ...(args.add === undefined ? {} : { add: args.add }),
      ...(args.remove === undefined ? {} : { remove: args.remove }),
      ...(args.assignee === undefined ? {} : { assignee: args.assignee }),
    });
  }
  if (operation.name === "resolve-delivery-thread" && "threadId" in args) {
    return provider.resolveDeliveryThread({
      deliveryRequest: args.deliveryRequest,
      threadId: args.threadId,
    });
  }
  if (operation.name === "restore-checkout" && "baseRef" in args) {
    return git.restoreCheckout({ baseRef: args.baseRef });
  }
  if (operation.name === "delete-branch" && "branch" in args) {
    return git.deleteBranch({
      branch: args.branch,
      ...(expectedHead === undefined ? {} : { expectedHead }),
    });
  }
  return {
    ok: false,
    code: "provider.payload.invalid",
    detail: `unknown operation ${operation.name}`,
  };
};

const recordFor = (
  operation: CloseoutOperation,
  workItemRef: string,
  outcome: CloseoutApplyOutcome,
  timestamp: string,
  reason?: string,
): CloseoutOperationRecord => ({
  schemaId: "delivery.closeout.operation.v1",
  operationId: operation.operationId,
  workItemRef,
  engine: operation.engine,
  capabilityContext: operation.capabilityContext,
  operation: operation.name,
  arguments: operation.arguments,
  target: operation.target,
  outcome,
  ...(reason === undefined ? {} : { reason }),
  evidence: [
    { name: "operation", value: operation.name },
    { name: "target", value: operation.target.entityId },
  ],
  timestamp,
});

const targetFailure = (plan: CloseoutPlan, apply: boolean): CloseoutRunResult | undefined => {
  for (const step of plan.steps) {
    if (step.reason === "closeout.target.unobserved") {
      return {
        ok: false,
        error: { kind: "closeout", code: "closeout.target.unobserved" },
      };
    }
    // F-10 phrases branch ambiguity as an apply-time outcome. Plan mode renders
    // the already-computed `would-refuse` step so the operator can inspect it;
    // only apply projects the hard failure (and deletes nothing).
    if (apply && step.reason === "closeout.target.ambiguous") {
      return {
        ok: false,
        error: { kind: "closeout", code: "closeout.target.ambiguous" },
      };
    }
    if (step.reason === "provider.payload.invalid") {
      return {
        ok: false,
        error: { kind: "provider", code: "provider.payload.invalid" },
      };
    }
  }
  return undefined;
};

/**
 * Execute (apply) or render (plan) the deterministic transaction.
 *
 * Plan mode performs zero fences, zero appends, and zero provider/git writes.
 * Apply mode acquires one fence, reuses terminal outcomes, retries a failed
 * outcome, appends one record per terminal operation, and releases the fence in
 * a `finally`. A provider failure stops provider steps but still runs a safe
 * local restore and skips branch deletion.
 */
export const runCloseout = async (input: CloseoutRunInput): Promise<CloseoutRunResult> => {
  const failure = targetFailure(input.plan, input.apply);
  if (failure !== undefined) return failure;

  if (!input.apply) {
    const data: CloseoutData = {
      schemaId: CLOSEOUT_SCHEMA_ID,
      command: "closeout",
      workItemRef: input.plan.workItemRef,
      mode: "plan",
      baseRef: input.plan.baseRef,
      ...(input.plan.deliveryRequest === undefined
        ? {}
        : { deliveryRequest: input.plan.deliveryRequest }),
      steps: input.plan.steps,
      summary: input.plan.summary,
      ledgerKey: `closeout.operations:${input.plan.workItemRef}`,
    };
    return { ok: true, data: boundCloseoutData(data) };
  }

  const history = input.state.readHistory(input.plan.workItemRef);
  if (!history.ok) {
    return { ok: false, error: { kind: "state", code: history.error.code } };
  }
  const persisted = foldCloseoutOutcomes(history.value);
  const acquired = input.state.acquireFence(input.fenceToken);
  if (!acquired.ok) {
    return { ok: false, error: { kind: "state", code: acquired.error.code } };
  }
  const handle = acquired.value.handle;
  let earlierFailure = false;
  let stateFailure: { kind: string; code: string } | undefined;
  const steps: CloseoutStep[] = [];
  const mergedHeadSha = input.plan.deliveryRequest?.headSha;

  const append = (record: CloseoutOperationRecord): boolean => {
    const appended = input.state.append(handle, record);
    if (!appended.ok) {
      stateFailure = { kind: "state", code: appended.error.code };
      return false;
    }
    return true;
  };

  try {
    for (const step of input.plan.steps) {
      if (stateFailure !== undefined) break;
      if (
        earlierFailure &&
        step.stepId !== "checkout-restore" &&
        step.stepId !== "branch-cleanup"
      ) {
        steps.push({
          ...step,
          outcome: "skipped-noop",
          reason: "earlier-failure",
          operations: [],
        });
        continue;
      }
      if (earlierFailure && step.stepId === "branch-cleanup") {
        steps.push({
          ...step,
          outcome: "skipped-noop",
          reason: "earlier-failure",
          operations: [],
        });
        continue;
      }
      if (step.outcome !== "would-apply") {
        steps.push({ ...step, outcome: PLAN_TO_APPLY[step.outcome] ?? step.outcome });
        continue;
      }
      let applied = 0;
      let satisfied = 0;
      let failed = 0;
      for (const operation of step.operations) {
        if (stateFailure !== undefined) break;
        const existing = persisted[operation.operationId];
        if (existing !== undefined && TERMINAL_OUTCOMES.has(existing.outcome)) {
          satisfied += 1;
          continue;
        }
        const result = await executeOperation(operation, input.provider, input.git, mergedHeadSha);
        if (!result.ok) {
          failed += 1;
          earlierFailure = true;
          if (
            !append(
              recordFor(operation, input.plan.workItemRef, "failed", input.timestamp, result.code),
            )
          ) {
            break;
          }
          break;
        }
        const outcome = operationOutcome(result);
        if (outcome === "applied") applied += 1;
        else satisfied += 1;
        if (!append(recordFor(operation, input.plan.workItemRef, outcome, input.timestamp))) break;
      }
      const outcome: CloseoutOutcome =
        failed > 0 ? "failed" : applied > 0 ? "applied" : "satisfied";
      steps.push({ ...step, outcome });
    }
  } finally {
    input.state.releaseFence(handle);
  }

  if (stateFailure !== undefined) {
    return { ok: false, error: stateFailure };
  }
  const data: CloseoutData = {
    schemaId: CLOSEOUT_SCHEMA_ID,
    command: "closeout",
    workItemRef: input.plan.workItemRef,
    mode: "applied",
    baseRef: input.plan.baseRef,
    ...(input.plan.deliveryRequest === undefined
      ? {}
      : { deliveryRequest: input.plan.deliveryRequest }),
    steps,
    summary: summarizeCloseout(steps),
    ledgerKey: `closeout.operations:${input.plan.workItemRef}`,
  };
  if (steps.some((step) => step.outcome === "failed")) {
    return {
      ok: false,
      error: { kind: "closeout", code: "closeout.write.failed" },
    };
  }
  if (steps.some((step) => step.outcome === "refused")) {
    return {
      ok: false,
      error: { kind: "closeout", code: "closeout.branch.unsafe" },
    };
  }
  return { ok: true, data: boundCloseoutData(data) };
};

/** Render the deterministic human digest within 200 lines and 16 KiB. */
export const renderCloseoutHuman = (data: CloseoutData): string => {
  const lines: string[] = [];
  lines.push(`closeout ${data.workItemRef} (${data.mode})`);
  lines.push(`base: ${data.baseRef}`);
  if (data.deliveryRequest !== undefined) {
    lines.push(
      `delivery: ${data.deliveryRequest.entityId} ${data.deliveryRequest.sourceRef} -> ${data.deliveryRequest.targetRef}`,
    );
  }
  data.steps.forEach((step, index) => {
    const reason = step.reason === undefined ? "" : ` ${step.reason}`;
    lines.push(`${index + 1}. ${step.stepId}: ${step.outcome}${reason}`);
    for (const operation of step.operations) {
      lines.push(
        `   - ${operation.name} ${operation.target.entityId} ${operation.operationId.slice(0, 12)}`,
      );
    }
    if (step.truncation?.truncated === true) {
      lines.push(`   - truncated (omitted ${step.truncation.omitted})`);
    }
  });
  const counts = data.summary.counts;
  const summaryParts: string[] = [];
  for (const [key, value] of Object.entries(counts)) {
    if (value > 0) summaryParts.push(`${key}=${value}`);
  }
  summaryParts.sort();
  const summaryLine = summaryParts.join(" ");
  lines.push(`summary: ${summaryLine}`);
  const bounded = lines.slice(0, CLOSEOUT_MAX_HUMAN_LINES);
  let text = `${bounded.join("\n")}\n`;
  while (utf8ByteLength(text) > CLOSEOUT_MAX_HUMAN_BYTES) {
    bounded.pop();
    text = `${bounded.join("\n")}\n`;
  }
  return text;
};
