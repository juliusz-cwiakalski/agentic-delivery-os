/**
 * Shared queue-ready fact builders (GH-176 test plan §4.1).
 *
 * Every suite injects facts; nothing here reads the wall clock, network, or live
 * tree. The builders are deliberately boring and total so an individual case
 * only states the delta it exercises.
 */
import type { CliDependencies } from "../../../packages/cli/src/index";
import { runCli } from "../../../packages/cli/src/index";
import type {
  DeliveryRequest,
  DeliveryRequestReviewState,
  PipelineJob,
  PipelineRun,
  ProviderConfiguration,
  ProviderParkView,
  QueueReadyFacts,
  StatusActiveChange,
  StatusDeliveryAvailability,
  StatusDeliveryRequestRead,
  StatusLocalContextRead,
  StatusParkedWorkEntry,
  StatusPipelineRunRead,
  StatusProviderConfigRead,
  StatusProviderFacts,
  StatusRepositoryBinding,
  StatusRepositoryFacts,
  StatusTrackerAvailability,
  StatusWorkItemRead,
  WorkItem,
  WorkItemRelation,
  WorkItemRelationKind,
} from "../../../packages/core/src/contracts/index";
import { evaluateQueueReady } from "../../../packages/core/src/domain/queue-ready";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";

export const NOW_ISO = "2026-10-31T00:00:00Z";
export const NOW_MS = Date.parse(NOW_ISO);
export const BRANCH = "feat/GH-176/queue-ready";
export const SHA = "b31ec47111111111111111111111111111111111";
export const OWNER = "owner-placeholder";
export const NAME = "project-placeholder";
export const HOST = "github.com";
export const CHAIN = "primary";

/** The tests-only live switch literal; read only under `tests/**`. */
const LIVE_SWITCH_KEY = "ADOS_QUEUE_READY_LIVE";
export const liveEnabled = (): boolean => process.env[LIVE_SWITCH_KEY] === "1";

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

export const REVIEWS_AVAILABLE: StatusDeliveryAvailability = {
  state: "available",
  refs: "available",
  reviewState: "available",
  reviewThreads: "available",
};

export const REVIEWS_UNAVAILABLE: StatusDeliveryAvailability = {
  state: "available",
  refs: "available",
  reviewState: "unavailable",
  reviewThreads: "unavailable",
};

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

export type RepositoryInput = {
  readonly binding?: StatusRepositoryBinding;
  readonly branch?: string;
  readonly sha?: string;
};

export const repository = (input: RepositoryInput = {}): StatusRepositoryFacts => ({
  binding: input.binding ?? observedBinding(),
  head: {
    ...(input.branch === undefined ? { branch: BRANCH } : { branch: input.branch }),
    ...(input.sha === undefined ? { sha: SHA } : { sha: input.sha }),
    detached: false,
  },
});

export const observedHeadWithoutSha = (): StatusRepositoryFacts => ({
  binding: observedBinding(),
  head: { branch: BRANCH, detached: false },
});

export type WorkItemInput = {
  readonly entityId: string;
  readonly systemName?: string;
  readonly title?: string;
  readonly deliveryState?: WorkItem["status"]["deliveryState"];
  readonly labels?: readonly string[];
  readonly assignee?: string;
  readonly relations?: readonly WorkItemRelation[];
  readonly updatedAt?: string;
};

export const makeWorkItem = (input: WorkItemInput): WorkItem => ({
  identity: { systemName: input.systemName ?? "github", entityId: input.entityId },
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

export const relation = (
  relationKind: WorkItemRelationKind,
  entityId: string,
  systemName = "github",
): WorkItemRelation => ({ relationKind, target: { systemName, entityId } });

export const blockedBy = (entityId: string, systemName = "github"): WorkItemRelation =>
  relation("blocked-by", entityId, systemName);

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

export type DeliveryRequestInput = {
  readonly entityId: string;
  readonly systemName?: string;
  readonly sourceRef?: string;
  readonly targetRef?: string;
  readonly reviewState?: DeliveryRequestReviewState;
};

export const makeDeliveryRequest = (input: DeliveryRequestInput): DeliveryRequest => ({
  identity: { systemName: input.systemName ?? "github", entityId: input.entityId },
  sourceRef: input.sourceRef ?? `feat/GH-176/slug-${input.entityId}`,
  targetRef: input.targetRef ?? "main-tools",
  reviewState: input.reviewState ?? "open",
  threads: [],
});

export const deliveryRequestRead = (
  items: readonly DeliveryRequest[],
  availability: StatusDeliveryAvailability = REVIEWS_UNAVAILABLE,
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
  readonly jobs?: readonly PipelineJob[];
};

export const makePipelineRun = (input: PipelineRunInput): PipelineRun => ({
  identity: { systemName: "github", entityId: input.entityId },
  pipelineName: "ci",
  jobs: input.jobs ?? [job("build", "succeeded")],
  traceEvidence: [],
});

export const pipelineRunRead = (
  items: readonly PipelineRun[],
  pageItemCount = items.length,
): StatusPipelineRunRead => ({ ok: true, items, pageItemCount });

export const failedPipelineRunRead = (
  reason:
    | "read-failed"
    | "credential-unavailable"
    | "commit-unresolved"
    | "not-configured" = "read-failed",
): StatusPipelineRunRead => ({
  ok: false,
  reason,
  ...(reason === "credential-unavailable" ? { failureCode: "config.credential.missing" } : {}),
  ...(reason === "read-failed" ? { failureClass: "provider.payload.invalid" } : {}),
});

export const providerConfig = (
  overrides: Partial<ProviderConfiguration> = {},
): ProviderConfiguration => ({
  defaultChain: CHAIN,
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

export const providerConfigFailed = (
  reason: "config-invalid" | "provider-chain-unresolved",
  failureCode?: string,
): StatusProviderConfigRead => ({
  ok: false,
  reason,
  ...(failureCode === undefined ? {} : { failureCode }),
});

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
};

export const localContext = (input: LocalContextInput = {}): StatusLocalContextRead => ({
  ok: true,
  context: {
    path: "/home/user/.ai/local/pm-context.yaml",
    tracked: false,
    ...(input.activeChange === undefined ? {} : { activeChange: input.activeChange }),
    parkedChanges: input.parkedChanges ?? [],
  },
});

export const malformedLocalContext = (): StatusLocalContextRead => ({
  ok: false,
  reason: "malformed",
  path: "/home/user/.ai/local/pm-context.yaml",
});

export const missingLocalContext = (): StatusLocalContextRead => ({
  ok: false,
  reason: "missing",
  path: "/home/user/.ai/local/pm-context.yaml",
});

export type FactsOverrides = {
  readonly nowIso?: string;
  readonly nowMs?: number;
  readonly repository?: StatusRepositoryFacts;
  readonly tracker?: StatusWorkItemRead;
  readonly changes?: StatusDeliveryRequestRead;
  readonly ci?: StatusPipelineRunRead;
  readonly providers?: StatusProviderFacts;
  readonly localContext?: StatusLocalContextRead;
  readonly candidates?: readonly string[];
};

/** A fully satisfiable default: candidate `GH-176` observed through provider id `176`. */
export const baseFacts = (overrides: FactsOverrides = {}): QueueReadyFacts => ({
  nowIso: overrides.nowIso ?? NOW_ISO,
  nowMs: overrides.nowMs ?? NOW_MS,
  repository: overrides.repository ?? repository(),
  tracker:
    overrides.tracker ??
    workItemRead([makeWorkItem({ entityId: "176", labels: ["priority:high"] })]),
  changes: overrides.changes ?? deliveryRequestRead([]),
  ci: overrides.ci ?? pipelineRunRead([makePipelineRun({ entityId: "1" })]),
  providers: overrides.providers ?? providers(),
  localContext: overrides.localContext ?? localContext(),
  candidates: overrides.candidates ?? ["GH-176"],
});

/** Evaluate one fact set without a CLI. */
export const evaluate = (overrides: FactsOverrides = {}) =>
  evaluateQueueReady(baseFacts(overrides));

export const conditionById = (
  candidate: { readonly conditions: readonly { readonly id: string }[] },
  id: string,
) => {
  const found = candidate.conditions.find((condition) => condition.id === id);
  if (found === undefined) throw new Error(`condition ${id} is missing`);
  return found;
};

export type CallRecorder = { readonly calls: string[] };

export const createRecorder = (): CallRecorder => ({ calls: [] });

/** A synthetic fixed brand distinct from any production literal. */
export { SYNTHETIC_BRAND };

export type QueueCliOptions = {
  readonly brand?: typeof SYNTHETIC_BRAND;
  readonly secrets?: readonly string[];
  readonly runId?: string;
  readonly recorder?: CallRecorder;
};

export type QueueCliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Build fixed CLI dependencies around one program and run in process. */
export const runProgram = async (
  argv: readonly string[],
  program: CliDependencies["program"],
  options: QueueCliOptions = {},
): Promise<QueueCliRun> => {
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
    newRunId: () => options.runId ?? "run-queue-ready-fixture",
    secrets: options.secrets ?? [],
    program,
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

/* ------------------------------ CLI wiring -------------------------------- */

export type QueueRuntime =
  import("../../../packages/cli/src/commands/queue").QueueReadyCommandRuntime;

/** Build a recording runtime over injected facts. */
export const queueRuntime = (
  facts: QueueReadyFacts,
  recorder: CallRecorder = createRecorder(),
): QueueRuntime => ({
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
  nowIso: () => facts.nowIso,
  nowMs: () => facts.nowMs,
});

/** Run the queue command in process with fixed brand/clock/run id/streams. */
export const runQueueReadyCli = async (
  argv: readonly string[],
  runtime: QueueRuntime,
  options: QueueCliOptions = {},
): Promise<QueueCliRun> => {
  const { createQueueReadyCommandDefinition } = await import(
    "../../../packages/cli/src/commands/queue"
  );
  return runProgram(
    argv,
    { commands: { queue: createQueueReadyCommandDefinition(runtime) } },
    options,
  );
};
