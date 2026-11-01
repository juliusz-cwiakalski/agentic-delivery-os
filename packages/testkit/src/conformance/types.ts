/**
 * Conformance data model (GH-189 F-1, DM-1..DM-8).
 *
 * Types only: no runtime value, behaviour, I/O, clock, randomness, or ambient
 * environment access is declared here. Provider transport and client-option
 * types are derived from the adapters' exported client surfaces so the testkit
 * never imports the `/io` subpath.
 */
import type { GithubClient, GithubClientOptions } from "@delivery-os/adapters/github";
import type { GitLabClient } from "@delivery-os/adapters/gitlab";
import type { JiraClient } from "@delivery-os/adapters/jira";
import type {
  AdapterContract,
  AdapterOperation,
  CapabilityGapReason,
  CredentialPort,
  DeliveryRequest,
  DeliveryStateAlias,
  ExternalSystemInstance,
  PipelineJobState,
  PipelineRun,
  WorkItem,
} from "@delivery-os/core/contracts";

/** The provider transport seam, derived from the exported client option types. */
export type ConformanceTransport = NonNullable<GithubClientOptions["transport"]>;
export type ConformanceTransportRequest = Parameters<ConformanceTransport["send"]>[0];
export type ConformanceTransportResponse = Awaited<ReturnType<ConformanceTransport["send"]>>;
export type ConformanceCredentialPort = CredentialPort;

/** A concrete adapter read failure, derived from a production client signature. */
type WorkItemRead = Awaited<ReturnType<GithubClient["readWorkItem"]>>;
type DeliveryRequestRead = Awaited<ReturnType<GitLabClient["readDeliveryRequest"]>>;
type PipelineRunRead = Awaited<ReturnType<GitLabClient["readPipelineRun"]>>;
type JiraWorkItemRead = Awaited<ReturnType<JiraClient["readWorkItem"]>>;

/** The union of every classified read failure the clients can return. */
export type ConformanceAdapterReadFailure = Extract<
  WorkItemRead | DeliveryRequestRead | PipelineRunRead | JiraWorkItemRead,
  { readonly ok: false }
>;

/** One adapter read: a primitive value or a classified failure. */
export type ConformanceAdapterRead<T> =
  | { readonly ok: true; readonly value: T }
  | ConformanceAdapterReadFailure;

/** The execution tier (DM-5, DEC-13). */
export type ConformanceTier = "mock" | "live";

/** Overall conformance status (D-3). */
export type ConformanceStatus = "passed" | "failed" | "not-configured";

/** Per-provider status: no provider-level `skipped` state exists (D-3). */
export type ConformanceProviderStatus = ConformanceStatus;

/** Per-step outcome. */
export type ConformanceStepStatus = "executed" | "skipped" | "failed";

/** Per-flow summary status. */
export type ConformanceFlowStatus = "passed" | "failed" | "skipped";

/** Why a skipped step is skipped (closed set, spec §24 v1.2). */
export type ConformanceSkipKind = "declared-gap" | "capability-absent" | "live-read-only";

/** The primitive assertion family a flow step applies. */
export type ConformanceAssertionFamily =
  | "work-item"
  | "delivery-request"
  | "pipeline-run"
  | "comment-provenance"
  | "label-semantics"
  | "delivery-thread";

/** One ordered flow step (DM-2). */
export type ConformanceFlowStep = {
  readonly stepId: string;
  readonly operation: AdapterOperation;
  readonly assertionFamily: ConformanceAssertionFamily;
  /** Present only on the comment-provenance carrier roundtrip step. */
  readonly requiresCarrier?: boolean;
};

/** One provider-agnostic conformance flow (DM-1). */
export type ConformanceFlow = {
  readonly flowId: string;
  readonly name: string;
  readonly steps: readonly ConformanceFlowStep[];
};

/** The closed transport method set the mock tenant can address. */
export type ConformanceHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** One exact method-plus-URL mock route. */
export type MockTenantRoute = {
  readonly method: ConformanceHttpMethod;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  /** Optional exact request body; when present, a mismatch does not match. */
  readonly requestBody?: string;
};

/** GitHub addressing the flows consume. */
export type GithubMockAddressing = {
  readonly provider: "github";
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly pullNumber: number;
  readonly commitSha: string;
  readonly threadId: string;
};

/** GitLab addressing the flows consume. */
export type GitlabMockAddressing = {
  readonly provider: "gitlab";
  readonly projectPath: string;
  readonly mrIid: number;
  readonly commitSha: string;
};

/** Jira addressing the flows consume. */
export type JiraMockAddressing = {
  readonly provider: "jira";
  readonly issueKey: string;
};

/** The provider addressing union. */
export type MockTenantAddressing = GithubMockAddressing | GitlabMockAddressing | JiraMockAddressing;

/** Declarative mock tenant data (DM-4). */
export type MockTenant = {
  readonly provenance: string;
  readonly provider: string;
  readonly adapterName: string;
  readonly instance: ExternalSystemInstance;
  readonly credentialReferenceName: string;
  readonly addressing: MockTenantAddressing;
  readonly routes: readonly MockTenantRoute[];
  readonly expected: Readonly<Record<string, unknown>>;
};

/** Decode outcome for untrusted tenant data. */
export type ConformanceDecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly detail: string };

/** Construction input for one conformance adapter client. */
export type ConformanceClientBuildInput = {
  readonly tenant: MockTenant;
  readonly instance: ExternalSystemInstance;
  readonly credentials: ConformanceCredentialPort;
  readonly transport: ConformanceTransport;
};

/** One provider-agnostic conformance client; the builder closes over addressing. */
export type ConformanceAdapterWrite = ConformanceAdapterRead<void>;

export type ConformanceAdapterClient = {
  readonly readWorkItem?: () => Promise<ConformanceAdapterRead<WorkItem>>;
  readonly readDeliveryRequest?: () => Promise<ConformanceAdapterRead<DeliveryRequest>>;
  readonly readPipelineRun?: () => Promise<ConformanceAdapterRead<readonly PipelineRun[]>>;
  readonly writeWorkItem?: () => Promise<ConformanceAdapterWrite>;
  readonly transitionWorkItem?: () => Promise<ConformanceAdapterWrite>;
  readonly resolveDeliveryThread?: () => Promise<ConformanceAdapterWrite>;
};

/** Input passed to a test-only control write handler. */
export type ConformanceWriteInput = {
  readonly provider: string;
  readonly flowId: string;
  readonly stepId: string;
  readonly operation: AdapterOperation;
  readonly tenant: MockTenant;
};

/** Outcome of a test-only control write handler. */
export type ConformanceWriteOutcome =
  | { readonly ok: true; readonly detail: string; readonly assertionCount: number }
  | { readonly ok: false; readonly detail: string };

/** A test-only carrier-roundtrip/write handler (never set by production). */
export type ConformanceWriteHandler = (
  input: ConformanceWriteInput,
) => Promise<ConformanceWriteOutcome> | ConformanceWriteOutcome;

/** One registered conformance adapter (DM-3). */
export type ConformanceAdapterRegistration = {
  readonly provider: string;
  readonly contract: AdapterContract;
  readonly buildClient: (input: ConformanceClientBuildInput) => ConformanceAdapterClient;
  /** Test-only control seam; production registrations never set it. */
  readonly writeHandler?: ConformanceWriteHandler;
};

/** A declared gap reason used by a control adapter. */
export type ConformanceDeclaredGap = {
  readonly operation: AdapterOperation;
  readonly reason: CapabilityGapReason;
};

/** A scalar expected/received value in a bounded diagnostic (D-11). */
export type ConformanceFailureScalar = string | number | boolean;

/** One bounded, primitive-level failure diagnostic (F-10). */
export type ConformanceFailure = {
  readonly assertion: string;
  readonly expected: ConformanceFailureScalar;
  readonly received: ConformanceFailureScalar;
  readonly reference: string;
  readonly detail: string;
};

/** One step result; the same shape nests in `flows[]` and flattens in `steps[]`. */
export type ConformanceStepResult = {
  readonly provider: string;
  readonly flowId: string;
  readonly stepId: string;
  readonly operation: AdapterOperation;
  readonly status: ConformanceStepStatus;
  readonly skipReason: string | null;
  readonly skipKind: ConformanceSkipKind | null;
  readonly assertionCount: number;
  readonly failure?: ConformanceFailure;
};

/** One provider-flow summary inside `providers[]` (spec §24). */
export type ConformanceProviderFlowSummary = {
  readonly flowId: string;
  readonly name: string;
  readonly status: ConformanceFlowStatus;
};

/** One provider result. */
export type ConformanceProviderResult = {
  readonly provider: string;
  readonly adapterName: string;
  readonly status: ConformanceProviderStatus;
  readonly missingSettings: readonly string[];
  readonly flows: readonly ConformanceProviderFlowSummary[];
};

/** Canonical per-flow result with nested ordered steps. */
export type ConformanceFlowResult = {
  readonly provider: string;
  readonly flowId: string;
  readonly name: string;
  readonly status: ConformanceFlowStatus;
  readonly steps: readonly ConformanceStepResult[];
};

/** Report totals. */
export type ConformanceTotals = {
  readonly providers: number;
  readonly flows: number;
  readonly steps: number;
  readonly executed: number;
  readonly skipped: number;
  readonly failed: number;
};

/** The in-memory conformance report shared by both tiers (DM-5). */
export type ConformanceReport = {
  readonly runId: string;
  readonly tier: ConformanceTier;
  readonly generatedAt: string;
  readonly status: ConformanceStatus;
  readonly providers: readonly ConformanceProviderResult[];
  readonly flows: readonly ConformanceFlowResult[];
  readonly steps: readonly ConformanceStepResult[];
  readonly mutationRequests: number;
  readonly createdArtifacts: number;
  readonly totals: ConformanceTotals;
};

/** The persisted `delivery.conformance.v1` artifact (DM-6). */
export type ConformanceArtifact = ConformanceReport & {
  readonly schema: string;
};

/** Input to the capability-gated runner. */
export type RunConformanceInput = {
  readonly adapters: readonly ConformanceAdapterRegistration[];
  readonly tenants: Readonly<Record<string, MockTenant>>;
  readonly credentials: ConformanceCredentialPort;
  readonly transportFactory: (provider: string) => ConformanceTransport;
  readonly nowIso: string;
  readonly runId: string;
  readonly tier: ConformanceTier;
};

/** A closed delivery-state alias used by primitive assertions. */
export type ConformanceDeliveryState = DeliveryStateAlias;

/** A closed pipeline job state used by primitive assertions. */
export type ConformancePipelineJobState = PipelineJobState;
