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
  CAPSULE_CONTRACT_VERSION,
  CAPSULE_MAX_RESIDUE_ITEMS,
  CAPSULE_MAX_SESSIONS,
  CAPSULE_RESIDUE_KINDS,
  type CapsuleFileRuntime,
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
  type CloseoutCapsuleData,
  type CloseoutCapsuleFacts,
  type CloseoutCheckoutFacts,
  type CloseoutData,
  type CloseoutDeleteArguments,
  type CloseoutDeliverySummary,
  type CloseoutDiffRead,
  type CloseoutEvidence,
  type CloseoutEvidenceField,
  type CloseoutExpectedCapsuleEvent,
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
  type CloseoutPromotionRuntime,
  type CloseoutProviderRuntime,
  type CloseoutQueueRemovalData,
  type CloseoutReadObservation,
  type CloseoutResidueItem,
  type CloseoutRestoreArguments,
  type CloseoutRetroFacts,
  type CloseoutReverseDependentObservation,
  type CloseoutSessionFacts,
  type CloseoutStateRuntime,
  type CloseoutStep,
  type CloseoutStepId,
  type CloseoutSummary,
  type CloseoutTelemetryDisclosure,
  type CloseoutTelemetryRuntime,
  type CloseoutThreadArguments,
  type CloseoutThreadAuthorFact,
  type CloseoutTransitionArguments,
  type CloseoutWorktreeArguments,
  type CloseoutWorktreeFacts,
  type CloseoutWriteOutcome,
  DELIVERED_LABEL,
  LIFECYCLE_LABEL_DISPOSITIONS,
  OWNER_ATTENTION_LABEL,
  PROTECTED_REF_NAMES,
  type StateFenceHandle,
} from "#contracts";
import {
  capsuleDigest,
  capsuleEventGaps,
  capsulePromotionCounts,
  deriveCapsuleEventKey,
  ingestReviewArtifacts,
} from "./capsule.js";
import {
  candidateFileViolations,
  evaluateCandidates,
  validateCandidate,
} from "./capsule-candidates.js";
import { evaluateDiffSweep } from "./closeout-diff-sweep.js";
import { evaluateThreadPolicy } from "./closeout-thread-policy.js";
import { sha256Hex } from "./sha256.js";

/** The seven step definitions in binding order (PIN-2). */
export const closeoutStepDefinitions = [
  { stepId: "ticket-to-done", label: "ticket to done" },
  { stepId: "lifecycle-label-sweep", label: "lifecycle label sweep" },
  { stepId: "unassign", label: "unassign" },
  { stepId: "owed-flip-sweep", label: "owed-flip sweep" },
  { stepId: "comment-resolution", label: "comment resolution" },
  { stepId: "checkout-restore", label: "checkout restore" },
  { stepId: "worktree-cleanup", label: "local worktree cleanup" },
  { stepId: "branch-cleanup", label: "squash-safe local branch cleanup" },
  { stepId: "merged-diff-sweep", label: "merged-diff owed-flip sweep" },
  { stepId: "retro-coverage-move", label: "retro coverage move" },
  { stepId: "session-compaction", label: "session compaction checkpoint" },
  { stepId: "capsule", label: "close the change capsule" },
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
  /** The read-only capsule pre-flight facts (GH-240 F-3). */
  readonly capsule?: CloseoutCapsuleFacts;
  /** The unresolved thread authorship facts (GH-240 F-6). */
  readonly threadAuthorFacts?: readonly CloseoutThreadAuthorFact[];
  /** The read-only worktree facts (GH-240 F-7). */
  readonly worktree?: CloseoutWorktreeFacts;
  /** The retro-coverage facts (GH-240 F-8). */
  readonly retro?: CloseoutRetroFacts;
  /** The session-attribution facts (GH-240 F-9). */
  readonly sessions?: CloseoutSessionFacts;
  /** The merged-diff facts for the plan step (GH-240 F-5). */
  readonly diff?: {
    readonly available: boolean;
    readonly hits: number;
    readonly ambiguous: number;
    readonly ambiguousHits?: readonly {
      readonly kind: string;
      readonly location: string;
    }[];
  };
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
    readonly detail?: Readonly<Record<string, unknown>>;
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
    ...(options.detail === undefined ? {} : { detail: options.detail }),
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
  if (
    operation === "restore-checkout" ||
    operation === "delete-branch" ||
    operation === "remove-worktree"
  ) {
    return "supported";
  }
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
    name === "restore-checkout" || name === "delete-branch" || name === "remove-worktree"
      ? "git"
      : facts.provider.systemName;
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
  if (merged.signals?.threads === "unavailable") {
    // The merged PR was read from a list projection whose thread set is not
    // observable. An unavailable thread read is never an observed empty set.
    return planStep("comment-resolution", "skipped-noop", {
      reason: "thread-signal-unavailable",
      evidence: evidence(field("observation", "observed"), field("threads", "unavailable")),
    });
  }
  const unresolved = [...merged.value.threads]
    .filter((thread) => !thread.resolved)
    .sort((left, right) => left.threadId.localeCompare(right.threadId));
  // Absent or unknown authorship is human (fail closed): never resolve-all and
  // never resolve a thread whose root author the provider did not establish.
  const authors = new Map(
    (facts.threadAuthorFacts ?? []).map((fact) => [fact.threadId, fact.authorKind]),
  );
  const policy = evaluateThreadPolicy({
    threads: unresolved.map((thread) => ({
      threadId: thread.threadId,
      authorPrincipal: "unknown",
      authorKind: authors.get(thread.threadId) ?? "unknown",
    })),
  });
  const resolvable = new Set(policy.resolved);
  const bounded = unresolved.slice(0, CLOSEOUT_MAX_THREADS);
  const operations = bounded
    .filter((thread) => resolvable.has(thread.threadId))
    .map((thread) => {
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
      field("human", policy.residue.length),
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

/** The retro-coverage plan step (GH-240 F-8). */
const retroStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const retro = facts.retro;
  if (retro === undefined || !retro.available) {
    return planStep("retro-coverage-move", "skipped-gap", {
      reason: "retro-registry-unavailable",
      evidence: evidence(field("registry", "unavailable")),
      detail: { state: "unavailable" },
    });
  }
  return planStep("retro-coverage-move", "would-apply", {
    evidence: evidence(field("state", retro.collected ? "collected" : "pending")),
    detail: { state: retro.collected ? "collected" : "pending" },
  });
};

/** The session-compaction plan step (GH-240 F-9). */
const compactionStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const sessions = facts.sessions;
  if (sessions === undefined) {
    return planStep("session-compaction", "skipped-noop", {
      reason: "no-sessions",
      evidence: evidence(field("sessions", 0)),
      detail: { state: "no-sessions" },
    });
  }
  if (!sessions.available) {
    return planStep("session-compaction", "skipped-gap", {
      reason: "session-attribution-unavailable",
      evidence: evidence(field("sessions", "unattributed")),
      detail: { state: "unavailable" },
    });
  }
  if (sessions.sessionIds.length === 0) {
    return planStep("session-compaction", "skipped-noop", {
      reason: "no-sessions",
      evidence: evidence(field("sessions", 0)),
      detail: { state: "no-sessions" },
    });
  }
  return planStep("session-compaction", "would-apply", {
    evidence: evidence(
      field("sessions", sessions.sessionIds.length),
      field("gap", "harness-compaction-unavailable"),
    ),
    detail: {
      state: "checkpoint",
      sessions: sessions.sessionIds.length,
      gap: "harness-compaction-unavailable",
    },
  });
};

/** The merged-diff sweep plan step (GH-240 F-5). */
const diffSweepStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const diff = facts.diff;
  if (diff === undefined || !diff.available) {
    return planStep("merged-diff-sweep", "skipped-gap", {
      reason: "merged-diff-unavailable",
      evidence: evidence(field("mergedDiff", "unavailable")),
    });
  }
  return planStep("merged-diff-sweep", "would-apply", {
    evidence: evidence(field("hits", diff.hits), field("ambiguous", diff.ambiguous)),
    detail: { hits: diff.hits, ambiguous: diff.ambiguous },
  });
};

const worktreeStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const worktree = facts.worktree;
  if (worktree === undefined || !worktree.present) {
    return planStep("worktree-cleanup", "satisfied", {
      reason: "no-worktree",
      evidence: evidence(field("worktree", "absent")),
    });
  }
  if (!worktree.safe) {
    return planStep("worktree-cleanup", "would-refuse", {
      reason: "closeout.branch.unsafe",
      evidence: evidence(
        field("worktree", worktree.path ?? "unknown"),
        ...(worktree.head === undefined ? [] : [field("head", worktree.head)]),
        field("retained", 1),
        ...(worktree.reason === undefined ? [] : [field("condition", worktree.reason)]),
      ),
      detail: {
        retained: 1,
        ...(worktree.path === undefined ? {} : { path: worktree.path }),
        ...(worktree.reason === undefined ? {} : { condition: worktree.reason }),
      },
    });
  }
  const args: CloseoutWorktreeArguments = {
    worktreePath: worktree.path ?? "",
    ...(worktree.head === undefined ? {} : { expectedHead: worktree.head }),
  };
  const operation = operationFor(
    facts,
    "remove-worktree",
    {
      systemName: facts.provider.systemName,
      entityId: facts.workItemRef,
    },
    args,
  );
  return planStep("worktree-cleanup", outcomeFor(facts.persisted, [operation], "satisfied"), {
    operations: [operation],
    evidence: evidence(
      field("worktree", worktree.path ?? ""),
      ...(worktree.head === undefined ? [] : [field("head", worktree.head)]),
    ),
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

/** The terminal capsule step from the read-only pre-flight facts (GH-240 F-3). */
const capsuleStep = (facts: CloseoutPlanFacts): CloseoutStep => {
  const capsule = facts.capsule;
  const events = capsule?.events ?? 0;
  const candidates = capsule?.candidates ?? 0;
  if (capsule !== undefined && !capsule.valid) {
    return {
      stepId: "capsule",
      label: "close the change capsule",
      outcome: "would-refuse",
      reason: "closeout.capsule-invalid",
      operations: [],
      evidence: [
        field("events", events),
        ...(capsule.refusal === undefined ? [] : [field("refusal", capsule.refusal.code)]),
      ],
      detail: {
        present: capsule.present,
        events,
        candidates,
        ...(capsule.refusal === undefined ? {} : { refusal: capsule.refusal }),
      },
    };
  }
  return {
    stepId: "capsule",
    label: "close the change capsule",
    outcome: "would-apply",
    operations: [],
    evidence: [
      field("present", capsule?.present ?? false),
      field("events", events),
      field("candidates", candidates),
    ],
    detail: { present: capsule?.present ?? false, events, candidates },
  };
};

/** Build the deterministic plan from pure facts (F-2). */
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
  steps.push(worktreeStep(facts));
  steps.push(branchStep(facts, baseRef, checkout));
  steps.push(diffSweepStep(facts));
  steps.push(retroStep(facts));
  steps.push(compactionStep(facts));
  steps.push(capsuleStep(facts));
  const ordered = steps;
  const retroResidue =
    facts.retro === undefined || !facts.retro.available
      ? [
          {
            item: "the retro registry is unavailable",
            kind: "retro-coverage-unavailable" as const,
            location: "retro.registry",
          },
        ]
      : [];
  const diffResidue =
    facts.diff?.ambiguousHits?.map((hit) => ({
      item: `ambiguous ${hit.kind} hit`,
      kind: "ambiguous-flip-hit" as const,
      location: hit.location,
    })) ?? [];
  const sessionResidue =
    facts.sessions !== undefined &&
    facts.sessions.sessionIds.length > 0 &&
    !facts.sessions.available
      ? [
          {
            item: "session attribution is unavailable",
            kind: "session-attribution-gap" as const,
            location: "session.store",
          },
        ]
      : [];
  const retainedWorktree =
    facts.worktree?.present && !facts.worktree.safe
      ? [
          {
            item: `retained worktree ${facts.worktree.path ?? "unknown"}`,
            kind: "worktree-retained" as const,
            location: facts.worktree.path ?? "unknown",
          },
        ]
      : [];
  const threadAuthors = new Map(
    (facts.threadAuthorFacts ?? []).map((fact) => [fact.threadId, fact]),
  );
  const threadStepPlans =
    supports(facts.provider.capabilities, "resolve-delivery-thread") &&
    facts.mergedRequest.observation === "observed" &&
    facts.mergedRequest.signals?.threads !== "unavailable";
  const unresolvedThreads = threadStepPlans
    ? facts.mergedRequest.value.threads.filter((thread) => !thread.resolved)
    : [];
  const policy = evaluateThreadPolicy({
    threads: unresolvedThreads.map((thread) => {
      const fact = threadAuthors.get(thread.threadId);
      return {
        threadId: thread.threadId,
        authorPrincipal: fact?.authorPrincipal ?? "unknown",
        authorKind: fact?.authorKind ?? "unknown",
      };
    }),
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
    ...(policy.residue.length === 0 &&
    policy.omitted === 0 &&
    retainedWorktree.length === 0 &&
    retroResidue.length === 0 &&
    sessionResidue.length === 0 &&
    diffResidue.length === 0
      ? {}
      : {
          residue: [
            ...retainedWorktree,
            ...retroResidue,
            ...sessionResidue,
            ...diffResidue,
            ...policy.residue,
            ...(policy.omitted === 0
              ? []
              : [
                  {
                    item: `+${policy.omitted} more items`,
                    kind: "capsule-cap-reached" as const,
                    location: "residue",
                  },
                ]),
          ],
        }),
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
  readonly runId?: string;
  readonly telemetry?: CloseoutTelemetryRuntime;
  /** The append-only capsule file runtime (GH-240 F-3). */
  readonly capsule?: CapsuleFileRuntime;
  /** The expected capsule events derived from the durable state records (F-3). */
  readonly capsuleExpected?: readonly CloseoutExpectedCapsuleEvent[];
  /** The injected promotion runtime (GH-240 F-4). */
  readonly promotion?: CloseoutPromotionRuntime;
  /** The one bounded merged-diff read (GH-240 F-5). */
  readonly diffRead?: CloseoutDiffRead;
  /** The retro-coverage facts (GH-240 F-8). */
  readonly retro?: CloseoutRetroFacts;
  /** The session-attribution facts (GH-240 F-9). */
  readonly sessions?: CloseoutSessionFacts;
  /**
   * The additive non-step queue-removal hook (GH-292 F-2, DM-6). Plan mode
   * reads and reports; apply mode runs inside the closeout fence handle after
   * the steps complete. Absent leaves the data block absent, exactly as
   * delivered.
   */
  readonly queueRemoval?: (input: {
    readonly mode: "plan" | "apply";
    readonly workItemRef: string;
    readonly mergedObserved: boolean;
    readonly handle?: StateFenceHandle;
  }) => CloseoutQueueRemovalData | undefined;
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
  if (operation.name === "remove-worktree" && "worktreePath" in args) {
    if (git.removeWorktree === undefined) {
      return {
        ok: false,
        code: "closeout.branch.unsafe",
        detail: "worktree removal is unavailable",
      };
    }
    return git.removeWorktree({
      path: args.worktreePath,
      ...(args.expectedHead === undefined ? {} : { expectedHead: args.expectedHead }),
    });
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
 * Capture telemetry after the terminal steps. Non-gating: no step outcome,
 * summary, or command verdict changes; every failure is disclosed in counts and
 * warning reasons, and a failed capture writes no zero-valued record.
 */
const captureTelemetry = async (
  input: CloseoutRunInput,
  steps: readonly CloseoutStep[],
): Promise<CloseoutTelemetryDisclosure | undefined> => {
  if (input.telemetry === undefined) return undefined;
  void steps;
  const runId = input.runId ?? "closeout-run";
  const failed = (field: string): CloseoutTelemetryDisclosure => {
    const disclosure: CloseoutTelemetryDisclosure = {
      captured: 0,
      degraded: 0,
      failed: 1,
      warnings: [{ reason: "session-capture-failed", field }],
    };
    try {
      input.telemetry?.append({
        workItemRef: input.plan.workItemRef,
        runId,
        capturedAt: input.timestamp,
        records: [],
        agents: [],
        models: [],
        failedSessions: [{ sessionId: null, reason: "session-capture-failed" }],
        warnings: disclosure.warnings,
      });
    } catch {
      // The disclosure remains in the bounded output even if the ledger write fails.
    }
    return disclosure;
  };
  try {
    const captured = await input.telemetry.extract({
      workItemRef: input.plan.workItemRef,
      runId,
    });
    if (!captured.ok) return failed(captured.error.code);
    const appended = input.telemetry.append(captured.value);
    const degraded = captured.value.records.filter((record) => record.warnings.length > 0).length;
    const warnings = [
      ...captured.value.warnings,
      ...(appended.ok
        ? []
        : [{ reason: "session-capture-failed" as const, field: appended.error.code }]),
    ];
    return {
      captured: captured.value.records.length,
      degraded,
      failed: captured.value.failedSessions.length + (appended.ok ? 0 : 1),
      warnings,
      ...(captured.value.sessionTruncation === undefined
        ? {}
        : { sessionTruncation: captured.value.sessionTruncation }),
    };
  } catch {
    return failed("capture-runtime");
  }
};

const residueRank = (kind: CloseoutResidueItem["kind"]): number =>
  (CAPSULE_RESIDUE_KINDS as readonly string[]).indexOf(kind);

/** Deterministic residue order: kind order, then location (F-11, NFR-1). */
const orderResidue = (residue: readonly CloseoutResidueItem[]): readonly CloseoutResidueItem[] => {
  const ordered = [...residue].sort((left, right) => {
    const rank = residueRank(left.kind) - residueRank(right.kind);
    if (rank !== 0) return rank;
    return left.location < right.location ? -1 : left.location > right.location ? 1 : 0;
  });
  const seen = new Set<string>();
  const unique = ordered.filter((item) => {
    const key = `${item.kind}\u0000${item.location}\u0000${item.item}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (
    unique.length <= CAPSULE_MAX_RESIDUE_ITEMS ||
    unique.some((item) => item.kind === "capsule-cap-reached")
  ) {
    return unique;
  }
  const omitted = unique.length - CAPSULE_MAX_RESIDUE_ITEMS;
  return [
    ...unique.slice(0, CAPSULE_MAX_RESIDUE_ITEMS),
    { item: `+${omitted} more items`, kind: "capsule-cap-reached", location: "residue" },
  ];
};

/** The read-only capsule residue shared by plan and apply (F-3, F-11). */
const capsuleResidueOf = (input: CloseoutRunInput): readonly CloseoutResidueItem[] => {
  const runtime = input.capsule;
  if (runtime === undefined) return [];
  const residue: CloseoutResidueItem[] = [];
  const reviews = runtime.listReviewArtifacts(input.plan.workItemRef);
  const ingestion = reviews.ok
    ? ingestReviewArtifacts(reviews.artifacts)
    : { verdicts: [], unreadable: [] };
  for (const artifact of ingestion.unreadable) {
    residue.push({
      item: `unreadable review verdict ${artifact}`,
      kind: "review-verdict-unreadable",
      location: artifact,
    });
  }
  const read = runtime.read(input.plan.workItemRef);
  if (read.ok) {
    for (const gap of capsuleEventGaps(read.events, input.capsuleExpected ?? [])) {
      residue.push({
        item: `missing capsule event ${gap.kind}`,
        kind: "capsule-event-gap",
        location: gap.identity,
      });
    }
  }
  return orderResidue(residue);
};

type CapsuleStepExecution =
  | {
      readonly ok: true;
      readonly step: CloseoutStep;
      readonly capsule: CloseoutCapsuleData;
      readonly residue: readonly CloseoutResidueItem[];
    }
  | { readonly ok: false; readonly code: string; readonly detail: string };

/**
 * Execute the terminal capsule step in apply mode (GH-240 F-3, DEC-4).
 *
 * Validates first with zero writes on damage, completes a pre-contract capsule
 * with `capsule.opened` + `capsule.backfill-gap`, ingests readable review
 * verdicts, records the cross-check gaps as residue, and appends exactly one
 * terminal close.
 */
const executeCapsuleStep = (
  input: CloseoutRunInput,
  planned: CloseoutStep,
): CapsuleStepExecution => {
  const runtime = input.capsule;
  if (runtime === undefined) {
    return {
      ok: true,
      step: {
        ...planned,
        outcome: "skipped-noop",
        reason: "capsule-runtime-absent",
        operations: [],
      },
      capsule: { closed: false, events: 0, candidates: [] },
      residue: [],
    };
  }
  const workItemRef = input.plan.workItemRef;
  const runId = input.runId ?? "closeout-run";
  const read = runtime.read(workItemRef);
  if (!read.ok) {
    return { ok: false, code: "closeout.capsule-invalid", detail: read.detail };
  }
  const candidates = runtime.readCandidates(workItemRef);
  if (!candidates.ok) {
    return { ok: false, code: "closeout.capsule-invalid", detail: candidates.detail };
  }
  const reviews = runtime.listReviewArtifacts(workItemRef);
  if (!reviews.ok) {
    return { ok: false, code: "closeout.capsule-invalid", detail: reviews.detail };
  }
  const ingestion = ingestReviewArtifacts(reviews.artifacts);
  runtime.ensureCandidates(workItemRef);
  const candidateDocuments = runtime.readCandidateDocuments(workItemRef);
  if (!candidateDocuments.ok) {
    return { ok: false, code: "closeout.capsule-invalid", detail: candidateDocuments.detail };
  }
  const fileViolations = candidateFileViolations(candidateDocuments.documents);
  if (fileViolations.length > 0) {
    return {
      ok: false,
      code: "closeout.capsule-invalid",
      detail: fileViolations
        .map((violation) => `${violation.file}: ${violation.detail}`)
        .join("; "),
    };
  }
  const candidateIds = candidateDocuments.documents
    .map((document) => (/\.yaml$/.test(document.file) ? document.file.slice(0, -5) : document.file))
    .sort();
  const decisionsById = new Map<string, number>();
  for (const event of read.events) {
    if (event.kind !== "capsule.promotion") continue;
    const id = String(event.payload.id);
    decisionsById.set(id, (decisionsById.get(id) ?? 0) + 1);
  }
  const multiple = candidateIds.filter((id) => (decisionsById.get(id) ?? 0) > 1);
  if (multiple.length > 0) {
    return {
      ok: false,
      code: "closeout.capsule-invalid",
      detail: `multiple promotion decisions for ${multiple.join(", ")}`,
    };
  }
  let appended = 0;
  const append = (
    kind: "capsule.opened" | "capsule.backfill-gap" | "review.verdict" | "capsule.promotion",
    eventKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): { readonly ok: boolean; readonly code?: string; readonly detail: string } => {
    const result = runtime.append({
      changeRef: workItemRef,
      workspaceChangesDirectory: "",
      writer: "closeout",
      kind,
      eventKey,
      payload,
      runId,
      occurredAt: input.timestamp,
    });
    if (!result.ok) return { ok: false, code: result.code, detail: result.detail };
    if (result.appended) appended += 1;
    return { ok: true, detail: "" };
  };
  if (read.events.length === 0) {
    const opened = append("capsule.opened", `${workItemRef}:capsule.opened`, {
      contractVersion: CAPSULE_CONTRACT_VERSION,
      workItemRef,
    });
    if (!opened.ok) {
      return {
        ok: false,
        code: opened.code === "state.lock.busy" ? "state.lock.busy" : "closeout.capsule-invalid",
        detail: opened.detail,
      };
    }
    const backfill = append("capsule.backfill-gap", `${workItemRef}:capsule.backfill-gap`, {
      state: "pre-contract",
    });
    if (!backfill.ok) {
      return {
        ok: false,
        code: backfill.code === "state.lock.busy" ? "state.lock.busy" : "closeout.capsule-invalid",
        detail: backfill.detail,
      };
    }
  }
  for (const verdict of ingestion.verdicts) {
    const ingested = append("review.verdict", `${workItemRef}:review:${verdict.iteration}`, {
      iteration: verdict.iteration,
      verdict: verdict.verdict,
      artifact: verdict.artifact,
    });
    if (!ingested.ok) {
      return {
        ok: false,
        code: ingested.code === "state.lock.busy" ? "state.lock.busy" : "closeout.capsule-invalid",
        detail: ingested.detail,
      };
    }
  }
  const promotion = input.promotion;
  if (promotion !== undefined) {
    const decided = new Set(
      read.events
        .filter((event) => event.kind === "capsule.promotion")
        .map((event) => String(event.payload.id)),
    );
    const evaluation = evaluateCandidates({
      documents: promotion.candidates,
      memory: promotion.memory,
      decided,
    });
    if (evaluation.schemaFailures.length > 0) {
      return {
        ok: false,
        code: "closeout.capsule-invalid",
        detail: evaluation.schemaFailures
          .map((failure) => `${failure.id}: ${failure.detail}`)
          .join("; "),
      };
    }
    for (const write of evaluation.writes) {
      const written = promotion.write(write);
      if (!written.ok) {
        return {
          ok: false,
          code:
            written.code === "escape" ? "closeout.step.capsule.failed" : "closeout.capsule-invalid",
          detail: written.detail,
        };
      }
    }
    for (const decision of evaluation.decisions) {
      const appendedDecision = append(
        "capsule.promotion",
        `${workItemRef}:capsule.promotion:${decision.id}`,
        decision.decision === "promoted"
          ? {
              id: decision.id,
              class: decision.class,
              decision: "promoted",
              mode: decision.mode,
              home: decision.home,
              ...(decision.supersedes === undefined ? {} : { supersedes: decision.supersedes }),
            }
          : {
              id: decision.id,
              class: decision.class,
              decision: "rejected",
              reason: decision.reason,
            },
      );
      if (!appendedDecision.ok) {
        return {
          ok: false,
          code:
            appendedDecision.code === "state.lock.busy"
              ? "state.lock.busy"
              : "closeout.capsule-invalid",
          detail: appendedDecision.detail,
        };
      }
    }
  }
  const beforeClose = runtime.read(workItemRef);
  if (!beforeClose.ok) {
    return { ok: false, code: "closeout.capsule-invalid", detail: beforeClose.detail };
  }
  const finalDecisions = new Map<string, number>();
  for (const event of beforeClose.events) {
    if (event.kind !== "capsule.promotion") continue;
    const id = String(event.payload.id);
    finalDecisions.set(id, (finalDecisions.get(id) ?? 0) + 1);
  }
  const undecided = candidateIds.filter((id) => (finalDecisions.get(id) ?? 0) !== 1);
  if (undecided.length > 0) {
    return {
      ok: false,
      code: "closeout.capsule-invalid",
      detail: `every candidate needs exactly one promotion decision (${undecided.join(", ")})`,
    };
  }
  const residue = orderResidue([
    ...ingestion.unreadable.map((artifact) => ({
      item: `unreadable review verdict ${artifact}`,
      kind: "review-verdict-unreadable" as const,
      location: artifact,
    })),
    ...capsuleEventGaps(beforeClose.events, input.capsuleExpected ?? []).map((gap) => ({
      item: `missing capsule event ${gap.kind}`,
      kind: "capsule-event-gap" as const,
      location: gap.identity,
    })),
  ]);
  const preContract = beforeClose.events.some((event) => event.kind === "capsule.backfill-gap");
  const decisionCounts = capsulePromotionCounts(beforeClose.events);
  const closed = runtime.close({
    changeRef: workItemRef,
    workspaceChangesDirectory: "",
    writer: "closeout",
    eventKey: `${workItemRef}:capsule.closed`,
    payload: {
      decisionCounts,
      eventCount: beforeClose.events.length,
      digest: capsuleDigest(beforeClose.events),
    },
    runId,
    occurredAt: input.timestamp,
  });
  if (!closed.ok && closed.code !== "capsule.post-close") {
    return {
      ok: false,
      code: closed.code === "state.lock.busy" ? "state.lock.busy" : "closeout.capsule-invalid",
      detail: closed.detail,
    };
  }
  if (closed.ok && closed.appended) appended += 1;
  const afterClose = runtime.read(workItemRef);
  const events = afterClose.ok ? afterClose.events : beforeClose.events;
  const projections = events
    .filter((event) => event.kind === "capsule.promotion")
    .map((event) => ({
      id: String(event.payload.id),
      decision: event.payload.decision as "promoted" | "rejected",
      ...(typeof event.payload.home === "string" ? { home: event.payload.home } : {}),
      ...(typeof event.payload.reason === "string" ? { reason: event.payload.reason } : {}),
    }));
  const outcome: CloseoutOutcome = appended > 0 ? "applied" : "satisfied";
  return {
    ok: true,
    step: {
      ...planned,
      outcome,
      operations: [],
      evidence: [
        field("closed", true),
        field("events", events.length),
        field("candidates", projections.length),
        field("gaps", residue.filter((item) => item.kind === "capsule-event-gap").length),
      ],
      detail: {
        closed: true,
        events: events.length,
        candidates: projections.length,
        preContract,
      },
    },
    capsule: { closed: true, events: events.length, candidates: projections },
    residue,
  };
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
/**
 * The complete capsule pre-flight (GH-240 F-3, DEC-4; review F-2).
 *
 * Runs in plan and apply before any provider write, git mutation, or state
 * append: capsule damage, candidate caps, `<id>.yaml` naming, candidate schema,
 * one decision per candidate, and promotion path confinement.
 */
const capsulePreflightOf = (
  input: CloseoutRunInput,
): { readonly code: string; readonly detail: string } | undefined => {
  const runtime = input.capsule;
  if (runtime === undefined) return undefined;
  const workItemRef = input.plan.workItemRef;
  const read = runtime.read(workItemRef);
  if (!read.ok) {
    return { code: "closeout.capsule-invalid", detail: read.detail };
  }
  const candidates = runtime.readCandidates(workItemRef);
  if (!candidates.ok) {
    return { code: "closeout.capsule-invalid", detail: candidates.detail };
  }
  const documents = runtime.readCandidateDocuments(workItemRef);
  if (!documents.ok) {
    return { code: "closeout.capsule-invalid", detail: documents.detail };
  }
  const violations = candidateFileViolations(documents.documents);
  if (violations.length > 0) {
    return {
      code: "closeout.capsule-invalid",
      detail: violations.map((violation) => `${violation.file}: ${violation.detail}`).join("; "),
    };
  }
  for (const document of documents.documents) {
    const validated = validateCandidate(document.value);
    if (!validated.ok) {
      return {
        code: "closeout.capsule-invalid",
        detail: `${document.file}: ${validated.detail}`,
      };
    }
  }
  const decisions = new Map<string, number>();
  for (const event of read.events) {
    if (event.kind !== "capsule.promotion") continue;
    const id = String(event.payload.id);
    decisions.set(id, (decisions.get(id) ?? 0) + 1);
  }
  const evaluation =
    input.promotion === undefined
      ? undefined
      : evaluateCandidates({
          documents: input.promotion.candidates,
          memory: input.promotion.memory,
          decided: new Set(decisions.keys()),
        });
  const planned = new Set((evaluation?.decisions ?? []).map((decision) => decision.id));
  const candidateIds = documents.documents
    .map((document) => (/\.yaml$/.test(document.file) ? document.file.slice(0, -5) : document.file))
    .sort();
  const undecided = candidateIds.filter((id) => {
    const count = decisions.get(id) ?? 0;
    if (count > 1) return true;
    return count === 0 && !planned.has(id);
  });
  if (undecided.length > 0) {
    return {
      code: "closeout.capsule-invalid",
      detail: `every candidate needs exactly one promotion decision (${undecided.join(", ")})`,
    };
  }
  if (evaluation !== undefined && evaluation.schemaFailures.length > 0) {
    return {
      code: "closeout.capsule-invalid",
      detail: evaluation.schemaFailures
        .map((failure) => `${failure.id}: ${failure.detail}`)
        .join("; "),
    };
  }
  const checked =
    evaluation === undefined ? undefined : input.promotion?.preflight?.(evaluation.writes);
  if (checked !== undefined && !checked.ok) {
    return { code: "closeout.step.capsule.failed", detail: checked.detail };
  }
  return undefined;
};

export const runCloseout = async (input: CloseoutRunInput): Promise<CloseoutRunResult> => {
  const failure = targetFailure(input.plan, input.apply);
  if (failure !== undefined) return failure;
  const preflightFailure = capsulePreflightOf(input);
  if (input.apply && preflightFailure !== undefined) {
    return {
      ok: false,
      error: {
        kind: "closeout",
        code: preflightFailure.code,
        summary: preflightFailure.detail,
      },
    };
  }
  if (input.apply && input.capsule !== undefined) {
    const capsuleRead = input.capsule.read(input.plan.workItemRef);
    if (!capsuleRead.ok) {
      return { ok: false, error: { kind: "closeout", code: "closeout.capsule-invalid" } };
    }
    if (capsuleRead.events.length === 0) {
      // Pre-contract: record the backfill before any later step appends to it,
      // so the terminal capsule step always finds the honest history.
      const file = input.capsule.ensureCandidates(input.plan.workItemRef);
      if (file.ok) {
        input.capsule.append({
          changeRef: input.plan.workItemRef,
          workspaceChangesDirectory: "",
          writer: "closeout",
          kind: "capsule.opened",
          eventKey: `${input.plan.workItemRef}:capsule.opened`,
          payload: {
            contractVersion: CAPSULE_CONTRACT_VERSION,
            workItemRef: input.plan.workItemRef,
          },
          runId: input.runId ?? "closeout-run",
          occurredAt: input.timestamp,
        });
        input.capsule.append({
          changeRef: input.plan.workItemRef,
          workspaceChangesDirectory: "",
          writer: "closeout",
          kind: "capsule.backfill-gap",
          eventKey: `${input.plan.workItemRef}:capsule.backfill-gap`,
          payload: { state: "pre-contract" },
          runId: input.runId ?? "closeout-run",
          occurredAt: input.timestamp,
        });
      }
    }
  }

  if (!input.apply) {
    const residue = orderResidue([...(input.plan.residue ?? []), ...capsuleResidueOf(input)]);
    let steps = input.plan.steps;
    {
      const read = input.capsule?.read(input.plan.workItemRef);
      const documents = input.capsule?.readCandidateDocuments(input.plan.workItemRef);
      const candidateDocs = documents?.ok === true ? documents.documents : [];
      const decisions = new Map<string, number>();
      if (read?.ok === true) {
        for (const event of read.events) {
          if (event.kind !== "capsule.promotion") continue;
          const id = String(event.payload.id);
          decisions.set(id, (decisions.get(id) ?? 0) + 1);
        }
      }
      const evaluation =
        input.promotion === undefined
          ? undefined
          : evaluateCandidates({
              documents: input.promotion.candidates,
              memory: input.promotion.memory,
              decided: new Set(decisions.keys()),
            });
      const planned = new Set((evaluation?.decisions ?? []).map((decision) => decision.id));
      const candidateIds = candidateDocs
        .map((document) =>
          /\.yaml$/.test(document.file) ? document.file.slice(0, -5) : document.file,
        )
        .sort();
      const undecided = candidateIds.filter((id) => {
        const count = decisions.get(id) ?? 0;
        if (count > 1) return true;
        return count === 0 && !planned.has(id);
      });
      const violations = candidateFileViolations(candidateDocs);
      const schemaFailures = evaluation?.schemaFailures ?? [];
      const preflight =
        evaluation === undefined ? undefined : input.promotion?.preflight?.(evaluation.writes);
      const refusal =
        violations.length > 0
          ? {
              reason: "closeout.capsule-invalid",
              detail: violations
                .map((violation) => `${violation.file}: ${violation.detail}`)
                .join("; "),
            }
          : schemaFailures.length > 0
            ? {
                reason: "closeout.capsule-invalid",
                detail: schemaFailures
                  .map((failure) => `${failure.id}: ${failure.detail}`)
                  .join("; "),
              }
            : undecided.length > 0
              ? {
                  reason: "closeout.capsule-invalid",
                  detail: `every candidate needs exactly one promotion decision (${undecided.join(", ")})`,
                }
              : preflight !== undefined && !preflight.ok
                ? { reason: "closeout.step.capsule.failed", detail: preflight.detail }
                : undefined;
      if (refusal !== undefined) {
        steps = input.plan.steps.map((step) =>
          step.stepId === "capsule"
            ? {
                ...step,
                outcome: "would-refuse" as const,
                reason: refusal.reason,
                detail: { ...(step.detail ?? {}), refusal: refusal.detail },
              }
            : step,
        );
      }
    }
    const data: CloseoutData = {
      schemaId: CLOSEOUT_SCHEMA_ID,
      command: "closeout",
      workItemRef: input.plan.workItemRef,
      mode: "plan",
      baseRef: input.plan.baseRef,
      ...(input.plan.deliveryRequest === undefined
        ? {}
        : { deliveryRequest: input.plan.deliveryRequest }),
      steps,
      summary: summarizeCloseout(steps),
      ledgerKey: `closeout.operations:${input.plan.workItemRef}`,
      ...(residue.length === 0 ? {} : { residue }),
      ...(() => {
        const queueRemoval = input.queueRemoval?.({
          mode: "plan",
          workItemRef: input.plan.workItemRef,
          mergedObserved: input.plan.deliveryRequest !== undefined,
        });
        return queueRemoval === undefined ? {} : { queueRemoval };
      })(),
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
  let capsuleData: CloseoutCapsuleData | undefined;
  let capsuleFailure: { readonly code: string; readonly detail: string } | undefined;
  const capsuleResidue: CloseoutResidueItem[] = [...(input.plan.residue ?? [])];
  const mergedHeadSha = input.plan.deliveryRequest?.headSha;
  // GH-292 F-2: the additive non-step queue-removal disclosure, assigned
  // inside the fence and disclosed in the applied data.
  let queueRemoval: CloseoutQueueRemovalData | undefined;

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
      if (step.stepId === "retro-coverage-move") {
        const retro = input.retro;
        if (retro === undefined || !retro.available) {
          capsuleResidue.push({
            item: "the retro registry is unavailable",
            kind: "retro-coverage-unavailable",
            location: "retro.registry",
          });
          steps.push({ ...step, outcome: "skipped-gap", reason: "retro-registry-unavailable" });
          continue;
        }
        let appended = false;
        if (input.capsule !== undefined) {
          const result = input.capsule.append({
            changeRef: input.plan.workItemRef,
            workspaceChangesDirectory: "",
            writer: "closeout",
            kind: "capsule.retro-coverage",
            eventKey: `${input.plan.workItemRef}:capsule.retro-coverage:change`,
            payload: {
              level: "change",
              state: retro.collected ? "collected" : "pending",
              ...(retro.runId === undefined ? {} : { runId: retro.runId }),
            },
            runId: input.runId ?? "closeout-run",
            occurredAt: input.timestamp,
          });
          if (!result.ok && result.code === "state.lock.busy") {
            capsuleFailure = { code: "state.lock.busy", detail: result.detail };
            break;
          }
          appended = result.ok && result.appended;
        }
        steps.push({
          ...step,
          outcome: appended ? "applied" : "satisfied",
          detail: { state: retro.collected ? "collected" : "pending" },
        });
        continue;
      }
      if (step.stepId === "session-compaction") {
        const sessions = input.sessions;
        if (sessions === undefined) {
          steps.push({ ...step, outcome: "skipped-noop", reason: "no-sessions" });
          continue;
        }
        if (!sessions.available) {
          capsuleResidue.push({
            item: "session attribution is unavailable",
            kind: "session-attribution-gap",
            location: "session.store",
          });
          steps.push({
            ...step,
            outcome: "skipped-gap",
            reason: "session-attribution-unavailable",
          });
          continue;
        }
        if (sessions.sessionIds.length === 0) {
          steps.push({ ...step, outcome: "skipped-noop", reason: "no-sessions" });
          continue;
        }
        let appended = false;
        if (input.capsule !== undefined) {
          const ids = sessions.sessionIds.slice(0, CAPSULE_MAX_SESSIONS);
          const result = input.capsule.append({
            changeRef: input.plan.workItemRef,
            workspaceChangesDirectory: "",
            writer: "closeout",
            kind: "capsule.compaction-checkpoint",
            eventKey: deriveCapsuleEventKey([
              "capsule.compaction-checkpoint",
              [...sessions.sessionIds].sort().join(","),
              sessions.lastVerifiedCommit ?? "",
            ]),
            payload: {
              sessions: ids,
              sessionCount: sessions.sessionIds.length,
              workingStateFlushed: sessions.workingStateFlushed ?? true,
              eventLogFlushed: sessions.eventLogFlushed ?? true,
              unresolvedQuestions: sessions.unresolvedQuestions ?? 0,
              lastVerifiedCommit: sessions.lastVerifiedCommit ?? "",
              gap: "harness-compaction-unavailable",
              ...(sessions.truncated === undefined
                ? {}
                : { sessionTruncation: sessions.truncated }),
            },
            runId: input.runId ?? "closeout-run",
            occurredAt: input.timestamp,
          });
          if (!result.ok && result.code === "state.lock.busy") {
            capsuleFailure = { code: "state.lock.busy", detail: result.detail };
            break;
          }
          appended = result.ok && result.appended;
        }
        steps.push({
          ...step,
          outcome: appended ? "applied" : "satisfied",
          detail: { state: "checkpoint", gap: "harness-compaction-unavailable" },
        });
        continue;
      }
      if (step.stepId === "merged-diff-sweep") {
        const sweep = evaluateDiffSweep({
          ...(input.diffRead === undefined ? {} : { diff: input.diffRead }),
          workItemRef: input.plan.workItemRef,
        });
        if (sweep.status === "unavailable") {
          steps.push({
            ...step,
            outcome: "skipped-gap",
            reason: "merged-diff-unavailable",
            operations: [],
          });
          continue;
        }
        const ambiguous = sweep.hits.filter((hit) => !hit.resolved);
        for (const hit of ambiguous) {
          capsuleResidue.push({
            item: `ambiguous ${hit.kind} hit`,
            kind: "ambiguous-flip-hit",
            location: `${hit.filePath}:${hit.line}`,
          });
        }
        let added = 0;
        if (input.capsule !== undefined) {
          for (const hit of sweep.hits.filter((entry) => entry.resolved)) {
            const eventKey = deriveCapsuleEventKey([
              "closeout.step",
              hit.filePath,
              hit.contentHash,
              hit.kind,
              input.plan.workItemRef,
            ]);
            const appendedHit = input.capsule.append({
              changeRef: input.plan.workItemRef,
              workspaceChangesDirectory: "",
              writer: "closeout",
              kind: "closeout.step",
              eventKey,
              payload: {
                stepId: "merged-diff-sweep",
                outcome: "applied",
                filePath: hit.filePath,
                lineHash: hit.contentHash,
                markerKind: hit.kind,
                workItemRef: input.plan.workItemRef,
              },
              runId: input.runId ?? "closeout-run",
              occurredAt: input.timestamp,
            });
            if (!appendedHit.ok && appendedHit.code === "state.lock.busy") {
              capsuleFailure = { code: "state.lock.busy", detail: appendedHit.detail };
              break;
            }
            if (appendedHit.ok && appendedHit.appended) added += 1;
          }
        }
        if (capsuleFailure !== undefined) break;
        const { reason: _planReason, ...withoutPlanReason } = step;
        void _planReason;
        steps.push({
          ...withoutPlanReason,
          outcome: added > 0 ? "applied" : "satisfied",
          operations: [],
          evidence: evidence(
            field("hits", sweep.hits.length),
            field("ambiguous", ambiguous.length),
          ),
          detail: { hits: sweep.hits.length, ambiguous: ambiguous.length, added },
        });
        continue;
      }
      if (step.stepId === "capsule") {
        const executed = executeCapsuleStep(input, step);
        if (!executed.ok) {
          capsuleFailure = { code: executed.code, detail: executed.detail };
          break;
        }
        steps.push(executed.step);
        capsuleData = executed.capsule;
        capsuleResidue.push(...executed.residue);
        continue;
      }
      if (step.outcome !== "would-apply") {
        steps.push({ ...step, outcome: PLAN_TO_APPLY[step.outcome] ?? step.outcome });
        continue;
      }
      let applied = 0;
      let _satisfied = 0;
      let failed = 0;
      for (const operation of step.operations) {
        if (stateFailure !== undefined) break;
        const existing = persisted[operation.operationId];
        if (existing !== undefined && TERMINAL_OUTCOMES.has(existing.outcome)) {
          _satisfied += 1;
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
        else _satisfied += 1;
        if (!append(recordFor(operation, input.plan.workItemRef, outcome, input.timestamp))) break;
      }
      const outcome: CloseoutOutcome =
        failed > 0 ? "failed" : applied > 0 ? "applied" : "satisfied";
      steps.push({ ...step, outcome });
    }
    // GH-292 F-2: the landed-removal hook runs after the closeout writes and
    // inside the fence the transaction already holds; it is fail-open and
    // never changes a step outcome or the exit code.
    queueRemoval = input.queueRemoval?.({
      mode: "apply",
      workItemRef: input.plan.workItemRef,
      mergedObserved: input.plan.deliveryRequest !== undefined,
      handle,
    });
  } finally {
    input.state.releaseFence(handle);
  }

  if (stateFailure !== undefined) {
    return { ok: false, error: stateFailure };
  }
  if (capsuleFailure !== undefined) {
    return {
      ok: false,
      error: {
        kind: capsuleFailure.code.startsWith("state.") ? "state" : "closeout",
        code: capsuleFailure.code,
        summary: capsuleFailure.detail,
      },
    };
  }
  const telemetryCapture = await captureTelemetry(input, steps);
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
    ...(telemetryCapture === undefined ? {} : { telemetryCapture }),
    ...(capsuleData === undefined ? {} : { capsule: capsuleData }),
    ...(capsuleResidue.length === 0 ? {} : { residue: orderResidue(capsuleResidue) }),
    ...(queueRemoval === undefined ? {} : { queueRemoval }),
  };
  if (steps.some((step) => step.outcome === "failed")) {
    return {
      ok: false,
      error: { kind: "closeout", code: "closeout.write.failed" },
    };
  }
  const refused = steps.find((step) => step.outcome === "refused");
  if (refused !== undefined) {
    const retained = refused.detail?.retained;
    const path = refused.detail?.path;
    const condition = refused.detail?.condition;
    const evidence = [
      retained === undefined ? "" : `retained=${String(retained)}`,
      path === undefined ? "" : `path=${String(path)}`,
      condition === undefined ? "" : `condition=${String(condition)}`,
    ]
      .filter((part) => part.length > 0)
      .join(" ");
    return {
      ok: false,
      error: {
        kind: "closeout",
        code: "closeout.branch.unsafe",
        summary: `${refused.stepId} refused${evidence.length === 0 ? "" : `: ${evidence}`}`,
      },
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
  if (data.residue !== undefined && data.residue.length > 0) {
    lines.push("");
    lines.push("JUDGMENT RESIDUE");
    for (const item of data.residue) {
      lines.push(`- ${item.kind} ${item.item} (${item.location})`);
    }
  }
  if (data.capsule !== undefined) {
    lines.push(
      `capsule: closed=${String(data.capsule.closed)} events=${data.capsule.events} candidates=${data.capsule.candidates.length}`,
    );
  }
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
