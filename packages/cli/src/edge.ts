/**
 * The designated runtime-aware edge (D12).
 *
 * Brand identity is resolved once, before any discovery, from an injected
 * environment record. Source acquisition, legacy fact mapping, shipped artifact
 * injection and the pure resolver are composed here; the command handler only
 * shapes the already-resolved snapshot.
 */

import { readFileSync } from "node:fs";
import {
  acquireFileConfig,
  type FileSystemFacts,
  neutralEnvironmentFacts,
  nodeFileSystemFacts,
  type PmNotesFileSystemFacts,
  type RuntimePlatform,
  readLocalPmContext,
  readPmNotesText,
  runtimePlatform,
  stagePmNotesPhaseEntry,
} from "@delivery-os/adapters/file";
import {
  createGitBranchSeam,
  type GitBranchSeam,
  type GitBranchSeamOptions,
} from "@delivery-os/adapters/git";
import {
  createGitHubClient,
  GITHUB_ADAPTER_CONTRACT,
  type GithubClient,
  type GithubClientOptions,
} from "@delivery-os/adapters/github";
import { GITLAB_ADAPTER_CONTRACT, type GitLabClient } from "@delivery-os/adapters/gitlab";
import { JIRA_ADAPTER_CONTRACT, type JiraClient } from "@delivery-os/adapters/jira";
import { createLegacyCompat } from "@delivery-os/adapters/legacy";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  type RepositoryIo,
  type RepositoryRootFacts,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import {
  createSessionAdmin,
  createSessionStore,
  type OpencodeSessionIo,
} from "@delivery-os/adapters/session";
import type { ConfigCatalog, DefaultPositionManifest } from "@delivery-os/core";
import {
  buildCloseoutPlan,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  catalogPaths,
  classifyPruneCandidate,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  isLiveDbSession,
  PRODUCTION_CATALOG,
  resolveCloseoutBaseRef,
  resolveConfig,
  runCloseout,
  selectPruneCandidates,
} from "@delivery-os/core";
import type { BrandingInputError, ResolverInput } from "@delivery-os/core/branding";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import {
  type AdapterCapabilityDeclaration,
  type BrandIdentity,
  CLOSEOUT_MAX_DEPENDENTS,
  type CloseoutGitRuntime,
  type CloseoutProviderRuntime,
  type CloseoutReadObservation,
  type CloseoutReverseDependentObservation,
  type CloseoutStateRuntime,
  type CloseoutWriteOutcome,
  type ConfigFailure,
  type CredentialPort,
  type DeliveryRequest,
  type ExternalSystemInstance,
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  type ProviderClock,
  type ProviderSleep,
  type QuotaTransport,
  type Result,
  type StateStorePort,
  type StatusLocalContextRead,
  type StatusParkRead,
  type StatusProviderConfigRead,
  type StatusReadFailure,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  type WorkItem,
} from "@delivery-os/core/contracts";
import {
  createProviderEngine,
  parseAndValidateProviderConfiguration,
  readProviderParkViews,
} from "@delivery-os/core/provider";
import {
  appendCloseoutOutcome,
  appendPhaseTransition,
  foldCloseoutHistory,
  readChangeTransitions,
  readChangeTransitionsTolerant,
  readCloseoutHistory,
  replacePhaseProjection,
} from "@delivery-os/core/state";
import { resolveAppErrorCode } from "./classify.js";
import {
  type CloseoutCommandRuntime,
  createCloseoutCommandDefinition,
} from "./commands/closeout.js";
import {
  type ConfigCommandRuntime,
  type ConfigResolvedSnapshot,
  createConfigCommandDefinition,
} from "./commands/config.js";
import { createDbCommandDefinition, type DbCommandRuntime } from "./commands/db.js";
import {
  createLintCommandDefinition,
  type LintCommandRuntime,
  type LintRegistryRead,
} from "./commands/lint.js";
import { createPhaseCommandDefinition, type PhaseCommandRuntime } from "./commands/phase.js";
import {
  createProviderCommandDefinition,
  type ProviderCommandRuntime,
} from "./commands/provider.js";
import { createQueueReadyCommandDefinition } from "./commands/queue.js";
import { createStatusCommandDefinition, type StatusCommandRuntime } from "./commands/status.js";
import { createVerifyCommandDefinition, type VerifyCommandRuntime } from "./commands/verify.js";
import type { CliDependencies, CommandDefinition, CommandFlags, CommandProgram } from "./index.js";

const NEUTRAL_OVERRIDE_NAME = "DELIVERY_OS_WORKING_NAME";

/** Register non-empty secret values from an injected environment record. */
export function registerEdgeSecrets(
  environment: Readonly<Record<string, string | undefined>>,
  keys: readonly string[],
): readonly string[] {
  const values: string[] = [];
  for (const key of keys) {
    const value = environment[key];
    if (typeof value === "string" && value.length > 0 && !values.includes(value)) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Read the registry target through the injected state port. The derived
 * projection is observed by its documented record key; no mutation or fence is
 * acquired by a read.
 */
export const createRegistryLintReader = (
  store: StateStorePort,
): ((changeRef: string) => LintRegistryRead) => {
  return (changeRef) => {
    const read = store.read({ requiredKeys: [] });
    if (!read.ok) return { ok: false, error: read.error };
    const { evidence, values } = read.value;
    const projectionName = `${PHASE_STATE_DOCUMENT_PREFIX}${changeRef}${PHASE_STATE_DOCUMENT_SUFFIX}`;
    return {
      ok: true,
      verifiedEmpty: evidence.verifiedEmpty,
      recordCount: evidence.recordCount,
      verification: evidence.verification,
      projection: { present: Object.hasOwn(values, `document:${projectionName}`) },
    };
  };
};

/** Compose the phase write path from injected I/O, state, and time facts. */
export type PhaseRuntimeOptions = {
  readonly store: StateStorePort;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly writeFile: (file: string, text: string) => void;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
};

export const createPhaseCommandRuntime = (options: PhaseRuntimeOptions): PhaseCommandRuntime => ({
  readPmNotes: (changeRef) =>
    readPmNotesText({
      changeRef,
      changesDirectory: options.changesDirectory,
      fs: options.fs,
    }),
  stageEntry: (text, edit) => stagePmNotesPhaseEntry(text, edit),
  readRegistry: (changeRef) => {
    const read = readChangeTransitions(options.store, changeRef);
    if (!read.ok) return { ok: false, error: read.error };
    return {
      ok: true,
      verifiedEmpty: read.value.verifiedEmpty,
      transitions: read.value.transitions,
      evidence: read.value.evidence,
    };
  },
  appendTransition: (request) => appendPhaseTransition(options.store, request),
  replaceProjection: (request) => replacePhaseProjection(options.store, request),
  writePmNotes: (file, text) => {
    try {
      options.writeFile(file, text);
      return { ok: true };
    } catch {
      return { ok: false, message: `failed to write ${file}` };
    }
  },
  nowIso: options.nowIso,
  newFenceToken: options.newFenceToken,
});

/** Compose the read-only verify runtime from injected I/O and the state port. */
export type VerifyRuntimeOptions = {
  readonly store: StateStorePort;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
};

export const createVerifyCommandRuntime = (
  options: VerifyRuntimeOptions,
): VerifyCommandRuntime => ({
  readPmNotes: (changeRef) =>
    readPmNotesText({
      changeRef,
      changesDirectory: options.changesDirectory,
      fs: options.fs,
    }),
  readRegistry: (changeRef) => {
    const read = readChangeTransitionsTolerant(options.store, changeRef);
    if (!read.ok) return { ok: false, error: read.error };
    return {
      ok: true,
      present: read.value.present,
      verifiedEmpty: read.value.verifiedEmpty,
      transitions: read.value.transitions,
      recordCount: read.value.evidence.recordCount,
    };
  },
});

export type EdgeOptions = {
  readonly brand: BrandIdentity;
  readonly program: CommandProgram;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly secretKeys?: readonly string[];
};

/** Assemble the production dependency set at the runtime-aware edge. */
export function createProductionDependencies(options: EdgeOptions): CliDependencies {
  return {
    brand: options.brand,
    clock: { now: () => Math.trunc(performance.now()) },
    newRunId: () => globalThis.crypto.randomUUID(),
    secrets: registerEdgeSecrets(options.environment ?? {}, options.secretKeys ?? []),
    program: options.program,
  };
}

/** Injected I/O and seams for the provider command family (GH-182 PD-G). */
export type ProviderComposition = {
  readonly clock: ProviderClock;
  readonly credentialPort: CredentialPort;
  readonly transport: QuotaTransport;
  readonly sleep: ProviderSleep;
  readonly stateStore: StateStorePort;
  readonly newFenceToken: () => string;
};

/** The injected provider transport shape used by the GitHub reads. */
export type StatusTransport = NonNullable<GithubClientOptions["transport"]>;

/** The status composition seams; the provider resolver is supplied by the edge. */
export type StatusComposition = {
  readonly store: StateStorePort;
  readonly credentials: CredentialPort;
  readonly transport: StatusTransport;
  readonly repository: { readonly cwd: string; readonly io: RepositoryIo };
  readonly localContext: { readonly path: string; readonly fs: FileSystemFacts };
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly github: { readonly instance: ExternalSystemInstance };
};

/**
 * The closeout composition seams (GH-183 D11): pure facts, the provider and git
 * runtimes, the fenced state runtime, and injected time/id factories.
 */
export type CloseoutComposition = {
  readonly planFacts: (workItemRef: string) => Promise<CloseoutPlanFacts>;
  readonly provider: CloseoutProviderRuntime;
  readonly git: CloseoutGitRuntime;
  readonly state: CloseoutStateRuntime;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
};

/** The raw provider source the closeout composition bridges to a runtime. */
export type CloseoutProviderSource =
  | {
      readonly kind: "github";
      readonly client: GithubClient;
      readonly systemName?: string;
      readonly capabilities?: AdapterCapabilityDeclaration;
    }
  | {
      readonly kind: "jira";
      readonly client: JiraClient;
      readonly systemName?: string;
      readonly capabilities?: AdapterCapabilityDeclaration;
    }
  | {
      readonly kind: "gitlab";
      readonly client: GitLabClient;
      readonly systemName?: string;
      readonly capabilities?: AdapterCapabilityDeclaration;
    }
  | {
      readonly kind: "declared";
      readonly systemName: string;
      readonly capabilities: AdapterCapabilityDeclaration;
    };

/** The raw ports the production closeout composition consumes. */
export type CloseoutCompositionOptions = {
  readonly workspaceId: string;
  readonly provider: CloseoutProviderSource;
  /** An already-built seam, or the construction options for the real seam. */
  readonly git: GitBranchSeam | GitBranchSeamOptions;
  readonly store: StateStorePort;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly dependentsLimit?: number;
  readonly mergedRequestLimit?: number;
  readonly entityIdFor?: (workItemRef: string, kind: CloseoutProviderSource["kind"]) => string;
};

type ReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly detail?: string };

const closeoutReadOutcome = <T>(result: ReadResult<T>): CloseoutReadObservation<T> =>
  result.ok
    ? { observation: "observed", value: result.value }
    : { observation: "invalid", detail: result.detail ?? result.code };

type WriteResult =
  | { readonly ok: true; readonly alreadyApplied?: boolean }
  | { readonly ok: false; readonly code: string; readonly detail?: string };

const closeoutWriteOutcome = (result: WriteResult): CloseoutWriteOutcome =>
  result.ok
    ? { ok: true, ...(result.alreadyApplied === true ? { alreadyApplied: true } : {}) }
    : { ok: false, code: result.code, detail: result.detail ?? result.code };

const bridgeCloseoutProvider = (source: CloseoutProviderSource): CloseoutProviderRuntime => {
  if (source.kind === "github") {
    const client = source.client;
    return {
      systemName: source.systemName ?? GITHUB_ADAPTER_CONTRACT.adapterName,
      capabilities: source.capabilities ?? GITHUB_ADAPTER_CONTRACT.capabilities,
      readWorkItem: (entityId) => client.readWorkItemObservation(entityId),
      readWorkItemObservation: (entityId) => client.readWorkItemObservation(entityId),
      readDeliveryRequest: async (entityId) => {
        if (!/^\d+$/.test(entityId)) {
          return { observation: "invalid", detail: "GitHub delivery request id is not numeric" };
        }
        return closeoutReadOutcome(await client.readDeliveryRequest(Number(entityId)));
      },
      findMergedDeliveryRequest: (input) => client.findMergedDeliveryRequest(input),
      listBlockedByDependents: (input) => client.listBlockedByDependents(input),
      writeWorkItem: async (input) =>
        closeoutWriteOutcome(
          await client.writeWorkItem({
            entityId: input.entityId,
            ...(input.add === undefined ? {} : { add: input.add }),
            ...(input.remove === undefined ? {} : { remove: input.remove }),
            ...(input.assignee === undefined ? {} : { assignee: input.assignee }),
          }),
        ),
      transitionWorkItem: async (input) =>
        closeoutWriteOutcome(await client.transitionWorkItem(input)),
      resolveDeliveryThread: async (input) =>
        closeoutWriteOutcome(await client.resolveDeliveryThread(input)),
    };
  }
  if (source.kind === "jira") {
    const client = source.client;
    return {
      systemName: source.systemName ?? JIRA_ADAPTER_CONTRACT.adapterName,
      capabilities: source.capabilities ?? JIRA_ADAPTER_CONTRACT.capabilities,
      readWorkItem: (entityId) => client.readWorkItemObservation(entityId),
      readWorkItemObservation: (entityId) => client.readWorkItemObservation(entityId),
      listBlockedByDependents: async (input) =>
        client.listBlockedByDependents({ issueKey: input.entityId, limit: input.limit }),
      writeWorkItem: async (input) =>
        closeoutWriteOutcome(
          await client.writeWorkItem({
            issueKey: input.entityId,
            ...(input.add === undefined ? {} : { add: input.add }),
            ...(input.remove === undefined ? {} : { remove: input.remove }),
            ...(input.assignee === undefined ? {} : { assignee: input.assignee }),
          }),
        ),
      transitionWorkItem: async (input) =>
        closeoutWriteOutcome(
          await client.transitionWorkItem({
            issueKey: input.entityId,
            deliveryState: input.deliveryState,
          }),
        ),
      resolveDeliveryThread: async () => ({
        ok: false,
        code: "provider.payload.invalid",
        detail: "Jira has no delivery-thread surface",
      }),
    };
  }
  if (source.kind === "gitlab") {
    const client = source.client;
    return {
      systemName: source.systemName ?? GITLAB_ADAPTER_CONTRACT.adapterName,
      capabilities: source.capabilities ?? GITLAB_ADAPTER_CONTRACT.capabilities,
      readWorkItem: async () => ({ observation: "unavailable" }),
      readWorkItemObservation: async () => ({ observation: "unavailable" }),
      readDeliveryRequest: async (entityId) => {
        if (!/^\d+$/.test(entityId)) {
          return { observation: "invalid", detail: "GitLab merge request iid is not numeric" };
        }
        return closeoutReadOutcome(await client.readDeliveryRequest(Number(entityId)));
      },
      listBlockedByDependents: async () => ({ observation: "no-surface" }),
      writeWorkItem: async () => ({
        ok: false,
        code: "provider.payload.invalid",
        detail: "GitLab has no closeout write surface",
      }),
      transitionWorkItem: async () => ({
        ok: false,
        code: "provider.payload.invalid",
        detail: "GitLab has no closeout transition surface",
      }),
      resolveDeliveryThread: async () => ({
        ok: false,
        code: "provider.payload.invalid",
        detail: "GitLab has no delivery-thread surface",
      }),
    };
  }
  return {
    systemName: source.systemName,
    capabilities: source.capabilities,
    readWorkItem: async () => ({ observation: "unavailable" }),
    readWorkItemObservation: async () => ({ observation: "unavailable" }),
    listBlockedByDependents: async () => ({ observation: "no-surface" }),
    writeWorkItem: async () => ({
      ok: false,
      code: "provider.payload.invalid",
      detail: "declared provider has no closeout write surface",
    }),
    transitionWorkItem: async () => ({
      ok: false,
      code: "provider.payload.invalid",
      detail: "declared provider has no closeout transition surface",
    }),
    resolveDeliveryThread: async () => ({
      ok: false,
      code: "provider.payload.invalid",
      detail: "declared provider has no delivery-thread surface",
    }),
  };
};

const defaultCloseoutEntityId = (
  workItemRef: string,
  kind: CloseoutProviderSource["kind"],
): string => {
  if (kind !== "github") return workItemRef;
  const match = /^[A-Z][A-Z0-9]*-(\d+)$/.exec(workItemRef);
  return match?.[1] ?? workItemRef;
};

const planCloseoutDependentFacts = async (
  provider: CloseoutProviderRuntime,
  candidates: readonly WorkItem[],
  limit: number,
): Promise<readonly CloseoutDependentFact[]> => {
  const bounded = candidates.slice(0, limit);
  return Promise.all(
    bounded.map(async (candidate): Promise<CloseoutDependentFact> => {
      const current = await provider.readWorkItemObservation(candidate.identity.entityId);
      if (current.observation !== "observed") {
        return { item: candidate, blockers: { observation: "unavailable" } };
      }
      const relationsSignal = current.signals?.relations;
      if (
        relationsSignal === undefined ||
        relationsSignal === "unavailable" ||
        relationsSignal === "unknown"
      ) {
        return { item: current.value, blockers: { observation: "unavailable" } };
      }
      const blockedBy = current.value.relations.filter(
        (relation) => relation.relationKind === "blocked-by",
      );
      const blockerReads = await Promise.all(
        blockedBy.map((relation) => provider.readWorkItemObservation(relation.target.entityId)),
      );
      const blockers: WorkItem[] = [];
      for (const read of blockerReads) {
        if (read.observation !== "observed") {
          return { item: current.value, blockers: { observation: "unavailable" } };
        }
        blockers.push(read.value);
      }
      return { item: current.value, blockers: { observation: "observed", value: blockers } };
    }),
  );
};

const isGitBranchSeam = (value: GitBranchSeam | GitBranchSeamOptions): value is GitBranchSeam =>
  "readCheckout" in value && typeof value.readCheckout === "function";

const gitSeamFor = (value: GitBranchSeam | GitBranchSeamOptions): GitBranchSeam =>
  isGitBranchSeam(value) ? value : createGitBranchSeam(value);

/** Bridge the fenced state port to the closeout state runtime (NFR-8). */
export const createCloseoutStateRuntime = (store: StateStorePort): CloseoutStateRuntime => ({
  acquireFence: (token) => store.acquireFence(token),
  append: (handle, record) => appendCloseoutOutcome(store, handle, record),
  releaseFence: (handle) => store.releaseFence(handle),
  readHistory: (workItemRef) => readCloseoutHistory(store, workItemRef),
});

/**
 * Compose the production closeout reads and runtimes from raw ports.
 *
 * `planFacts` performs the read orchestration (work item, merged request,
 * reverse dependents with per-candidate relation reads, git facts, persisted
 * ledger) exactly once; the engine then plans/applies over those facts.
 */
export const createCloseoutComposition = (
  options: CloseoutCompositionOptions,
): CloseoutComposition => {
  const provider = bridgeCloseoutProvider(options.provider);
  const git = gitSeamFor(options.git);
  const dependentsLimit = options.dependentsLimit ?? CLOSEOUT_MAX_DEPENDENTS;
  const mergedRequestLimit = options.mergedRequestLimit ?? 20;
  const entityIdFor = options.entityIdFor ?? defaultCloseoutEntityId;

  const planFacts = async (workItemRef: string): Promise<CloseoutPlanFacts> => {
    const entityId = entityIdFor(workItemRef, options.provider.kind);
    const observedWorkItem = await provider.readWorkItemObservation(entityId);
    if (
      observedWorkItem.observation === "invalid" &&
      observedWorkItem.code !== undefined &&
      observedWorkItem.code !== "provider.payload.invalid"
    ) {
      // A credential/config failure keeps its delivered identity at exit 1;
      // only payload and HTTP/transport failures are the invalid observation.
      const resolution = resolveAppErrorCode(observedWorkItem.code);
      if (resolution.ok) {
        throw { kind: resolution.entry.domainKind, code: observedWorkItem.code };
      }
    }

    const mergedRequest: CloseoutReadObservation<DeliveryRequest> =
      provider.findMergedDeliveryRequest === undefined
        ? { observation: "unavailable" }
        : await provider.findMergedDeliveryRequest({ workItemRef, limit: mergedRequestLimit });

    const dependentsRaw: CloseoutReverseDependentObservation<readonly WorkItem[]> =
      provider.listBlockedByDependents === undefined
        ? { observation: "no-surface" }
        : await provider.listBlockedByDependents({ entityId, limit: dependentsLimit });
    const dependents: CloseoutReverseDependentObservation<readonly CloseoutDependentFact[]> =
      dependentsRaw.observation === "observed"
        ? {
            observation: "observed",
            value: await planCloseoutDependentFacts(provider, dependentsRaw.value, dependentsLimit),
          }
        : dependentsRaw;

    const baseRef = resolveCloseoutBaseRef(mergedRequest);
    const mergedHeadSha =
      mergedRequest.observation === "observed" ? mergedRequest.value.headSha : undefined;
    const deliveryBranch =
      mergedRequest.observation === "observed" ? mergedRequest.value.sourceRef : "";

    const checkout = await git.readCheckout({
      deliveryBranch,
      baseRef,
      ...(mergedHeadSha === undefined ? {} : { deliveryHead: mergedHeadSha }),
    });
    const cleanWorktree = await git.isClean();
    const baseRefExists = await git.resolveRef({ ref: baseRef });
    const branches = await git.listBranches({ workItemRef });
    const checkedOutElsewhere = (
      await Promise.all(
        branches.map(async (branch) => ({
          name: branch.name,
          elsewhere: await git.isCheckedOutElsewhere({ branch: branch.name }),
        })),
      )
    )
      .filter((entry) => entry.elsewhere)
      .map((entry) => entry.name);

    const history = readCloseoutHistory(options.store, workItemRef);
    if (!history.ok) {
      // A torn/malformed ledger is a classified state failure, never zeros.
      throw { kind: "state", code: history.error.code };
    }

    return {
      workspaceId: options.workspaceId,
      workItemRef,
      provider: { systemName: provider.systemName, capabilities: provider.capabilities },
      observedWorkItem,
      mergedRequest,
      dependents,
      checkout,
      cleanWorktree,
      baseRefExists,
      branches,
      checkedOutElsewhere,
      persisted: foldCloseoutHistory(history.value),
    };
  };

  return {
    planFacts,
    provider,
    git,
    state: createCloseoutStateRuntime(options.store),
    nowIso: options.nowIso,
    newFenceToken: options.newFenceToken,
  };
};

/** Compose the closeout command runtime over injected facts and runtimes. */
export const createCloseoutCommandRuntime = (
  composition: CloseoutComposition,
): CloseoutCommandRuntime => {
  const run = async (workItemRef: string, apply: boolean) => {
    const facts = await composition.planFacts(workItemRef);
    const plan = buildCloseoutPlan(facts);
    return runCloseout({
      plan,
      provider: composition.provider,
      git: composition.git,
      state: composition.state,
      timestamp: composition.nowIso(),
      fenceToken: composition.newFenceToken(),
      apply,
    });
  };
  return {
    plan: (input) => run(input.workItemRef, false),
    apply: (input) => run(input.workItemRef, true),
  };
};

/** Injected I/O and clock for the db command family (GH-180 PIN-6). */
export type DbComposition = {
  readonly io: OpencodeSessionIo;
  readonly clock: { readonly nowMs: () => number };
};

/** Compose the db runtime over the store/admin ports and the injected clock. */
export const createDbCommandRuntime = (composition: DbComposition): DbCommandRuntime => {
  // The adapter may import only core contracts; the pure policy is injected
  // here from the core root so the single domain predicate remains the source.
  const policy = {
    isLive: isLiveDbSession,
    cutoff: computeDbCutoffMs,
    liveBoundary: computeDbLiveBoundaryMs,
    classify: classifyPruneCandidate,
    select: selectPruneCandidates,
  };
  const store = createSessionStore(composition.io, policy);
  const admin = createSessionAdmin(composition.io, policy);
  return {
    size: () => store.size(),
    list: (input) => store.list({ limit: input.limit, nowMs: composition.clock.nowMs() }),
    prune: (input) =>
      admin.prune({
        olderThanDays: input.olderThanDays,
        limit: input.limit,
        apply: input.apply,
        nowMs: composition.clock.nowMs(),
      }),
    reboot: (input) => admin.reboot({ apply: input.apply, nowMs: composition.clock.nowMs() }),
  };
};

const providerFailure = (failure: { readonly code: string }): StatusReadFailure =>
  failure.code === "config.credential.missing"
    ? { ok: false, reason: "credential-unavailable", failureCode: "config.credential.missing" }
    : { ok: false, reason: "read-failed", failureClass: failure.code };

/** Compose the status runtime, enforcing the credential-reference guard first. */
export const createStatusCommandRuntime = (
  options: StatusComposition,
  resolveProviderConfig: () => StatusProviderConfigRead,
): StatusCommandRuntime => {
  const instance = options.github.instance;
  const admitted =
    instance.systemKind === "vcs" && instance.authMethod.mechanism === "credential-reference";
  const refusal: StatusReadFailure = {
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
  };
  let target: StatusRepositoryTarget | undefined;

  const clientFor = (repository: StatusRepositoryTarget) =>
    createGitHubClient({
      instance,
      credentials: options.credentials,
      repository,
      transport: options.transport,
    });

  const readRepository = (): StatusRepositoryFacts => {
    const facts = readRepositoryFacts({
      cwd: options.repository.cwd,
      io: options.repository.io,
    });
    const parsed = parseGitHubRemote(facts.originUrl);
    if (parsed.ok) {
      target = { owner: parsed.owner, name: parsed.name };
      return {
        binding: {
          state: "observed",
          host: "github.com",
          owner: parsed.owner,
          name: parsed.name,
          remoteName: "origin",
        },
        head: facts.head,
      };
    }
    target = undefined;
    return {
      binding: { state: "unavailable", reason: parsed.reason },
      head: facts.head,
    };
  };

  const readWorkItems: StatusCommandRuntime["readWorkItems"] = async (repository, limit) => {
    if (!admitted) return refusal;
    const result = await clientFor(repository).listWorkItems(limit);
    if (!result.ok) return providerFailure(result);
    return {
      ok: true,
      items: result.value.items,
      pageItemCount: result.value.pageItemCount,
      availability: {
        ownerHandBacks: "available",
        blockedDependencies: "unavailable",
        stalls: "available",
        hygiene: "available",
      },
    };
  };

  const readDeliveryRequests: StatusCommandRuntime["readDeliveryRequests"] = async (
    repository,
    limit,
  ) => {
    if (!admitted) return refusal;
    const result = await clientFor(repository).listDeliveryRequests(limit);
    if (!result.ok) return providerFailure(result);
    return {
      ok: true,
      items: result.value.items,
      pageItemCount: result.value.pageItemCount,
      availability: {
        state: "available",
        refs: "available",
        reviewState: "unavailable",
        reviewThreads: "unavailable",
      },
    };
  };

  const readPipelineRuns: StatusCommandRuntime["readPipelineRuns"] = async (sha, limit) => {
    if (!admitted) return refusal;
    if (target === undefined) return { ok: false, reason: "not-configured" };
    const result = await clientFor(target).readPipelineRun(sha, limit);
    if (!result.ok) return providerFailure(result);
    return {
      ok: true,
      items: result.value.items,
      pageItemCount: result.value.pageItemCount,
    };
  };

  return {
    readRepository,
    readWorkItems,
    readDeliveryRequests,
    readPipelineRuns,
    readProviderConfig: resolveProviderConfig,
    readProviderParks: (nowMs): StatusParkRead => {
      const parks = readProviderParkViews(options.store, nowMs);
      if (!parks.ok) {
        return { ok: false, reason: "state-unreadable", failureCode: parks.error.code };
      }
      return { ok: true, parks: parks.value };
    },
    readLocalContext: (): StatusLocalContextRead =>
      readLocalPmContext({ path: options.localContext.path, fs: options.localContext.fs }),
    nowIso: options.clock.nowIso,
    nowMs: options.clock.nowMs,
  };
};

export type ConfigProgramOptions = {
  readonly workingName: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
  readonly platform?: RuntimePlatform;
  readonly catalog?: ConfigCatalog;
  readonly defaultPositions?: DefaultPositionManifest;
  readonly fs?: FileSystemFacts;
  readonly repositoryIo?: RepositoryIo;
  readonly resolveBrand?: (input: ResolverInput) => Result<BrandIdentity, BrandingInputError>;
  readonly warn?: (message: string) => void;
  readonly lint?: LintCommandRuntime;
  readonly phase?: PhaseCommandRuntime;
  readonly provider?: ProviderComposition;
  readonly verify?: VerifyCommandRuntime;
  readonly status?: StatusComposition;
  readonly queueReady?: StatusComposition;
  readonly db?: DbComposition;
  readonly closeout?: CloseoutComposition;
};

export type ConfigProgramResult =
  | {
      readonly ok: true;
      readonly brand: BrandIdentity;
      readonly program: CommandProgram;
      readonly secrets: readonly string[];
    }
  | { readonly ok: false; readonly error: BrandingInputError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDefaultPositionManifest = (value: unknown): value is DefaultPositionManifest => {
  if (!isRecord(value)) return false;
  if (value.source !== "core/src/config/defaults.ts") return false;
  if (typeof value.sourceHash !== "string" || !/^[0-9a-f]{64}$/.test(value.sourceHash)) {
    return false;
  }
  if (!isRecord(value.positions)) return false;
  return Object.values(value.positions).every(
    (line) => typeof line === "number" && Number.isInteger(line) && line > 0,
  );
};

/** Read the packed defaults-position manifest at the runtime-aware edge. */
export const readShippedDefaultsManifest = (): DefaultPositionManifest | undefined => {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(
        new URL("../../core/dist/config/defaults-positions.json", import.meta.url),
        "utf8",
      ),
    );
    return isDefaultPositionManifest(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const stringFlag = (flags: CommandFlags, name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const stringEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const facts: Record<string, string> = {};
  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) facts[name] = value;
  }
  return facts;
};

const envName = (prefix: string, path: string): string =>
  `${prefix}${path.toUpperCase().replaceAll(".", "__").replaceAll("-", "_")}`;

const ordinaryFlags = (flags: CommandFlags, catalog: ConfigCatalog): Record<string, string> => {
  const declarations = new Set(
    catalogPaths(catalog).flatMap(([, field]) => (field.flag === undefined ? [] : [field.flag])),
  );
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(flags)) {
    if (typeof value === "string" && declarations.has(name)) values[name] = value;
  }
  return values;
};

/**
 * Compose a frozen brand, acquired sources, legacy facts and the packed defaults
 * manifest into one config command program. Brand resolution happens before any
 * filesystem or root discovery.
 */
export const createConfigProgram = (options: ConfigProgramOptions): ConfigProgramResult => {
  const override = options.environment[NEUTRAL_OVERRIDE_NAME];
  const brandInput: ResolverInput =
    override === undefined
      ? { workingName: options.workingName }
      : { workingName: options.workingName, override };
  const resolveBrand = options.resolveBrand ?? resolveBrandIdentity;
  const branded = resolveBrand(brandInput);
  if (!branded.ok) return { ok: false, error: branded.error };
  const brand = branded.value;
  const catalog = options.catalog ?? PRODUCTION_CATALOG;
  const fs = options.fs ?? nodeFileSystemFacts();
  const repositoryIo = options.repositoryIo ?? nodeRepositoryIo();
  const platform = options.platform ?? runtimePlatform();
  const selectorName = `${brand.environmentPrefix}CONFIG`;
  const warnings: string[] = [];
  const legacy = createLegacyCompat({
    current: {
      environmentPrefix: brand.environmentPrefix,
      configDirectoryName: brand.configDirectoryName,
    },
    warn: (message) => {
      warnings.push(message);
    },
  });
  const currentEnvironment = options.environment;
  const initialLegacy = legacy.resolveConfigFacts({
    facts: stringEnvironment(currentEnvironment),
    environment: currentEnvironment,
    homeDirectory: options.homeDirectory,
  });
  const startupWarnings = [...warnings];
  warnings.length = 0;
  const secretKeys = catalogPaths(catalog).flatMap(([path, field]) =>
    field.env && field.source === "environment-only"
      ? [envName(brand.environmentPrefix, path)]
      : [],
  );
  const secrets = registerEdgeSecrets(initialLegacy.environment, secretKeys);

  const resolve = (flags: CommandFlags): Result<ConfigResolvedSnapshot, ConfigFailure> => {
    warnings.length = 0;
    const facts = stringEnvironment(currentEnvironment);
    const legacyFacts = legacy.resolveConfigFacts({
      facts,
      environment: currentEnvironment,
      homeDirectory: options.homeDirectory,
    });
    const selectedFlag = stringFlag(flags, "--config");
    const selectorOwn = Object.hasOwn(currentEnvironment, selectorName);
    const selectedConfig =
      selectedFlag ?? (selectorOwn ? currentEnvironment[selectorName] : legacyFacts.selectedConfig);
    const explicitProjectRoot = stringFlag(flags, "--project-root");
    const discoveredGitRoot =
      explicitProjectRoot === undefined ? findGitRoot(options.cwd, repositoryIo) : undefined;
    const rootFacts: RepositoryRootFacts = {
      ...(discoveredGitRoot !== undefined ? { gitRoot: discoveredGitRoot } : {}),
      ...(explicitProjectRoot === undefined ? {} : { explicitRoot: explicitProjectRoot }),
    };
    const acquired = acquireFileConfig({
      platform,
      homeDirectory: options.homeDirectory,
      environment: legacyFacts.environment,
      ...(rootFacts.gitRoot === undefined ? {} : { gitRoot: rootFacts.gitRoot }),
      ...(rootFacts.explicitRoot === undefined
        ? {}
        : { explicitProjectRoot: rootFacts.explicitRoot }),
      ...(selectedConfig === undefined ? {} : { selectedConfig }),
      enableSystemConfig: flags["--enable-system-config"] === true,
      enableUserConfig: flags["--enable-user-config"] === true,
      enableProjectLocalConfig: flags["--enable-project-local-config"] === true,
      configurationDirectoryName: brand.configDirectoryName,
      fs,
    });
    if (!acquired.ok) return acquired;
    const manifest = options.defaultPositions ?? readShippedDefaultsManifest();
    const resolved = resolveConfig({
      sources: acquired.sources,
      skipped: acquired.skipped,
      environment: neutralEnvironmentFacts(legacyFacts.environment, [
        NEUTRAL_OVERRIDE_NAME,
        selectorName,
      ]),
      environmentPrefix: brand.environmentPrefix,
      excludedEnvironmentNames: [NEUTRAL_OVERRIDE_NAME, selectorName],
      flags: ordinaryFlags(flags, catalog),
      catalog,
      strict: flags["--strict"] === true,
      ...(manifest === undefined ? {} : { defaultPositions: manifest }),
    });
    if (!resolved.ok) return resolved;
    const notices = [...startupWarnings.splice(0), ...warnings];
    return { ok: true, value: { config: resolved.value, notices } };
  };

  const runtime: ConfigCommandRuntime = { resolve };
  const commands: Record<string, CommandDefinition> = {
    config: createConfigCommandDefinition(runtime, catalog),
  };
  if (options.lint !== undefined) {
    commands.lint = createLintCommandDefinition(options.lint);
  }
  if (options.phase !== undefined) {
    commands.phase = createPhaseCommandDefinition(options.phase);
  }
  if (options.provider !== undefined) {
    const provider = options.provider;
    const engine = createProviderEngine(provider);
    const providerRuntime: ProviderCommandRuntime = {
      resolve: async (input) => {
        const snapshot = resolve({});
        if (!snapshot.ok) {
          return {
            ok: false,
            code: snapshot.error.code,
            summary: `configuration rejected (${snapshot.error.code})`,
          };
        }
        const parsed = parseAndValidateProviderConfiguration(snapshot.value.config.values);
        if (!parsed.ok) {
          return { ok: false, code: parsed.error.code, summary: parsed.error.detail };
        }
        return engine.resolve({
          config: parsed.config,
          ...(input.chainName === undefined ? {} : { chainName: input.chainName }),
          persist: true,
        });
      },
      quota: async (input) => {
        const snapshot = resolve({});
        if (!snapshot.ok) {
          return {
            ok: false,
            code: snapshot.error.code,
            summary: `configuration rejected (${snapshot.error.code})`,
          };
        }
        const parsed = parseAndValidateProviderConfiguration(snapshot.value.config.values);
        if (!parsed.ok) {
          return { ok: false, code: parsed.error.code, summary: parsed.error.detail };
        }
        return engine.quota({
          config: parsed.config,
          ...(input.providerName === undefined ? {} : { providerName: input.providerName }),
        });
      },
      parks: (input) => engine.parks(input),
    };
    commands.provider = createProviderCommandDefinition(providerRuntime);
  }
  const resolveProviderConfig = (): StatusProviderConfigRead => {
    const snapshot = resolve({});
    if (!snapshot.ok) {
      return { ok: false, reason: "config-invalid", failureCode: snapshot.error.code };
    }
    const parsed = parseAndValidateProviderConfiguration(snapshot.value.config.values);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: "provider-chain-unresolved",
        failureCode: "config.value.invalid",
      };
    }
    return { ok: true, config: parsed.config };
  };
  if (options.status !== undefined) {
    commands.status = createStatusCommandDefinition(
      createStatusCommandRuntime(options.status, resolveProviderConfig),
    );
  }
  if (options.queueReady !== undefined) {
    commands.queue = createQueueReadyCommandDefinition(
      createStatusCommandRuntime(options.queueReady, resolveProviderConfig),
    );
  }
  if (options.verify !== undefined) {
    commands.verify = createVerifyCommandDefinition(options.verify);
  }
  if (options.db !== undefined) {
    commands.db = createDbCommandDefinition(createDbCommandRuntime(options.db));
  }
  if (options.closeout !== undefined) {
    commands.closeout = createCloseoutCommandDefinition(
      createCloseoutCommandRuntime(options.closeout),
    );
  }
  return {
    ok: true,
    brand,
    program: { commands },
    secrets,
  };
};
