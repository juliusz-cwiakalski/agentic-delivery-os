/**
 * The v1 primitive port contracts (F-1, DM-1–DM-8).
 *
 * Runtime-neutral by construction: this module declares types only — no
 * functions, I/O, ambient environment, clock, or randomness. The contracts are
 * keyed by the primitive catalogue's globally unique PascalCase names; no
 * numeric identifiers and no provider-specific behaviour enter this tier.
 *
 * Selection is bounded to the catalogue's adapter-interaction rows typed at M0.
 * Primitives outside that set (harness, queue/scheduling, state/audit, and the
 * non-adapter context rows) belong to their owning stories.
 */
import type { AdapterCapabilityDeclaration } from "./adapter-capabilities.js";
import type { CredentialReference } from "./credentials.js";

/** The provider class an external system instance represents (DM-1). */
export type ExternalSystemKind = "tracker" | "vcs" | "ci";

/**
 * How an adapter authenticates against an external system.
 *
 * A credential-bearing method references a declared credential reference; it
 * never carries inline secret material.
 */
export type ExternalSystemAuthMethod =
  | { readonly mechanism: "credential-reference"; readonly reference: CredentialReference }
  | { readonly mechanism: "anonymous" };

/** A configured tracker, VCS, or CI instance (DM-1). */
export type ExternalSystemInstance = {
  readonly instanceName: string;
  readonly systemKind: ExternalSystemKind;
  readonly baseUrl: string;
  readonly authMethod: ExternalSystemAuthMethod;
};

/** An adapter's typed declaration shell (DM-2). */
export type AdapterContract = {
  readonly adapterName: string;
  readonly systemKind: ExternalSystemKind;
  readonly capabilities: AdapterCapabilityDeclaration;
};

/** A provider-qualified entity identity: the provider's name plus its own id. */
export type ProviderQualifiedIdentity = {
  readonly systemName: string;
  readonly entityId: string;
};

/** The delivery-state alias a native workflow status maps onto (DM-4). */
export type DeliveryStateAlias =
  | "backlog"
  | "ready"
  | "in-progress"
  | "in-review"
  | "done"
  | "canceled";

/** How a transition is performed on the provider (DM-4). */
export type WorkflowTransitionMechanism =
  | "api-transition"
  | "field-update"
  | "label-swap"
  | "manual";

/** One native-status to delivery-state mapping (DM-4). */
export type WorkflowStateMapping = {
  readonly nativeStatus: string;
  readonly deliveryState: DeliveryStateAlias;
  readonly transitionMechanism: WorkflowTransitionMechanism;
};

/** The provider's native status to delivery-state alias map (DM-4). */
export type WorkflowMap = {
  readonly systemName: string;
  readonly states: readonly WorkflowStateMapping[];
};

/** The closed set of typed work-item relation kinds (DM-5). */
export type WorkItemRelationKind = "parent" | "child" | "blocks" | "blocked-by" | "relates-to";

/** One typed work-item relation (DM-5). */
export type WorkItemRelation = {
  readonly relationKind: WorkItemRelationKind;
  readonly target: ProviderQualifiedIdentity;
};

/** A normalized work-item status (DM-3). */
export type WorkItemStatus = {
  readonly nativeStatus: string;
  readonly deliveryState: DeliveryStateAlias;
};

/** A normalized work-item comment (DM-3). */
export type WorkItemComment = {
  readonly commentId: string;
  readonly authorAccount: string;
  readonly body: string;
};

/**
 * A normalized ticket (DM-3).
 *
 * Absence semantics are uniform across the optional fields (ADR-0004,
 * ADR-0006): an absent field means the provider did not supply the signal, so
 * the value is unknown — it is never derived, fabricated, or collapsed into an
 * empty set.
 */
export type WorkItem = {
  readonly identity: ProviderQualifiedIdentity;
  readonly title: string;
  readonly status: WorkItemStatus;
  readonly labels: readonly string[];
  readonly assignee?: string;
  readonly relations: readonly WorkItemRelation[];
  /**
   * The provider-asserted comment set. Absent = the comment set is unknown
   * (omitted by the provider for permission/paging causes, or not fetched);
   * present — including an explicitly empty array — = the provider-asserted set
   * (ADR-0006).
   */
  readonly comments?: readonly WorkItemComment[];
  /**
   * The provider-native last-modified timestamp, copied verbatim as an
   * ISO-8601 UTC string. Absent = activity is unknown, never "no activity"
   * (ADR-0004; GH-188 OQ-E).
   */
  readonly updatedAt?: string;
};

/** A delivery request's review state (DM-6). */
export type DeliveryRequestReviewState =
  | "draft"
  | "open"
  | "changes-requested"
  | "approved"
  | "merged"
  | "closed";

/** One review thread on a delivery request (DM-6). */
export type DeliveryThread = {
  readonly threadId: string;
  readonly resolved: boolean;
  readonly commentCount: number;
};

/** A delivery request (PR/MR) view (DM-6). */
export type DeliveryRequest = {
  readonly identity: ProviderQualifiedIdentity;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly reviewState: DeliveryRequestReviewState;
  readonly threads: readonly DeliveryThread[];
  /**
   * The provider-resolved merged head commit, copied verbatim. Absent = the
   * provider did not supply the signal (unknown), never an empty or derived
   * value (DM-8, ADR-0004).
   */
  readonly headSha?: string;
};

/** A pipeline job state (DM-7). */
export type PipelineJobState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "skipped";

/** One pipeline job (DM-7). */
export type PipelineJob = {
  readonly jobName: string;
  readonly jobState: PipelineJobState;
};

/** A pointer to pipeline trace evidence — never a bare status colour (DM-7). */
export type TraceEvidenceRef = {
  readonly evidenceName: string;
  readonly location: string;
};

/** Pipeline, job, and trace evidence (DM-7). */
export type PipelineRun = {
  readonly identity: ProviderQualifiedIdentity;
  readonly pipelineName: string;
  readonly jobs: readonly PipelineJob[];
  readonly traceEvidence: readonly TraceEvidenceRef[];
};

/** A bounded retry backoff strategy (DM-8). */
export type RetryBackoff = "none" | "linear" | "exponential";

/**
 * A retry policy for a known-safe operation (DM-8).
 *
 * Only known-safe retries are representable: an unsafe write carries no retry
 * policy at all rather than an empty or permissive one.
 */
export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly backoff: RetryBackoff;
};

/** A key that makes an external write safely retryable (DM-8). */
export type IdempotencyKey = {
  readonly keyValue: string;
  readonly scope: string;
};
