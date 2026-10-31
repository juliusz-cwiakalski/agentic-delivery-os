/**
 * Shared status fact builders (test-plan §4.1).
 *
 * Every status suite injects facts; nothing here reads the clock, environment,
 * network, or live tree. The builders are deliberately boring and total so an
 * individual case only states the delta it exercises.
 */
import {
  createStatusCommandDefinition,
  type StatusCommandRuntime,
} from "../../../packages/cli/src/commands/status";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  DeliveryRequest,
  DeliveryThread,
  ExternalSystemInstance,
  PipelineJob,
  PipelineRun,
  ProviderConfiguration,
  ProviderParkView,
  StatusActiveChange,
  StatusDeliveryRequestRead,
  StatusFacts,
  StatusLocalContextRead,
  StatusParkedWorkEntry,
  StatusPipelineRunRead,
  StatusProviderConfigRead,
  StatusProviderFacts,
  StatusRepositoryBinding,
  StatusRepositoryFacts,
  StatusTrackerAvailability,
  StatusWorkItemRead,
  TraceEvidenceRef,
  WorkItem,
  WorkItemRelation,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";

export const NOW_ISO = "2026-10-31T00:00:00Z";
export const NOW_MS = Date.parse(NOW_ISO);
export const DAY_MS = 86_400_000;
export const BRANCH = "feat/GH-175/status-v1";
export const SHA = "1111111111111111111111111111111111111111";
export const OWNER = "owner-placeholder";
export const NAME = "project-placeholder";
export const HOST = "github.com";

export const ALL_AVAILABLE: StatusTrackerAvailability = {
  ownerHandBacks: "available",
  blockedDependencies: "available",
  stalls: "available",
  hygiene: "available",
};

export const GITHUB_SLICE_AVAILABILITY: StatusTrackerAvailability = {
  ownerHandBacks: "available",
  blockedDependencies: "unavailable",
  stalls: "available",
  hygiene: "available",
};

export const REVIEWS_AVAILABLE = {
  state: "available",
  refs: "available",
  reviewState: "available",
  reviewThreads: "available",
} as const;

export const REVIEWS_UNAVAILABLE = {
  state: "available",
  refs: "available",
  reviewState: "unavailable",
  reviewThreads: "unavailable",
} as const;

export const observedBinding = (): StatusRepositoryBinding => ({
  state: "observed",
  host: HOST,
  owner: OWNER,
  name: NAME,
  remoteName: "origin",
});

export const unavailableBinding = (
  reason: "addressing-unresolved" | "remote-unsupported" = "addressing-unresolved",
): StatusRepositoryBinding => ({ state: "unavailable", reason });

export const repository = (
  overrides: Partial<StatusRepositoryFacts> = {},
): StatusRepositoryFacts => ({
  binding: observedBinding(),
  head: { branch: BRANCH, sha: SHA, detached: false },
  ...overrides,
});

const relation = (
  relationKind: WorkItemRelation["relationKind"],
  entityId: string,
): WorkItemRelation => ({ relationKind, target: { systemName: "github", entityId } });

export type WorkItemInput = {
  readonly entityId: string;
  readonly title?: string;
  readonly deliveryState?: WorkItem["status"]["deliveryState"];
  readonly labels?: readonly string[];
  readonly assignee?: string;
  readonly relations?: readonly WorkItemRelation[];
  readonly updatedAt?: string;
};

export const makeWorkItem = (input: WorkItemInput): WorkItem => ({
  identity: { systemName: "github", entityId: input.entityId },
  title: input.title ?? `Item ${input.entityId}`,
  status: {
    nativeStatus: input.deliveryState ?? "ready",
    deliveryState: input.deliveryState ?? "ready",
  },
  labels: input.labels ?? [],
  ...(input.assignee === undefined ? {} : { assignee: input.assignee }),
  relations: input.relations ?? [],
  ...(input.updatedAt === undefined ? {} : { updatedAt: input.updatedAt }),
});

export const blockedBy = (entityId: string): WorkItemRelation => relation("blocked-by", entityId);

export const workItemRead = (
  items: readonly WorkItem[],
  availability: StatusTrackerAvailability = ALL_AVAILABLE,
  pageItemCount = items.length,
): StatusWorkItemRead => ({ ok: true, items, pageItemCount, availability });

export const failedWorkItemRead = (
  reason: "read-failed" | "credential-unavailable" | "not-configured" = "read-failed",
): StatusWorkItemRead => ({
  ok: false,
  reason,
  ...(reason === "credential-unavailable" ? { failureCode: "config.credential.missing" } : {}),
  ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" } : {}),
});

const thread = (threadId: string, resolved: boolean, commentCount: number): DeliveryThread => ({
  threadId,
  resolved,
  commentCount,
});

export type DeliveryRequestInput = {
  readonly entityId: string;
  readonly sourceRef?: string;
  readonly targetRef?: string;
  readonly reviewState?: DeliveryRequest["reviewState"];
  readonly threads?: readonly DeliveryThread[];
};

export const makeDeliveryRequest = (input: DeliveryRequestInput): DeliveryRequest => ({
  identity: { systemName: "github", entityId: input.entityId },
  sourceRef: input.sourceRef ?? `feat/GH-${input.entityId}`,
  targetRef: input.targetRef ?? "main-tools",
  reviewState: input.reviewState ?? "open",
  threads: input.threads ?? [thread("PRRT_1", false, 1)],
});

export const reviewThread = thread;

export const deliveryRequestRead = (
  items: readonly DeliveryRequest[],
  availability = REVIEWS_AVAILABLE,
  pageItemCount = items.length,
): StatusDeliveryRequestRead => ({ ok: true, items, pageItemCount, availability });

export const failedDeliveryRequestRead = (
  reason: "read-failed" | "credential-unavailable" = "read-failed",
): StatusDeliveryRequestRead => ({
  ok: false,
  reason,
  ...(reason === "credential-unavailable" ? { failureCode: "config.credential.missing" } : {}),
  ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" } : {}),
});

export const job = (jobName: string, jobState: PipelineJob["jobState"]): PipelineJob => ({
  jobName,
  jobState,
});

export type PipelineRunInput = {
  readonly entityId: string;
  readonly pipelineName?: string;
  readonly jobs?: readonly PipelineJob[];
  readonly traceEvidence?: readonly TraceEvidenceRef[];
};

export const makePipelineRun = (input: PipelineRunInput): PipelineRun => ({
  identity: { systemName: "github", entityId: input.entityId },
  pipelineName: input.pipelineName ?? "ci",
  jobs: input.jobs ?? [job("build", "succeeded")],
  traceEvidence: input.traceEvidence ?? [],
});

export const pipelineRunRead = (
  items: readonly PipelineRun[],
  pageItemCount = items.length,
): StatusPipelineRunRead => ({ ok: true, items, pageItemCount });

export const failedPipelineRunRead = (
  reason: "read-failed" | "credential-unavailable" | "commit-unresolved" = "read-failed",
): StatusPipelineRunRead => ({
  ok: false,
  reason,
  ...(reason === "credential-unavailable" ? { failureCode: "config.credential.missing" } : {}),
  ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" } : {}),
});

export const providerConfig = (
  overrides: Partial<ProviderConfiguration> = {},
): ProviderConfiguration => ({
  defaultChain: "primary",
  credentials: {},
  entries: {
    primary: { name: "primary", class: "subscription", enabled: true },
  },
  chains: {
    primary: { name: "primary", entries: ["primary"], allowPaidFallback: false },
  },
  ...overrides,
});

export const providerConfigRead = (
  config: ProviderConfiguration = providerConfig(),
): StatusProviderConfigRead => ({ ok: true, config });

export const parkView = (overrides: Partial<ProviderParkView> = {}): ProviderParkView => ({
  name: "provider:primary",
  subjectKind: "provider",
  subjectName: "primary",
  cause: "quota-exhausted",
  conditions: ["quota-exhausted"],
  state: "active",
  createdAt: "2026-10-30T00:00:00Z",
  expiresAt: "2026-11-01T00:00:00Z",
  evidence: {},
  ...overrides,
});

export const providers = (overrides: Partial<StatusProviderFacts> = {}): StatusProviderFacts => ({
  config: providerConfigRead(),
  parks: { ok: true, parks: [] },
  ...overrides,
});

export const activeChange = (overrides: Partial<StatusActiveChange> = {}): StatusActiveChange => ({
  workItemRef: "GH-175",
  branch: BRANCH,
  changeFolder: "doc/changes/2026-10/2026-10-31--GH-175--status-v1",
  ...overrides,
});

export type LocalContextInput = {
  readonly activeChange?: StatusActiveChange;
  readonly parkedChanges?: readonly StatusParkedWorkEntry[];
  readonly path?: string;
};

export const localContext = (input: LocalContextInput = {}): StatusLocalContextRead => ({
  ok: true,
  context: {
    path: input.path ?? "/home/user/.ai/local/pm-context.yaml",
    tracked: false,
    ...(input.activeChange === undefined ? {} : { activeChange: input.activeChange }),
    parkedChanges: input.parkedChanges ?? [],
  },
});

export const malformedLocalContext = (
  path = "/home/user/.ai/local/pm-context.yaml",
): StatusLocalContextRead => ({
  ok: false,
  reason: "malformed",
  path,
});

export const missingLocalContext = (
  path = "/home/user/.ai/local/pm-context.yaml",
): StatusLocalContextRead => ({
  ok: false,
  reason: "missing",
  path,
});

export const baseFacts = (overrides: Partial<StatusFacts> = {}): StatusFacts => ({
  nowIso: NOW_ISO,
  nowMs: NOW_MS,
  repository: repository(),
  tracker: workItemRead([]),
  changes: deliveryRequestRead([]),
  ci: pipelineRunRead([]),
  providers: providers(),
  localContext: localContext({ activeChange: activeChange() }),
  ...overrides,
});

export const statusInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
    },
  },
});

export const anonymousInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: { mechanism: "anonymous" },
});

export const sectionById = <T extends { readonly id: string }>(
  sections: readonly T[],
  id: string,
): T => {
  const found = sections.find((section) => section.id === id);
  if (found === undefined) throw new Error(`section ${id} is missing`);
  return found;
};

export type StatusCallRecorder = {
  readonly calls: string[];
};

export const createStatusRecorder = (): StatusCallRecorder => ({ calls: [] });

/** Build a runtime over the injected facts; the recorder proves call order/count. */
export const statusRuntime = (
  facts: StatusFacts,
  recorder: StatusCallRecorder = createStatusRecorder(),
): StatusCommandRuntime => ({
  readRepository: () => {
    recorder.calls.push("readRepository");
    return facts.repository;
  },
  readWorkItems: async () => {
    recorder.calls.push("readWorkItems");
    return facts.tracker;
  },
  readDeliveryRequests: async () => {
    recorder.calls.push("readDeliveryRequests");
    return facts.changes;
  },
  readPipelineRuns: async () => {
    recorder.calls.push("readPipelineRuns");
    return facts.ci;
  },
  readProviderConfig: () => {
    recorder.calls.push("readProviderConfig");
    return facts.providers.config;
  },
  readProviderParks: () => {
    recorder.calls.push("readProviderParks");
    return facts.providers.parks;
  },
  readLocalContext: () => {
    recorder.calls.push("readLocalContext");
    return facts.localContext;
  },
  nowIso: () => {
    recorder.calls.push("nowIso");
    return facts.nowIso;
  },
  nowMs: () => {
    recorder.calls.push("nowMs");
    return facts.nowMs;
  },
});

export type StatusCliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly recorder: StatusCallRecorder;
};

export type StatusCliOptions = {
  readonly recorder?: StatusCallRecorder;
  readonly brand?: typeof SYNTHETIC_BRAND;
  readonly secrets?: readonly string[];
  readonly runId?: string;
};

/** Run the status definition in process with fixed brand/clock/run id/streams. */
export const runStatusCli = async (
  argv: readonly string[],
  runtime: StatusCommandRuntime,
  options: StatusCliOptions = {},
): Promise<StatusCliRun> => {
  const recorder = options.recorder ?? createStatusRecorder();
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [100, 110] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-status-fixture",
    secrets: options.secrets ?? [],
    program: { commands: { status: createStatusCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value, recorder };
};
