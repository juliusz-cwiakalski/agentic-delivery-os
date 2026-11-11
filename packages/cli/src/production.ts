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
  resolveCredentialSourceKey,
} from "@delivery-os/adapters/credentials";
import { createNodeProcessPort, createUnixTransport } from "@delivery-os/adapters/daemon";
import {
  acquireFileConfig,
  ensureDispatchIdentityMarkerText,
  nodeFileSystemFacts,
  nodeOwnerHoldMarkerFileSystem,
  nodePmNotesFileSystemFacts,
  readDispatchIdentityMarkerText,
  readOwnerHoldMarker,
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
import {
  CLAUDE_CAPABILITIES,
  createClaudeSession,
  createOpencodeSession,
  mapCoordinatorNewTurn,
} from "@delivery-os/adapters/harness";
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
  type DispatchPreflightError,
  type DispatchPreflightResult,
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
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
  readQueueEntries,
  releaseQueueLease,
  resolveConfig,
  resolveCoordinatorSettings,
  resolveDaemonSettings,
  resolveDispatchIdentity,
  resolveHarnessSettings,
  resolveLaneSettings,
  resolveOwnerHoldFact,
  resolveStateDirectoryScope,
  serializeIdentityMarker,
  type VerifyDocumentClassification,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  CLOSEOUT_INTEGRATION_BASE,
  type ConfigNodeOrigins,
  type ConfigValue,
  type QueueDegradationReason,
  type CoordinatorProgressState,
  type CredentialPort,
  type CredentialReference,
  type DaemonSettings,
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
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessKind,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type HarnessSpawnRunner,
  type HarnessSpawnStarter,
  LOCAL_CALLER_PRINCIPAL,
  type OwnerHoldFact,
  type PipelineRun,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_SOURCE_ITEM_LIMIT,
  type SupervisorPort,
  VERIFY_GATES_CI_RUN_LIMIT,
} from "@delivery-os/core/contracts";
import {
  createDaemonLockPort,
  createNodeStateEdge,
  createStateStore,
  ensureEconomicsExhaustionRecord,
  foldPhaseState,
  readChangeTransitionsTolerant,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import type { CoordinatorSessionFacts } from "./commands/coordinator-loop.js";
import type { DaemonCommandRuntime } from "./commands/daemon.js";
import { createDaemonCommandRuntime } from "./daemon-compose.js";
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
import { workingNameEnvironmentVariable } from "./entrypoint.js";

const PROVIDER_FAILURE = "config.credential.missing";

/**
 * The tracker-family tokens the truth read derives, resolved from the one
 * taxonomy: `merged`, `blocked`, `pr-open`.
 */
const [PR_MERGED_TOKEN, PR_BLOCKED_TOKEN, PR_OPEN_TOKEN] = DELIVERY_RESULT_TOKENS;

/** The bounded provider page the truth read addresses. */
const TRUTH_PROVIDER_LIMIT = STATUS_SOURCE_ITEM_LIMIT;

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

/** The exact `<PREFIX>_STATE_DIR` variable the state-directory resolution reads. */
const stateDirectoryEnvironmentName = (environmentPrefix: string): string =>
  `${environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`;

/** The user configuration root the supervisor adapter writes the unit under. */
const supervisorConfigDirectoryFor = (input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory: string;
}): string | undefined => {
  const configured = input.environment.XDG_CONFIG_HOME;
  if (configured !== undefined && configured.length > 0 && configured.startsWith("/")) {
    return trimTrailingSeparators(configured);
  }
  // The home-based root applies only when a home exists; with neither an
  // absolute override nor a home the root is unresolvable, and `daemon install`
  // refuses rather than deriving a root-level path (AC-F7-2, DM-6).
  return input.homeDirectory.length === 0 ? undefined : `${input.homeDirectory}/.config`;
};

/** The daemon family's delivered `config.value.invalid` refusal identity. */
const daemonConfigurationRefusal = (): {
  readonly error: { readonly kind: string; readonly code: string };
} => ({ error: { kind: "config", code: "config.value.invalid" } });

/** The daemon family's one state-directory classification (DM-5, DEC-18). */
type DaemonStateDirectory =
  | { readonly kind: "resolved"; readonly directory: string }
  | { readonly kind: "unresolvable" };

const classifyDaemonStateDirectory = (input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix: string;
  readonly stateDirectoryName: string;
  readonly homeDirectory: string;
}): DaemonStateDirectory => {
  const scope = resolveStateDirectoryScope({
    environment: input.environment,
    environmentPrefix: input.environmentPrefix,
    stateDirectoryName: input.stateDirectoryName,
    homeDirectory: input.homeDirectory,
  });
  if (scope.ok) return { kind: "resolved", directory: scope.value };
  // A non-absolute override keeps the delivered home-based value; with no home
  // the directory is unresolvable and no root-level path is ever derived.
  return input.homeDirectory.length === 0
    ? { kind: "unresolvable" }
    : { kind: "resolved", directory: `${input.homeDirectory}/${input.stateDirectoryName}` };
};

/**
 * The durable DM-4 reachability predicate (AC-F5-1..AC-F5-8): reachable iff an
 * instance record exists, its latest operation is an acquisition, the latest
 * heartbeat belongs to that instance, and its age is STRICTLY below the
 * configured lock-staleness bound. Everything else — including an unreadable or
 * torn read — is unreachable. It performs no socket connect, no process probe,
 * and no sleep.
 */
export const daemonReachable = (input: {
  readonly store: ReturnType<typeof createStateStore>;
  readonly nowMs: number;
  readonly lockStalenessMs: number;
}): boolean => {
  try {
    const instance = readDaemonInstance(input.store);
    if (!instance.ok || instance.latest === undefined) return false;
    const latest = instance.latest;
    if (latest.operation !== "acquired" && latest.operation !== "taken-over") return false;
    const heartbeat = readDaemonHeartbeat(input.store);
    if (!heartbeat.ok || heartbeat.latest === undefined) return false;
    if (heartbeat.latest.instanceId !== latest.instanceId) return false;
    const ageMs = input.nowMs - Date.parse(heartbeat.latest.beatAt);
    return ageMs < input.lockStalenessMs;
  } catch {
    return false;
  }
};

/**
 * The unavailable daemon runtime for the unresolvable state-directory outcome.
 *
 * It constructs no store, lock, settings, transport, socket path, supervisor
 * scope, entry path, or pid, attempts no spawn, and answers every subcommand
 * with the delivered `config.value.invalid` identity at exit `1`.
 */
const unavailableDaemonRuntime = (): DaemonCommandRuntime => {
  const refuse = daemonConfigurationRefusal;
  return {
    start: async () => refuse(),
    stop: async () => refuse(),
    status: async () => refuse(),
    install: async () => refuse(),
    uninstall: async () => refuse(),
  };
};

const credentialRefusal = async (): Promise<{ readonly ok: false; readonly code: string }> => ({
  ok: false,
  code: PROVIDER_FAILURE,
});

/** The declared truth-read credential reference (names only, never material). */
const githubReadReference: CredentialReference = {
  referenceName: "github-read",
  sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
};

/**
 * The declared credential references whose resolved values the runtime edge
 * registers for serialization redaction.
 */
export const DECLARED_CREDENTIAL_REFERENCES: readonly CredentialReference[] = [githubReadReference];

const githubInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: githubReadReference,
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
   * The injected provider instance. Production uses the declared `github-read`
   * reference; tests may inject a prefixed reference to prove key derivation.
   */
  readonly githubInstance?: ExternalSystemInstance;
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
  /**
   * The process signal subscription seam (the bin supplies the host process).
   */
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
  /**
   * The running entry path (the bin supplies `process.argv[1]`), so the detached
   * child and the installed unit name the same executable.
   */
  readonly daemonEntry?: string;
  /** A pass-through supervisor seam so install is provable without a live systemd. */
  readonly supervisor?: SupervisorPort;
  /**
   * The recorded coordinator session facts override. Production derives them
   * from the delivered lane ledger; tests and embedders may inject the same
   * shape without spawning a harness.
   */
  readonly coordinatorSessionFacts?: () => CoordinatorSessionFacts;
  /** The foreground loop wait override; production uses the resolved interval. */
  readonly coordinatorCollectionIntervalMs?: number;
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
    const homeBasedStateDirectory = `${homeDirectory}/${brand.stateDirectoryName}`;
    // The daemon family's one state-directory classification (DM-5, DEC-5,
    // DEC-18): an absolute override wins; otherwise the home-based default
    // applies only when a home exists; otherwise the directory is unresolvable.
    const daemonStateDirectory = classifyDaemonStateDirectory({
      environment,
      environmentPrefix: brand.environmentPrefix,
      stateDirectoryName: brand.stateDirectoryName,
      homeDirectory,
    });
    // The resolved daemon directory is the one scope the daemon store, lock,
    // settings, socket, and supervisor scope use; an unresolvable outcome keeps
    // the delivered home-based template for the non-daemon families only.
    const stateDirectory =
      daemonStateDirectory.kind === "resolved"
        ? daemonStateDirectory.directory
        : homeBasedStateDirectory;
    const changesDirectory = `${cwd}/doc/changes`;
    // One per-pass owner-hold resolution over the injected environment and the
    // fixed production store directory (GH-280 F-1, D12). Never cached.
    const readOwnerHold = (): OwnerHoldFact => {
      const marker = readOwnerHoldMarker(
        { storeDirectory: stateDirectory },
        nodeOwnerHoldMarkerFileSystem(),
      );
      return resolveOwnerHoldFact({
        environment,
        environmentPrefix: brand.environmentPrefix,
        storeDirectory: stateDirectory,
        marker,
      });
    };
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

    /**
     * Resolve the daemon settings and the lane restart bound over one
     * configuration acquisition. A missing configuration resolves the same
     * resolvers over an empty branch, so the shipped defaults apply; a resolved
     * configuration whose daemon branch is invalid composes the unavailable
     * runtime instead of a re-derived literal.
     */
    const readDaemonConfiguration = (
      directory: string,
    ): { readonly settings: DaemonSettings; readonly restartBound: number } | undefined => {
      const resolveOver = (
        values: Readonly<Record<string, ConfigValue>>,
        origins: ConfigNodeOrigins,
      ): { readonly settings: DaemonSettings; readonly restartBound: number } | undefined => {
        const settings = resolveDaemonSettings(values, origins, { stateDirectory: directory });
        if (!settings.ok) return undefined;
        const lane = resolveLaneSettings(values, origins);
        return {
          settings: settings.value,
          restartBound: lane.ok
            ? lane.value.restartBudget
            : PRODUCTION_DEFAULTS.lane["restart-budget"],
        };
      };
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
      if (!acquired.ok) return resolveOver({}, {});
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return resolveOver({}, {});
      return resolveOver(resolved.value.values, resolved.value.origins);
    };

    /**
     * Compose the daemon family's runtime over the one resolved state-directory
     * scope. The unresolvable outcome composes the unavailable runtime, so the
     * family stays registered while no store, lock, settings, transport, socket
     * path, supervisor scope, entry path, or pid is constructed.
     */
    const daemonDirectory =
      daemonStateDirectory.kind === "resolved" ? daemonStateDirectory.directory : undefined;
    const daemonConfiguration =
      daemonDirectory === undefined ? undefined : readDaemonConfiguration(daemonDirectory);
    const daemonRuntime = ((): DaemonCommandRuntime => {
      if (daemonDirectory === undefined || daemonConfiguration === undefined) {
        return unavailableDaemonRuntime();
      }
      const directory = daemonDirectory;
      const configuration = daemonConfiguration;
      const lock = createDaemonLockPort(createNodeStateEdge(), directory);
      const transport = createUnixTransport({
        stateDirectory: directory,
        socketPath: configuration.settings.socketPath,
        lockOwned: () => lock.read().state === "held",
      });
      // The re-entry environment is derived from facts the composer already
      // holds: the injected environment record and the composed home. No value
      // is invented, so a stripped `PATH` or home stays stripped, and the home
      // variable keeps the name it was read from (`HOME`, else `USERPROFILE`).
      const path = environment.PATH;
      const homeVariable =
        environment.HOME !== undefined && environment.HOME.length > 0
          ? "HOME"
          : environment.USERPROFILE !== undefined && environment.USERPROFILE.length > 0
            ? "USERPROFILE"
            : undefined;
      const workingNameVariable = workingNameEnvironmentVariable();
      const workingName = environment[workingNameVariable];
      const reentryEnvironment: Record<string, string> = {
        ...(path === undefined ? {} : { PATH: path }),
        ...(homeVariable === undefined
          ? {}
          : { [homeVariable]: environment[homeVariable] as string }),
        ...(workingName === undefined || workingName.length === 0
          ? {}
          : { [workingNameVariable]: workingName }),
      };
      const supervisorConfigDirectory = supervisorConfigDirectoryFor({
        environment,
        homeDirectory,
      });
      const composed = createDaemonCommandRuntime({
        store,
        lock,
        settings: configuration.settings,
        restartBound: configuration.restartBound,
        stateDirectory: directory,
        unit: `${brand.binaryName}-daemon.service`,
        binary: facts.daemonEntry ?? "",
        environmentName: stateDirectoryEnvironmentName(brand.environmentPrefix),
        ...(supervisorConfigDirectory === undefined ? {} : { supervisorConfigDirectory }),
        ...(facts.processId === undefined ? {} : { pid: facts.processId }),
        ...(facts.signalHost === undefined ? {} : { signalHost: facts.signalHost }),
        ...(facts.supervisor === undefined ? {} : { supervisor: facts.supervisor }),
        ...(facts.daemonEntry === undefined ? {} : { daemonEntry: facts.daemonEntry }),
        ...(Object.keys(reentryEnvironment).length === 0 ? {} : { reentryEnvironment }),
        transport,
        newFenceToken,
        newLockToken: () => globalThis.crypto.randomUUID(),
        newInstanceId: () => globalThis.crypto.randomUUID(),
        nowIso,
      });
      // With no absolute `XDG_CONFIG_HOME` and no home the user configuration
      // root is unresolvable: `install` refuses with `config.value.invalid`
      // before the unsupported and missing-entry-path refusals, writes no unit
      // and no ownership marker, invokes no supervisor command, and creates no
      // configuration-root directory (AC-F7-2, DM-6). Every other subcommand
      // keeps the resolved runtime.
      if (supervisorConfigDirectory !== undefined) return composed;
      return { ...composed, install: async () => daemonConfigurationRefusal() };
    })();

    const credentials = facts.credentials ?? createProcessCredentialPort(brand);
    const harnessCredentials = createEnvironmentCredentialPort({ environment, brand });
    const instance = facts.githubInstance ?? githubInstance();
    const truthReadReference =
      instance.authMethod.mechanism === "credential-reference"
        ? instance.authMethod.reference
        : undefined;
    const truthReadCredential =
      truthReadReference === undefined
        ? undefined
        : {
            referenceName: truthReadReference.referenceName,
            sourceKey: resolveCredentialSourceKey(truthReadReference, brand),
          };
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
      readOwnerHold,
      ...(truthReadCredential === undefined ? {} : { credentialReference: truthReadCredential }),
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
    /**
     * The durable reachability marker (DM-4, AC-F5-1..AC-F5-8), folded from the
     * one production predicate over the composed staleness bound. It performs no
     * socket connect, no process probe, and no sleep.
     */
    const daemonReachability = (): readonly QueueDegradationReason[] => {
      if (daemonConfiguration === undefined) return ["daemon-unreachable"];
      return daemonReachable({
        store,
        nowMs: nowMs(),
        lockStalenessMs: daemonConfiguration.settings.lockStalenessMs,
      })
        ? []
        : ["daemon-unreachable"];
    };

    const queueComposition = {
      store,
      facts: queueFacts,
      ...(repositoryBinding === undefined ? {} : { repositoryBinding }),
      nowIso,
      nowMs,
      newFenceToken,
      degraded: daemonReachability,
      readyRuntime: createStatusCommandRuntime(statusComposition(), noChain),
      readOwnerHold,
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
          : {
              kind: "variable" as const,
              name: entry.name,
              ...(entry.optional === true ? { optional: true } : {}),
            },
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

    /** The bounded refusal summary: one line, at most 240 characters. */
    const boundPreflightSummary = (text: string): string => {
      const single = text.replace(/[\r\n]+/gu, " ").trim();
      return single.length <= 240 ? single : `${single.slice(0, 239)}…`;
    };

    const preflightRefusal = (error: DispatchPreflightError): DispatchPreflightResult => ({
      ok: false,
      error,
    });

    /**
     * The admission precondition at the production boundary.
     *
     * It asks the delivered work-item read for exactly one bounded record and
     * classifies the outcome itself from the failure's status: the adapter
     * collapses an outage, a rejected credential, and a malformed payload into
     * one code, so forwarding that code would make them indistinguishable.
     */
    const dispatchPreflight = async (changeRef: string): Promise<DispatchPreflightResult> => {
      if (truthReadReference === undefined) return { ok: true };
      const referenceName = truthReadReference.referenceName;
      const sourceKey = resolveCredentialSourceKey(truthReadReference, brand);
      const issueNumber = /^[A-Za-z]+-([0-9]+)$/u.exec(changeRef)?.[1];
      if (issueNumber === undefined || target === undefined) {
        return preflightRefusal({
          kind: "input",
          code: "input.value.rejected",
          summary: boundPreflightSummary(
            `work item ${changeRef} is not addressable for admission; verify the reference and the repository remote`,
          ),
        });
      }
      const read = await client.readWorkItem(Number(issueNumber));
      if (read.ok) return { ok: true };
      const status = "httpStatus" in read ? read.httpStatus : undefined;
      if (read.code === "config.credential.missing") {
        return preflightRefusal({
          kind: "config",
          code: "config.credential.missing",
          summary: boundPreflightSummary(
            `credential key ${sourceKey} is unset (reference ${referenceName}); export ${sourceKey}="$(gh auth token)" or configure a credential reference`,
          ),
          trustedRefusal: true,
        });
      }
      if (read.code === "provider.not-found" || status === 404) {
        return preflightRefusal({
          kind: "input",
          code: "input.value.rejected",
          summary: boundPreflightSummary(
            `the provider reported work item ${changeRef} as absent for credential key ${sourceKey} (reference ${referenceName}); verify the reference and the token's repository scope`,
          ),
        });
      }
      if (status !== undefined && status >= 200 && status < 300) {
        return preflightRefusal({
          kind: "provider",
          code: "provider.payload.invalid",
          summary: boundPreflightSummary(
            `the provider returned an unparsable work-item payload for ${changeRef} (reference ${referenceName}); treat this as a provider or adapter fault`,
          ),
        });
      }
      if (status === 401 || status === 403) {
        return preflightRefusal({
          kind: "provider",
          code: "provider.auth.rejected",
          summary: boundPreflightSummary(
            `the truth-read credential for reference ${referenceName} was rejected by the provider; correct ${sourceKey} or rotate it and retry`,
          ),
        });
      }
      return preflightRefusal({
        kind: "provider",
        code: "provider.outage",
        summary: boundPreflightSummary(
          `the provider could not complete the work-item read for ${changeRef} (reference ${referenceName}); retry when the provider is available`,
        ),
      });
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
      preflight: dispatchPreflight,
      claimLease: (ref) => {
        const hold = readOwnerHold();
        if (hold.active) {
          return {
            ok: false,
            code: "queue.precondition.unmet",
            summary:
              hold.reason === undefined
                ? `reason=owner-hold; owner hold active (${hold.source})`
                : `reason=owner-hold; owner hold active (${hold.source}): ${hold.reason}`,
          };
        }
        const claimed = claimQueueLease(store, {
          ref,
          holder: "dispatch",
          runner: "dispatch",
          weightClass: "standard",
          nowIso: nowIso(),
          nowMs: nowMs(),
          fenceToken: newFenceToken(),
          ownerHold: hold,
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
     * its start-time identity capability, the delivered harness session port
     * with a coordinator session profile, and the real cycle driver.
     *
     * The coordinator session profile reuses the same delivered session port as
     * the resident daemon and dispatch surfaces: spawn, deliver/resume, collect,
     * liveness, and listSessions. The recorded lane ledger supplies the session
     * identity and process identity; an absent fact stays `unknown` rather than
     * being fabricated.
     */
    const createProductionCoordinatorComposition = (): CoordinatorComposition => {
      const settings = resolveProductionCoordinatorSettings();
      const loopIntervalMs = facts.coordinatorCollectionIntervalMs ?? settings.collectionIntervalMs;
      const processPort = createNodeProcessPort();
      const ownStartTimeMs = (): number | undefined => processPort.startTimeMs?.(ownProcessId);
      const coordinatorId = "coordinator-main";
      const coordinatorPrompt = `Continue coordinating delivery supervision for ${coordinatorId} in ${cwd}. Observe the delivery ledger and act on the next actionable item.`;

      let coordinatorHandle: HarnessSessionHandle | null = null;
      let coordinatorPid: number | null = null;
      let cachedProgress: {
        readonly newTurn: CoordinatorProgressState;
        readonly observedAtMs: number | null;
      } = { newTurn: "unknown", observedAtMs: null };

      const laneFact = () => {
        const lanes = readDaemonLanes(store);
        return lanes.ok ? lanes.latest : undefined;
      };

      const resumeDeclaredFor = (kind: HarnessKind): boolean =>
        kind === "claude-code" ? CLAUDE_CAPABILITIES.supportedOperations.includes("resume") : true;

      const readCoordinatorSession = (): CoordinatorSessionFacts => {
        if (facts.coordinatorSessionFacts !== undefined) return facts.coordinatorSessionFacts();
        if (coordinatorHandle !== null) {
          const pid = coordinatorPid;
          const observedStartTime = pid === null ? undefined : processPort.startTimeMs?.(pid);
          return {
            sessionId: coordinatorHandle.sessionId,
            liveness: "alive",
            contextTokens: null,
            harnessKind: coordinatorHandle.harnessKind,
            completedCleanly: false,
            resumable: true,
            resumeDeclared: resumeDeclaredFor(coordinatorHandle.harnessKind),
            pid,
            processStartTimeMs: observedStartTime ?? null,
          };
        }
        const lane = laneFact();
        const pid = lane?.processId ?? null;
        const observedStartTime = pid === null ? undefined : processPort.startTimeMs?.(pid);
        const liveness: CoordinatorSessionFacts["liveness"] =
          pid === null ? "unknown" : processPort.isAlive(pid) ? "alive" : "absent";
        const kind = harnessKindOf(lane?.harnessKind) ?? "opencode";
        return {
          sessionId: lane?.sessionId ?? null,
          liveness,
          contextTokens: null,
          harnessKind: kind,
          completedCleanly: lane?.state === "completed",
          resumable: (lane?.sessionId ?? null) !== null,
          resumeDeclared: resumeDeclaredFor(kind),
          pid,
          processStartTimeMs: observedStartTime ?? null,
        };
      };

      const coordinatorHarness = (
        preferredKind?: HarnessKind,
      ):
        | {
            readonly ok: true;
            readonly port: HarnessSessionPort;
            readonly descriptor: HarnessExecutionEnvironmentDescriptor;
            readonly kind: HarnessKind;
          }
        | { readonly ok: false; readonly code: string } => {
        const resolution = resolveProductionHarnessSettings();
        if (!resolution.ok) return { ok: false, code: resolution.code };
        const lane = laneFact();
        const kind = preferredKind ?? harnessKindOf(lane?.harnessKind) ?? resolution.settings.kind;
        return {
          ok: true,
          port: harnessFor(kind),
          kind,
          descriptor: {
            kind: resolution.settings.executionKind,
            workDirectory: cwd,
            environment: harnessEnvironmentEntries(resolution.settings),
          },
        };
      };

      const refreshProgress = async (): Promise<void> => {
        if (coordinatorHandle === null) return;
        const resolvedHarness = coordinatorHarness();
        if (!resolvedHarness.ok) return;
        const report = await resolvedHarness.port.liveness({ handle: coordinatorHandle });
        if (!report.ok) return;
        const facts = mapCoordinatorNewTurn(report.value);
        cachedProgress = {
          newTurn: facts.newTurn,
          observedAtMs: facts.observedAt === null ? null : Date.parse(facts.observedAt),
        };
      };

      const runSessionEffect = async (
        effect: "attach" | "resume" | "spawn",
      ): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }> => {
        if (effect === "attach") return { ok: true };
        const facts = readCoordinatorSession();
        const resolvedHarness =
          effect === "resume"
            ? coordinatorHarness(harnessKindOf(facts.harnessKind))
            : coordinatorHarness();
        if (!resolvedHarness.ok) return { ok: false, code: resolvedHarness.code };
        const lane = laneFact();
        if (effect === "resume") {
          let sessionId = coordinatorHandle?.sessionId ?? facts.sessionId ?? null;
          if (sessionId === null) {
            // No recorded session identity: reuse the delivered listing surface
            // before declaring the resume impossible.
            const listed = await resolvedHarness.port.listSessions({
              workItemRef: lane?.ref ?? coordinatorId,
              descriptor: resolvedHarness.descriptor,
            });
            if (!listed.ok) return { ok: false, code: listed.error.code };
            sessionId = listed.value.handles[listed.value.handles.length - 1]?.sessionId ?? null;
          }
          if (sessionId === null) return { ok: false, code: "harness.session.unknown" };
          const handle: HarnessSessionHandle = coordinatorHandle ?? {
            harnessKind: harnessKindOf(facts.harnessKind) ?? resolvedHarness.kind,
            sessionId,
            treeRoot: lane?.ref ?? cwd,
            workItemRef: lane?.ref ?? coordinatorId,
          };
          const resumed = await resolvedHarness.port.resume({
            handle,
            prompt: coordinatorPrompt,
            descriptor: resolvedHarness.descriptor,
          });
          if (!resumed.ok) return { ok: false, code: resumed.error.code };
          coordinatorHandle = resumed.value;
          coordinatorPid = facts.pid ?? lane?.processId ?? null;
          await refreshProgress();
          return { ok: true };
        }
        const spawned = await resolvedHarness.port.spawn({
          workItemRef: lane?.ref ?? coordinatorId,
          prompt: coordinatorPrompt,
          descriptor: resolvedHarness.descriptor,
        });
        if (!spawned.ok) return { ok: false, code: spawned.error.code };
        coordinatorHandle = spawned.value;
        // A newly spawned harness session exposes no pid on the delivered handle;
        // kill-with-grace stays unavailable until the lane records one.
        coordinatorPid = null;
        await refreshProgress();
        return { ok: true };
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
        coordinatorId,
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
          progress: () => cachedProgress,
        },
        session: {
          read: readCoordinatorSession,
          apply: runSessionEffect,
          wake: async (effect) =>
            effect === "live" ? { ok: true } : { ok: (await runSessionEffect(effect)).ok },
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
                await wait(loopIntervalMs);
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
      daemon: daemonRuntime,
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
