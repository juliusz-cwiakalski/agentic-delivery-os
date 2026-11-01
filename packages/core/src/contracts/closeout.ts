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

/** The seven step ids in their binding order (F-2, PIN-2). */
export const CLOSEOUT_STEP_IDS = [
  "ticket-to-done",
  "lifecycle-label-sweep",
  "unassign",
  "owed-flip-sweep",
  "comment-resolution",
  "checkout-restore",
  "branch-cleanup",
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

/** The union of canonical operation arguments (PIN-4). */
export type CloseoutCanonicalArguments =
  | CloseoutTransitionArguments
  | CloseoutWriteArguments
  | CloseoutThreadArguments
  | CloseoutRestoreArguments
  | CloseoutDeleteArguments;

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
};

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
