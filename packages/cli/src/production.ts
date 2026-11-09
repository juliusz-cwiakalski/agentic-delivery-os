/**
 * Production composition root for the executable entrypoint (GH-242 F-1).
 *
 * Wires the delivered adapters into the prompt-required command runtimes and
 * lets `createConfigProgram` compose the program. Provider-facing reads share
 * one GitHub client; an unresolved remote or missing credential produces the
 * command's own classified degradation rather than an unclassified crash. No
 * command is claimed that is not composed.
 */
import { writeFileSync } from "node:fs";
import {
  createEnvironmentCredentialPort,
  createProcessCredentialPort,
} from "@delivery-os/adapters/credentials";
import { createNodeProcessPort } from "@delivery-os/adapters/daemon";
import {
  acquireFileConfig,
  ensureDispatchIdentityMarkerText,
  nodeFileSystemFacts,
  nodePmNotesFileSystemFacts,
  readDispatchIdentityMarkerText,
  readPmNotesText,
  relativeChangeFolder,
  replaceDispatchIdentityMarkerText,
  runtimePlatform,
} from "@delivery-os/adapters/file";
import {
  createGitBranchSeam,
  createGitMergeSeam,
  type GitChildRunner,
} from "@delivery-os/adapters/git";
import { createGitHubClient, type GithubClientOptions } from "@delivery-os/adapters/github";
import { createClaudeSession, createOpencodeSession } from "@delivery-os/adapters/harness";
import { createHostSpawnRunner, createHostSpawnStarter } from "@delivery-os/adapters/host";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
  resolveCheckoutGitDirectories,
} from "@delivery-os/adapters/repo";
import {
  assembleHarnessLiveness,
  buildHarnessSpawnEnvironment,
  type CoordinatorSettings,
  claimQueueLease,
  classifyHarnessEvidence,
  classifyVerifyDocument,
  type DispatchArtifactFacts,
  type DispatchLedgerFacts,
  type DispatchPrFact,
  type DispatchRead,
  type DispatchTrackerFacts,
  type DispatchTruthReads,
  EvaluateVerifyChange,
  type HarnessSettings,
  type LaneSettings,
  normalizeDispatchRepositoryKey,
  normalizeRepositoryKey,
  normalizeRepositoryRemote,
  PRODUCTION_DEFAULTS,
  readDaemonLanes,
  readQueueEntries,
  releaseQueueLease,
  resolveConfig,
  resolveCoordinatorSettings,
  resolveDispatchIdentity,
  resolveHarnessSettings,
  resolveLaneSettings,
  serializeIdentityMarker,
  type VerifyDocumentClassification,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  CLOSEOUT_INTEGRATION_BASE,
  type CredentialPort,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  type DispatchLedgerVariant,
  type DispatchPhaseLedger,
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXHAUSTION_SCHEMA_ID,
  type ExternalSystemInstance,
  HARNESS_KINDS,
  type HarnessEnvironmentBuilder,
  type HarnessEnvironmentEntry,
  type HarnessKind,
  type HarnessSessionPort,
  type HarnessSpawnRunner,
  type HarnessSpawnStarter,
  LOCAL_CALLER_PRINCIPAL,
  type PipelineRun,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_SOURCE_ITEM_LIMIT,
  VERIFY_GATES_CI_RUN_LIMIT,
} from "@delivery-os/core/contracts";
import {
  createNodeStateEdge,
  createStateStore,
  ensureEconomicsExhaustionRecord,
  foldPhaseState,
  readChangeTransitionsTolerant,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import type { CoordinatorSessionFacts } from "./commands/coordinator-loop.js";
import {
  type ConfigProgramOptions,
  type CoordinatorComposition,
  createCloseoutComposition,
  createConfigProgram,
  createDispatchCommandRuntime,
  createDispatchGateRuntime,
  createMergeCommandRuntime,
  createPhaseCommandRuntime,
  createPhaseCommitExtension,
  createPlanCommandRuntime,
  createProductionCommitRuntimeOptions,
  createStatusCommandRuntime,
  createVerifyCommandRuntime,
  createVerifyDeployCommandRuntime,
  createVerifyGatesCommandRuntime,
  type DispatchCommandRuntime,
  type DispatchComposition,
  type DispatchLaneFacts,
} from "./edge.js";
import type { EntrypointComposer } from "./entrypoint.js";

const PROVIDER_FAILURE = "config.credential.missing";

/**
 * The tracker-family tokens the truth read derives, resolved from the one
 * taxonomy: `merged`, `blocked`, `pr-open`.
 */
const [PR_MERGED_TOKEN, PR_BLOCKED_TOKEN, PR_OPEN_TOKEN] = DELIVERY_RESULT_TOKENS;

/** The bounded provider page the truth read addresses. */
const TRUTH_PROVIDER_LIMIT = STATUS_SOURCE_ITEM_LIMIT;

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

const credentialRefusal = async (): Promise<{ readonly ok: false; readonly code: string }> => ({
  ok: false,
  code: PROVIDER_FAILURE,
});

const githubInstance = (): ExternalSystemInstance => ({
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

type RepositoryTarget = { readonly owner: string; readonly name: string };

const nativeTransport: NonNullable<GithubClientOptions["transport"]> = {
  send: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
};

const repositoryTargetOf = (originUrl: string | undefined): RepositoryTarget | undefined => {
  const parsed = parseGitHubRemote(originUrl);
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined;
};

/** The production caller principal the handover/resolution records carry. */
const DISPATCH_PRINCIPAL = LOCAL_CALLER_PRINCIPAL.kind;

/** The declared harness kinds, used to validate a persisted lane fact. */
const harnessKindOf = (value: string | undefined): HarnessKind | undefined =>
  value !== undefined && (HARNESS_KINDS as readonly string[]).includes(value)
    ? (value as HarnessKind)
    : undefined;

/** Construction facts the bin passes to the production composer. */
export type ProductionCompositionFacts = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
  readonly workingName: string;
  /**
   * The injected repository facts. Production reads the checkout's origin;
   * tests inject a fixed remote so composition is proven without a real origin.
   */
  readonly repositoryFacts?: { readonly originUrl?: string };
  /**
   * The injected harness spawn runner. Production uses the host runner; tests
   * inject a recording runner so composition is proven without a harness process.
   */
  readonly harnessSpawnRunner?: HarnessSpawnRunner;
  /**
   * The injected streaming spawn starter. Production uses the host starter; tests
   * inject a recording starter so composition is proven without a harness process.
   */
  readonly harnessSpawnStarter?: HarnessSpawnStarter;
  /**
   * The injected GitHub transport. Production uses native `fetch`; tests inject
   * a recording transport so the truth read is proven without network access.
   */
  readonly githubTransport?: GithubClientOptions["transport"];
  /**
   * The injected credential port. Production reads the process environment;
   * tests inject a port so a missing credential is proven without ambient state.
   */
  readonly credentials?: CredentialPort;
  /**
   * The injected git child runner. Production spawns the git binary; tests
   * inject branch and history facts without touching a checkout.
   */
  readonly gitChildRunner?: GitChildRunner;
  /** The supervisor's own process id (the bin supplies `process.pid`). */
  readonly processId?: number;
  /** The process signal subscription seam (the bin supplies the host process). */
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
};

/**
 * Compose the prompt-required program over the delivered adapters.
 *
 * The composed brand is supplied by the entrypoint, so the name seam has one
 * source; only the working name input is repeated for `createConfigProgram`'s
 * own brand check.
 */
export const createProductionComposer = (facts: ProductionCompositionFacts): EntrypointComposer => {
  return (brand: BrandIdentity) => {
    const environment = facts.environment;
    const cwd = facts.cwd;
    const ownProcessId = facts.processId ?? 0;
    const signalHost = facts.signalHost;
    const homeDirectory = trimTrailingSeparators(facts.homeDirectory);
    const stateDirectory = `${homeDirectory}/${brand.stateDirectoryName}`;
    const changesDirectory = `${cwd}/doc/changes`;
    // One git-root resolution for every configuration branch composition.
    const gitRootForConfig = (): string | undefined => findGitRoot(cwd, nodeRepositoryIo());
    const notesFs = nodePmNotesFileSystemFacts();
    const localFs = nodeFileSystemFacts();
    const nowIso = (): string => new Date().toISOString();
    const nowMs = (): number => Date.now();
    const newFenceToken = (): string => globalThis.crypto.randomUUID();
    const workspaceId = "default";

    const store = createStateStore(
      {
        level: "local",
        workspaceId,
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory,
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );
    const credentials = facts.credentials ?? createProcessCredentialPort(brand);
    const harnessCredentials = createEnvironmentCredentialPort({ environment, brand });
    const instance = githubInstance();
    const transport = facts.githubTransport ?? nativeTransport;
    const gitBranches = createGitBranchSeam({
      cwd,
      ...(facts.gitChildRunner === undefined ? {} : { childRunner: facts.gitChildRunner }),
    });
    // Resolve the checkout facts once per invocation. An injected origin replaces
    // only the remote; the checkout root always comes from the working directory,
    // so a composition test can never supply a synthetic root (DEC-2, DEC-5).
    const resolvedRepositoryFacts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
    const repositoryOriginUrl =
      facts.repositoryFacts === undefined
        ? resolvedRepositoryFacts.originUrl
        : facts.repositoryFacts.originUrl;
    const repositoryFacts = {
      ...(resolvedRepositoryFacts.root === undefined ? {} : { root: resolvedRepositoryFacts.root }),
      ...(repositoryOriginUrl === undefined ? {} : { originUrl: repositoryOriginUrl }),
    };
    // The identity binding is scoped to this checkout, not the shared per-user
    // state root: its marker lives in the checkout's git common directory, so
    // two repositories in one home never collide and a rename or remote change
    // of one checkout never re-keys another's evidence.
    const identityMarkerDirectory = resolveCheckoutGitDirectories({
      cwd,
      io: nodeRepositoryIo(),
    })?.commonDir;
    const target = repositoryTargetOf(repositoryFacts.originUrl);
    const repositoryKey =
      repositoryFacts.originUrl === undefined
        ? undefined
        : normalizeRepositoryKey(repositoryFacts.originUrl);
    // One total derivation: the binding is present only when the GitHub target,
    // the contention-domain key, and the resolved checkout root all resolve. Any
    // failed condition yields no binding at all, never a one-sided pair (F-1).
    const repositoryBinding =
      target !== undefined && repositoryKey !== undefined && repositoryFacts.root !== undefined
        ? { repository: repositoryKey, repositoryRoot: repositoryFacts.root }
        : undefined;
    const harnessSpawnRunner = facts.harnessSpawnRunner ?? createHostSpawnRunner();
    const harnessSpawnStarter = facts.harnessSpawnStarter ?? createHostSpawnStarter();
    const clientTarget = target ?? { owner: "unresolved", name: "unresolved" };
    const client = createGitHubClient({
      instance,
      credentials,
      repository: clientTarget,
      transport,
    });
    const pmContextPath = `${cwd}/.ai/local/pm-context.yaml`;

    const statusComposition = () => ({
      store,
      credentials,
      transport,
      repository: { cwd, io: nodeRepositoryIo() },
      localContext: { path: pmContextPath, fs: localFs },
      clock: { nowMs, nowIso },
      github: { instance },
    });
    const noChain = () => ({
      ok: true as const,
      config: { credentials: {}, entries: {}, chains: {} },
    });

    const plan = createPlanCommandRuntime({ changesDirectory, fs: notesFs });
    const verifyRuntime = createVerifyCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
    });
    const readChangeFolder = (changeRef: string): string | undefined =>
      relativeChangeFolder({
        changeRef,
        changesDirectory,
        repoRoot: cwd,
        fs: notesFs,
      });

    const commitOptions = createProductionCommitRuntimeOptions({
      store,
      changesDirectory,
      fs: notesFs,
      cwd,
      phaseCommit: true,
      nowIso,
      newFenceToken,
      readChangeFolder,
    });
    const phaseRuntime = createPhaseCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
      writeFile: (file, text) => {
        writeFileSync(file, text);
      },
      nowIso,
      newFenceToken,
      readChangeFolder,
    });
    const phaseExtension = createPhaseCommitExtension(commitOptions);
    const committedPhaseRuntime = { ...phaseRuntime, commit: phaseExtension };

    const lintRuntime = {
      readPmNotes: (changeRef: string) =>
        readPmNotesText({ changeRef, changesDirectory, fs: notesFs }),
      readRegistry: (changeRef: string) => {
        const read = readChangeTransitionsTolerant(store, changeRef);
        if (!read.ok) return { ok: false as const, error: read.error };
        return {
          ok: true as const,
          verifiedEmpty: read.value.verifiedEmpty,
          recordCount: read.value.evidence.recordCount,
          verification: read.value.evidence.verification,
          projection: { present: true },
        };
      },
      readPlan: plan.readPlan,
      parseYaml: plan.parseYaml,
    };

    const queueFacts = {
      plans: {},
      workItems: {},
      ci: {},
      provider: { state: "unavailable" as const, reason: "not-configured" as const },
      close: {},
      deploy: { expectations: {}, verdicts: {} },
    };
    const queueComposition = {
      store,
      facts: queueFacts,
      ...(repositoryBinding === undefined ? {} : { repositoryBinding }),
      nowIso,
      nowMs,
      newFenceToken,
      degraded: ["daemon-unreachable" as const],
      readyRuntime: createStatusCommandRuntime(statusComposition(), noChain),
    };

    const gates = createVerifyGatesCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
      repository: { cwd, io: nodeRepositoryIo() },
      workflow: { baseDirectory: cwd, fs: localFs },
      github: { instance, credentials, transport },
      nowMs,
    });

    const merge = createMergeCommandRuntime({
      store,
      git: createGitMergeSeam({ cwd }),
      values: () => ({}),
      readWorkItem: credentialRefusal,
      readCheckRuns: credentialRefusal,
      readRequestDetail: credentialRefusal,
      nowIso,
      nowMs,
      newFenceToken,
    });

    const closeout = createCloseoutComposition({
      workspaceId,
      provider: { kind: "github", client },
      git: gitBranches,
      store,
      nowIso,
      newFenceToken,
    });

    /** Map the resolved allowlist onto descriptor entries (names and references only). */
    const harnessEnvironmentEntries = (
      settings: HarnessSettings,
    ): readonly HarnessEnvironmentEntry[] =>
      settings.environment.map((entry) =>
        "credentialRef" in entry
          ? {
              kind: "credential" as const,
              name: entry.name,
              reference: {
                referenceName: entry.credentialRef,
                sourceKey: { style: "literal" as const, name: entry.credentialRef },
              },
            }
          : { kind: "variable" as const, name: entry.name },
      );

    /** The bound deny-by-default environment builder over the injected parent environment. */
    const buildHarnessEnvironment: HarnessEnvironmentBuilder = (descriptor) =>
      buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: environment,
        credentials: harnessCredentials,
        record: { DELIVERY_WORK_PATH: descriptor.workDirectory },
      });

    /** Build the delivered session port for one configured kind. */
    const harnessFor = (kind: HarnessKind): HarnessSessionPort => {
      const common = {
        runner: harnessSpawnRunner,
        buildEnvironment: buildHarnessEnvironment,
        classify: classifyHarnessEvidence,
        assembleLiveness: assembleHarnessLiveness,
        now: nowIso,
      };
      return kind === "opencode"
        ? createOpencodeSession({
            ...common,
            starter: harnessSpawnStarter,
            command: "opencode",
            spawnArgs: ["run", "--format", "json"],
            resumeArgs: ["run", "--format", "json", "--session"],
            listArgs: ["session", "list", "--format", "json"],
          })
        : createClaudeSession({
            ...common,
            command: "claude",
            headlessArgs: ["--print", "--output-format", "json"],
          });
    };

    const phaseSummary = (changeRef: string): DispatchPhaseLedger => {
      const transitions = readChangeTransitionsTolerant(store, changeRef);
      const completed = transitions.ok
        ? Object.values(foldPhaseState(changeRef, transitions.value.transitions).phases).filter(
            (phase) => phase.completed !== null,
          ).length
        : 0;
      let total = completed;
      let variant: DispatchLedgerVariant = "unknown";
      const artifact = plan.readPlan(changeRef);
      if (artifact.ok) {
        const parsed = plan.parseYaml(artifact.text);
        if (parsed.ok) {
          const phases = (parsed.value as { readonly phases?: unknown }).phases;
          if (Array.isArray(phases)) {
            total = Math.max(phases.length, completed);
            variant = "full";
          }
        }
      }
      return { completed, total, variant };
    };

    /**
     * The persisted first-use repository identity, resolved through the delivered
     * policy (persisted marker, scheduler key, normalized remote — in that order
     * of authority). The binding is scoped to this checkout's git common
     * directory and is created only by a dispatch operating on this checkout, so
     * a read-only gate read never binds an arbitrary `--repo` argument and a
     * later rename or remote change never re-keys history (AC-F6-2, AC-F6-6).
     * The marker write is atomic, and a marker that carries no binding is
     * repaired rather than left permanently unreadable.
     */
    const resolveProductionRepository = (
      schedulerKey: string | undefined,
      options: { readonly persist: boolean },
    ): string | undefined => {
      const persistedMarker = readDispatchIdentityMarkerText(identityMarkerDirectory);
      const resolution = resolveDispatchIdentity({
        ...(schedulerKey === undefined ? {} : { schedulerKey }),
        ...(repositoryFacts.originUrl === undefined
          ? {}
          : { remoteUrl: repositoryFacts.originUrl }),
        ...(persistedMarker === undefined ? {} : { persistedMarker }),
      });
      if (!resolution.ok) return undefined;
      if (options.persist) {
        // Persist the binding. A marker that carries no binding (torn, empty,
        // or otherwise unparseable) is repaired in place, because create-once
        // alone would keep the torn content forever. An unpersistable marker
        // never changes the resolved identity, so the caller still records
        // under the same key.
        const serialized = serializeIdentityMarker(resolution.repository);
        if (persistedMarker === undefined) {
          ensureDispatchIdentityMarkerText(identityMarkerDirectory, serialized);
        } else if (resolution.source !== "marker") {
          replaceDispatchIdentityMarkerText(identityMarkerDirectory, serialized);
        }
      }
      return resolution.repository;
    };

    /** The scheduling engine's declared key for a ref, when one is queued. */
    const schedulerKeyForRef = (ref: string): string | undefined => {
      const entries = readQueueEntries(store);
      return entries.ok ? entries.latest.find((entry) => entry.ref === ref)?.repository : undefined;
    };

    /**
     * Normalize a command argument into a scheduler key. A full
     * `host/owner/name`, a VCS remote, or a bare `owner/name` (the remote's host
     * supplies the missing component) all resolve; anything else does not.
     */
    const schedulerKeyOf = (repo: string): string | undefined => {
      const direct = normalizeDispatchRepositoryKey(repo);
      if (direct !== undefined) return direct;
      const remote = normalizeRepositoryRemote(repo);
      if (remote !== undefined) return remote;
      const parts = repo
        .trim()
        .replace(/\.git$/iu, "")
        .split("/");
      if (parts.length !== 2) return undefined;
      const host =
        normalizeRepositoryRemote(repositoryFacts.originUrl)?.split("/")[0] ?? "github.com";
      return normalizeDispatchRepositoryKey(`${host}/${parts[0]}/${parts[1]}`);
    };

    /** The completed phase identifiers of a change, from the folded registry. */
    const completedPhaseIds = (ref: string): readonly string[] => {
      const transitions = readChangeTransitionsTolerant(store, ref);
      if (!transitions.ok) return [];
      return Object.entries(foldPhaseState(ref, transitions.value.transitions).phases)
        .filter(([, state]) => state.completed !== null)
        .map(([phaseId]) => phaseId);
    };

    /**
     * The delivered lane facts a resume admits against: the latest resumable
     * daemon lane record's session, the folded phase ledger position, the
     * adapter's resume-injection capability, and the recorded restart count.
     */
    const laneFactsFor = (ref: string, defaultKind: HarnessKind): DispatchLaneFacts | undefined => {
      const lanes = readDaemonLanes(store);
      if (!lanes.ok) return undefined;
      const latest = [...lanes.records]
        .reverse()
        .find(
          (lane) =>
            lane.ref === ref &&
            lane.sessionId !== undefined &&
            (lane.state === "delivering" ||
              lane.state === "detached" ||
              lane.state === "preempted"),
        );
      if (latest?.sessionId === undefined) return undefined;
      const kind = harnessKindOf(latest.harnessKind) ?? defaultKind;
      const restarts = readEconomicsRecords(store, ref);
      return {
        handle: {
          harnessKind: kind,
          sessionId: latest.sessionId,
          treeRoot: cwd,
          workItemRef: ref,
        },
        completedPhases: completedPhaseIds(ref),
        adapterSupportsResumeInjection: kind === "opencode",
        restartCount: restarts.ok ? restarts.restarts.length : Math.max(0, latest.spawnOrdinal - 1),
      };
    };

    /**
     * The provider web base, derived from the declared API base: the two
     * provider addressings GitHub publishes differ only by the API prefix.
     */
    const providerWebBase = (): string =>
      trimTrailingSeparators(instance.baseUrl)
        .replace(/\/api\/v3$/u, "")
        .replace(/\/\/api\./u, "//");

    /**
     * The pull-request web address, or `undefined` when the resolved
     * repository binding or the provider entity id cannot address one.
     */
    const pullRequestUrl = (entityId: string): string | undefined => {
      if (target === undefined || !/^[0-9]+$/u.test(entityId)) return undefined;
      return `${providerWebBase()}/${target.owner}/${target.name}/pull/${entityId}`;
    };

    /** The change's local branch and head; an unreadable history is classified. */
    const readChangeBranch = async (
      changeRef: string,
    ): Promise<
      { readonly branch?: string; readonly head?: string } | { readonly identity: string }
    > => {
      try {
        const branches = await gitBranches.listBranches({ workItemRef: changeRef });
        const found = branches[0];
        return found === undefined ? {} : { branch: found.name, head: found.head };
      } catch {
        return { identity: "git.branch.read-failed" };
      }
    };

    /** One pull-request truth: the observed fact plus the head the CI read addresses. */
    type PullTruth = {
      readonly fact: DispatchPrFact;
      readonly headSha?: string;
      readonly targetRef?: string;
    };

    type TruthFailure = { readonly ok: false; readonly identity: string };
    type TruthSuccess<T> = { readonly ok: true; readonly value: T };

    /**
     * The pull-request truth: an open request whose head is the change branch
     * first, then an already-merged request for the same ref. Neither the open
     * nor the merged read may be silently degraded to a narrower fact.
     *
     * The delivered client exposes the open-request list and the merged-request
     * lookup only, so a closed-unmerged request is not observable: it reads as
     * no request, which the derivation treats the same as `closed`.
     */
    const readPullTruth = async (
      changeRef: string,
      branch: string | undefined,
    ): Promise<TruthSuccess<PullTruth> | TruthFailure> => {
      if (target === undefined) return { ok: false, identity: "address-unresolved" };
      const open = await client.listDeliveryRequests(TRUTH_PROVIDER_LIMIT);
      if (!open.ok) return { ok: false, identity: open.code };
      const openMatch =
        branch === undefined
          ? undefined
          : open.value.items.find((item) => item.sourceRef === branch);
      if (openMatch !== undefined) {
        const url = pullRequestUrl(openMatch.identity.entityId);
        return {
          ok: true,
          value: {
            fact: {
              state: "open",
              url: url ?? null,
              mergeReady: openMatch.mergeableState === "mergeable",
            },
            targetRef: openMatch.targetRef,
            ...(openMatch.sourceHeadSha === undefined ? {} : { headSha: openMatch.sourceHeadSha }),
          },
        };
      }
      const merged = await client.findMergedDeliveryRequest({
        workItemRef: changeRef,
        limit: TRUTH_PROVIDER_LIMIT,
      });
      if (merged.observation === "invalid") {
        return { ok: false, identity: "provider.payload.invalid" };
      }
      const mergedMatch =
        merged.observation === "observed" &&
        (branch === undefined || merged.value.sourceRef === branch)
          ? merged.value
          : undefined;
      if (mergedMatch !== undefined) {
        const url = pullRequestUrl(mergedMatch.identity.entityId);
        const headSha = mergedMatch.sourceHeadSha ?? mergedMatch.headSha;
        return {
          ok: true,
          value: {
            fact: { state: "already-merged", url: url ?? null, mergeReady: false },
            targetRef: mergedMatch.targetRef,
            ...(headSha === undefined ? {} : { headSha }),
          },
        };
      }
      return { ok: true, value: { fact: { state: "none", url: null, mergeReady: false } } };
    };

    /**
     * The change branch's commit count ahead of the request's target (or the
     * declared integration base). A target that does not resolve locally falls
     * back to the branch's reachable count, so the zero-artifact predicate
     * stays truthful: the branch has no commits only when it has none.
     */
    const readBranchCommits = async (
      branch: string | undefined,
      pull: PullTruth,
    ): Promise<TruthSuccess<number> | TruthFailure> => {
      if (branch === undefined) return { ok: true, value: 0 };
      const since = pull.targetRef ?? CLOSEOUT_INTEGRATION_BASE;
      const ahead = await gitBranches.countCommits({ ref: branch, since });
      if (ahead !== undefined) return { ok: true, value: ahead };
      const reachable = await gitBranches.countCommits({ ref: branch });
      return reachable === undefined
        ? { ok: false, identity: "git.commit-count.unreadable" }
        : { ok: true, value: reachable };
    };

    /** The tracker truth: native done state and the owner-attention label set. */
    const readTrackerTruth = async (
      changeRef: string,
    ): Promise<TruthSuccess<DispatchTrackerFacts> | TruthFailure> => {
      const issueNumber = /^[A-Za-z]+-([0-9]+)$/u.exec(changeRef)?.[1];
      if (issueNumber === undefined || target === undefined) {
        return { ok: false, identity: "address-unresolved" };
      }
      const read = await client.readWorkItem(Number(issueNumber));
      if (!read.ok) return { ok: false, identity: read.code };
      const blocking = read.value.labels.some((label) =>
        (STATUS_OWNER_ATTENTION_LABELS as readonly string[]).includes(label),
      );
      const state: DispatchTrackerFacts["state"] =
        read.value.status.deliveryState === "done"
          ? "done"
          : blocking
            ? "delivery-blocked"
            : "in-progress";
      return { ok: true, value: { state, blocking } };
    };

    /**
     * The CI verdict on the pushed head, projected from the delivered check-run
     * facts. The declared gates battery answers the pre-merge question ("is the
     * gate green for the open request"); dispatch asks the weaker, also
     * post-merge-safe question "did the checks on this head succeed", so the
     * projection of the same `PipelineJobState` vocabulary lives here.
     */
    const ciVerdictOf = (
      runs: readonly PipelineRun[],
    ): "success" | "failure" | "pending" | "canceled" | "absent" => {
      const states = runs.flatMap((run) => run.jobs.map((job) => job.jobState));
      if (states.includes("failed")) return "failure";
      if (states.length === 0) return "absent";
      if (states.some((state) => state === "running" || state === "queued")) return "pending";
      if (states.includes("canceled")) return "canceled";
      return states.every((state) => state === "succeeded" || state === "skipped")
        ? "success"
        : "absent";
    };

    /** The CI read: the verdict on the pushed head, or its named absence. */
    const readCiTruth = async (
      headSha: string | undefined,
    ): Promise<DispatchRead<{ readonly verdict: "success" | "failure" }>> => {
      if (headSha === undefined) {
        return { ok: false, reason: "state", identity: "ci.head-unresolved" };
      }
      const read = await client.readPipelineRun(headSha, VERIFY_GATES_CI_RUN_LIMIT);
      if (!read.ok) return { ok: false, reason: "state", identity: read.code };
      const verdict = ciVerdictOf(read.value.items);
      if (verdict === "success") return { ok: true, value: { verdict: "success" } };
      if (verdict === "failure") return { ok: true, value: { verdict: "failure" } };
      return { ok: false, reason: "state", identity: `ci.${verdict}` };
    };

    /** The verify-change ledger outcome for the ref, over the real notes and ledger. */
    const readVerifyOutcome = (changeRef: string): DeliveryResultToken => {
      const notes = verifyRuntime.readPmNotes(changeRef);
      const document: VerifyDocumentClassification = notes.ok
        ? classifyVerifyDocument({ ok: true, value: notes.value })
        : notes.reason === "missing"
          ? {
              ok: false,
              kind: "lint",
              code: "lint.target.missing",
              summary: "result=failed; variant=unknown; missing=-",
            }
          : classifyVerifyDocument({ ok: false, parseFailure: notes.parseFailure });
      return EvaluateVerifyChange({
        changeRef,
        document,
        registry: verifyRuntime.readRegistry(changeRef),
      }).outcome;
    };

    /**
     * The independently derived tracker-family token for the same facts. An open
     * request is the tracker truth `pr-open` regardless of URL resolution; the
     * concrete address is the engine-side `urlResolved` attribute, so a
     * `pr-open-unverified` claim compares against an independent baseline.
     */
    const trackerTokenOf = (
      tracker: DispatchTrackerFacts,
      pr: DispatchPrFact,
    ): DeliveryResultToken | null => {
      if (tracker.blocking || tracker.state === "delivery-blocked") return PR_BLOCKED_TOKEN;
      if (pr.state === "already-merged") return PR_MERGED_TOKEN;
      if (pr.state === "open") return PR_OPEN_TOKEN;
      return null;
    };

    /**
     * The production truth read.
     *
     * Every source is the real one: the local change branch and its commits, the
     * GitHub-bound pull request and work item, the CI verdict on the pushed head,
     * the verify-change ledger outcome, and the tracker token derived from those
     * facts. A source that genuinely fails keeps its classified identity and the
     * dispatch classifies `state-unverified`; no read is fabricated or silently
     * narrowed.
     */
    const dispatchTruth = async (changeRef: string): Promise<DispatchTruthReads> => {
      const summary = phaseSummary(changeRef);
      const transitions = readChangeTransitionsTolerant(store, changeRef);
      const ledger: DispatchRead<DispatchLedgerFacts> = transitions.ok
        ? {
            ok: true,
            value: {
              completed: summary.completed,
              total: summary.total,
              progressed: summary.completed > 0,
              workRemaining: summary.completed < summary.total,
            },
          }
        : { ok: false, reason: "ledger", identity: transitions.error.code };

      const branch = await readChangeBranch(changeRef);
      const pull = await readPullTruth(changeRef, "identity" in branch ? undefined : branch.branch);
      const trackerRead = await readTrackerTruth(changeRef);

      let artifacts: DispatchRead<DispatchArtifactFacts>;
      if ("identity" in branch) {
        artifacts = { ok: false, reason: "artifact", identity: branch.identity };
      } else if (!pull.ok) {
        artifacts = { ok: false, reason: "artifact", identity: pull.identity };
      } else {
        const commits = await readBranchCommits(branch.branch, pull.value);
        artifacts = commits.ok
          ? { ok: true, value: { branchCommits: commits.value, pr: pull.value.fact } }
          : { ok: false, reason: "artifact", identity: commits.identity };
      }

      const headSha = pull.ok ? pull.value.headSha : "identity" in branch ? undefined : branch.head;
      const tracker: DispatchRead<DispatchTrackerFacts> = trackerRead.ok
        ? { ok: true, value: trackerRead.value }
        : { ok: false, reason: "tracker", identity: trackerRead.identity };

      return {
        artifacts,
        ledger,
        tracker,
        ci: await readCiTruth(headSha),
        verifyOutcome: readVerifyOutcome(changeRef),
        trackerToken:
          trackerRead.ok && pull.ok ? trackerTokenOf(trackerRead.value, pull.value.fact) : null,
        phasesComplete: summary.total > 0 && summary.completed >= summary.total,
      };
    };

    /**
     * The cancellable cadence timer: the composition owns the real timer, so a
     * finished session cancels the pending wait instead of holding the process.
     */
    const waitForCadence = (
      cadenceMs: number,
    ): { readonly promise: Promise<void>; readonly cancel: () => void } => {
      let cancel = (): void => {};
      const promise = new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          resolve();
        }, cadenceMs);
        const unref = (timer as { readonly unref?: () => void }).unref;
        if (typeof unref === "function") unref.call(timer);
        cancel = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      return { promise, cancel };
    };

    const dispatchComposition = (
      settings: HarnessSettings,
      lane: LaneSettings,
      repository: string,
    ): DispatchComposition => ({
      store,
      stateRoot: stateDirectory,
      fenceToken: newFenceToken(),
      nowIso,
      newAttemptId: (ref) => `attempt-${ref}-${nowMs()}-${newFenceToken()}`,
      newDivergenceId: (ref) => `DIV-${ref}-${newFenceToken()}`,
      harnesses: { opencode: harnessFor("opencode"), "claude-code": harnessFor("claude-code") },
      defaultHarness: settings.kind,
      descriptor: {
        kind: settings.executionKind,
        workDirectory: cwd,
        environment: harnessEnvironmentEntries(settings),
      },
      prompt: (ref) => `Deliver change ${ref} through the delivery lifecycle.`,
      evidenceClass: DISPATCH_DEFAULT_EVIDENCE_CLASS,
      repository: () => repository,
      readTruth: dispatchTruth,
      claimLease: (ref) => {
        const claimed = claimQueueLease(store, {
          ref,
          holder: "dispatch",
          runner: "dispatch",
          weightClass: "standard",
          nowIso: nowIso(),
          nowMs: nowMs(),
          fenceToken: newFenceToken(),
        });
        return claimed.ok
          ? { ok: true, leaseId: claimed.value.lease.leaseId }
          : { ok: false, code: claimed.code };
      },
      releaseLease: (ref) => {
        const released = releaseQueueLease(store, {
          ref,
          holder: "dispatch",
          nowIso: nowIso(),
          nowMs: nowMs(),
          fenceToken: newFenceToken(),
        });
        return released.ok;
      },
      phaseLedger: phaseSummary,
      // The lane policy is data: both the restart bound and the liveness cadence
      // come from the typed `lane` configuration branch.
      restartBudget: lane.restartBudget,
      restartCount: (ref) => {
        const restarts = readEconomicsRecords(store, ref);
        return restarts.ok ? restarts.restarts.length : 0;
      },
      livenessIntervalMs: lane.livenessIntervalMs,
      waitForCadence,
      existingLane: (ref) => laneFactsFor(ref, settings.kind),
      ensureRestartExhaustion: ({ ref, runId, restarts, recordedAt }) => {
        const ensured = ensureEconomicsExhaustionRecord(store, newFenceToken(), {
          schemaId: ECONOMICS_EXHAUSTION_SCHEMA_ID,
          workItemRef: ref,
          runId,
          reason: "dispatch.restart-budget-exceeded",
          restarts,
          historyRef: `economics/${ref}`,
          terminal: true,
          options: [...ECONOMICS_EXHAUSTION_OPTIONS],
          recordedAt,
        });
        return ensured.ok;
      },
      gate: {
        scope: "production",
        principal: DISPATCH_PRINCIPAL,
        resolveRepository: (repo) =>
          resolveProductionRepository(schedulerKeyOf(repo), { persist: false }),
      },
    });

    /** Resolve the typed harness and lane configuration branches. */
    const resolveProductionHarnessSettings = ():
      | { readonly ok: true; readonly settings: HarnessSettings; readonly lane: LaneSettings }
      | { readonly ok: false; readonly code: string } => {
      const gitRoot = gitRootForConfig();
      const acquired = acquireFileConfig({
        platform: runtimePlatform(),
        homeDirectory,
        environment,
        ...(gitRoot === undefined ? {} : { gitRoot }),
        enableSystemConfig: true,
        enableUserConfig: true,
        enableProjectLocalConfig: true,
        configurationDirectoryName: brand.configDirectoryName,
        fs: localFs,
      });
      if (!acquired.ok) return { ok: false, code: acquired.error.code };
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return { ok: false, code: resolved.error.code };
      const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
      if (!settings.ok) return { ok: false, code: settings.error.code };
      const lane = resolveLaneSettings(resolved.value.values, resolved.value.origins);
      return lane.ok
        ? { ok: true, settings: settings.value, lane: lane.value }
        : { ok: false, code: lane.error.code };
    };

    // The dispatch run surface resolves the typed configuration per invocation,
    // composes both delivered session ports over the host runner, and declares the
    // production evidence class. The evidence-gate surfaces need no harness
    // settings, so they are composed once over the same store and resolver.
    const dispatch: DispatchCommandRuntime = {
      ...createDispatchGateRuntime({
        store,
        stateRoot: stateDirectory,
        fenceToken: newFenceToken(),
        nowIso,
        gate: {
          scope: "production",
          principal: DISPATCH_PRINCIPAL,
          resolveRepository: (repo) =>
            resolveProductionRepository(schedulerKeyOf(repo), { persist: false }),
        },
      }),
      run: {
        run: async (input) => {
          const resolution = resolveProductionHarnessSettings();
          if (!resolution.ok) {
            return {
              ok: false,
              error: {
                kind: "input",
                code: resolution.code,
                summary: `harness configuration rejected (${resolution.code})`,
              },
            };
          }
          const repository = resolveProductionRepository(schedulerKeyForRef(input.ref), {
            persist: true,
          });
          if (repository === undefined) {
            return {
              ok: false,
              error: {
                kind: "input",
                code: "input.value.rejected",
                summary: "repository identity is unresolvable",
              },
            };
          }
          return createDispatchCommandRuntime(
            dispatchComposition(resolution.settings, resolution.lane, repository),
          ).run.run(input);
        },
      },
    };

    /**
     * Resolve the typed `coordinator` configuration branch. The shipped
     * defaults close the malformed-config case so the prompt-required command
     * surface always composes; the coordinator still reads its own resolved
     * values for every decision.
     */
    const defaultCoordinatorSettings = (): CoordinatorSettings => ({
      stuckWindowMs: PRODUCTION_DEFAULTS.coordinator["stuck-window"],
      killGraceMs: PRODUCTION_DEFAULTS.coordinator["kill-grace"],
      restartBudget: PRODUCTION_DEFAULTS.coordinator["restart-budget"],
      resumeContextLimit: PRODUCTION_DEFAULTS.coordinator["resume-context-limit"],
      collectionIntervalMs: PRODUCTION_DEFAULTS.coordinator["collection-interval"],
      progressBoundMs: PRODUCTION_DEFAULTS.coordinator["progress-bound"],
    });

    const resolveProductionCoordinatorSettings = (): CoordinatorSettings => {
      const gitRoot = gitRootForConfig();
      const acquired = acquireFileConfig({
        platform: runtimePlatform(),
        homeDirectory,
        environment,
        ...(gitRoot === undefined ? {} : { gitRoot }),
        enableSystemConfig: true,
        enableUserConfig: true,
        enableProjectLocalConfig: true,
        configurationDirectoryName: brand.configDirectoryName,
        fs: localFs,
      });
      if (!acquired.ok) return defaultCoordinatorSettings();
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return defaultCoordinatorSettings();
      const settings = resolveCoordinatorSettings(resolved.value.values, resolved.value.origins);
      return settings.ok ? settings.value : defaultCoordinatorSettings();
    };

    /**
     * Compose the coordinator command family over the delivered adapters
     * (GH-241 F-1/F-6/F-7/F-10): the shared state store, injected clock and id
     * factories, the resolved coordinator settings, the node process port with
     * its start-time identity capability, the recorded harness-session facts,
     * the declared session effects, and the real cycle driver. The session
     * facts come from the delivered daemon lane ledger; absent facts stay
     * `unknown` rather than being fabricated.
     */
    const createProductionCoordinatorComposition = (): CoordinatorComposition => {
      const settings = resolveProductionCoordinatorSettings();
      const processPort = createNodeProcessPort();
      const ownStartTimeMs = (): number | undefined => processPort.startTimeMs?.(ownProcessId);

      const readCoordinatorSession = (): CoordinatorSessionFacts => {
        const lanes = readDaemonLanes(store);
        const lane = lanes.ok ? lanes.latest : undefined;
        const pid = lane?.processId ?? null;
        const observedStartTime = pid === null ? undefined : processPort.startTimeMs?.(pid);
        const liveness: CoordinatorSessionFacts["liveness"] =
          pid === null ? "unknown" : processPort.isAlive(pid) ? "alive" : "absent";
        return {
          sessionId: lane?.sessionId ?? null,
          liveness,
          contextTokens: null,
          harnessKind: lane?.harnessKind ?? "opencode",
          completedCleanly: lane?.state === "completed",
          resumable: (lane?.sessionId ?? null) !== null,
          resumeDeclared: false,
          pid,
          processStartTimeMs: observedStartTime ?? null,
        };
      };

      const wait = (ms: number): Promise<void> =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, ms);
          const unref = (timer as { readonly unref?: () => void }).unref;
          if (typeof unref === "function") unref.call(timer);
        });

      return {
        store,
        clock: { nowMs, nowIso },
        newFenceToken,
        newId: (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`,
        coordinatorId: "coordinator-main",
        stateDirectory,
        settings,
        processPort: {
          port: processPort,
          capabilities: {
            alive: true,
            killWithGrace: true,
            startTimeIdentity: typeof processPort.startTimeMs === "function",
          },
          probe: ({ pid, processStartTimeMs }) => {
            if (!processPort.isAlive(pid)) return false;
            const observed = processPort.startTimeMs?.(pid);
            if (observed === undefined) return null;
            return observed === processStartTimeMs;
          },
          ownIdentity: () => {
            const start = ownStartTimeMs();
            return start === undefined ? null : { pid: ownProcessId, processStartTimeMs: start };
          },
          wait,
          // Production has no composed sourced-progress adapter for the
          // coordinator session; absence is the honest `unknown` class.
          progress: () => ({ newTurn: "unknown" as const, observedAtMs: null }),
        },
        session: {
          read: readCoordinatorSession,
          apply: (effect) =>
            effect === "attach"
              ? { ok: true as const }
              : { ok: false as const, code: "harness.capability.gap" },
          wake: (effect) => ({ ok: effect === "live" }),
        },
        loop: {
          run: async (onCycle) => {
            let signalled = false;
            const onSignal = (): void => {
              signalled = true;
            };
            signalHost?.once("SIGINT", onSignal);
            signalHost?.once("SIGTERM", onSignal);
            try {
              for (;;) {
                if (signalled) return "signal";
                const outcome = await onCycle();
                if (outcome === "stop") return "stopped";
                if (signalled) return "signal";
                await wait(settings.collectionIntervalMs);
              }
            } finally {
              signalHost?.removeListener("SIGINT", onSignal);
              signalHost?.removeListener("SIGTERM", onSignal);
            }
          },
        },
      };
    };

    const configured: ConfigProgramOptions = {
      workingName: facts.workingName,
      environment,
      cwd,
      homeDirectory,
      lint: lintRuntime,
      plan: { changesDirectory, fs: notesFs, readDiff: plan.readDiff },
      phase: committedPhaseRuntime,
      commit: commitOptions,
      status: statusComposition(),
      brief: statusComposition(),
      queueReady: statusComposition(),
      queue: queueComposition,
      lanes: queueComposition,
      blockers: {
        store,
        clock: { nowMs, nowIso },
        newFenceToken,
      },
      dispatch,
      verify: {
        ...verifyRuntime,
        gates,
        deploy: createVerifyDeployCommandRuntime({
          resolve: async () => ({ ok: false, kind: "no-target" }),
          github: {
            instance,
            credentials,
            transport,
            repository: clientTarget,
          },
        }),
      },
      merge,
      closeout,
      spend: {
        store,
        localContext: { path: pmContextPath, fs: localFs },
      },
      retro: {
        store,
        stateDirectory,
        workspaceId,
        changesDirectory,
        fs: notesFs,
        clock: { nowMs, nowIso },
        newRunId: () => globalThis.crypto.randomUUID(),
        newTraceId: () => globalThis.crypto.randomUUID(),
        newFenceToken,
      },
      coordinator: createProductionCoordinatorComposition(),
    };

    const program = createConfigProgram(configured);
    if (!program.ok) {
      throw new Error(`brand resolution failed: ${program.error.field}:${program.error.code}`);
    }
    return program.program;
  };
};
