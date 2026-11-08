/**
 * Recording in-process stubs for the pilot J1 exercise (spec Appendix D).
 *
 * Tracker, CI, PR-platform, and provider reads/writes are served from memory and
 * every access is recorded with `outbound: false`. A child-process recorder
 * proves the only spawned binary is the local `git` used for real objects and
 * landing. A throwing `fetch` guard and a `Bun.sleep` guard prove the suite
 * performs no network I/O and no sleeps.
 */
import { execFile } from "node:child_process";
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderTransport,
} from "../../../packages/adapters/src/io/provider-transport";
import type { QueueFactSource } from "../../../packages/cli/src/edge";
import type {
  AdapterCapabilityDeclaration,
  CloseoutProviderRuntime,
  CloseoutReadObservation,
  CredentialPort,
  DeliveryRequest,
  ExternalSystemInstance,
  PipelineRun,
  WorkItem,
} from "../../../packages/core/src/contracts/index";
import type {
  QueueCiFact,
  QueueCloseFact,
  QueueDeployFacts,
  QueuePlanFact,
  QueueProviderFact,
  QueueWorkItemFact,
} from "../../../packages/core/src/domain/queue-readiness";
import {
  PILOT_BASE,
  PILOT_BRANCH,
  PILOT_OWNER,
  PILOT_REF,
  PILOT_REPO,
  PILOT_REPOSITORY,
} from "./repo";

export const PILOT_BASE_URL = "https://api.github.example.test";
export const PILOT_CREDENTIAL_KEY = "PILOT_GITHUB_TOKEN";
export const PILOT_PULL_NUMBER = 504;
export const PILOT_PIPELINE_LIMIT = 20;

export type PilotStubSurface = "tracker" | "ci" | "pr-platform" | "provider";

export type PilotStubCall = {
  readonly surface: PilotStubSurface;
  readonly operation: string;
  readonly target: string;
  readonly outbound: false;
};

export type PilotSpawn = {
  readonly file: string;
  readonly args: readonly string[];
};

const supportedOperations = [
  "read-work-item",
  "read-delivery-request",
  "read-pipeline-run",
  "write-work-item",
  "transition-work-item",
  "resolve-delivery-thread",
] as const;

export const PILOT_PROVIDER_CAPABILITIES: AdapterCapabilityDeclaration = {
  supportedOperations: [...supportedOperations],
  declaredGaps: [],
  writableCarriers: [],
  readableCarriers: [],
};

const observed = <T>(value: T): CloseoutReadObservation<T> => ({ observation: "observed", value });

export const pilotWorkItem = (overrides: Partial<WorkItem> = {}): WorkItem => ({
  identity: { systemName: "github", entityId: "310" },
  title: "Pilot delivery",
  status: { nativeStatus: "open", deliveryState: "in-review" },
  labels: ["change", "in-progress"],
  relations: [],
  updatedAt: "2026-11-07T00:00:00Z",
  ...overrides,
});

export const pilotDeliveryRequest = (
  headSha: string,
  overrides: Partial<DeliveryRequest> = {},
): DeliveryRequest => ({
  identity: { systemName: "github", entityId: String(PILOT_PULL_NUMBER) },
  sourceRef: PILOT_BRANCH,
  targetRef: PILOT_BASE,
  reviewState: "open",
  threads: [],
  headSha,
  sourceHeadSha: headSha,
  mergeableState: "mergeable",
  commitCount: 1,
  changedFileCount: 4,
  ...overrides,
});

export const pilotGreenRuns = (sha: string): readonly PipelineRun[] =>
  ["CI / test", "CI / lint"].map((name, index) => ({
    identity: { systemName: "github", entityId: `${sha}:${String(44800 + index)}` },
    pipelineName: name,
    jobs: [{ jobName: name, jobState: "succeeded" }],
    traceEvidence: [],
  }));

export type PilotStubsOptions = {
  /** The live head of the pilot delivery branch. */
  readonly headSha: () => string;
  /** Injected credential canary, generated at runtime (never a literal secret). */
  readonly credential: string;
};

export type PilotStubs = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  readonly transport: ProviderTransport;
  readonly calls: PilotStubCall[];
  readonly providerCalls: PilotStubCall[];
  readonly queueFacts: QueueFactSource;
  readonly closeoutProvider: CloseoutProviderRuntime;
  readonly mergedRequest: () => DeliveryRequest;
  readonly workItem: () => WorkItem;
  setMerged(squashSha: string): void;
  markClosed(): void;
};

const issuePayload = (entityId: string, overrides: Record<string, unknown> = {}): unknown => ({
  number: Number.parseInt(entityId, 10),
  title: `Work item ${entityId}`,
  state: "open",
  labels: [{ name: "change" }],
  updated_at: "2026-11-07T00:00:00Z",
  ...overrides,
});

const pullPayload = (headSha: string): unknown => ({
  number: PILOT_PULL_NUMBER,
  state: "open",
  draft: false,
  mergeable: true,
  mergeable_state: "clean",
  reviewDecision: "APPROVED",
  head: { ref: PILOT_BRANCH, sha: headSha },
  base: { ref: PILOT_BASE },
  commits: 1,
  changed_files: 4,
});

const checkRunsPayload = (sha: string): unknown => ({
  total_count: 2,
  check_runs: [
    {
      id: 44800,
      name: "CI / test",
      status: "completed",
      conclusion: "success",
      head_sha: sha,
    },
    {
      id: 44801,
      name: "CI / lint",
      status: "completed",
      conclusion: "success",
      head_sha: sha,
    },
  ],
});

const repositoryPath = `/repos/${PILOT_OWNER}/${PILOT_REPO}`;

/** Build the recording stubs over mutable in-memory facts. */
export const createPilotStubs = (options: PilotStubsOptions): PilotStubs => {
  const calls: PilotStubCall[] = [];
  const providerCalls: PilotStubCall[] = [];

  let workItem = pilotWorkItem();
  let mergedRequest = pilotDeliveryRequest(options.headSha(), { reviewState: "merged" });

  const record = (surface: PilotStubSurface, operation: string, target: string): void => {
    calls.push({ surface, operation, target, outbound: false });
  };

  const instance: ExternalSystemInstance = {
    instanceName: "vcs-github",
    systemKind: "vcs",
    baseUrl: PILOT_BASE_URL,
    authMethod: {
      mechanism: "credential-reference",
      reference: {
        referenceName: "pilot-tracker",
        sourceKey: { style: "literal", name: PILOT_CREDENTIAL_KEY },
      },
    },
  };

  const credentials: CredentialPort = {
    resolve: (reference) => {
      record("tracker", "credential-resolve", reference.referenceName);
      return { ok: true, material: { value: options.credential } };
    },
  };

  const transport: ProviderTransport = {
    send: async (request: ProviderRequest): Promise<ProviderResponse> => {
      const url = request.url;
      const base = `${PILOT_BASE_URL}${repositoryPath}`;
      if (url === `${base}/issues?state=open&per_page=100&sort=updated&direction=desc`) {
        record("tracker", "list-work-items", PILOT_REPOSITORY);
        return { status: 200, body: ["310", "320", "321"].map((ref) => issuePayload(ref)) };
      }
      if (url === `${base}/pulls?state=open&per_page=100&sort=updated&direction=desc`) {
        record("pr-platform", "list-open-requests", PILOT_REPOSITORY);
        return { status: 200, body: [pullPayload(options.headSha())] };
      }
      if (url === `${base}/pulls?state=closed&per_page=20&sort=updated&direction=desc`) {
        record("pr-platform", "list-merged-requests", PILOT_REPOSITORY);
        return { status: 200, body: [pullPayload(mergedRequest.headSha ?? options.headSha())] };
      }
      if (
        url.startsWith(`${base}/commits/`) &&
        url.endsWith(`/check-runs?per_page=${String(PILOT_PIPELINE_LIMIT)}`)
      ) {
        const sha = decodeURIComponent(
          url.slice(`${base}/commits/`.length, url.indexOf("/check-runs")),
        );
        record("ci", "read-check-runs", sha);
        return { status: 200, body: checkRunsPayload(sha) };
      }
      if (url === `${base}/issues/310`) {
        record("tracker", "read-work-item", "310");
        return { status: 200, body: issuePayload("310") };
      }
      if (url === `${base}/pulls/${String(PILOT_PULL_NUMBER)}`) {
        record("pr-platform", "read-request", String(PILOT_PULL_NUMBER));
        return { status: 200, body: pullPayload(options.headSha()) };
      }
      throw new Error(`unfixtured pilot provider request ${request.method} ${url}`);
    },
  };

  const providerRecord = (operation: string, target: string): void => {
    providerCalls.push({ surface: "provider", operation, target, outbound: false });
  };

  const closeoutProvider: CloseoutProviderRuntime = {
    systemName: "github",
    capabilities: PILOT_PROVIDER_CAPABILITIES,
    readWorkItem: async (entityId) => {
      providerRecord("read-work-item", entityId);
      return observed(workItem);
    },
    readWorkItemObservation: async (entityId) => {
      providerRecord("read-work-item-observation", entityId);
      return observed(workItem);
    },
    findMergedDeliveryRequest: async (input) => {
      providerRecord("find-merged-request", input.workItemRef);
      return observed(mergedRequest);
    },
    listBlockedByDependents: async (input) => {
      providerRecord("list-dependents", input.entityId);
      return observed([]);
    },
    writeWorkItem: async (input) => {
      providerRecord("write-work-item", input.entityId);
      return { ok: true };
    },
    transitionWorkItem: async (input) => {
      providerRecord("transition-work-item", input.entityId);
      return { ok: true };
    },
    resolveDeliveryThread: async (input) => {
      providerRecord("resolve-delivery-thread", input.threadId);
      return { ok: true };
    },
  };

  const plans: Readonly<Record<string, QueuePlanFact>> = {
    "GH-310": { state: "valid", tier: "full" },
    "GH-320": { state: "valid", tier: "full" },
    "GH-321": { state: "valid", tier: "lite" },
  };
  const workItems: Record<string, QueueWorkItemFact> = {
    "GH-310": { state: "observed", deliveryState: "in-review", labels: ["change"], blockedBy: [] },
    "GH-320": {
      state: "observed",
      deliveryState: "ready",
      labels: ["priority:high"],
      blockedBy: [],
    },
    "GH-321": { state: "observed", deliveryState: "ready", labels: ["change"], blockedBy: [] },
  };
  const ci: Readonly<Record<string, QueueCiFact>> = {
    "GH-310": { state: "available", result: "succeeded" },
    "GH-320": { state: "available", result: "succeeded" },
    "GH-321": { state: "available", result: "succeeded" },
  };
  const provider: QueueProviderFact = { state: "available" };
  const close: Record<string, QueueCloseFact> = {
    "GH-310": "merge-ready",
    "GH-320": "none",
    "GH-321": "none",
  };
  const deploy: QueueDeployFacts = { expectations: {}, verdicts: {} };

  const queueFacts: QueueFactSource = {
    plans,
    workItems,
    ci,
    provider,
    close,
    deploy,
  };

  return {
    instance,
    credentials,
    transport,
    calls,
    providerCalls,
    queueFacts,
    closeoutProvider,
    mergedRequest: () => mergedRequest,
    workItem: () => workItem,
    setMerged: (squashSha) => {
      workItem = pilotWorkItem({
        status: { nativeStatus: "open", deliveryState: "in-review" },
        labels: ["change", "in-progress"],
      });
      mergedRequest = pilotDeliveryRequest(squashSha, { reviewState: "merged" });
      close["GH-310"] = "merge-ready";
    },
    markClosed: () => {
      workItem = pilotWorkItem({
        identity: { systemName: "github", entityId: "310" },
        title: "Pilot delivery",
        status: { nativeStatus: "closed", deliveryState: "done" },
        labels: ["change"],
        relations: [],
        updatedAt: "2026-11-07T00:00:00Z",
      });
      close["GH-310"] = "none";
      workItems["GH-310"] = { state: "observed", deliveryState: "done", labels: [], blockedBy: [] };
    },
  };
};

/** A child runner over a sanitized fixed environment that records every spawn. */
export type PilotChildRunnerOptions = {
  readonly timeout: number;
  readonly killSignal: "SIGKILL";
  readonly cwd?: string;
};

export type PilotChildRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

export type PilotChildRunner = (
  file: string,
  args: readonly string[],
  options: PilotChildRunnerOptions,
) => Promise<PilotChildRunnerResult>;

/** Build the git-only recording child runner used by every real git seam. */
export const createRecordingChildRunner = (
  spawns: PilotSpawn[],
  environment: Readonly<Record<string, string>>,
): PilotChildRunner => {
  return (file, args, options) =>
    new Promise((resolve) => {
      spawns.push({ file, args: [...args] });
      execFile(
        file,
        [...args],
        {
          timeout: options.timeout,
          killSignal: options.killSignal,
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
          env: { ...environment },
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        },
        (error, stdout, stderr) => {
          const status =
            error === null
              ? 0
              : typeof (error as { readonly code?: unknown }).code === "number"
                ? (error as { readonly code: number }).code
                : 1;
          resolve({
            stdout,
            stderr,
            status,
            timedOut: error !== null && (error as { readonly killed?: boolean }).killed === true,
          });
        },
      );
    });
};

export type FetchGuard = {
  readonly attempts: readonly string[];
  readonly restore: () => void;
};

/** Replace ambient fetch with a recorder that fails the run on any network use. */
export const installFetchGuard = (): FetchGuard => {
  const original = globalThis.fetch;
  const attempts: string[] = [];
  const guarded: typeof fetch = async (input) => {
    attempts.push(String(input));
    throw new Error("the pilot suite must not perform live network calls");
  };
  globalThis.fetch = guarded;
  return {
    attempts,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

export type SleepGuard = {
  readonly sleeps: readonly string[];
  readonly restore: () => void;
};

/** Replace the Bun sleep primitive with a recorder; no pilot path calls it. */
export const installSleepGuard = (): SleepGuard => {
  const original = Bun.sleep;
  const sleeps: string[] = [];
  Bun.sleep = (async (duration: number) => {
    sleeps.push(String(duration));
    throw new Error("the pilot suite must not sleep");
  }) as typeof Bun.sleep;
  return {
    sleeps,
    restore: () => {
      Bun.sleep = original;
    },
  };
};

export const isPilotRef = (ref: string): boolean => ref === PILOT_REF;
