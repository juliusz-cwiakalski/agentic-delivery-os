/**
 * The `delivery.closeout.v1` vocabulary (GH-183 F-1..F-15, DM-1..DM-11).
 *
 * Runtime-neutral by construction: types plus `as const` data only. The closeout
 * transaction plan, the canonical operation arguments, the deterministic
 * identity inputs, the bounded output envelope, and the additive
 * `closeout.operation` ledger payload are declared here.
 *
 * The discriminated read observation (DM-11) is closeout-specific contract
 * data: it adds no core primitive-port field and no closed adapter operation.
 */
import type { AdapterCapabilityDeclaration, CapabilityGapReason } from "./adapter-capabilities.js";
import type {
  CapsuleCandidateProjection,
  CloseoutCapsuleData,
  CloseoutResidueItem,
} from "./capsule.js";
import type { HarnessResult } from "./harness.js";
import type {
  HarnessTelemetryAppendReport,
  HarnessTelemetryCapture,
  HarnessTelemetryWarning,
  HarnessTruncation,
} from "./harness-telemetry.js";
import type { DeliveryRequest, ProviderQualifiedIdentity, WorkItem } from "./ports.js";
import type {
  StateAppendOutcome,
  StateFenceAcquisition,
  StateFenceHandle,
  StateFenceReleaseReport,
  StateResult,
} from "./state.js";

/** The machine payload schema identifier for the closeout command (F-13). */
export const CLOSEOUT_SCHEMA_ID = "delivery.closeout.v1" as const;

/** The append-only ledger payload schema identifier (EVT-1). */
export const CLOSEOUT_OPERATION_PAYLOAD_SCHEMA = "delivery.closeout.operation.v1" as const;

/** The additive state-ledger record kind (EVT-1, DM-4). */
export const CLOSEOUT_OPERATION_RECORD_KIND = "closeout.operation" as const;

/** The step ids in their binding order (F-2, PIN-2; GH-240 F-12 additive). */
export const CLOSEOUT_STEP_IDS = [
  "ticket-to-done",
  "lifecycle-label-sweep",
  "unassign",
  "owed-flip-sweep",
  "comment-resolution",
  "checkout-restore",
  "worktree-cleanup",
  "branch-cleanup",
  "merged-diff-sweep",
  "retro-coverage-move",
  "session-compaction",
  "capsule",
] as const;

/** Plan-mode outcome vocabulary (DM-3, PIN-5). */
export const CLOSEOUT_PLAN_OUTCOMES = [
  "would-apply",
  "satisfied",
  "skipped-gap",
  "skipped-noop",
  "would-refuse",
] as const;

/** Apply-mode outcome vocabulary (DM-3, PIN-5). */
export const CLOSEOUT_APPLY_OUTCOMES = [
  "applied",
  "satisfied",
  "skipped-gap",
  "skipped-noop",
  "failed",
  "refused",
] as const;

/** The closed gap-reason vocabulary (PIN-6). */
export const CLOSEOUT_GAP_REASONS = [
  "provider-unsupported",
  "adapter-not-implemented",
  "plan-restriction",
] as const;

/** The five closeout operation names (PIN-3). */
export const CLOSEOUT_OPERATION_NAMES = [
  "transition-work-item",
  "write-work-item",
  "resolve-delivery-thread",
  "restore-checkout",
  "delete-branch",
  "remove-worktree",
] as const;

/** The discriminated read-observation vocabulary (DM-11). */
export const CLOSEOUT_READ_OBSERVATIONS = [
  "observed",
  "not-found",
  "unavailable",
  "invalid",
] as const;

/**
 * The reverse-dependent surface vocabulary (F-7, AC-F7-6).
 *
 * This is deliberately separate from `CLOSEOUT_READ_OBSERVATIONS`: an absent
 * bounded reverse query surface is a provider-level capability gap, not the
 * same signal as a surface that exists but whose current read is unavailable.
 * Collapsing the two is what made AC-F7-6 unreachable in production.
 */
export const CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS = [
  "observed",
  "no-surface",
  "not-found",
  "unavailable",
  "invalid",
] as const;

/** The bounded lifecycle-label disposition table in declared order (F-5, PIN-7). */
export const LIFECYCLE_LABEL_DISPOSITIONS = [
  { label: "change", disposition: "keep" },
  { label: "planning", disposition: "remove" },
  { label: "spec-ready", disposition: "remove" },
  { label: "readiness-passed", disposition: "remove" },
  { label: "in-progress", disposition: "remove" },
  { label: "review", disposition: "remove" },
  { label: "blocked", disposition: "remove" },
  { label: "delivered", disposition: "add" },
] as const;

/** The v1 protected-ref names; the resolved base is added at plan time (PIN-8). */
export const PROTECTED_REF_NAMES = ["main", "main-tools", "HEAD"] as const;

/** The compiled v1 integration base; not a configuration key (DEC-9, PIN-8). */
export const CLOSEOUT_INTEGRATION_BASE = "main-tools" as const;

/** The declared owner-attention label (F-7). */
export const OWNER_ATTENTION_LABEL = "hand-back" as const;

/** The label removed when an owed dependent is flipped (F-7). */
export const BLOCKED_LABEL = "blocked" as const;

/** The label added when the lifecycle sweep completes (F-5). */
export const DELIVERED_LABEL = "delivered" as const;

/** The type label retained by the lifecycle sweep (F-5). */
export const CHANGE_LABEL = "change" as const;

/** The bound on direct dependents evaluated in one run (F-7, PIN-9). */
export const CLOSEOUT_MAX_DEPENDENTS = 200 as const;

/** The bound on unresolved threads resolved in one run (F-8, PIN-9). */
export const CLOSEOUT_MAX_THREADS = 100 as const;

/** The per-operation timeout in milliseconds (NFR-6, PIN-9). */
export const CLOSEOUT_OPERATION_TIMEOUT_MS = 30_000 as const;

/** The machine-payload byte bound (F-13, PIN-9). */
export const CLOSEOUT_MAX_MACHINE_BYTES = 65_536 as const;

/** The human-output line bound (F-13, PIN-9). */
export const CLOSEOUT_MAX_HUMAN_LINES = 200 as const;

/** The human-output byte bound (F-13, PIN-9). */
export const CLOSEOUT_MAX_HUMAN_BYTES = 16_384 as const;

/** The bound on declared members reported in one closeout run (GH-310 DEC-10). */
export const CLOSEOUT_MAX_MEMBERS = 8 as const;

/** The per-member cleanup column in plan mode (GH-310 DM-5, DEC-12). */
export const CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES = [
  "would-apply",
  "satisfied",
  "would-refuse",
  "skipped-gap",
] as const;

/** The per-member cleanup column in apply mode (GH-310 DM-5, DEC-12). */
export const CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES = [
  "applied",
  "satisfied",
  "refused",
  "skipped-gap",
] as const;

/** The per-member issue-closure column in plan mode (GH-310 DM-5, DEC-12). */
export const CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES = [
  "would-apply",
  "satisfied",
  "skipped-noop",
  "skipped-gap",
] as const;

/** The per-member issue-closure column in apply mode (GH-310 DM-5, DEC-12). */
export const CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES = [
  "applied",
  "satisfied",
  "skipped-noop",
  "skipped-gap",
] as const;

/**
 * The closed observed tracked-issue fact vocabulary (GH-310 DM-8).
 *
 * `open` and `closed` are observed tracker states; `none` means the member
 * declares no tracked issue; `unavailable` is a tracker read gap. The fact is
 * an input to the DM-5 mapping, never a report value.
 */
export const CLOSEOUT_MEMBER_ISSUE_FACTS = ["open", "closed", "none", "unavailable"] as const;

/** One of the seven ordered step ids. */
export type CloseoutStepId = (typeof CLOSEOUT_STEP_IDS)[number];

/** One of the five closeout operation names. */
export type CloseoutOperationName = (typeof CLOSEOUT_OPERATION_NAMES)[number];

/** A plan-mode outcome. */
export type CloseoutPlanOutcome = (typeof CLOSEOUT_PLAN_OUTCOMES)[number];

/** An apply-mode outcome. */
export type CloseoutApplyOutcome = (typeof CLOSEOUT_APPLY_OUTCOMES)[number];

/** The union of plan and apply outcomes. */
export type CloseoutOutcome = CloseoutPlanOutcome | CloseoutApplyOutcome;

/** A declared gap reason. */
export type CloseoutGapReason = (typeof CLOSEOUT_GAP_REASONS)[number];

/** The per-member cleanup value in plan mode (GH-310 DM-5). */
export type CloseoutMemberCleanupPlanOutcome =
  (typeof CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES)[number];

/** The per-member cleanup value in apply mode (GH-310 DM-5). */
export type CloseoutMemberCleanupApplyOutcome =
  (typeof CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES)[number];

/** The per-member issue-closure value in plan mode (GH-310 DM-5). */
export type CloseoutMemberIssuePlanOutcome = (typeof CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES)[number];

/** The per-member issue-closure value in apply mode (GH-310 DM-5). */
export type CloseoutMemberIssueApplyOutcome = (typeof CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES)[number];

/** The union of one member's mode-scoped cleanup values. */
export type CloseoutMemberCleanup =
  | CloseoutMemberCleanupPlanOutcome
  | CloseoutMemberCleanupApplyOutcome;

/** The union of one member's mode-scoped issue-closure values. */
export type CloseoutMemberIssueClosure =
  | CloseoutMemberIssuePlanOutcome
  | CloseoutMemberIssueApplyOutcome;

/** One observed tracked-issue fact (GH-310 DM-8). */
export type CloseoutMemberIssueFact = (typeof CLOSEOUT_MEMBER_ISSUE_FACTS)[number];

/**
 * One declared member's injected closeout facts (GH-310 DM-8, DEC-20).
 *
 * The entries are supplied through the closeout composition, one per declared
 * member in declared order. They carry per-member merge truth, the member
 * branch, and the observed tracked-issue fact only: no port, provider
 * operation, or durable store is added, and the durable production carrier
 * beyond the injection is deferred (OQ-6).
 */
export type CrossRepositoryCloseoutObservation = {
  readonly repoKey: string;
  readonly pullRequest: string;
  readonly merged: boolean;
  readonly headSha?: string;
  readonly branch: string;
  /**
   * The member's tracker work-item identity (DM-8): the tracked item that
   * member's delivery lands, supplied by the composition exactly like
   * `headSha`. It is the only permitted target of a member `ticket-to-done`
   * transition; a member without it reports `issueClosure: skipped-noop` and
   * schedules no transition, and no identity is ever synthesized from the
   * member ref or the change ref (DEC-12).
   */
  readonly issue?: string;
  /** The observed tracked-issue fact input to the DM-5 mapping. */
  readonly issueClosure?: CloseoutMemberIssueFact;
};

/** One additive per-member closeout report entry (GH-310 DM-5). */
export type CloseoutMemberReport = {
  readonly repoKey: string;
  readonly branch: string;
  readonly cleanup: CloseoutMemberCleanup;
  readonly pullRequest: string;
  readonly issueClosure: CloseoutMemberIssueClosure;
  /** Boolean merge truth: true only when the member's merge is observed. */
  readonly landed: boolean;
};

/**
 * One member's planned closeout projection (GH-310 DM-5, DEC-12).
 *
 * The projection is derived at plan time from that member's injected
 * observation plus the member's own planned operations — never from step
 * `detail` — and the operation ids attribute the executed outcomes in apply
 * mode.
 */
export type CloseoutMemberPlan = {
  readonly observation: CrossRepositoryCloseoutObservation;
  readonly cleanup: CloseoutMemberCleanupPlanOutcome;
  readonly cleanupOperationId?: string;
  readonly issueClosure: CloseoutMemberIssuePlanOutcome;
  readonly issueOperationId?: string;
};

/** A read-observation discriminant. */
export type CloseoutReadObservationKind = (typeof CLOSEOUT_READ_OBSERVATIONS)[number];

/** The capability posture folded into the operation identity (DEC-7, PIN-3). */
export type CloseoutCapabilityContext = "supported" | CapabilityGapReason;

/**
 * A discriminated provider read observation (DM-11).
 *
 * `observed` carries the provider-asserted value (an empty collection means
 * "none"); `not-found`, `unavailable`, and `invalid` never collapse into it.
 */
export type CloseoutObservedSignals = {
  readonly labels?: "observed" | "unavailable";
  readonly relations?: "observed" | "unavailable" | "unknown";
  readonly assignee?: "observed" | "unavailable";
  /** Review-thread availability on a delivery request (GitHub GraphQL read). */
  readonly threads?: "observed" | "unavailable";
};

export type CloseoutReadObservation<T> =
  | {
      readonly observation: "observed";
      readonly value: T;
      readonly signals?: CloseoutObservedSignals;
    }
  | { readonly observation: "not-found" }
  | { readonly observation: "unavailable" }
  | {
      readonly observation: "invalid";
      readonly detail: string;
      /** A preserved classified identity (e.g. a credential/config failure). */
      readonly code?: string;
    };

/**
 * A reverse-dependent read result (F-7, AC-F7-6).
 *
 * `no-surface` means the adapter/runtime has no bounded reverse query surface;
 * it maps to a provider-level `skipped-gap` (`provider-unsupported`).
 * `unavailable` means the surface exists but the current read is unavailable;
 * it maps to a signal-level `skipped-noop` (`relation-signal-unavailable`).
 */
export type CloseoutReverseDependentObservation<T> =
  | {
      readonly observation: "observed";
      readonly value: T;
      readonly signals?: CloseoutObservedSignals;
    }
  | { readonly observation: "no-surface" }
  | { readonly observation: "not-found" }
  | { readonly observation: "unavailable" }
  | { readonly observation: "invalid"; readonly detail: string };

/** The flat `write-work-item` canonical argument object (DM-5, PIN-4). */
export type CloseoutLabelArguments = {
  readonly add?: readonly string[];
  readonly remove?: readonly string[];
};

/** The canonical arguments for a `write-work-item` label/assignee operation. */
export type CloseoutWriteArguments = CloseoutLabelArguments & {
  readonly assignee?: "none";
};

/** The canonical arguments for a `transition-work-item` operation. */
export type CloseoutTransitionArguments = {
  readonly deliveryState: "done";
};

/** The canonical arguments for a `resolve-delivery-thread` operation. */
export type CloseoutThreadArguments = {
  readonly deliveryRequest: ProviderQualifiedIdentity;
  readonly threadId: string;
};

/** The canonical arguments for a `restore-checkout` operation. */
export type CloseoutRestoreArguments = {
  readonly baseRef: string;
};

/** The canonical arguments for a `delete-branch` operation. */
export type CloseoutDeleteArguments = {
  readonly branch: string;
};

/** The canonical arguments for a `remove-worktree` operation. */
export type CloseoutWorktreeArguments = {
  readonly worktreePath: string;
  /** The head observed at planning time; re-checked before removal. */
  readonly expectedHead?: string;
};

/** The retro-coverage facts the plan consumes (GH-240 F-8, DM-9). */
export type CloseoutRetroFacts = {
  readonly available: boolean;
  readonly collected: boolean;
  readonly runId?: string;
};

/** The session-attribution facts the plan consumes (GH-240 F-9, DM-8). */
export type CloseoutSessionFacts = {
  readonly available: boolean;
  readonly sessionIds: readonly string[];
  readonly lastVerifiedCommit?: string;
  readonly unresolvedQuestions?: number;
  readonly workingStateFlushed?: boolean;
  readonly eventLogFlushed?: boolean;
  readonly truncated?: { readonly truncated: boolean; readonly omitted: number };
};

/** The injected, non-gating telemetry capture capability (GH-240 F-10). */
export type CloseoutTelemetryRuntime = {
  readonly extract: (input: {
    readonly workItemRef: string;
    readonly runId: string;
  }) => Promise<HarnessResult<HarnessTelemetryCapture>>;
  readonly append: (capture: HarnessTelemetryCapture) => StateResult<HarnessTelemetryAppendReport>;
};

/** The read-only worktree facts the plan consumes (GH-240 F-7, DM-7). */
export type CloseoutWorktreeFacts = {
  readonly present: boolean;
  readonly safe: boolean;
  readonly reason?: string;
  readonly path?: string;
  readonly head?: string;
  readonly branch?: string;
};

/** The union of canonical operation arguments (PIN-4). */
export type CloseoutCanonicalArguments =
  | CloseoutTransitionArguments
  | CloseoutWriteArguments
  | CloseoutThreadArguments
  | CloseoutRestoreArguments
  | CloseoutDeleteArguments
  | CloseoutWorktreeArguments;

/** Alias for the canonical argument union used by the plan and ledger. */
export type CloseoutArguments = CloseoutCanonicalArguments;

/** One bounded evidence field; values are primitive and non-leaking (F-13). */
export type CloseoutEvidenceField = {
  readonly name: string;
  readonly value: string | number | boolean;
};

/** Bounded operation evidence (never a payload, comment body, or secret). */
export type CloseoutEvidence = readonly CloseoutEvidenceField[];

/** A deterministic truncation marker (F-7, F-8, F-13). */
export type CloseoutTruncation = {
  readonly truncated: boolean;
  readonly omitted: number;
  readonly cap: number;
};

/** The explicit identity inputs of one closeout operation (DM-9, PIN-12). */
export type CloseoutOperationIdentityInputs = {
  readonly workspaceId: string;
  readonly workItemRef: string;
  readonly engine: string;
  readonly capabilityContext: CloseoutCapabilityContext;
  readonly operation: CloseoutOperationName;
  readonly arguments: CloseoutCanonicalArguments;
  readonly target: ProviderQualifiedIdentity;
};

/** One canonical, identity-bearing operation (DM-2). */
export type CloseoutOperation = {
  readonly operationId: string;
  readonly name: CloseoutOperationName;
  readonly engine: string;
  readonly capabilityContext: CloseoutCapabilityContext;
  readonly target: ProviderQualifiedIdentity;
  readonly arguments: CloseoutCanonicalArguments;
};

/** One ordered transaction step (DM-1). */
export type CloseoutStep = {
  readonly stepId: CloseoutStepId;
  readonly label: string;
  readonly outcome: CloseoutOutcome;
  readonly reason?: string;
  readonly operations: readonly CloseoutOperation[];
  readonly evidence: CloseoutEvidence;
  readonly truncation?: CloseoutTruncation;
  /** Additive bounded step detail (GH-240 F-12, DM-5). */
  readonly detail?: Readonly<Record<string, unknown>>;
};

/** The per-run outcome summary (F-13). */
export type CloseoutSummary = {
  readonly totalOperations: number;
  readonly counts: Readonly<Record<CloseoutOutcome, number>>;
  readonly gaps: number;
  readonly noops: number;
  readonly failures: number;
  readonly refusals: number;
};

/** The bounded delivery-request summary rendered in output (F-12, F-13). */
export type CloseoutDeliverySummary = {
  readonly systemName: string;
  readonly entityId: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly headSha?: string;
};

/** The deterministic seven-step transaction plan (DM-1, F-2). */
export type CloseoutPlan = {
  readonly schemaId: typeof CLOSEOUT_SCHEMA_ID;
  readonly workItemRef: string;
  readonly baseRef: string;
  readonly deliveryRequest?: CloseoutDeliverySummary;
  readonly steps: readonly CloseoutStep[];
  readonly summary: CloseoutSummary;
  /** Additive per-member planned projections, in declared order (GH-310 DM-5). */
  readonly members?: readonly CloseoutMemberPlan[];
  /**
   * The delivered change-level `ticket-to-done` plan outcome in member mode
   * (GH-310 DEC-23). Member transitions ride the same step additively, so the
   * apply-mode aggregate folds this contribution together with the members'
   * mode-scoped values. Absent in member-less mode and never emitted as data.
   */
  readonly changeTicketOutcome?: CloseoutPlanOutcome;
  /** Additive planned residue (thread policy and diff ambiguous hits). */
  readonly residue?: readonly CloseoutResidueItem[];
};

/** The additive telemetry-capture disclosure on the closeout output (GH-233). */
export type CloseoutTelemetryDisclosure = {
  readonly captured: number;
  readonly degraded: number;
  readonly failed: number;
  readonly warnings: readonly HarnessTelemetryWarning[];
  readonly sessionTruncation?: HarnessTruncation;
};

/** The bounded `delivery.closeout.v1` machine payload (F-13). */
export type CloseoutData = {
  readonly schemaId: typeof CLOSEOUT_SCHEMA_ID;
  readonly command: "closeout";
  readonly workItemRef: string;
  readonly mode: "plan" | "applied";
  readonly baseRef: string;
  readonly deliveryRequest?: CloseoutDeliverySummary;
  readonly steps: readonly CloseoutStep[];
  readonly summary: CloseoutSummary;
  readonly ledgerKey?: string;
  /** Non-gating telemetry capture disclosure; absent when no capture ran. */
  readonly telemetryCapture?: CloseoutTelemetryDisclosure;
  /** Additive bounded judgment residue (GH-240 F-11, DM-4). */
  readonly residue?: readonly CloseoutResidueItem[];
  /** Additive applied capsule outcome; absent in plan mode (F-3, DM-5). */
  readonly capsule?: CloseoutCapsuleData;
  /** Additive per-member report in declared order (GH-310 DM-5). */
  readonly members?: readonly CloseoutMemberReport[];
  /** Additive non-step queue-removal disclosure (GH-292 F-2, DM-6). */
  readonly queueRemoval?: CloseoutQueueRemovalData;
  /**
   * Additive member-mode removal disclosures, one per declared member in
   * declared order (GH-310 DM-8). Present only when members are declared.
   */
  readonly queueRemovals?: readonly CloseoutQueueRemovalData[];
};

/** The closed closeout queue-removal outcome set (GH-292 DM-6). */
export const CLOSEOUT_QUEUE_REMOVAL_OUTCOMES = [
  "removed",
  "would-remove",
  "satisfied",
  "skipped",
] as const;
export type CloseoutQueueRemovalOutcome = (typeof CLOSEOUT_QUEUE_REMOVAL_OUTCOMES)[number];

/** The closed skip-reason set (GH-292 DM-6); present only when skipped. */
export const CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS = [
  "no-merge-truth",
  "lease-held",
  "state-unavailable",
  "ref-not-canonical",
] as const;
export type CloseoutQueueRemovalSkipReason = (typeof CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS)[number];

/** One additive non-step `queueRemoval` block (GH-292 DM-6). */
export type CloseoutQueueRemovalData = {
  readonly outcome: CloseoutQueueRemovalOutcome;
  readonly ref?: string;
  readonly reason?: string;
  readonly skipReason?: CloseoutQueueRemovalSkipReason;
};

/** The read-only capsule pre-flight facts the pure planner consumes (F-3). */
export type CloseoutCapsuleFacts = {
  readonly present: boolean;
  readonly valid: boolean;
  readonly refusal?: {
    readonly code: string;
    readonly detail: string;
    readonly line?: number;
  };
  readonly events: number;
  readonly candidates: number;
};

/** One event the durable state records say the capsule must contain (F-3). */
export type CloseoutExpectedCapsuleEvent = {
  readonly kind: string;
  readonly eventKey: string;
  readonly identity: string;
};

/** One ingested review verdict from a readable artifact (F-3, Appendix A). */
export type CloseoutReviewVerdict = {
  readonly iteration: number;
  readonly verdict: string;
  readonly artifact: string;
};

/** Re-exported for the closeout surface and tests to name one projection. */
export type CloseoutCapsuleCandidate = CapsuleCandidateProjection;

/** One appended `closeout.operation` ledger record (EVT-1, DM-4). */
export type CloseoutOperationRecord = {
  readonly schemaId: typeof CLOSEOUT_OPERATION_PAYLOAD_SCHEMA;
  readonly operationId: string;
  readonly workItemRef: string;
  readonly engine: string;
  readonly capabilityContext: CloseoutCapabilityContext;
  readonly operation: CloseoutOperationName;
  readonly arguments: CloseoutCanonicalArguments;
  readonly target: ProviderQualifiedIdentity;
  readonly outcome: CloseoutApplyOutcome;
  readonly reason?: string;
  readonly evidence: CloseoutEvidence;
  readonly timestamp: string;
};

/** A provider write outcome: success or a classified adapter-local failure. */
export type CloseoutWriteOutcome =
  | { readonly ok: true; readonly alreadyApplied?: boolean }
  | { readonly ok: false; readonly code: string; readonly detail: string };

/** The closeout-relevant provider operations (DM-5, PIN-14/PIN-15). */
export type CloseoutProviderRuntime = {
  readonly systemName: string;
  readonly capabilities: AdapterCapabilityDeclaration;
  readonly readWorkItem: (entityId: string) => Promise<CloseoutReadObservation<WorkItem>>;
  readonly readWorkItemObservation: (
    entityId: string,
  ) => Promise<CloseoutReadObservation<WorkItem>>;
  readonly readDeliveryRequest?: (
    entityId: string,
  ) => Promise<CloseoutReadObservation<DeliveryRequest>>;
  readonly findMergedDeliveryRequest?: (input: {
    readonly workItemRef: string;
    readonly limit: number;
  }) => Promise<CloseoutReadObservation<DeliveryRequest>>;
  readonly listBlockedByDependents?: (input: {
    readonly entityId: string;
    readonly limit: number;
  }) => Promise<CloseoutReverseDependentObservation<readonly WorkItem[]>>;
  readonly writeWorkItem: (
    input: CloseoutWriteArguments & { readonly entityId: string },
  ) => Promise<CloseoutWriteOutcome>;
  readonly transitionWorkItem: (input: {
    readonly entityId: string;
    readonly deliveryState: "done";
  }) => Promise<CloseoutWriteOutcome>;
  readonly resolveDeliveryThread: (input: {
    readonly deliveryRequest: ProviderQualifiedIdentity;
    readonly threadId: string;
  }) => Promise<CloseoutWriteOutcome>;
};

/** The checkout classification the git seam reports (F-9, PIN-16). */
export type CloseoutCheckoutState =
  | "delivery-branch"
  | "detached-at-delivery-head"
  | "base"
  | "unrelated"
  | "missing";

/** The facts read for the checkout restore predicate. */
export type CloseoutCheckoutFacts = {
  readonly state: CloseoutCheckoutState;
  readonly branch?: string;
  readonly head?: string;
};

/** One local branch fact. */
export type CloseoutBranchFact = {
  readonly name: string;
  readonly head: string;
};

/** The bounded git runtime the closeout engine consumes (PIN-16). */
export type CloseoutGitRuntime = {
  readonly readCheckout: (input: {
    readonly deliveryBranch: string;
    readonly baseRef: string;
    readonly deliveryHead?: string;
  }) => Promise<CloseoutCheckoutFacts>;
  readonly listBranches: (input: {
    readonly workItemRef: string;
  }) => Promise<readonly CloseoutBranchFact[]>;
  readonly readBranch: (input: {
    readonly branch: string;
  }) => Promise<CloseoutBranchFact | undefined>;
  readonly isCheckedOutElsewhere: (input: { readonly branch: string }) => Promise<boolean>;
  readonly listWorktrees?: () => Promise<
    readonly {
      readonly path: string;
      readonly branch?: string;
      readonly head?: string;
      readonly locked: boolean;
    }[]
  >;
  readonly removeWorktree?: (input: { readonly path: string }) => Promise<CloseoutWriteOutcome>;
  readonly isClean: () => Promise<boolean>;
  readonly resolveRef: (input: { readonly ref: string }) => Promise<boolean>;
  readonly restoreCheckout: (input: { readonly baseRef: string }) => Promise<CloseoutWriteOutcome>;
  readonly deleteBranch: (input: {
    readonly branch: string;
    /** Re-checked against the local branch head immediately before deletion. */
    readonly expectedHead?: string;
  }) => Promise<CloseoutWriteOutcome>;
};

/** The fenced state operations the closeout engine consumes (PIN-13, D6). */
export type CloseoutStateRuntime = {
  readonly acquireFence: (token: string) => StateResult<StateFenceAcquisition>;
  readonly append: (
    handle: StateFenceHandle,
    record: CloseoutOperationRecord,
  ) => StateResult<StateAppendOutcome>;
  readonly releaseFence: (handle: StateFenceHandle) => StateResult<StateFenceReleaseReport>;
  readonly readHistory: (workItemRef: string) => StateResult<readonly CloseoutOperationRecord[]>;
};
