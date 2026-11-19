/**
 * Production composition root for the executable entrypoint (GH-242 F-1).
 *
 * Wires the delivered adapters into the prompt-required command runtimes and
 * lets `createConfigProgram` compose the program. Provider-facing reads share
 * one GitHub client; an unresolved remote or missing credential produces the
 * command's own classified degradation rather than an unclassified crash. No
 * command is claimed that is not composed.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  createEnvironmentCredentialPort,
  createProcessCredentialPort,
  resolveCredentialSourceKey,
} from "@delivery-os/adapters/credentials";
import { createNodeProcessPort, createUnixTransport } from "@delivery-os/adapters/daemon";
import {
  acquireFileConfig,
  createHostIndexAccess,
  createNodeInstallFilePort,
  ensureDispatchIdentityMarkerText,
  ensureProjectIdentityMarkerText,
  enumerateStateRoots,
  type FileSystemFacts,
  type HostIndexAccess,
  hostIndexDocumentPath,
  nodeFileSystemFacts,
  nodeOwnerHoldMarkerFileSystem,
  nodePmNotesFileSystemFacts,
  preserveCorruptHostIndex,
  projectPmNotesCompleteness,
  readCommittedConfigDocument,
  readDispatchAuthorityFact,
  readDispatchIdentityMarkerText,
  readHostIndexFile,
  readLocalPmContext,
  readOwnerHoldMarker,
  readPmNotesText,
  readProjectGroupsConfig,
  readProjectIdentityMarker,
  readStateRootArtifacts,
  relativeChangeFolder,
  replaceDispatchIdentityMarkerText,
  replaceHostIndexFile,
  runtimePlatform,
  scanDeclaredWorkspaceMembers,
} from "@delivery-os/adapters/file";
import {
  createGitBranchSeam,
  createGitMergeSeam,
  type GitChildRunner,
} from "@delivery-os/adapters/git";
import {
  createGitHubClient,
  createGithubCliTransport,
  createGithubNativeTransport,
  type GithubChildRunner,
  type GithubClientOptions,
  type GithubTransportPolicy,
  type GithubTransportSelection,
  githubCliHostname,
  probeGithubCli,
  resolveTransportSelection,
} from "@delivery-os/adapters/github";
import {
  CLAUDE_CAPABILITIES,
  createBunSqliteStoreOpener,
  createClaudeInstance,
  createClaudeSession,
  createOpencodeInstance,
  createOpencodeSession,
  createOpencodeSessionTotalsReader,
  mapCoordinatorNewTurn,
  OPENCODE_CAPABILITIES,
} from "@delivery-os/adapters/harness";
import { createHostSpawnRunner, createHostSpawnStarter } from "@delivery-os/adapters/host";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  readCheckoutIdentity,
  readRepositoryFacts,
  resolveCheckoutGitDirectories,
} from "@delivery-os/adapters/repo";
import type {
  HarnessAdapterRegistration,
  HarnessBindingResolution,
  HarnessProfileView,
  HarnessSelectionView,
} from "@delivery-os/core";
import {
  type AuthorityEvidence,
  aggregateProjectMemberOutcomes,
  assembleHarnessLiveness,
  bindingEnvironmentRecords,
  bindingInvocationArgs,
  buildHarnessSpawnEnvironment,
  buildLifecyclePrompt,
  type CoordinatorSettings,
  claimDispatchLease,
  classifyHarnessEvidence,
  classifyProjectStateLocation,
  classifyVerifyDocument,
  corroborateDelivery,
  createStateSupervisionReadPort,
  createStateSupervisionWritePort,
  type DaemonComposition,
  type DispatchArtifactFacts,
  type DispatchLedgerFacts,
  type DispatchPreflightError,
  type DispatchPreflightResult,
  type DispatchPrFact,
  type DispatchRead,
  type DispatchTrackerFacts,
  type DispatchTruthReads,
  detectPriorNamespace,
  EvaluateVerifyChange,
  emptyHandoverGate,
  evaluateCoordinatorRestartAdmission,
  evaluateHarnessModeAvailability,
  evaluateModelExpressibility,
  evaluateRestartBudget,
  foldDispatchHandover,
  type HandoverEvidence,
  type HarnessSettings,
  type HostIndexRootProbe,
  harnessAgentIdentityViolation,
  type LaneSettings,
  type LoopDelay,
  type LoopLogSink,
  type LoopSessionFacts,
  legacyStoreWarning,
  logByteLength,
  maintainHostIndex,
  normalizeDispatchRepositoryKey,
  normalizeRepositoryKey,
  normalizeRepositoryRemote,
  orderProjectEntries,
  PRODUCTION_DEFAULTS,
  type ProjectsScopeFailure,
  parseHostIndexDocument,
  parsePlanMembers,
  parseProjectIdentityMarker,
  planLogAppend,
  projectGroupDeclared,
  projectGroupEntry,
  projectGroupMemberEntry,
  projectGroupMemberSelectors,
  projectHandoverState,
  projectListEntry,
  projectMemberHealth,
  projectMemberOutcomeOfHealth,
  projectStateRoot,
  rankBlockerQuestions,
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
  readDispatchGate,
  readDispatchHandover,
  readDispatchLanes,
  readQueueEntries,
  releaseQueueLease,
  renderLogLine,
  reposHandoverGateOf,
  reposListDataOf,
  resolveBinding,
  resolveConfig,
  resolveCoordinatorSettings,
  resolveDispatchIdentity,
  resolveDispatchLane,
  resolveHarnessInstance,
  resolveHarnessSettings,
  resolveLaneSettings,
  resolveOwnerHoldFact,
  resolveProjectGroupMember,
  resolveProjectScope,
  reversibilityOf,
  runDispatchTrackerLadder,
  type SupervisionEconomicsWritePort,
  type SupervisionRestartAdmission,
  selectDaemonReachability,
  selectProjectGroups,
  serializeHostIndexDocument,
  serializeIdentityMarker,
  spawnTitleFor,
  stateScopeEnvironmentName,
  stateScopeRoots,
  suiteMapReadOfDocument,
  type TelemetryAttributionSubstrates,
  type TelemetryClaimedIdentity,
  type TelemetrySessionTotalsReader,
  type VerifyDocumentClassification,
  validateProjectGroupsDocument,
  type WorkspaceLocatedMember,
} from "@delivery-os/core";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import {
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  type BrandIdentity,
  CLOSEOUT_INTEGRATION_BASE,
  type CommandFailureHarnessDetail,
  type ConfigErrorCode,
  type ConfigNodeOrigins,
  type ConfigPriorOutcome,
  type ConfigValue,
  type CoordinatorProgressState,
  type CredentialPort,
  type CredentialReference,
  type DaemonReachability,
  type DaemonSettings,
  DELIVERY_RESULT_TOKENS,
  type DeliveryRequest,
  type DeliveryResultToken,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  type DispatchDelay,
  type DispatchLedgerVariant,
  type DispatchPhaseLedger,
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXHAUSTION_SCHEMA_ID,
  ECONOMICS_RESTART_SCHEMA_ID,
  type ExternalSystemInstance,
  HARNESS_KINDS,
  type HandoverState,
  type HarnessCapabilityDeclaration,
  type HarnessEnvironmentBuilder,
  type HarnessEnvironmentEntry,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessFailure,
  type HarnessKind,
  type HarnessMode,
  type HarnessModeOrigin,
  type HarnessResult,
  type HarnessSeatBinding,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type HarnessSpawnRunner,
  type HarnessSpawnStarter,
  type HarnessVersionProbe,
  type HarnessVersionVerdict,
  HOST_INDEX_INITIAL_REVISION,
  type HostIndexEntry,
  IMPLEMENTED_TRACKER_KINDS,
  INSTALL_MAX_JUDGED_ROOTS,
  INSTALL_RECORD_FILE_NAME,
  INSTALL_STATE_ROOT_PROJECTS_DIRECTORY,
  type InstallArtifactIdentity,
  type InstallDaemonPort,
  type InstallRuntime,
  LOCAL_CALLER_PRINCIPAL,
  type OwnerHoldFact,
  type PipelineRun,
  PROJECTS_COMMAND_FAMILY,
  type PriorIdentityNotice,
  type ProjectConfigInvalidReason,
  type ProjectGroupEntry,
  type ProjectGroupMemberEntry,
  type ProjectGroupMemberSelected,
  type ProjectGroupsConfig,
  type ProjectGroupValidated,
  type ProjectScopedMemberWork,
  QUEUE_DEFAULT_NEXT_ACTIONS,
  QUEUE_REF_PATTERN,
  type QueueDegradationReason,
  type QueueEntryProjection,
  type QueueTrackerRead,
  REPOS_COMMAND_FAMILY,
  type ReposHandoverGate,
  renderPriorIdentityNotice,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_SOURCE_ITEM_LIMIT,
  type StateStorePort,
  type SupervisorPort,
  TELEMETRY_RUN_ID_UNAVAILABLE,
  type TelemetryIngestSink,
  VERIFY_GATES_CI_RUN_LIMIT,
  type WorkItem,
} from "@delivery-os/core/contracts";
import {
  nominateProviderProfile,
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  selectProfile,
} from "@delivery-os/core/provider";
import {
  appendBlockerQuestion,
  appendEconomicsRestartEvent,
  createDaemonLockPort,
  createNodeStateEdge,
  createStateStore,
  ensureEconomicsExhaustionRecord,
  foldPhaseState,
  readAuditLedger,
  readBlockerLedger,
  readChangeTransitionsTolerant,
  readCoordinatorRecords,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import type { CoordinatorSessionFacts } from "./commands/coordinator-loop.js";
import type { DaemonCommandRuntime } from "./commands/daemon.js";
import { createInstallCommandDefinition } from "./commands/install.js";
import type {
  ProjectGroupRuntimeRead,
  ProjectGroupWorkRead,
  ProjectsRuntimeRead,
} from "./commands/projects.js";
import type { ReposRuntimeRead } from "./commands/repos.js";
import { createDaemonCommandRuntime, resolveProjectDaemonSettings } from "./daemon-compose.js";
import {
  type ConfigProgramOptions,
  type CoordinatorComposition,
  createCloseoutComposition,
  createConfigProgram,
  createDispatchCommandRuntime,
  createDispatchGateRuntime,
  createLoopLedgerPort,
  createMergeCommandRuntime,
  createPhaseCommandRuntime,
  createPhaseCommitExtension,
  createPlanCommandRuntime,
  createProductionCommitRuntimeOptions,
  createQueueCommandRuntime,
  createResolvedProviderProbe,
  createStatusCommandRuntime,
  createTelemetryIngestSink,
  createVerifyCommandRuntime,
  createVerifyDeployCommandRuntime,
  createVerifyGatesCommandRuntime,
  type DispatchCommandRuntime,
  type DispatchComposition,
  type LoopComposition,
  type QueueComposition,
  resolveAgentIdentity,
} from "./edge.js";
import type { EntrypointComposer, EntrypointInvocationFact } from "./entrypoint.js";
import { workingNameEnvironmentVariable } from "./entrypoint.js";
import { PROMPT_REQUIRED_COMMANDS } from "./help/prompt-required-commands.js";
import type { CommandDefinition, CommandProgram } from "./index.js";

/**
 * The configuration-document codes the merge composition's configuration-read
 * branch can forward (GH-293 F-6; DEC-18).
 *
 * The branch resolves the one declared configuration document before the
 * transaction reads anything and forwards the acquisition's or the resolver's
 * own classified code instead of resolving an empty map. The tuple is typed
 * against the delivered configuration taxonomy, so the branch cannot forward a
 * code the taxonomy does not declare, and the conformance suite pins every
 * member of this tuple as a member of the emittable declaration.
 *
 * Two taxonomy codes are deliberately absent because this branch cannot produce
 * them: the resolver is called with no environment map, so an unmapped
 * environment variable is unreachable; and with no strict flag, so a strict
 * warning is unreachable.
 */
const MERGE_COMPOSITION_CONFIGURATION_CODES = [
  "config.file.malformed",
  "config.value.invalid",
  "config.key.unknown",
  "config.reset.invalid",
  "config.interpolation.rejected",
  "config.secret.forbidden",
  "config.path.forbidden",
] as const satisfies readonly ConfigErrorCode[];

/**
 * The production merge composition's declared emittable failure codes (GH-293
 * F-7, DM-6; TDR-0031 D9).
 *
 * Exhaustive by construction over this composition's refusal branches: every
 * member is a code the delivered error table already declares, and the
 * classification conformance suite ranges over this declaration rather than a
 * hand-picked list. The configuration-read branch contributes its own forwarded
 * codes, so a configuration document that cannot be read or that carries an
 * invalid `merge` value is classified by its declared identity rather than
 * silently resolving defaults. The set is a declaration, never a row source: it
 * adds no row, kind, or exit.
 */
export const MERGE_COMPOSITION_EMITTABLE_CODES = [
  ...MERGE_COMPOSITION_CONFIGURATION_CODES,
  "config.credential.missing",
  "provider.auth.rejected",
  "provider.outage",
  "merge.transaction-aborted",
  "merge.state-unverified",
  "merge.gates-stale",
  "merge.waiver-unauthorized",
  "merge.owner-gate-override-without-waiver",
  "merge.rebase-conflict",
  "merge.landing-unverified",
] as const;

/**
 * The tracker-family tokens the truth read derives, resolved from the one
 * taxonomy: `merged`, `blocked`, `pr-open`.
 */
const [PR_MERGED_TOKEN, PR_BLOCKED_TOKEN, PR_OPEN_TOKEN] = DELIVERY_RESULT_TOKENS;

/**
 * The one declared work-item-ref grammar the merge surfaces accept.
 *
 * The command's own validation and this composition's ref resolution read the
 * same delivered contract pattern, so a prefix carrying a digit (`ABC2-12`)
 * validates and then resolves instead of being refused as unresolvable.
 */
const CHANGE_REF_GRAMMAR = new RegExp(QUEUE_REF_PATTERN, "u");

/** The work-item number a ref carries, or `undefined` when it is not a ref. */
const changeRefNumberOf = (ref: string): string | undefined =>
  CHANGE_REF_GRAMMAR.test(ref) ? ref.slice(ref.lastIndexOf("-") + 1) : undefined;

/** The change ref a branch name carries: the first path segment that is a ref. */
const changeRefInBranch = (branch: string): string | undefined =>
  branch.split("/").find((segment) => CHANGE_REF_GRAMMAR.test(segment));

/** The bounded provider page the truth read addresses. */
const TRUTH_PROVIDER_LIMIT = STATUS_SOURCE_ITEM_LIMIT;

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

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

const repositoryTargetOf = (originUrl: string | undefined): RepositoryTarget | undefined => {
  const parsed = parseGitHubRemote(originUrl);
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined;
};

/** The production caller principal the handover/resolution records carry. */
const DISPATCH_PRINCIPAL = LOCAL_CALLER_PRINCIPAL.kind;

/** One entry of the host process table (the exact-identity reap's only input). */
type ProductionProcessEntry = {
  readonly pid: number;
  readonly argv: readonly string[];
};

/**
 * The host process table the terminate seam reads (GH-347 AC-F5-5, TDR-0051
 * DC-3): `/proc` command lines on Linux, nothing elsewhere. It starts no
 * process, runs no shell, and matches no name pattern — the adapter compares
 * this lane's session id or its deterministic `ticket-<REF>` title against the
 * argv elements.
 */
const readProductionProcessTable = (): readonly ProductionProcessEntry[] => {
  if (process.platform !== "linux") return [];
  let entries: string[];
  try {
    entries = readdirSync("/proc");
  } catch {
    return [];
  }
  const table: ProductionProcessEntry[] = [];
  for (const entry of entries) {
    const pid = Number(entry);
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
    try {
      const argv = readFileSync(`/proc/${entry}/cmdline`, "utf8")
        .split("\u0000")
        .filter((value) => value.length > 0);
      if (argv.length > 0) table.push({ pid, argv });
    } catch {
      // The process exited between the listing and the read; never fabricated.
    }
  }
  return table;
};

/**
 * The production terminate seam the opencode adapter receives (GH-347 AC-F5-5,
 * TDR-0051 DC-2/DC-3). The tree signal reaches the group the runtime leads and
 * falls back to the matched process only; it never widens the target.
 */
const productionTerminateTree = {
  list: readProductionProcessTable,
  signalTree: (pid: number, signal: "SIGTERM" | "SIGKILL"): boolean => {
    // The delivered process port is the composition's one signalling seam; a
    // negative pid addresses the group the runtime leads, and the direct pid is
    // the fallback when it leads no group.
    const signals = createNodeProcessPort();
    if (signals.signal(-pid, signal).ok) return true;
    return signals.signal(pid, signal).ok;
  },
};

/**
 * Guarantee a declaration reaches the engine from the composition edge
 * (GH-347 AC-F5-4, F-5, DM-5; review N1).
 *
 * The adapter's own declaration is the single source and passes through the
 * composition unchanged. This edge fills an ABSENT declaration from the
 * adapter's exported constant and NEVER overrides one the port reports: the
 * opencode adapter resolves an injected override, and shadowing it would
 * separate the declaration from the implementation that reads it. It never
 * throws — an undeclared port is filled, not refused.
 */
const harnessWithDeclaration = (
  port: HarnessSessionPort,
  declaration: HarnessCapabilityDeclaration,
): HarnessSessionPort =>
  port.capabilities === undefined ? { ...port, capabilities: declaration } : port;

/** The declaration each configured harness kind exports as its single source. */
const harnessDeclaration = (kind: HarnessKind): HarnessCapabilityDeclaration =>
  kind === "opencode" ? OPENCODE_CAPABILITIES : CLAUDE_CAPABILITIES;

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
   * The RESOLVED base branch a dispatch's lifecycle prompt targets (GH-347
   * AC-F7-3, DM-6). The composition is the resolution site: an embedder that
   * knows its integration base supplies it, and the delivered integration base
   * is the declared fallback. The prompt never carries a second hardcoded
   * literal, and no configuration key is added.
   */
  readonly dispatchBaseBranch?: string;
  /**
   * The injected harness spawn runner. Production uses the host runner; tests
   * inject a recording runner so composition is proven without a harness process.
   */
  readonly harnessSpawnRunner?: HarnessSpawnRunner;
  /**
   * The injected version probe (GH-335 F-1). Production builds it over the host
   * runner; a composed test supplies a deterministic answer so composition is
   * proven without a harness process.
   */
  readonly harnessVersionProbe?: HarnessVersionProbe;
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
   * The composition-edge transport selection (DM-10). Production supplies it
   * from `resolveCompositionTransportSelection`; tests and embedders may omit
   * it, in which case the delivered native-`fetch` transport serves with no
   * probe and no selection value.
   */
  readonly githubTransportSelection?: GithubTransportSelection;
  /**
   * The injected CLI child runner. Production omits it (the adapter's bounded
   * `execFile` default applies); tests inject a recording runner so composition
   * is proven without a live process.
   */
  readonly githubCliRunner?: GithubChildRunner;
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
   * The injected dispatch delay fact (GH-347 AC-F9-2). Production binds the
   * real timer; the offline battery injects a recorder that advances a virtual
   * clock, so no parity case waits on a wall clock.
   */
  readonly dispatchDelay?: DispatchDelay;
  /**
   * The injected composition clock (GH-347 driver D1): a fixed clock makes the
   * battery deterministic without a wall-clock read. Production omits it and
   * reads the system clock.
   */
  readonly clock?: { readonly nowMs: () => number; readonly nowIso: () => string };
  /**
   * The process signal subscription seam (the bin supplies the host process).
   */
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
  /**
   * The running entry path (the bin supplies the compiled artifact's real path
   * or the delivered script path), so the detached child and the installed unit
   * name the same executable.
   */
  readonly daemonEntry?: string;
  /**
   * The injected build identity (GH-346 DM-1). Absent in a workspace run, which
   * is exactly the development run the install dev gate refuses.
   */
  readonly buildIdentity?: InstallArtifactIdentity;
  /**
   * The running artifact's real path (GH-346 D7, SEAM-TP-1): the declared
   * composition fact steps 2 and 3 stage and verify. Production supplies
   * `process.execPath` for a compiled run; the domain never reads it itself.
   */
  readonly runningArtifactPath?: string;
  /**
   * The owning-role fact (GH-346 D6, TDR-0044 §3): the primary bin declares
   * `true`; the alias declares nothing, and an absent fact means NOT owning.
   */
  readonly ownsInstallation?: boolean;
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
  /** The injected loop wait override (GH-348 NFR-1); production binds the timer. */
  readonly loopDelay?: LoopDelay;
  /**
   * The observability-only host-index access counters. They accept no root, no
   * key, and no path, so a composition test reads the bound without injecting
   * state (GH-288 F-2, TR-1).
   */
  readonly hostIndexAccess?: HostIndexAccess;
  /**
   * The injected resident-daemon composition (GH-288 F-5). The shipped binary
   * supplies none, so the build declares the unmounted reason and never probes;
   * a composition that mounts the daemon probes honestly.
   */
  readonly daemon?: DaemonComposition;
  /**
   * The configuration filesystem facts (GH-320 F-3). Production uses the node
   * facts; a test may inject counting facts so per-layer reads are observable.
   */
  readonly configurationFs?: FileSystemFacts;
  /**
   * A test/embedder observability seam over the main state store (GH-295 §22):
   * the composed program keeps using the returned port, so a composition proof
   * can instrument reads without changing the state location.
   */
  readonly stateStoreWrap?: (store: StateStorePort) => StateStorePort;
};

/** The one bounded warning an invocation outside any checkout emits (DEC-10). */
const UNBOUND_SCOPE_WARNING =
  "outside any git work tree: delivery state is not repository-scoped (unbound scope)";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withWarning = (result: unknown, warning: string): unknown => {
  if (!isRecord(result) || (!Object.hasOwn(result, "data") && !Object.hasOwn(result, "error"))) {
    return result;
  }
  const existing = Array.isArray(result.warnings)
    ? result.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
  return { ...result, warnings: [...existing, warning] };
};

/** Append the bounded scope warnings to every composed handler's outcome. */
const withScopeWarnings = (
  program: CommandProgram,
  warnings: readonly string[],
): CommandProgram => {
  const commands: Record<string, CommandDefinition> = {};
  for (const [name, definition] of Object.entries(program.commands)) {
    commands[name] = {
      ...definition,
      handler: (invocation) => {
        const outcome = definition.handler(invocation);
        const merged = (value: unknown): unknown =>
          warnings.reduce<unknown>((current, warning) => withWarning(current, warning), value);
        return outcome instanceof Promise ? outcome.then(merged) : merged(outcome);
      },
    };
  }
  return { commands };
};

/**
 * The pair-or-absent queue repository binding (F-1). The binding is present only
 * when both the contention-domain repository key and the resolved checkout root
 * exist; otherwise it is absent. It is never a one-sided pair, and this is the
 * one place the pair literal is constructed.
 */
const repositoryBindingOf = (
  repository: string | undefined,
  repositoryRoot: string | undefined,
): { readonly repository: string; readonly repositoryRoot: string } | undefined =>
  repository === undefined || repositoryRoot === undefined
    ? undefined
    : { repository, repositoryRoot };

/**
 * Attach the derived binding to a queue composition. This is the one place a
 * composition declares its `repositoryBinding` property, so every composition —
 * the checkout-scoped one and each group member's per-checkout one — carries a
 * binding produced by the same derivation.
 */
const withRepositoryBinding = (
  composition: QueueComposition,
  binding: QueueComposition["repositoryBinding"],
): QueueComposition =>
  binding === undefined ? composition : { ...composition, repositoryBinding: binding };

/**
 * The classified scope-refusal program (GH-288 F-1, DEC-16, DEC-17).
 *
 * Every command maps the same identity/state state to the same classified
 * outcome, so a refusal is reported through the family's declared identity and
 * its exit projection instead of being contained as `fallback.internal`. The
 * program keeps exactly the prompt-required set, so the entrypoint's restriction
 * step still finds every name it expects.
 */
const scopeRefusalProgram = (
  failure: ProjectsScopeFailure,
  warnings: readonly string[] = [],
): CommandProgram => {
  const summary =
    failure.kind === "config"
      ? `the state-directory scope is invalid (${failure.key})`
      : failure.summary;
  const kind = failure.kind === "config" ? "config" : "projects";
  // The flat record set owns its failure identities after the rename (GH-309
  // F-7): the `repos` command and the `projects list --flat` alias classify
  // identity and state failures under `repos.*`, while every other command —
  // and the group surface's default form — keeps the composition-level
  // `projects.*` refusal (TC-PROJ-022 pins that parity with the MCP surface,
  // which this change does not touch).
  const flatCode = (): string =>
    failure.kind === "identity"
      ? "repos.identity-unreadable"
      : failure.kind === "state"
        ? "repos.state-unavailable"
        : failure.code;
  const flatKind = (): string => (failure.kind === "config" ? "config" : "repos");
  const definitionFor = (name: string): CommandDefinition => ({
    // The refusal is the same for every command, so the grammar admits any flag
    // and positional shape and the classified scope failure answers instead of
    // the parser: the identity outcome must not depend on which command was asked.
    acceptsAnyFlag: true,
    positionals: { max: 3 },
    handler: (invocation) => {
      const flat =
        name === REPOS_COMMAND_FAMILY ||
        (name === PROJECTS_COMMAND_FAMILY && invocation.flags["--flat"] === true);
      return {
        error: flat
          ? { kind: flatKind(), code: flatCode(), summary }
          : { kind, code: failure.code, summary },
        ...(warnings.length === 0 ? {} : { warnings }),
      };
    },
  });
  const commands: Record<string, CommandDefinition> = {};
  for (const name of PROMPT_REQUIRED_COMMANDS) commands[name] = definitionFor(name);
  return { commands };
};

/**
 * The bounded audit-ledger read the claimed-identity substrate performs.
 *
 * The read is one verified, filtered pass over the delivered ledger with a
 * declared limit; a claim absent from the read window answers nothing, so the
 * invoking process's own claim decides instead of an invented value.
 */
const TELEMETRY_AUDIT_READ_LIMIT = 64;

/** The injected facts one production ingest sink composes over (GH-291 F-1, F-2). */
export type ProductionTelemetrySinkInput = {
  readonly store: StateStorePort;
  readonly workItemRef: string;
  /** The invoking command's audit run id: the correlation key of every step. */
  readonly runId: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix: string;
  readonly treeRoot: string | null;
  readonly repository: string | null;
  readonly harnessVersion?: string | null;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly sessionTotals?: TelemetrySessionTotalsReader;
};

/**
 * Compose one harness session's telemetry ingest sink over the delivered
 * substrates (GH-291 F-1, F-2; AC-F2-1).
 *
 * The claimed agent identity is read from the same injected-environment claim
 * the delivered command-audit ledger records, and the run identity is the
 * invoking command's own audit run id — so a real delivery's steps carry the
 * claimed role and a run id that joins the audit ledger, instead of a random
 * id that joins nothing. The attribution ports answer from the delivered
 * session economics (session/run identity) and the delivered command-audit
 * ledger (a completed run's claimed identity).
 *
 * The delivered claim is one per-lane-unique value with no declared role/lane
 * split, so it is recorded as the claimed agent role; the lane dimension stays
 * unattributable and disclosed (`unattributable-step`) rather than guessed.
 */
export const createProductionTelemetrySink = (
  input: ProductionTelemetrySinkInput,
): TelemetryIngestSink => {
  const resolved = resolveAgentIdentity(input.environment, input.environmentPrefix);
  const invocationClaim: TelemetryClaimedIdentity = {
    agentRole: resolved?.value ?? null,
    lane: null,
  };
  const recordedClaim = (runId: string): TelemetryClaimedIdentity | undefined => {
    const ledger = readAuditLedger(input.store, { limit: TELEMETRY_AUDIT_READ_LIMIT });
    if (!ledger.ok) return undefined;
    const record = ledger.value.records.find((candidate) => candidate.runId === runId);
    const value = record?.agentIdentity?.value;
    if (value === undefined || value.trim().length === 0) return undefined;
    return { agentRole: value, lane: null };
  };
  const attribution: TelemetryAttributionSubstrates = {
    readSessionIdentity: (sessionId) => {
      const records = readEconomicsRecords(input.store, input.workItemRef);
      if (!records.ok) return undefined;
      const recorded = records.restarts.find((entry) => entry.sessionId === sessionId);
      return recorded === undefined ? undefined : { sessionId, runId: recorded.runId };
    },
    // A finished run's recorded claim wins; the invoking process's own claim
    // answers otherwise. One sink serves one spawned session, so that claim is
    // this session's claimed identity — never a value borrowed from elsewhere.
    readClaimedIdentity: (runId) => recordedClaim(runId) ?? invocationClaim,
  };
  return createTelemetryIngestSink({
    store: input.store,
    workItemRef: input.workItemRef,
    runId: input.runId,
    harnessKind: "opencode",
    harnessVersion: input.harnessVersion ?? null,
    treeRoot: input.treeRoot,
    repository: input.repository,
    claimed: invocationClaim,
    attribution,
    model: null,
    nowIso: input.nowIso,
    newFenceToken: input.newFenceToken,
    ...(input.sessionTotals === undefined ? {} : { sessionTotals: input.sessionTotals }),
  });
};

/**
 * The daemon re-entry environment, derived from the injected environment alone
 * (GH-320 F-3b, GH-288 F-1).
 *
 * Only the declared allowlist survives: `PATH`, the home variable the composer
 * read (`HOME`, else `USERPROFILE`), and a non-empty working-name override. Any
 * other key — a forwarded state-directory look-alike, a credential, an unrelated
 * variable — is dropped here rather than passed to a detached child; the
 * brand-derived state-directory binding is added by the daemon composition and
 * written last, so it stays authoritative.
 */
export const daemonReentryEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const path = environment.PATH;
  const homeVariable =
    environment.HOME !== undefined && environment.HOME.length > 0
      ? "HOME"
      : environment.USERPROFILE !== undefined && environment.USERPROFILE.length > 0
        ? "USERPROFILE"
        : undefined;
  const workingNameVariable = workingNameEnvironmentVariable();
  const workingName = environment[workingNameVariable];
  return {
    ...(path === undefined ? {} : { PATH: path }),
    ...(homeVariable === undefined ? {} : { [homeVariable]: environment[homeVariable] as string }),
    ...(workingName === undefined || workingName.length === 0
      ? {}
      : { [workingNameVariable]: workingName }),
  };
};

/**
 * Compose the prompt-required program over the delivered adapters.
 *
 * The composed brand is supplied by the entrypoint, so the name seam has one
 * source; only the working name input is repeated for `createConfigProgram`'s
 * own brand check.
 */
/** The ref-stable typed-question identity (DEC-9(f)); never embeds the run id. */
export const supervisionExhaustionQuestionId = (ref: string): string => `exhaustion-${ref}`;

/** The typed recovery options the exhaustion question offers (declared once). */
export const SUPERVISION_EXHAUSTION_QUESTION_OPTIONS = [
  "restart-fresh-budget",
  "park-owner-review",
] as const;

/**
 * The ONE supervision economics/append closure factory (F-4v2): schema ids,
 * exhaustion options, the ref-stable question identity, and the per-run
 * blocker-ledger cache are authored here, and both the production composition
 * and the test harness build their closures from it. The blocker ledger is read
 * at most once per run and its snapshot is passed to the append as the current
 * view (DEC-9(d)); the run id is record/evidence metadata only.
 */
export const createSupervisionEconomicsWritePort = (input: {
  readonly store: StateStorePort;
  readonly newFenceToken: () => string;
}): SupervisionEconomicsWritePort => {
  let cachedLedger: ReturnType<typeof readBlockerLedger> | undefined;
  return {
    appendRestart: ({ ref, ordinal, runId, recordedAt }) => {
      const outcome = appendEconomicsRestartEvent(input.store, input.newFenceToken(), {
        schemaId: ECONOMICS_RESTART_SCHEMA_ID,
        workItemRef: ref,
        runId,
        sessionId: runId,
        ordinal,
        reason: "session-interrupted",
        recordedAt,
      });
      return outcome.ok
        ? { ok: true, appended: outcome.appended }
        : { ok: false, code: outcome.code };
    },
    ensureExhaustion: ({ ref, restarts, runId, recordedAt }) => {
      const outcome = ensureEconomicsExhaustionRecord(input.store, input.newFenceToken(), {
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
      return outcome.ok
        ? { ok: true, appended: outcome.appended }
        : { ok: false, code: outcome.code };
    },
    raiseQuestion: ({ ref, restarts, askedAt }) => {
      const ledger = cachedLedger ?? readBlockerLedger(input.store);
      cachedLedger = ledger;
      if (!ledger.ok) return { ok: false, code: ledger.error.code };
      const id = supervisionExhaustionQuestionId(ref);
      if (ledger.value.questions.some((question) => question.id === id)) {
        return { ok: true, appended: false };
      }
      const record = {
        schemaId: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
        id,
        type: "decision-needed" as const,
        audience: "owner" as const,
        lane: "supervise",
        ref,
        question: `the restart budget for ${ref} is exhausted after ${String(
          restarts,
        )} restarts; choose the recovery route`,
        options: [...SUPERVISION_EXHAUSTION_QUESTION_OPTIONS],
        askedAt,
      };
      const appended = appendBlockerQuestion(input.store, {
        record,
        fenceToken: input.newFenceToken(),
        current: ledger.value,
      });
      if (!appended.ok) return { ok: false, code: appended.error.code };
      if (appended.value.appended) {
        // One ledger read per run: the cached snapshot absorbs this question
        // so a second exhausted lane appends against a current view.
        cachedLedger = {
          ok: true,
          value: {
            ...ledger.value,
            questions: [...ledger.value.questions, record],
            recordCount: ledger.value.recordCount + 1,
          },
        };
      }
      return { ok: true, appended: appended.value.appended };
    },
  };
};

/* ------------------------------------------------------------------------- */
/* GH-335 — the harness plane's single production seams.                      */
/* ------------------------------------------------------------------------- */

/**
 * Build the single production version probe (GH-335 F-1, DEC-11, §17.2 clause 6).
 *
 * One bounded, shell-free invocation of the harness's own version surface. The
 * declared deadline is handed to the child-process runner's `timeout:` option;
 * a timeout answers `timed-out`, and a non-zero exit is a rejection (which the
 * resolver classifies as indeterminate). No shell, no prompt, no session args.
 */
export const createHarnessVersionProbe = (input: {
  readonly runner: HarnessSpawnRunner;
  readonly command: string;
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
}): HarnessVersionProbe => {
  return async (probe) => {
    const result = await input.runner(input.command, ["--version"], {
      cwd: input.cwd,
      env: input.environment,
      timeout: probe.deadlineMs,
    });
    if (result.timedOut) return { status: "timed-out" };
    if (result.status !== 0) {
      throw new Error(`harness version probe exited ${String(result.status)}`);
    }
    return { status: "answered", stdout: result.stdout };
  };
};

/** One pre-session harness refusal, classified and recordless. */
export type ProductionHarnessRefusal = {
  readonly kind: "harness" | "config" | "provider";
  readonly code: string;
  readonly summary?: string;
  readonly field?: string;
  readonly harness?: CommandFailureHarnessDetail;
};

/** The resolved harness facts one admission discloses (TDR-0041). */
export type ProductionHarnessFacts = {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionVerdict: HarnessVersionVerdict;
  readonly mode: HarnessMode;
  /** The mode origin: the delivered default or a declared value (DM-3). */
  readonly modeOrigin?: HarnessModeOrigin;
};

/** The refusal a resolved facts set implies, or `undefined` when it admits. */
export const harnessFactsRefusal = (
  facts: ProductionHarnessFacts,
): ProductionHarnessRefusal | undefined => {
  if (facts.versionVerdict === "outside") {
    return {
      kind: "harness",
      code: "harness.version.unsupported",
      summary: `observed harness version ${facts.observedVersion ?? "unknown"} is outside the supported window`,
      harness: {
        kind: facts.kind,
        observedVersion: facts.observedVersion,
        versionVerdict: "outside",
      },
    };
  }
  if (facts.versionVerdict === "indeterminate") {
    return {
      kind: "harness",
      code: "harness.version.unknown",
      summary: "the harness version could not be determined",
      harness: { kind: facts.kind, observedVersion: null, versionVerdict: "indeterminate" },
    };
  }
  const availability = evaluateHarnessModeAvailability(facts.mode);
  if (!availability.available) {
    return {
      kind: "harness",
      code: "harness.mode.unavailable",
      summary: `requested mode ${availability.requested} is unavailable; the available mode is ${availability.availableMode}`,
      harness: {
        kind: facts.kind,
        observedVersion: facts.observedVersion,
        versionVerdict: "inside",
        mode: availability.requested,
      },
    };
  }
  return undefined;
};

/**
 * Build the pre-session harness admission (GH-335 F-1/F-2, NFR-1).
 *
 * One resolution per dispatch: the injected probe runs once, the window is
 * evaluated once, and the mode availability is classified. The admission runs
 * before the lease claim, so a refusal claims no lease, starts no child, and
 * appends no attempt record.
 */
export const createHarnessAdmission = (input: {
  readonly kind: HarnessKind;
  readonly mode: HarnessMode;
  readonly modeOrigin?: HarnessModeOrigin;
  readonly registrations: readonly HarnessAdapterRegistration[];
  readonly versionProbe: HarnessVersionProbe;
  readonly now: () => number;
}): (() => Promise<
  | { readonly ok: true; readonly facts: ProductionHarnessFacts }
  | { readonly ok: false; readonly error: ProductionHarnessRefusal }
>) => {
  return async () => {
    const instance = await resolveHarnessInstance({
      kind: input.kind,
      registrations: input.registrations,
      versionProbe: input.versionProbe,
      now: input.now,
      mode: input.mode,
      ...(input.modeOrigin === undefined ? {} : { modeOrigin: input.modeOrigin }),
    });
    if (!instance.ok) {
      return {
        ok: false,
        error: {
          kind: "config",
          code: instance.error.code,
          ...(instance.error.field === undefined ? {} : { field: instance.error.field }),
          ...(instance.error.summary === undefined ? {} : { summary: instance.error.summary }),
        },
      };
    }
    const facts: ProductionHarnessFacts = {
      kind: input.kind,
      observedVersion: instance.value.observedVersion,
      versionVerdict: instance.value.versionVerdict ?? "indeterminate",
      mode: instance.value.mode ?? input.mode,
      ...(instance.value.modeOrigin === undefined && input.modeOrigin === undefined
        ? {}
        : { modeOrigin: instance.value.modeOrigin ?? input.modeOrigin }),
    };
    const refusal = harnessFactsRefusal(facts);
    return refusal === undefined ? { ok: true, facts } : { ok: false, error: refusal };
  };
};

/** The delivered harness adapter registrations (one per closed kind). */
export const productionHarnessRegistrations: readonly HarnessAdapterRegistration[] = [
  { kind: "opencode", create: createOpencodeInstance },
  { kind: "claude-code", create: createClaudeInstance },
];

/** The declared bound for one caller-supplied value inside a refusal summary. */
export const PROFILE_SUMMARY_MAX_CHARS = 64 as const;

/** Single-line and bound one caller-supplied value for a refusal summary (F-9). */
export const boundedSummaryValue = (value: string): string => {
  // Control characters (including newlines and tabs) become spaces, then runs
  // of whitespace collapse: the value can never open a second summary line.
  const single = [...value]
    .map((character) => ((character.codePointAt(0) ?? 0) < 0x20 ? " " : character))
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
  return single.length <= PROFILE_SUMMARY_MAX_CHARS
    ? single
    : `${single.slice(0, PROFILE_SUMMARY_MAX_CHARS - 1)}…`;
};

/**
 * Resolve one spawn's single-seat binding, or the pre-session refusal it implies
 * (GH-335 F-3, DEC-16, TDR-0040 A-2).
 *
 * The caller supplies the agent identity; this is the composition's resolution
 * call site. An unassigned named agent refuses through the delivered
 * `provider.profile.invalid` with its agent, profile, and declared seats in the
 * bounded summary, and an unrepresentable seat model refuses through
 * `harness.profile.model-unrepresentable`.
 */
export const resolveHarnessAdmissionBinding = (request: {
  readonly agent: string;
  readonly profile: HarnessProfileView;
  readonly selection: HarnessSelectionView;
  readonly profileName?: string;
  readonly resolve?: (
    profile: HarnessProfileView,
    selection: HarnessSelectionView,
    agent?: string,
  ) => HarnessBindingResolution;
}):
  | { readonly ok: true; readonly binding: HarnessSeatBinding }
  | { readonly ok: false; readonly error: HarnessFailure } => {
  // DEC-17 / AC-F3-1: a present empty or whitespace-only identity is invalid
  // input naming the agent-identity field, never a profile refusal.
  const violation = harnessAgentIdentityViolation(request.agent);
  if (violation !== undefined) {
    return {
      ok: false,
      error: {
        kind: "config",
        code: "config.value.invalid",
        field: violation.field,
        summary: violation.summary,
      },
    };
  }
  const resolve = request.resolve ?? resolveBinding;
  const resolution = resolve(request.profile, request.selection, request.agent);
  if (resolution.outcome === "unassigned") {
    const seats = Object.keys(request.profile.seats).sort();
    const profile = boundedSummaryValue(request.profileName ?? "selected");
    return {
      ok: false,
      error: {
        kind: "provider",
        code: "provider.profile.invalid",
        field: "agent",
        summary: `agent ${boundedSummaryValue(request.agent)} has no seat in profile ${profile} (declared seats: ${seats.length === 0 ? "none" : seats.join(", ")})`,
      },
    };
  }
  if (resolution.outcome === "no-agent") {
    return {
      ok: false,
      error: {
        kind: "config",
        code: "config.value.invalid",
        field: "agent",
        summary: "a named agent resolved no seat",
      },
    };
  }
  const expressibility = evaluateModelExpressibility(resolution.binding);
  if (!expressibility.ok) {
    return {
      ok: false,
      error: {
        kind: "harness",
        code: "harness.profile.model-unrepresentable",
        field: "seat",
        summary: expressibility.summary,
      },
    };
  }
  return { ok: true, binding: resolution.binding };
};

/**
 * Resolve the dispatch's selected profile context from already-resolved
 * configuration values (GH-335 F-2, review F-7).
 *
 * The single home of the configuration → selected-profile → context mapping: the
 * composition calls it with the resolved values and a test drives it directly, so
 * the mount's context half has an oracle instead of only a source-text assertion.
 */
export const resolveProfileContextFrom = (
  values: Readonly<Record<string, ConfigValue>>,
  nowMs: number,
): HarnessProfileContext | undefined => {
  const providerParsed = parseAndValidateProviderConfiguration(values);
  if (!providerParsed.ok) return undefined;
  const profileParsed = parseAndValidateProfileConfiguration(values, providerParsed.config);
  if (!profileParsed.ok) return undefined;
  const selection = selectProfile({
    profiles: profileParsed.config,
    probe: createResolvedProviderProbe(providerParsed.config.entries, nowMs),
    nowMs,
  });
  if (!selection.ok) return undefined;
  const profile = profileParsed.config.profiles[selection.decision.profile];
  if (profile === undefined) return undefined;
  return {
    profile: { seats: profile.seats, agentOverrides: profile.agentOverrides },
    selection: {
      agentOverrides: selection.decision.agentOverrides,
      seatModels: selection.decision.seatModels,
    },
    profileName: selection.decision.profile,
  };
};

/**
 * Wrap a harness session port in the composition's per-spawn resolution.
 *
 * The caller's agent identity is read from the port input's own member, the
 * pure resolver is called once per spawn, and the returned single-seat binding
 * is supplied on the sibling member. A role-less call binds nothing. This is the
 * production resolution call site (DEC-16): the composition mounts it on the
 * opencode port and supplies the selected profile through `context`.
 *
 * An `unassigned` named agent refuses through the delivered
 * `provider.profile.invalid`, naming the agent, the profile, and the declared
 * seats (AC-F3-4, TDR-0040 A-2); `config.value.invalid` is reserved for the
 * invalid identity and the contract-violation case.
 */
export type HarnessProfileContext = {
  readonly profile: HarnessProfileView;
  readonly selection: HarnessSelectionView;
  readonly profileName?: string;
};

export const createHarnessProfilePort = (request: {
  readonly port: HarnessSessionPort;
  readonly profile?: HarnessProfileView;
  readonly selection?: HarnessSelectionView;
  readonly profileName?: string;
  /** The lazily resolved profile context, preferred over the static pair. */
  readonly context?: (input: { readonly workItemRef: string }) => HarnessProfileContext | undefined;
  readonly resolve?: (
    profile: HarnessProfileView,
    selection: HarnessSelectionView,
    agent?: string,
  ) => HarnessBindingResolution;
}): HarnessSessionPort => {
  const bind = <TInput extends { readonly agent?: string; readonly binding?: HarnessSeatBinding }>(
    call: (callInput: TInput) => Promise<HarnessResult<HarnessSessionHandle>>,
  ) => {
    return async (callInput: TInput): Promise<HarnessResult<HarnessSessionHandle>> => {
      if (callInput.agent === undefined) return call(callInput);
      const violation = harnessAgentIdentityViolation(callInput.agent);
      if (violation !== undefined) {
        return {
          ok: false,
          error: {
            kind: "config",
            code: "config.value.invalid",
            field: violation.field,
            summary: violation.summary,
          },
        };
      }
      const context =
        request.context?.({
          workItemRef: (callInput as { readonly workItemRef?: string }).workItemRef ?? "",
        }) ??
        (request.profile === undefined || request.selection === undefined
          ? undefined
          : {
              profile: request.profile,
              selection: request.selection,
              ...(request.profileName === undefined ? {} : { profileName: request.profileName }),
            });
      if (context === undefined) {
        // DEC-18: an unresolvable profile context is a pre-resolution input
        // failure on the delivered `config.value.invalid` identity, naming the
        // agent-identity field with a FIXED bounded summary (no interpolated
        // caller value) — never a fourth resolution outcome.
        return {
          ok: false,
          error: {
            kind: "config",
            code: "config.value.invalid",
            field: "agent",
            summary: "no provider profile could be resolved for the supplied agent",
          },
        };
      }
      // One mapping: the wrapper delegates to the pure helper above.
      const resolved = resolveHarnessAdmissionBinding({
        agent: callInput.agent,
        profile: context.profile,
        selection: context.selection,
        ...(context.profileName === undefined ? {} : { profileName: context.profileName }),
        ...(request.resolve === undefined ? {} : { resolve: request.resolve }),
      });
      if (!resolved.ok) return { ok: false, error: resolved.error };
      return call({ ...callInput, binding: resolved.binding });
    };
  };
  const { port } = request;
  return {
    ...port,
    spawn: bind(port.spawn),
    deliver: bind(port.deliver),
    resume: bind(port.resume),
  };
};

/**
 * Resolve the opencode store path at the runtime-aware edge (GH-335 F-5, §7.1).
 *
 * The delivered default names the harness's own data directory with a `~/`
 * prefix, and the harness's observed `OPENCODE_DB` override wins when the
 * injected environment record carries it. Core reads no ambient environment:
 * both the value and the home directory arrive injected.
 */
export const reconcileOpencodeStorePath = (input: {
  readonly configured: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory: string;
}): string => {
  const override = input.environment.OPENCODE_DB;
  const chosen =
    override !== undefined && override.trim().length > 0 ? override.trim() : input.configured;
  if (chosen === "~") return input.homeDirectory;
  if (chosen.startsWith("~/")) return `${input.homeDirectory}/${chosen.slice(2)}`;
  return chosen;
};

/**
 * The opencode invocation args per mode surface (GH-335 F-2, TDR-0042).
 *
 * The default mode's observed surface is `--standalone`; the composition owns
 * the surface selection, so the adapter never invents a mode flag.
 */
export const PRODUCTION_OPENCODE_ARGS = {
  spawn: ["--standalone", "run", "--format", "json"],
  resume: ["--standalone", "run", "--format", "json", "--session"],
  list: ["--standalone", "session", "list", "--format", "json"],
} as const;
/**
 * The composition-edge transport facts (DM-10, Table C).
 *
 * `policy` is the closed composition choice; an absent policy means the declared
 * `prefer-cli` default. `runner` is injected by tests so no live process runs.
 */
export type CompositionTransportFacts = {
  readonly policy?: GithubTransportPolicy;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly runner?: GithubChildRunner;
  readonly timeoutMs?: number;
};

/**
 * Resolve the transport selection at the launcher edge (async, DM-10).
 *
 * `api-only` never probes; `prefer-cli` awaits exactly one bounded probe and
 * degrades to the API transport with the probe refusal code. This function is
 * distinct from the adapter's pure `resolveTransportSelection` on purpose: one
 * is the launcher edge, the other is synchronous data resolution.
 */
export const resolveCompositionTransportSelection = async (
  facts: CompositionTransportFacts,
): Promise<GithubTransportSelection> => {
  const policy = facts.policy ?? "prefer-cli";
  if (policy === "api-only") return resolveTransportSelection({ policy });
  const probe = await probeGithubCli({
    ...(facts.runner === undefined ? {} : { runner: facts.runner }),
    environment: facts.environment,
    ...(facts.timeoutMs === undefined ? {} : { timeoutMs: facts.timeoutMs }),
  });
  return resolveTransportSelection({ policy, probe });
};

export const createProductionComposer = (facts: ProductionCompositionFacts): EntrypointComposer => {
  return (brand: BrandIdentity, invocation?: EntrypointInvocationFact) => {
    const environment = facts.environment;
    const cwd = facts.cwd;
    const ownProcessId = facts.processId ?? 0;
    const signalHost = facts.signalHost;
    const homeDirectory = trimTrailingSeparators(facts.homeDirectory);
    // The configuration filesystem facts: production uses the node facts; a
    // test may inject counting facts so per-layer reads are observable.
    const localFs = facts.configurationFs ?? nodeFileSystemFacts();
    // The declared prior identity (GH-320 F-2): its two directory names come
    // from the one resolver, so no prior path is a second literal. An unusable
    // prior name simply declares no fallback.
    const priorNames = (() => {
      const priorWorkingName = invocation?.priorWorkingName;
      if (priorWorkingName === undefined || priorWorkingName.length === 0) return undefined;
      const prior = resolveBrandIdentity({ workingName: priorWorkingName });
      return prior.ok
        ? {
            configDirectoryName: prior.value.configDirectoryName,
            stateDirectoryName: prior.value.stateDirectoryName,
          }
        : undefined;
    })();
    // The notice's once-state belongs to this composed program (DEC-10): one
    // emission per source kind, never a process global. The rendered lines travel
    // the delivered warning channel, which the surface writes to stderr through
    // the serializer in every mode and never into the payload.
    const emittedNotices = new Set<string>();
    const compositionNotices: string[] = [];
    // The declared degradation is composition data whose only observable
    // surface is exactly one rendered line (DM-10, AC-F2-2): no persisted copy,
    // no new readable surface on the composed program object.
    const selectionDegradation = facts.githubTransportSelection?.degradation;
    if (selectionDegradation !== undefined) {
      const selectionLine = `GitHub CLI transport unavailable (${selectionDegradation.code}); using the API transport.`;
      compositionNotices.push(selectionLine);
      invocation?.onCompositionNotice?.(selectionLine);
    }
    const emitNotice = (notice: PriorIdentityNotice): void => {
      if (emittedNotices.has(notice.reason)) return;
      emittedNotices.add(notice.reason);
      const line = renderPriorIdentityNotice(notice);
      compositionNotices.push(line);
      // The entrypoint's containment branch delivers these lines when the
      // composition fails before returning a program (GH-320 F-1, AC-F5-6).
      invocation?.onCompositionNotice?.(line);
    };
    const emitConfigNotice = (prior: readonly ConfigPriorOutcome[] | undefined): void => {
      if (prior === undefined || prior.length === 0) return;
      const read = prior.find((entry) => entry.state === "read");
      if (read !== undefined) {
        emitNotice({
          reason: "config-read",
          priorLocation: read.file,
          currentLocation: read.currentFile,
        });
        return;
      }
      const shadowed = prior[0];
      if (shadowed !== undefined) {
        emitNotice({
          reason: "config-skipped",
          priorLocation: shadowed.file,
          currentLocation: shadowed.currentFile,
        });
      }
    };
    // The two layers (GH-288 F-1, DEC-12): the delivered host root holds
    // host-wide controls only, and the derived project root holds every
    // delivery artifact of this checkout. One policy resolves both — the host
    // root honours the absolute state-directory environment override and otherwise the
    // home default — and that same policy is the daemon family's one
    // state-directory resolution (GH-286 F-3, DM-5): no inline home-plus-brand
    // composition survives here, and an unresolvable host root is the
    // classified scope refusal (GH-286 AC-F3-5, GH-288 DEC-17).
    // The prior identity's default root is probed through the injected filesystem
    // facts; the policy itself stays pure and takes the facts as data.
    const existsSafe = (path: string): boolean => {
      try {
        return localFs.exists(path);
      } catch {
        return false;
      }
    };
    const scope = resolveProjectScope({
      environment,
      environmentPrefix: brand.environmentPrefix,
      stateDirectoryName: brand.stateDirectoryName,
      homeDirectory,
      ...(priorNames === undefined
        ? {}
        : { priorStateDirectoryName: priorNames.stateDirectoryName }),
      probeDefaultRoot: existsSafe,
      checkout: readCheckoutIdentity({ cwd, io: nodeRepositoryIo() }),
      ports: {
        readMarker: (commonDir) => readProjectIdentityMarker(commonDir),
        writeMarker: (commonDir, text) => ensureProjectIdentityMarkerText(commonDir, text),
        newProjectIdentifier: () => globalThis.crypto.randomUUID().replace(/-/gu, ""),
      },
    });
    if (!scope.ok) return scopeRefusalProgram(scope.error);
    const roots = stateScopeRoots(scope.value);
    const selection = scope.value.hostRootSelection;
    if (selection.kind === "prior" && selection.priorDefaultRoot !== undefined) {
      emitNotice({
        reason: "state-read",
        priorLocation: selection.priorDefaultRoot,
        currentLocation: selection.currentDefaultRoot,
      });
    } else if (
      selection.kind === "current" &&
      selection.priorDefaultRoot !== undefined &&
      selection.priorDefaultRootExists
    ) {
      emitNotice({
        reason: "state-skipped",
        priorLocation: selection.priorDefaultRoot,
        currentLocation: selection.currentDefaultRoot,
      });
    }
    const hostRoot = roots.hostRoot;
    const stateDirectory = roots.projectRoot;
    const checkoutRoot =
      scope.value.scope.kind === "project" ? scope.value.scope.checkoutRoot : cwd;
    const changesDirectory = `${cwd}/doc/changes`;
    // One per-pass owner-hold resolution over the injected environment and the
    // host root (GH-280 F-1, D12; GH-288 F-7 keeps the hold host-wide). Never
    // cached.
    const readOwnerHold = (): OwnerHoldFact => {
      const marker = readOwnerHoldMarker(
        { storeDirectory: hostRoot },
        nodeOwnerHoldMarkerFileSystem(),
      );
      return resolveOwnerHoldFact({
        environment,
        environmentPrefix: brand.environmentPrefix,
        storeDirectory: hostRoot,
        marker,
      });
    };
    // One git-root resolution for every configuration branch composition.
    const gitRootForConfig = (): string | undefined => findGitRoot(cwd, nodeRepositoryIo());
    const notesFs = nodePmNotesFileSystemFacts();
    /**
     * The one read-only project-configuration acquisition with the prior
     * identity (GH-320 F-3, DEC-14). Every composition-time and per-invocation
     * acquisition goes through here, so the fallback is exercised by the
     * delivered composition and no command gains a read. The notice is emitted
     * once per composed program by the owner above.
     */
    const acquireProjectConfiguration = (gitRoot: string | undefined) => {
      const acquired = acquireFileConfig({
        platform: runtimePlatform(),
        homeDirectory,
        environment,
        ...(gitRoot === undefined ? {} : { gitRoot }),
        enableSystemConfig: true,
        enableUserConfig: true,
        enableProjectLocalConfig: true,
        configurationDirectoryName: brand.configDirectoryName,
        ...(priorNames === undefined
          ? {}
          : { priorConfigurationDirectoryName: priorNames.configDirectoryName }),
        fs: localFs,
      });
      if (acquired.ok) emitConfigNotice(acquired.prior);
      return acquired;
    };
    const nowIso = (): string => facts.clock?.nowIso() ?? new Date().toISOString();
    const nowMs = (): number => facts.clock?.nowMs() ?? Date.now();
    // The composition's declared start instant rides every lane owner fact.
    const compositionStartedAt = nowIso();
    // The one injected delay fact (GH-347 AC-F9-2): production binds the real
    // timer; an offline composition injects its recorder.
    const dispatchDelay: DispatchDelay =
      facts.dispatchDelay ??
      ((ms) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
    const newFenceToken = (): string => globalThis.crypto.randomUUID();
    const workspaceId = "default";

    // The derived host index: exactly one read and at most one write per
    // store-opening invocation whose scope resolves inside a checkout, no
    // filesystem crawl, and no maintenance on a read-only list path (F-2,
    // DEC-4, DEC-5, DEC-14, DEC-18). A key held under another identifier is
    // never adopted: the invocation refuses before opening the store.
    const hostIndexAccess = facts.hostIndexAccess ?? createHostIndexAccess();
    const maintenanceWarnings: string[] = [];
    const probeRecordedRoot = (root: string): HostIndexRootProbe => {
      if (!existsSync(root)) return { state: "absent" };
      const identity = readCheckoutIdentity({ cwd: root, io: nodeRepositoryIo() });
      if (identity.kind !== "resolved") return { state: "uncertain" };
      const markerRead = readProjectIdentityMarker(identity.commonDir);
      if (markerRead.state !== "present") return { state: "uncertain" };
      const marker = parseProjectIdentityMarker(markerRead.text);
      return marker === undefined
        ? { state: "uncertain" }
        : { state: "resolved", projectIdentifier: marker.projectIdentifier };
    };
    // The read-only surfaces never maintain the index: the group surface and
    // the flat record set are list reads (GH-288 F-2, GH-309 F-7), and the
    // group-scoped `queue`/`status` forms read per-checkout state only
    // (GH-309 F-3, NFR-2, AC-NFR2-1). This holds on classified-failure paths
    // too: the maintenance block runs before the handler, so it is gated here.
    const maintainsIndex =
      invocation?.command !== PROJECTS_COMMAND_FAMILY &&
      invocation?.command !== REPOS_COMMAND_FAMILY &&
      invocation?.command !== "board" &&
      invocation?.groupScoped !== true;
    // The legacy detection (GH-288 F-8, AC-F8-2): an unmigrated host root is
    // reported once per state-opening invocation, moves nothing, deletes
    // nothing, and never changes the exit code. A migrated host emits nothing.
    const legacyWarning =
      maintainsIndex && scope.value.scope.kind === "project"
        ? legacyStoreWarning({
            hostArtifacts: readStateRootArtifacts(hostRoot),
            projectRootExists: existsSync(scope.value.scope.stateLocation),
          })
        : undefined;
    if (legacyWarning !== undefined) maintenanceWarnings.push(legacyWarning);
    if (maintainsIndex && scope.value.scope.kind === "project") {
      const current = scope.value.scope;
      hostIndexAccess.countRead();
      const read = readHostIndexFile(hostRoot);
      if (read.state !== "unreadable") {
        const document = read.state === "present" ? parseHostIndexDocument(read.text) : undefined;
        const corrupt = read.state === "present" && document === undefined;
        const maintained = maintainHostIndex({
          hostRoot,
          document,
          corrupt,
          registration: {
            projectKey: current.projectKey,
            projectIdentifier: current.projectIdentifier,
            root: current.checkoutRoot,
            stateLocation: current.stateLocation,
            recordedAt: nowIso(),
          },
          probe: probeRecordedRoot,
        });
        maintenanceWarnings.push(...maintained.warnings);
        if (maintained.next !== undefined) {
          if (maintained.preserveCorruptAs !== undefined && read.state === "present") {
            preserveCorruptHostIndex(hostRoot, maintained.preserveCorruptAs, read.text);
          }
          hostIndexAccess.countWrite();
          replaceHostIndexFile(hostRoot, serializeHostIndexDocument(maintained.next));
        }
        if (maintained.conflict !== undefined) {
          return scopeRefusalProgram(
            {
              kind: "state",
              code: "projects.state-unavailable",
              summary:
                `project key ${maintained.conflict.projectKey} is registered to another project ` +
                `identifier (${maintained.conflict.existingIdentifier}); this checkout ` +
                `(${maintained.conflict.candidateRoot}) cannot establish its state location`,
            },
            maintenanceWarnings,
          );
        }
      }
    }

    const openedStore = createStateStore(
      {
        level: "local",
        workspaceId,
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory,
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );
    const store = facts.stateStoreWrap?.(openedStore) ?? openedStore;

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
        const settings = resolveProjectDaemonSettings(directory, { values, origins });
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
      const acquired = acquireProjectConfiguration(gitRoot);
      if (!acquired.ok) return resolveOver({}, {});
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return resolveOver({}, {});
      return resolveOver(resolved.value.values, resolved.value.origins);
    };

    /**
     * Compose the daemon family's runtime over the one resolved state-directory
     * scope — the project state root the store, lock, settings, socket, and
     * supervisor scope all share (GH-286 F-3, GH-288 F-6). The settings-invalid
     * outcome composes the unavailable runtime, so the family stays registered
     * while no store, lock, settings, transport, socket path, supervisor scope,
     * entry path, or pid is constructed.
     */
    const daemonDirectory = stateDirectory;
    const daemonConfiguration = readDaemonConfiguration(daemonDirectory);
    const daemonRuntime = ((): DaemonCommandRuntime => {
      if (daemonConfiguration === undefined) {
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
      // is invented, so a stripped `PATH` or home stays stripped, the home
      // variable keeps the name it was read from (`HOME`, else `USERPROFILE`),
      // and every key outside that declared set is dropped (GH-320 F-3b).
      const reentryEnvironment = daemonReentryEnvironment(environment);
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
        // The state-directory binding names the host root, so a re-entered
        // child or the installed unit derives this same project state root from
        // it instead of nesting a second `projects/` segment under the project
        // root (GH-288 F-1, GH-286 F-3).
        stateDirectoryEnvironmentValue: hostRoot,
        // The unit runs in the checkout when the scope is project-owned, so the
        // installed process resolves the same project rather than `unbound`.
        workingDirectory: checkoutRoot,
        unit: `${brand.binaryName}-daemon.service`,
        binary: facts.daemonEntry ?? "",
        environmentName: stateScopeEnvironmentName(brand.environmentPrefix),
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
      // root is unresolvable: `install` AND `uninstall` refuse with
      // `config.value.invalid` before the unsupported and missing-entry-path
      // refusals, write no unit and no ownership marker, invoke no supervisor
      // command, create no configuration-root directory, and never search the
      // state directory (AC-F7-2, DM-6, NF-7). Every other subcommand keeps the
      // resolved runtime.
      if (supervisorConfigDirectory !== undefined) return composed;
      return {
        ...composed,
        install: async () => daemonConfigurationRefusal(),
        uninstall: async () => daemonConfigurationRefusal(),
      };
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
    // An injected transport bypasses selection entirely (probe-free). A present
    // selection picks the CLI transport or the exported native-`fetch` factory;
    // an absent selection is the declared third state: native `fetch`, no probe,
    // no DM-10 value. The CLI host identity is computed ONCE from the declared
    // instance base URL, so no request can re-derive it (D1).
    const cliHostname = githubCliHostname(new URL(instance.baseUrl).host);
    const transport =
      facts.githubTransport ??
      (facts.githubTransportSelection?.selected === "gh"
        ? createGithubCliTransport({
            ...(facts.githubCliRunner === undefined ? {} : { runner: facts.githubCliRunner }),
            environment,
            hostname: cliHostname,
          })
        : createGithubNativeTransport());
    const gitBranches = createGitBranchSeam({
      cwd,
      ...(facts.gitChildRunner === undefined ? {} : { childRunner: facts.gitChildRunner }),
    });
    // Resolve the checkout facts once per invocation. An injected origin replaces
    // only the remote; the checkout root always comes from the working directory,
    // so a composition test can never supply a synthetic root (DEC-2, DEC-5).
    // One memoized reader serves the composing checkout and every fleet row's
    // own checkout, so a fleet read pays one metadata read per distinct checkout
    // and never a second resolution of the same one.
    const repositoryFactsByRoot = new Map<string, ReturnType<typeof readRepositoryFacts>>();
    const repositoryFactsFor = (root: string): ReturnType<typeof readRepositoryFacts> => {
      const cached = repositoryFactsByRoot.get(root);
      if (cached !== undefined) return cached;
      const facts = readRepositoryFacts({ cwd: root, io: nodeRepositoryIo() });
      repositoryFactsByRoot.set(root, facts);
      return facts;
    };
    const resolvedRepositoryFacts = repositoryFactsFor(cwd);
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
    const repositoryBinding = repositoryBindingOf(
      target !== undefined ? repositoryKey : undefined,
      repositoryFacts.root,
    );
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

    /**
     * The group-scoped work read (GH-309 F-5, F-6). The production closure is
     * assigned below once the group read helpers exist; every composed runtime
     * only invokes it after composition has completed.
     */
    let readProjectGroupWork: (groupKey: string) => Promise<ProjectGroupWorkRead> = async () => ({
      ok: false,
      code: "projects.scope-unavailable",
      summary: "the project group scope is not composed",
    });

    const statusComposition = () => ({
      store,
      credentials,
      transport,
      repository: { cwd, io: nodeRepositoryIo() },
      localContext: { path: pmContextPath, fs: localFs },
      clock: { nowMs, nowIso },
      github: { instance },
      readOwnerHold,
      readProjectGroup: (groupKey: string) => readProjectGroupWork(groupKey),
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
     * The bounded local plan-member read (GH-310 F-2, DEC-21, DM-6): one plan
     * read plus the injected YAML parse. No configuration and no network are
     * read; an absent, unreadable, unparseable, member-less, or invalid plan
     * leaves the delivered single-ref queue path untouched.
     */
    const readPlanMembers: NonNullable<QueueComposition["readPlanMembers"]> = (ref) => {
      const read = plan.readPlan(ref);
      if (!read.ok) return undefined;
      const parsed = plan.parseYaml(read.text);
      if (!parsed.ok) return undefined;
      const document = parsed.value;
      if (typeof document !== "object" || document === null || Array.isArray(document)) {
        return undefined;
      }
      const raw = (document as { readonly members?: unknown }).members;
      if (raw === undefined) return undefined;
      return parsePlanMembers(raw, ref).members;
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

    const queueComposition = withRepositoryBinding(
      {
        store,
        facts: queueFacts,
        nowIso,
        nowMs,
        newFenceToken,
        degraded: daemonReachability,
        readyRuntime: createStatusCommandRuntime(statusComposition(), noChain),
        readOwnerHold,
        readPlanMembers,
        readProjectGroup: (groupKey: string) => readProjectGroupWork(groupKey),
        // GH-292 F-5: the per-item tracker delivery-state read for `queue
        // reconcile`, riding the same verified GitHub client the closeout
        // composition reads with. No ambient credential read: the client uses
        // the already-injected declared credential port. `provider.not-found`
        // is a truthful observation (the item is retained and reported
        // unobserved); an unavailable read surfaces its provider identity and
        // the sweep stops.
        readTrackerDeliveryState: async (ref: string): Promise<QueueTrackerRead> => {
          const issueNumber = /^[A-Za-z]+-([0-9]+)$/.exec(ref)?.[1];
          if (issueNumber === undefined) {
            return { ok: false, failureCode: "provider.payload.invalid" };
          }
          const observation = await client.readWorkItemObservation(issueNumber);
          if (observation.observation === "observed") {
            return {
              ok: true,
              kind: "state",
              deliveryState: observation.value.status.deliveryState,
            };
          }
          if (observation.observation === "not-found") {
            return { ok: true, kind: "not-found" };
          }
          return {
            ok: false,
            failureCode:
              observation.observation === "invalid" && observation.code !== undefined
                ? observation.code
                : "provider.outage",
          };
        },
      },
      repositoryBinding,
    );

    /**
     * The gates surface's one bounded configuration-document resolution
     * attempt (GH-300 DM-9). The result is memoized for the invocation, the map
     * node is extracted and resolved by the map's own resolver, and no other
     * configuration layer is read. The gate-set seam stays untouched.
     */
    let committedSuiteMapRead: ReturnType<typeof readCommittedConfigDocument> | undefined;
    const readSuiteMap = (): ReturnType<typeof suiteMapReadOfDocument> => {
      if (committedSuiteMapRead === undefined) {
        const gitRoot = gitRootForConfig();
        const selectedConfig = environment[`${brand.environmentPrefix}CONFIG`];
        committedSuiteMapRead = readCommittedConfigDocument({
          platform: runtimePlatform(),
          homeDirectory,
          environment,
          ...(gitRoot === undefined ? {} : { gitRoot }),
          ...(selectedConfig === undefined ? {} : { selectedConfig }),
          enableSystemConfig: false,
          enableUserConfig: false,
          enableProjectLocalConfig: false,
          configurationDirectoryName: brand.configDirectoryName,
          fs: localFs,
        });
      }
      return suiteMapReadOfDocument(committedSuiteMapRead);
    };

    const gates = createVerifyGatesCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
      repository: { cwd, io: nodeRepositoryIo() },
      workflow: { baseDirectory: cwd, fs: localFs },
      github: { instance, credentials, transport },
      nowMs,
      readSuiteMap,
    });

    /** The declared integration base the checkout's base reference resolves to. */
    const mergeBaseRef = CLOSEOUT_INTEGRATION_BASE;
    /**
     * The RESOLVED base branch the dispatch lifecycle prompt interpolates
     * (GH-347 AC-F7-3, DM-6): the composition fact is the resolution, and the
     * delivered integration base is the declared fallback. It never reads the
     * constant at the prompt's own build site.
     */
    const dispatchBaseBranch =
      facts.dispatchBaseBranch !== undefined && facts.dispatchBaseBranch.length > 0
        ? facts.dispatchBaseBranch
        : CLOSEOUT_INTEGRATION_BASE;
    /** The checkout's own current branch, read from its git facts. */
    const mergeBranch = resolvedRepositoryFacts.head.branch;

    /**
     * The provider-resolved repository owner (GH-293 DEC-13, TDR-0031 D8): the
     * owner component of the checkout's normalized `host/owner/name` identity,
     * resolved through the delivered identity policy with no new configuration
     * key and no persistence on this path.
     */
    const mergeOwnerPrincipalOf = (): string | undefined => {
      const repository = resolveProductionRepository(undefined, { persist: false });
      if (repository === undefined) return undefined;
      const parts = repository.split("/");
      return parts.length === 3 ? parts[1] : undefined;
    };

    /**
     * One declared configuration resolution for the merge branch (GH-293 F-6).
     *
     * An absent document keeps the delivered defaults; an unreadable or invalid
     * document forwards its own classified code rather than silently resolving
     * `{}`. The declared keys stay exactly `gate-freshness`, `gates`, and
     * `deploy-expectations`, and the forwarded code is a member of the delivered
     * configuration taxonomy by type.
     */
    type MergeConfigurationRead =
      | { readonly ok: true; readonly values: Readonly<Record<string, ConfigValue>> }
      | { readonly ok: false; readonly code: ConfigErrorCode; readonly detail?: string };
    let mergeConfigurationCache: MergeConfigurationRead | undefined;
    const mergeConfiguration = (): MergeConfigurationRead => {
      if (mergeConfigurationCache !== undefined) return mergeConfigurationCache;
      const acquired = acquireProjectConfiguration(gitRootForConfig());
      if (!acquired.ok) {
        mergeConfigurationCache = { ok: false, code: acquired.error.code };
        return mergeConfigurationCache;
      }
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) {
        mergeConfigurationCache = { ok: false, code: resolved.error.code };
        return mergeConfigurationCache;
      }
      mergeConfigurationCache = { ok: true, values: resolved.value.values };
      return mergeConfigurationCache;
    };

    /**
     * Map one adapter read failure onto the composition's declared identities
     * (GH-293 F-7, OQ-TP-6). Every mapped code is a member of the declaration
     * above; a read fault never reaches `fallback.internal`.
     */
    const mergeReadCodeOf = (read: {
      readonly code: string;
      readonly httpStatus?: number;
    }): string => {
      if (read.code === "config.credential.missing") return "config.credential.missing";
      if (read.code === "provider.auth.rejected") return "provider.auth.rejected";
      if (read.code === "provider.outage") return "provider.outage";
      if (read.code === "provider.payload.invalid") {
        return read.httpStatus === 401 || read.httpStatus === 403
          ? "provider.auth.rejected"
          : "provider.outage";
      }
      // An absent request or work item cannot be resolved: the transaction
      // aborts cleanly before any landing mutation, and a re-run with a valid
      // reference converges (the declared `merge.transaction-aborted` meaning).
      if (read.code === "provider.not-found") return "merge.transaction-aborted";
      return "provider.outage";
    };

    const mergeWorkItem = async (
      changeRef: string,
    ): Promise<
      { readonly ok: true; readonly item: WorkItem } | { readonly ok: false; readonly code: string }
    > => {
      const issueNumber = changeRefNumberOf(changeRef);
      if (issueNumber === undefined) return { ok: false, code: "merge.transaction-aborted" };
      const read = await client.readWorkItem(Number(issueNumber));
      return read.ok ? { ok: true, item: read.value } : { ok: false, code: mergeReadCodeOf(read) };
    };

    const mergeCheckRuns = async (
      sha: string,
    ): Promise<
      | {
          readonly ok: true;
          readonly items: readonly PipelineRun[];
          readonly pageItemCount: number;
          readonly sha?: string;
        }
      | { readonly ok: false; readonly code: string }
    > => {
      const read = await client.readPipelineRun(sha, VERIFY_GATES_CI_RUN_LIMIT);
      return read.ok
        ? { ok: true, items: read.value.items, pageItemCount: read.value.pageItemCount, sha }
        : { ok: false, code: mergeReadCodeOf(read) };
    };

    const mergeRequestDetail = async (): Promise<
      | { readonly ok: true; readonly request: DeliveryRequest }
      | { readonly ok: false; readonly code: string }
    > => {
      if (target === undefined) return { ok: false, code: "merge.transaction-aborted" };
      const open = await client.listDeliveryRequests(TRUTH_PROVIDER_LIMIT);
      if (!open.ok) return { ok: false, code: mergeReadCodeOf(open) };
      const match =
        mergeBranch === undefined
          ? undefined
          : open.value.items.find((item) => item.sourceRef === mergeBranch);
      if (match !== undefined) return { ok: true, request: match };
      // The convergence case: an already-merged request for the branch's ref.
      const changeRef = mergeBranch === undefined ? undefined : changeRefInBranch(mergeBranch);
      if (changeRef !== undefined) {
        const merged = await client.findMergedDeliveryRequest({
          workItemRef: changeRef,
          limit: TRUTH_PROVIDER_LIMIT,
        });
        if (merged.observation === "observed") return { ok: true, request: merged.value };
      }
      return { ok: false, code: "merge.transaction-aborted" };
    };

    const mergeRuntimeBase = createMergeCommandRuntime({
      store,
      git: createGitMergeSeam({ cwd }),
      values: () => {
        const configuration = mergeConfiguration();
        return configuration.ok ? configuration.values : {};
      },
      readWorkItem: mergeWorkItem,
      readCheckRuns: mergeCheckRuns,
      readRequestDetail: mergeRequestDetail,
      // Resolved lazily from the checkout's identity policy: the owner component
      // of the normalized `host/owner/name`, never a configuration key.
      get ownerPrincipal() {
        return mergeOwnerPrincipalOf();
      },
      baseRef: mergeBaseRef,
      ...(mergeBranch === undefined ? {} : { branch: mergeBranch }),
      nowIso,
      nowMs,
      newFenceToken,
    });

    // The configuration document is resolved once per invocation, so its own
    // classified failure is forwarded before the transaction reads anything.
    const merge = {
      readConfig: (changeRef: string) => {
        const configuration = mergeConfiguration();
        if (!configuration.ok) {
          return {
            ok: false as const,
            code: configuration.code,
            ...(configuration.detail === undefined ? {} : { detail: configuration.detail }),
          };
        }
        return mergeRuntimeBase.readConfig(changeRef);
      },
      createPorts: mergeRuntimeBase.createPorts,
    };

    const closeout = createCloseoutComposition({
      workspaceId,
      provider: { kind: "github", client },
      git: gitBranches,
      store,
      nowIso,
      nowMs,
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

    /**
     * The harness facts the dispatch admission resolved for the run in flight.
     *
     * Composition-instance scoped, never process-global: the admission writes it
     * once per dispatch and the composed port's lazy gate reads it at spawn
     * time, so the adapter can never fall back to "inside" on a refused run.
     *
     * Invariant: one dispatch per composed instance (the delivery path composes
     * one dispatch per invocation, and the per-ref single-flight admission keeps
     * a second concurrent dispatch out). The per-spawn binding itself is NOT
     * carried here — it travels on the spawn input as per-spawn data (DEC-16).
     */
    let dispatchHarnessFacts: ProductionHarnessFacts | undefined;

    /** The gate the dispatch port reads; absent for the non-dispatch lanes. */
    const dispatchVersionGate = () =>
      dispatchHarnessFacts === undefined
        ? {
            verdict: "indeterminate" as const,
            observedVersion: null,
            mode: "per-invocation-private-server" as const,
          }
        : {
            verdict: dispatchHarnessFacts.versionVerdict,
            observedVersion: dispatchHarnessFacts.observedVersion,
            mode: dispatchHarnessFacts.mode,
          };

    /** Build the delivered session port for one configured kind. */
    const harnessFor = (
      kind: HarnessKind,
      gate?: () => {
        readonly verdict: "inside" | "outside" | "indeterminate";
        readonly observedVersion: string | null;
        readonly mode: HarnessMode;
      },
    ): HarnessSessionPort => {
      const common = {
        runner: harnessSpawnRunner,
        buildEnvironment: buildHarnessEnvironment,
        classify: classifyHarnessEvidence,
        assembleLiveness: assembleHarnessLiveness,
        now: nowIso,
      };
      const adapter =
        kind === "opencode"
          ? createOpencodeSession({
              ...common,
              starter: harnessSpawnStarter,
              command: "opencode",
              // The gate reads the facts the dispatch admission resolved for this
              // run, so a refusal cannot be bypassed by the adapter's default.
              ...(gate === undefined ? {} : { versionGate: gate }),
              // The binding's surface mapping is injected: the adapter owns no
              // second copy of the rules (GH-335 F-3, TDR-0040).
              bindingSeams: {
                identityViolation: harnessAgentIdentityViolation,
                expressibility: evaluateModelExpressibility,
                invocationArgs: bindingInvocationArgs,
                environmentRecords: bindingEnvironmentRecords,
              },
              spawnArgs: PRODUCTION_OPENCODE_ARGS.spawn,
              resumeArgs: PRODUCTION_OPENCODE_ARGS.resume,
              listArgs: PRODUCTION_OPENCODE_ARGS.list,
              // GH-347 DEC-4: the declared grace is waited through the one
              // injected delay fact with reason `terminate-grace`.
              terminateWait: (ms) => dispatchDelay(ms, "terminate-grace"),
              // GH-347 AC-F5-5, TDR-0051 DC-2/DC-3: the process-tree seam is
              // bound HERE, at the composition edge, so the adapter carries no
              // ambient process access.
              terminateTree: productionTerminateTree,
              telemetrySinkFor: ({ workItemRef }) => {
                const resolution = resolveProductionHarnessSettings();
                if (!resolution.ok) return undefined;
                return createProductionTelemetrySink({
                  store,
                  workItemRef,
                  // The invoking command's audit run id: every step record joins
                  // the audit ledger instead of carrying an invented identity.
                  runId: invocation?.runId ?? TELEMETRY_RUN_ID_UNAVAILABLE,
                  environment,
                  environmentPrefix: brand.environmentPrefix,
                  treeRoot: cwd,
                  repository: cwd,
                  nowIso,
                  newFenceToken,
                  sessionTotals: createOpencodeSessionTotalsReader({
                    opener: createBunSqliteStoreOpener(),
                    storePath: resolution.settings.opencodeDatabasePath,
                  }),
                });
              },
            })
          : createClaudeSession({
              ...common,
              command: "claude",
              headlessArgs: ["--print", "--output-format", "json"],
            });
      // GH-347 AC-F5-4 (review N1): the composition edge guarantees the
      // adapter's own declaration reaches the engine. An absent declaration is
      // filled from the adapter's exported constant; a present one is never
      // overridden.
      return harnessWithDeclaration(adapter, harnessDeclaration(kind));
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
      // The bounded tracker ladder (GH-347 API-4, DEC-7): five attempts with the
      // declared waits through the injected delay; exhaustion is named, never a
      // success-shaped fact.
      const ladder = await runDispatchTrackerLadder({
        read: async () => {
          const attempt = await readTrackerTruth(changeRef);
          return attempt.ok
            ? { ok: true as const, value: attempt.value }
            : { ok: false as const, reason: "tracker" as const, identity: attempt.identity };
        },
        delay: dispatchDelay,
      });
      const trackerRead = ladder.ok
        ? { ok: true as const, value: ladder.value }
        : { ok: false as const, identity: ladder.identity };

      let artifacts: DispatchRead<DispatchArtifactFacts>;
      if ("identity" in branch) {
        artifacts = { ok: false, reason: "artifact", identity: branch.identity };
      } else if (!pull.ok) {
        artifacts = { ok: false, reason: "artifact", identity: pull.identity };
      } else {
        const commits = await readBranchCommits(branch.branch, pull.value);
        artifacts = commits.ok
          ? {
              ok: true,
              value: {
                branchCommits: commits.value,
                pr: pull.value.fact,
                pmNotes: projectPmNotesCompleteness(verifyRuntime.readPmNotes(changeRef)),
              },
            }
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

    /**
     * The production nomination gate (GH-294 F-1, TDR-0028 D1/D3): the
     * delivered selection seam run once over the resolved provider
     * configuration, the delivered probe, and the production clock. Every
     * production dispatch nominates at admission — the first predicate,
     * before the preflight, the owner-hold gate, and the lease claim — and
     * every no-nomination shape refuses with the seam's resolve identity,
     * fail-closed: the profiles branch ships empty by default, so a fresh
     * installation declares nothing and refuses `provider.profile.absent`
     * until it declares its profiles (the branch's own fail-closed contract).
     */
    /**
     * Resolve the dispatch's selected profile context for the resolution call
     * site (GH-335 F-2, DEC-16). The same configuration the nomination gate reads;
     * an unresolvable context means a caller-supplied agent is refused, never
     * silently bound.
     */
    // Resolved once per composition instance and reused for every spawn of the
    // run, so the context the port resolves cannot drift from the one admission
    // read (review F-8; the composition holds one dispatch per instance).
    let dispatchProfileContext: HarnessProfileContext | undefined;
    let profileContextResolved = false;
    const resolveProfileContext = (): HarnessProfileContext | undefined => {
      if (profileContextResolved) return dispatchProfileContext;
      profileContextResolved = true;
      const acquired = acquireProjectConfiguration(gitRootForConfig());
      if (!acquired.ok) return undefined;
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return undefined;
      dispatchProfileContext = resolveProfileContextFrom(resolved.value.values, nowMs());
      return dispatchProfileContext;
    };

    const nominationPredicate = (): ReturnType<typeof nominateProviderProfile> => {
      const closedSet = [
        "provider.profile.absent",
        "provider.profile.invalid",
        "provider.profile.capability-denied",
        "provider.profile.unavailable",
      ];
      const gitRoot = gitRootForConfig();
      const acquired = acquireProjectConfiguration(gitRoot);
      if (!acquired.ok) {
        return {
          ok: false,
          refusal: {
            code: "provider.profile.invalid",
            summary: `provider configuration rejected (${acquired.error.code})`,
          },
        };
      }
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) {
        return {
          ok: false,
          refusal: {
            code: "provider.profile.invalid",
            summary: `provider configuration rejected (${resolved.error.code})`,
          },
        };
      }
      const providerParsed = parseAndValidateProviderConfiguration(resolved.value.values);
      if (!providerParsed.ok) {
        return {
          ok: false,
          refusal: { code: "provider.profile.invalid", summary: providerParsed.error.detail },
        };
      }
      const profileParsed = parseAndValidateProfileConfiguration(
        resolved.value.values,
        providerParsed.config,
      );
      if (!profileParsed.ok) {
        const code = (closedSet as readonly string[]).includes(profileParsed.error.code)
          ? (profileParsed.error.code as "provider.profile.absent" | "provider.profile.invalid")
          : "provider.profile.invalid";
        return { ok: false, refusal: { code, summary: profileParsed.error.detail } };
      }
      return nominateProviderProfile({
        profiles: profileParsed.config,
        probe: createResolvedProviderProbe(providerParsed.config.entries, nowMs()),
        nowMs: nowMs(),
      });
    };

    /**
     * The pre-session harness admission for one dispatch (GH-335 F-1, F-2).
     *
     * The version window is evaluated on the opencode delivery harness only:
     * claude-code stays a registered compatibility surface (NG-1) and keeps its
     * delivered behaviour. The probe runs once, in the declared allowlist
     * environment, and its facts are memoized for the composed port's gate.
     */
    const dispatchHarnessAdmission = (settings: HarnessSettings) => async () => {
      if (settings.kind !== "opencode") return { ok: true as const };
      const descriptor: HarnessExecutionEnvironmentDescriptor = {
        kind: settings.executionKind,
        workDirectory: cwd,
        environment: harnessEnvironmentEntries(settings),
      };
      const built = buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: environment,
        credentials: harnessCredentials,
        record: { DELIVERY_WORK_PATH: cwd },
      });
      if (!built.ok) {
        return {
          ok: false as const,
          error: {
            kind: "harness" as const,
            code: built.error.code,
            ...(built.error.field === undefined ? {} : { field: built.error.field }),
            ...(built.error.summary === undefined ? {} : { summary: built.error.summary }),
          },
        };
      }
      const probe =
        facts.harnessVersionProbe ??
        createHarnessVersionProbe({
          runner: harnessSpawnRunner,
          command: "opencode",
          cwd,
          environment: built.value,
        });
      const admitted = await createHarnessAdmission({
        kind: settings.kind,
        mode: settings.mode,
        modeOrigin: settings.modeOrigin,
        registrations: productionHarnessRegistrations,
        versionProbe: probe,
        now: nowMs,
      })();
      if (!admitted.ok) {
        dispatchHarnessFacts = undefined;
        return admitted;
      }
      dispatchHarnessFacts = admitted.facts;
      return { ok: true as const, facts: admitted.facts };
    };

    const dispatchComposition = (
      settings: HarnessSettings,
      lane: LaneSettings,
      repository: string,
      killGraceMs: number,
    ): DispatchComposition => ({
      store,
      stateRoot: stateDirectory,
      fenceToken: newFenceToken(),
      nowIso,
      newAttemptId: (ref) => `attempt-${ref}-${nowMs()}-${newFenceToken()}`,
      newDivergenceId: (ref) => `DIV-${ref}-${newFenceToken()}`,
      harnesses: {
        // DEC-16: the composition is the resolver's production call site. A
        // caller-supplied agent is resolved from the selected profile; a
        // role-less call is an unchanged passthrough (DEC-15).
        opencode: createHarnessProfilePort({
          port: harnessFor("opencode", dispatchVersionGate),
          context: () => resolveProfileContext(),
          resolve: resolveBinding,
        }),
        "claude-code": harnessFor("claude-code"),
      },
      defaultHarness: settings.kind,
      harnessAdmission: dispatchHarnessAdmission(settings),
      harnessFacts: () => dispatchHarnessFacts,
      descriptor: {
        kind: settings.executionKind,
        workDirectory: cwd,
        environment: harnessEnvironmentEntries(settings),
      },
      // GH-347 F-7, DEC-8: the fresh prompt is the delivery-lifecycle prompt
      // parameterized by the ref and the RESOLVED base branch.
      prompt: (ref) => buildLifecyclePrompt({ ref, baseBranch: dispatchBaseBranch }),
      // The lifecycle agent identity is `pm` through the existing caller-agent
      // member; the binding is the delivered pure resolution's single seat.
      harnessAgent: () => "pm",
      // The deterministic fresh-spawn title is a composition fact.
      freshTitle: (ref) => spawnTitleFor(ref),
      harnessBinding: () => {
        const context = resolveProfileContext();
        if (context === undefined) return undefined;
        const resolved = resolveBinding(context.profile, context.selection, "pm");
        return resolved.outcome === "binding" ? resolved.binding : undefined;
      },
      evidenceClass: DISPATCH_DEFAULT_EVIDENCE_CLASS,
      repository: () => repository,
      readTruth: dispatchTruth,
      preflight: dispatchPreflight,
      // GH-294 F-1: every production dispatch nominates at admission — the
      // first predicate, before the preflight, the owner-hold gate, and the
      // lease claim (TDR-0028 D1, OQ-TP-4). The profiles branch ships empty
      // by default, so a fresh installation refuses `provider.profile.absent`
      // until it declares its profiles (the branch's fail-closed contract).
      nominate: nominationPredicate,
      claimLease: (ref) =>
        claimDispatchLease(store, {
          ref,
          nowIso,
          nowMs,
          fenceToken: newFenceToken(),
          ownerHold: readOwnerHold(),
          delay: dispatchDelay,
        }),
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
      killGraceMs,
      appendRestart: ({ ref, runId, sessionId, ordinal, reason, recordedAt }) => {
        const appended = appendEconomicsRestartEvent(store, newFenceToken(), {
          schemaId: ECONOMICS_RESTART_SCHEMA_ID,
          workItemRef: ref,
          runId,
          sessionId,
          ordinal,
          reason,
          recordedAt,
        });
        return appended.ok;
      },
      ...(ownProcessId > 0
        ? { laneOwner: { processId: ownProcessId, startedAt: compositionStartedAt } }
        : {}),
      // The one injected delay fact (GH-347 AC-F9-2): production binds the real
      // timer; no configuration key and no ambient timer lives in the engine.
      delay: dispatchDelay,
      // The lane policy is data: both the restart bound and the liveness cadence
      // come from the typed `lane` configuration branch.
      restartBudget: lane.restartBudget,
      restartCount: (ref) => {
        const restarts = readEconomicsRecords(store, ref);
        return restarts.ok ? restarts.restarts.length : 0;
      },
      livenessIntervalMs: lane.livenessIntervalMs,
      waitForCadence,
      // The lane resolver seam (GH-347 API-3, AC-F9-2): the one function that
      // resolves the newest recorded lane carrying a session identity.
      existingLane: (ref) =>
        resolveDispatchLane(store, {
          ref,
          defaultHarnessKind: settings.kind,
          treeRoot: cwd,
          completedPhases: completedPhaseIds,
          // The adapter capability is a composition fact: the opencode adapter
          // declares resume injection; the CLI keeps the literal.
          supportsResumeInjection: (kind) => kind === "opencode",
          restartCount: (target) => {
            const restarts = readEconomicsRecords(store, target);
            return restarts.ok ? restarts.restarts.length : 0;
          },
        }),
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
      | {
          readonly ok: true;
          readonly settings: HarnessSettings;
          readonly lane: LaneSettings;
          readonly killGraceMs: number;
        }
      | { readonly ok: false; readonly code: string } => {
      const gitRoot = gitRootForConfig();
      const acquired = acquireProjectConfiguration(gitRoot);
      if (!acquired.ok) return { ok: false, code: acquired.error.code };
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return { ok: false, code: resolved.error.code };
      const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
      if (!settings.ok) return { ok: false, code: settings.error.code };
      // GH-335 §7.1: reconcile the store location at the edge (the default's
      // `~/` home expansion plus the harness's observed override).
      const reconciled: HarnessSettings = {
        ...settings.value,
        opencodeDatabasePath: reconcileOpencodeStorePath({
          configured: settings.value.opencodeDatabasePath,
          environment,
          homeDirectory,
        }),
      };
      const lane = resolveLaneSettings(resolved.value.values, resolved.value.origins);
      const coordinatorSettings = resolveCoordinatorSettings(
        resolved.value.values,
        resolved.value.origins,
      );
      if (!lane.ok) return { ok: false, code: lane.error.code };
      if (!coordinatorSettings.ok) return { ok: false, code: coordinatorSettings.error.code };
      return {
        ok: true,
        settings: reconciled,
        lane: lane.value,
        killGraceMs: coordinatorSettings.value.killGraceMs,
      };
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
        // The read side resolves identity with persistence disabled and passes no
        // scheduler key, so `dispatch attempts` performs exactly one store read
        // and never creates, repairs, or re-persists the binding marker.
        attempts: {
          resolveRepository: () => resolveProductionRepository(undefined, { persist: false }),
          resolveActiveRef: () => {
            const context = readLocalPmContext({ path: pmContextPath, fs: localFs });
            return context.ok ? (context.context.activeChange?.workItemRef ?? null) : null;
          },
          contextPath: pmContextPath,
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
            dispatchComposition(
              resolution.settings,
              resolution.lane,
              repository,
              resolution.killGraceMs,
            ),
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
      const acquired = acquireProjectConfiguration(gitRoot);
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

    /** The active log's byte size, or `0` when the file does not exist yet. */
    const readLogBytes = (path: string): number => {
      try {
        return statSync(path).size;
      } catch {
        return 0;
      }
    };

    /**
     * Compose the loop supervision profile (GH-348 F-1, F-2, F-6): the delivered
     * store behind the loop ledger port, the injected clock and id/fence
     * factories, the resolved coordinator settings consumed unchanged, the node
     * process port with its capabilities, the delivered harness session port
     * with the CEO per-spawn binding, the bounded file log, and the real
     * foreground cycle driver. No configuration key is added (DM-8).
     */
    const createProductionLoopComposition = (): LoopComposition => {
      const loopId = "loop-main";
      const settings = resolveProductionCoordinatorSettings();
      const loopIntervalMs = facts.coordinatorCollectionIntervalMs ?? settings.collectionIntervalMs;
      const processPort = createNodeProcessPort();
      const ownStartTimeMs = (): number | undefined => processPort.startTimeMs?.(ownProcessId);
      const ledger = createLoopLedgerPort(store, loopId, newFenceToken);
      const loopDelay: LoopDelay =
        facts.loopDelay ??
        ((ms) =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, ms);
            const unref = (timer as { readonly unref?: () => void }).unref;
            if (typeof unref === "function") unref.call(timer);
          }));

      let handle: HarnessSessionHandle | null = null;
      let lastTokens: number | null = null;
      let recorded: LoopSessionFacts = {
        sessionId: null,
        liveness: "absent",
        harnessKind: "opencode",
        pid: null,
        processStartTimeMs: null,
        title: null,
      };

      const harnessForLoop = ():
        | {
            readonly ok: true;
            readonly port: HarnessSessionPort;
            readonly descriptor: HarnessExecutionEnvironmentDescriptor;
            readonly kind: HarnessKind;
          }
        | { readonly ok: false; readonly code: string } => {
        const resolution = resolveProductionHarnessSettings();
        if (!resolution.ok) return { ok: false, code: resolution.code };
        const kind = resolution.settings.kind;
        return {
          ok: true,
          port: createHarnessProfilePort({
            port: harnessFor(kind),
            context: () => resolveProfileContext(),
            resolve: resolveBinding,
          }),
          kind,
          descriptor: {
            kind: resolution.settings.executionKind,
            workDirectory: cwd,
            environment: harnessEnvironmentEntries(resolution.settings),
          },
        };
      };

      const effectFacts = (
        input: HarnessSessionHandle,
      ): {
        readonly sessionId: string;
        readonly harnessKind: string;
        readonly pid: number | null;
        readonly processStartTimeMs: number | null;
        readonly title: string | null;
      } => {
        const pid = input.pid ?? null;
        const start = pid === null ? undefined : processPort.startTimeMs?.(pid);
        return {
          sessionId: input.sessionId,
          harnessKind: input.harnessKind,
          pid,
          processStartTimeMs: start ?? null,
          title: null,
        };
      };

      const logPath = join(stateDirectory, "loop", `${loopId}.log`);
      const logSink: LoopLogSink = {
        append: (event, pairs) => {
          const line = renderLogLine({
            recordedAt: nowIso(),
            event,
            ...(pairs === undefined ? {} : { pairs }),
          });
          if (line === null) return;
          try {
            const lineBytes = logByteLength(`${line}\n`);
            const active = readLogBytes(logPath);
            const plan = planLogAppend({ activeBytes: active, lineBytes });
            if (plan.drop) return;
            mkdirSync(join(stateDirectory, "loop"), { recursive: true });
            if (plan.rotate) renameSync(logPath, `${logPath}.1`);
            appendFileSync(logPath, `${line}\n`, "utf8");
          } catch {
            // Bounded observability: a log fault never changes an outcome (F-7).
          }
        },
        available: () => true,
      };

      return {
        ledger,
        clock: { nowMs, nowIso },
        newFenceToken,
        newId: (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`,
        loopId,
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
        },
        progress: {
          read: (sessionId) => {
            if (sessionId === null) return { state: "unknown" as const, observedAtMs: null };
            const resolution = resolveProductionHarnessSettings();
            if (!resolution.ok) return { state: "unknown" as const, observedAtMs: null };
            const totals = createOpencodeSessionTotalsReader({
              opener: createBunSqliteStoreOpener(),
              storePath: resolution.settings.opencodeDatabasePath,
            });
            const reading = totals(sessionId);
            if (reading === undefined) {
              return { state: "unknown" as const, observedAtMs: null };
            }
            const total =
              (reading.tokens.input ?? 0) +
              (reading.tokens.output ?? 0) +
              (reading.tokens.reasoning ?? 0) +
              (reading.tokens.cacheRead ?? 0) +
              (reading.tokens.cacheWrite ?? 0);
            const delta = total - (lastTokens ?? 0);
            lastTokens = total;
            return {
              state: delta > 0 ? ("positive" as const) : ("zero" as const),
              observedAtMs: nowMs(),
            };
          },
        },
        corroborator: {
          read: () => {
            const lanes = readDispatchLanes(store);
            const daemon = readDaemonLanes(store);
            return corroborateDelivery({
              storeReadable: lanes.ok && daemon.ok,
              dispatchLanes: lanes.ok
                ? lanes.records.map((lane: { state: string; owner?: { processId?: number } }) => ({
                    state: lane.state === "active" ? ("active" as const) : ("terminal" as const),
                    pid: lane.owner?.processId ?? null,
                    liveness:
                      lane.owner?.processId === undefined
                        ? ("unreadable" as const)
                        : processPort.isAlive(lane.owner.processId)
                          ? ("alive" as const)
                          : ("dead" as const),
                  }))
                : [],
              daemonLane:
                daemon.ok && daemon.latest !== undefined
                  ? {
                      state: daemon.latest.state,
                      pid: daemon.latest.processId ?? null,
                      liveness:
                        daemon.latest.processId === undefined
                          ? ("unreadable" as const)
                          : processPort.isAlive(daemon.latest.processId)
                            ? ("alive" as const)
                            : ("dead" as const),
                    }
                  : null,
            });
          },
        },
        artifactAdvanced: () => {
          const read = store.readRecords();
          if (!read.ok) return false;
          return read.value.records.some(
            (entry) => entry.kind === "merge.transaction" || entry.kind === "blocker.answer",
          );
        },
        terminate: async (graceMs) => {
          if (handle === null || handle.pid === undefined) {
            return { outcome: "capability-gap", failureReason: null };
          }
          const resolved = harnessForLoop();
          if (!resolved.ok || resolved.port.terminate === undefined) {
            return { outcome: "capability-gap", failureReason: null };
          }
          const killed = await resolved.port.terminate({ handle, graceMs });
          if (!killed.ok) {
            return { outcome: "failed", failureReason: "identity-mismatch" };
          }
          return {
            outcome: killed.value.terminated ? "terminated" : "failed",
            failureReason: killed.value.terminated ? null : "identity-mismatch",
          };
        },
        admission: ({ ordinal, budgetEpochId }) => {
          const read = readCoordinatorRecords(store, loopId);
          if (!read.ok) return { state: "unevaluable", nextOrdinal: ordinal };
          const decision = evaluateCoordinatorRestartAdmission({
            records: read.restarts,
            budgetEpochId,
            bound: settings.restartBudget,
          });
          return decision.state === "admit"
            ? { state: "admit", nextOrdinal: decision.nextOrdinal }
            : decision.state === "refuse"
              ? { state: "refuse", nextOrdinal: ordinal }
              : { state: "unevaluable", nextOrdinal: ordinal };
        },
        session: {
          read: () => {
            if (handle === null) return recorded;
            const pid = handle.pid ?? recorded.pid;
            const alive = pid === null ? false : processPort.isAlive(pid);
            return {
              ...recorded,
              sessionId: handle.sessionId,
              harnessKind: handle.harnessKind,
              pid,
              liveness: alive ? "alive" : "unknown",
            };
          },
          spawn: async ({ title, prompt }) => {
            const resolved = harnessForLoop();
            if (!resolved.ok) return { ok: false, code: resolved.code };
            const spawned = await resolved.port.spawn({
              workItemRef: loopId,
              prompt,
              descriptor: resolved.descriptor,
              agent: "ceo",
              title,
            });
            if (!spawned.ok) return { ok: false, code: spawned.error.code };
            handle = spawned.value;
            const facts = { ...effectFacts(spawned.value), title };
            recorded = {
              sessionId: facts.sessionId,
              liveness: "alive",
              harnessKind: facts.harnessKind,
              pid: facts.pid,
              processStartTimeMs: facts.processStartTimeMs,
              title: facts.title,
            };
            return { ok: true, fresh: true, ...facts };
          },
          resume: async ({ sessionId, prompt }) => {
            const resolved = harnessForLoop();
            if (!resolved.ok) return { ok: false, code: resolved.code };
            const resumable: HarnessSessionHandle = handle ?? {
              harnessKind: recorded.harnessKind as HarnessKind,
              sessionId,
              treeRoot: sessionId,
              workItemRef: loopId,
            };
            const resumed = await resolved.port.resume({
              handle: resumable,
              prompt,
              descriptor: resolved.descriptor,
              agent: "ceo",
            });
            if (!resumed.ok) return { ok: false, code: resumed.error.code };
            handle = resumed.value;
            const facts = { ...effectFacts(resumed.value), title: recorded.title };
            recorded = {
              sessionId: facts.sessionId,
              liveness: "alive",
              harnessKind: facts.harnessKind,
              pid: facts.pid,
              processStartTimeMs: facts.processStartTimeMs,
              title: facts.title,
            };
            return { ok: true, fresh: false, ...facts };
          },
          join: async () => ({
            ok: true,
            fresh: false,
            sessionId: recorded.sessionId ?? "",
            harnessKind: recorded.harnessKind,
            pid: recorded.pid,
            processStartTimeMs: recorded.processStartTimeMs,
            title: recorded.title,
          }),
        },
        log: logSink,
        delay: loopDelay,
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
                await loopDelay(loopIntervalMs, "collection-interval");
              }
            } finally {
              signalHost?.removeListener("SIGINT", onSignal);
              signalHost?.removeListener("SIGTERM", onSignal);
            }
          },
        },
      };
    };

    /**
     * The `projects list` host overview (GH-288 F-3, F-4, F-5, DEC-5, DEC-8).
     *
     * Read-only by construction: one index read, no maintenance, no prune, no
     * project-root creation, and no write of any kind. A present-but-unreadable
     * state location fails the whole answer instead of fabricating a row.
     */
    /**
     * One project's dispatch facts over the store the row already opens.
     *
     * The store is created once per row and reused for the handover fold and,
     * on the `repos list` path, the read-time gate evaluation — no second store
     * open, no write, no identity persistence.
     */
    const readProjectHandover = (
      stateLocation: string,
      projectKey: string,
      repository?: string,
    ):
      | {
          readonly ok: true;
          readonly store: StateStorePort;
          readonly state: "engine" | "shell" | "in-transition";
          readonly operation: HandoverEvidence;
          readonly reversible: boolean;
        }
      | { readonly ok: false; readonly summary: string } => {
      const projectStore = createStateStore(
        {
          level: "local",
          workspaceId,
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory: stateLocation,
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      );
      const ledger = readDispatchHandover(projectStore);
      if (!ledger.ok) {
        return {
          ok: false,
          summary: `project ${projectKey} has a state location whose dispatch ledger cannot be read (${stateLocation})`,
        };
      }
      let operation: HandoverEvidence = "none";
      let reversible = false;
      if (ledger.records.length > 0) {
        // The folded truth is per repository, and the row reads only its own:
        // a store that accumulates a second identity (a rename or a remote
        // change does not re-key history) can never report another repository's
        // authority as this row's. When the row's identity is not resolved, the
        // fold keeps the delivered cross-identity read.
        const folded = foldDispatchHandover(ledger.records).filter(
          (entry) => repository === undefined || entry.repository === repository,
        );
        const latest = [...folded]
          .sort((left, right) =>
            left.recordedAt < right.recordedAt ? -1 : left.recordedAt > right.recordedAt ? 1 : 0,
          )
          .at(-1);
        operation = latest?.authority ?? "none";
        reversible = reversibilityOf(latest?.authority ?? "dual-run");
      }
      const fact = readDispatchAuthorityFact(stateLocation);
      const authority: AuthorityEvidence =
        fact.state === "valid"
          ? { state: "valid", authority: fact.view.authority }
          : { state: fact.state === "malformed" ? "malformed" : "absent" };
      return {
        ok: true,
        store: projectStore,
        state: projectHandoverState({ operation, authority }),
        operation,
        reversible,
      };
    };

    /**
     * Resolve one row's own normalized `host/owner/name` identity read-only and
     * non-persisting (GH-293 DM-7, DEC-15): the persisted create-once binding
     * recorded with that checkout's git common directory first, then the
     * checkout's configured VCS remote. No scheduler key exists on this path and
     * the read never creates, repairs, or rewrites the binding.
     */
    const resolveRowRepository = (root: string): string | undefined => {
      const checkout = readCheckoutIdentity({ cwd: root, io: nodeRepositoryIo() });
      const commonDir = checkout.kind === "resolved" ? checkout.commonDir : undefined;
      const persistedMarker = readDispatchIdentityMarkerText(commonDir);
      // The composition's own checkout is the one whose remote the injection
      // seam already resolved; every other row is read from its own checkout.
      const remoteUrl =
        root === cwd ? repositoryFacts.originUrl : repositoryFactsFor(root).originUrl;
      const resolution = resolveDispatchIdentity({
        ...(persistedMarker === undefined ? {} : { persistedMarker }),
        ...(remoteUrl === undefined ? {} : { remoteUrl }),
      });
      return resolution.ok ? resolution.repository : undefined;
    };

    /**
     * The read-time gate block for one ready row (GH-293 F-3, DM-4, DM-7).
     *
     * One bounded attempts read plus one divergences read over the row's own
     * store, folded at the declared `production` evidence scope and bound to the
     * row's own repository identity. An unreadable ledger or an unresolvable
     * identity fails the whole read as `repos.state-unavailable` with no row; a
     * truncated read reports `unverifiable` plus the declared truncation.
     */
    const readRowHandoverGate = (
      store: StateStorePort,
      root: string,
      projectKey: string,
      resolvedRepository?: string,
    ):
      | { readonly ok: true; readonly gate: ReposHandoverGate }
      | { readonly ok: false; readonly summary: string } => {
      const repository = resolvedRepository ?? resolveRowRepository(root);
      if (repository === undefined) {
        return {
          ok: false,
          summary: `project ${projectKey} has a ready state location whose repository identity cannot be resolved (${root})`,
        };
      }
      const read = readDispatchGate({
        store,
        repository,
        scope: "production",
        nowIso: nowIso(),
      });
      if (!read.ok) {
        return {
          ok: false,
          summary: `project ${projectKey} (${repository}) has a dispatch evidence ledger that cannot be read`,
        };
      }
      return { ok: true, gate: reposHandoverGateOf(read) };
    };

    /** One row's resolved facts; the projection to each payload happens later. */
    type ProjectRowFacts = {
      readonly projectKey: string;
      readonly root: string;
      readonly stateLocation: string;
      readonly daemonReachable: DaemonReachability;
      readonly handoverState: HandoverState;
      readonly reversible: boolean;
      readonly handoverGate: ReposHandoverGate;
    };

    const readDaemonReachability = async (
      stateLocation: string,
      stateRootPresent: boolean,
    ): Promise<
      | { readonly ok: true; readonly value: DaemonReachability }
      | { readonly ok: false; readonly summary: string }
    > => {
      const composition = facts.daemon;
      if (composition === undefined || !composition.mounted) {
        return { ok: true, value: selectDaemonReachability({ mount: { mounted: false } }) };
      }
      const capability = composition.capability?.();
      if (capability === undefined) {
        return { ok: true, value: selectDaemonReachability({ mount: { mounted: false } }) };
      }
      if (!stateRootPresent) {
        return {
          ok: true,
          value: selectDaemonReachability({
            mount: { mounted: true },
            probe: { stateRoot: "absent" },
          }),
        };
      }
      const settings = resolveProjectDaemonSettings(stateLocation);
      if (!settings.ok) {
        return {
          ok: false,
          summary: `project state location ${stateLocation} cannot derive a socket path (${settings.error.code})`,
        };
      }
      const socket = await capability.probe({
        socketPath: settings.value.socketPath,
        timeoutMs: settings.value.responseTimeoutMs,
      });
      return {
        ok: true,
        value: selectDaemonReachability({
          mount: { mounted: true },
          probe: { stateRoot: "present", socket },
        }),
      };
    };

    /**
     * The shared project-row read (GH-288 F-3, F-4, F-5; GH-293 F-3).
     *
     * One host-index read, one row pass. `withGate` decides whether each ready
     * row also evaluates the handover gate over the store it has already opened:
     * `repos list` asks for it, `projects list` and its flat alias never do, so
     * the delivered `projects.v1` payload cannot gain a field and the alias stays
     * byte-identical.
     */
    const readProjectRows = async (
      withGate: boolean,
    ): Promise<
      | {
          readonly ok: true;
          readonly rows: readonly ProjectRowFacts[];
          readonly revision: number;
          readonly warnings: readonly string[];
        }
      | { readonly ok: false; readonly code: string; readonly summary: string }
    > => {
      hostIndexAccess.countList();
      const read = readHostIndexFile(hostRoot);
      if (read.state === "absent") {
        return { ok: true, rows: [], revision: HOST_INDEX_INITIAL_REVISION, warnings: [] };
      }
      const indexPath = hostIndexDocumentPath(hostRoot);
      if (read.state === "unreadable") {
        return {
          ok: false,
          code: "repos.registry-corrupt",
          summary: `the host index at ${indexPath} is present but unreadable`,
        };
      }
      const document = parseHostIndexDocument(read.text);
      if (document === undefined) {
        return {
          ok: false,
          code: "repos.registry-corrupt",
          summary: `the host index at ${indexPath} is present but cannot be parsed`,
        };
      }
      const rows: ProjectRowFacts[] = [];
      const warnings: string[] = [];
      let legacyChecked = false;
      for (const entry of document.projects) {
        // A recorded checkout root that no longer exists is not reported: the
        // entry stays in the index for the next maintenance prune (spec F-3).
        if (!existsSync(entry.root)) continue;
        const stateLocation = projectStateRoot(hostRoot, entry.projectKey);
        let stat: ReturnType<typeof statSync> | undefined;
        try {
          stat = statSync(stateLocation);
        } catch {
          stat = undefined;
        }
        // A bounded directory listing proves readability, so a present but
        // unreadable root reaches `repos.state-unavailable` here rather than
        // only failing later inside the store open.
        let readable = false;
        if (stat?.isDirectory() === true) {
          try {
            readdirSync(stateLocation);
            readable = true;
          } catch {
            readable = false;
          }
        }
        const classification = classifyProjectStateLocation({
          exists: stat !== undefined,
          directory: stat?.isDirectory() === true,
          readable,
        });
        if (classification === "first-use" && !legacyChecked) {
          // AC-F3-5 cell 2: an absent root beside a host-root store is a
          // warning, never `repos.state-unavailable`, and the list stays
          // write-free while reporting it once.
          legacyChecked = true;
          const legacy = legacyStoreWarning({
            hostArtifacts: readStateRootArtifacts(hostRoot),
            projectRootExists: false,
          });
          if (legacy !== undefined) warnings.push(legacy);
        }
        if (classification === "state-unavailable") {
          return {
            ok: false,
            code: "repos.state-unavailable",
            summary: `project ${entry.projectKey} has a state location that is not a readable directory (${stateLocation})`,
          };
        }
        // The row's own normalized identity, resolved once and used by both the
        // handover fold and the gate block (GH-293 DM-7, DEC-15). It is resolved
        // on the gate path only, so `projects list` performs no identity read.
        const rowRepository =
          withGate && classification === "ready" ? resolveRowRepository(entry.root) : undefined;
        const handover =
          classification === "first-use"
            ? ({ ok: true, state: "shell", reversible: false } as const)
            : readProjectHandover(stateLocation, entry.projectKey, rowRepository);
        if (!handover.ok) {
          return { ok: false, code: "repos.state-unavailable", summary: handover.summary };
        }
        let gate: ReposHandoverGate = emptyHandoverGate();
        let reversible = handover.reversible;
        if (withGate && classification === "ready") {
          if (!("store" in handover)) {
            return {
              ok: false,
              code: "repos.state-unavailable",
              summary: `project ${entry.projectKey} has no readable store for its gate evaluation`,
            };
          }
          const evaluated = readRowHandoverGate(
            handover.store,
            entry.root,
            entry.projectKey,
            rowRepository,
          );
          if (!evaluated.ok) {
            return { ok: false, code: "repos.state-unavailable", summary: evaluated.summary };
          }
          gate = evaluated.gate;
        }
        if (classification === "first-use") {
          reversible = false;
          gate = emptyHandoverGate();
        }
        const daemon = await readDaemonReachability(stateLocation, classification === "ready");
        if (!daemon.ok) {
          return { ok: false, code: "repos.state-unavailable", summary: daemon.summary };
        }
        if (entry.stateLocation !== stateLocation) {
          warnings.push(
            `project ${entry.projectKey} recorded state location ${entry.stateLocation} ` +
              `disagrees with the location derived from its key (${stateLocation}); ` +
              "the derived location is reported",
          );
        }
        rows.push({
          projectKey: entry.projectKey,
          root: entry.root,
          stateLocation,
          daemonReachable: daemon.value,
          handoverState: handover.state,
          reversible,
          handoverGate: gate,
        });
      }
      return { ok: true, rows, revision: document.revision, warnings };
    };

    const readProjects = async (): Promise<ProjectsRuntimeRead> => {
      const read = await readProjectRows(false);
      if (!read.ok) return read;
      // The delivered five-field row: the gate evaluation never reaches this
      // payload, so `projects.v1` and the flat alias stay byte-identical.
      const entries = read.rows.map((row) =>
        projectListEntry({
          projectKey: row.projectKey,
          root: row.root,
          stateLocation: row.stateLocation,
          daemonReachable: row.daemonReachable,
          handoverState: row.handoverState,
        }),
      );
      return {
        ok: true,
        data: { projects: orderProjectEntries(entries), hostIndexRevision: read.revision },
        ...(read.warnings.length === 0 ? {} : { warnings: [...read.warnings] }),
      };
    };

    /**
     * The `repos list` flat record set (GH-309 F-7, DM-3; GH-293 F-3).
     *
     * The only read that evaluates the handover gate per row: one bounded
     * attempts read plus one divergences read over the store the row pass already
     * opened, bound to that row's own repository identity and folded at the
     * declared `production` evidence scope. The alias path never passes through
     * this projection, so `projects list --flat` keeps the delivered payload
     * byte-identical (C-2).
     */
    const readRepos = async (): Promise<ReposRuntimeRead> => {
      const read = await readProjectRows(true);
      if (!read.ok) return read;
      const gates = new Map(
        read.rows.map((row) => [
          row.projectKey,
          { reversible: row.reversible, handoverGate: row.handoverGate },
        ]),
      );
      const data = reposListDataOf(
        {
          projects: read.rows.map((row) =>
            projectListEntry({
              projectKey: row.projectKey,
              root: row.root,
              stateLocation: row.stateLocation,
              daemonReachable: row.daemonReachable,
              handoverState: row.handoverState,
            }),
          ),
          hostIndexRevision: read.revision,
        },
        (entry) => {
          const gate = gates.get(entry.projectKey);
          if (gate === undefined) {
            throw new Error(`row ${entry.projectKey} has no resolved gate`);
          }
          return gate;
        },
      );
      return {
        ok: true,
        data,
        ...(read.warnings.length === 0 ? {} : { warnings: [...read.warnings] }),
      };
    };

    /** Describe one pinned configuration contradiction for the failure summary. */
    const describeConfigInvalid = (reason: ProjectConfigInvalidReason): string => {
      if (reason.case === "schema") return reason.detail;
      if (reason.case === "duplicate-groupKey") return `duplicate groupKey "${reason.groupKey}"`;
      if (reason.case === "empty-members") return `group "${reason.groupKey}" declares no members`;
      return (
        `group "${reason.groupKey}" member ${reason.index} violates the member selector rules ` +
        `(${reason.case})`
      );
    };

    /** The durable project key one declared root carries, when its marker is readable. */
    const identityProjectKeyFor = (root: string | undefined): string | undefined => {
      if (root === undefined || !existsSync(root)) return undefined;
      const identity = readCheckoutIdentity({ cwd: root, io: nodeRepositoryIo() });
      if (identity.kind !== "resolved") return undefined;
      const markerRead = readProjectIdentityMarker(identity.commonDir);
      if (markerRead.state !== "present") return undefined;
      return parseProjectIdentityMarker(markerRead.text)?.projectKey;
    };

    /** Classify one state location on disk exactly as the flat read does. */
    const classifyStateLocationOnDisk = (
      stateLocation: string,
    ): "first-use" | "ready" | "state-unavailable" => {
      let stat: ReturnType<typeof statSync> | undefined;
      try {
        stat = statSync(stateLocation);
      } catch {
        stat = undefined;
      }
      let readable = false;
      if (stat?.isDirectory() === true) {
        try {
          readdirSync(stateLocation);
          readable = true;
        } catch {
          readable = false;
        }
      }
      return classifyProjectStateLocation({
        exists: stat !== undefined,
        directory: stat?.isDirectory() === true,
        readable,
      });
    };

    /**
     * Resolve and observe one declared member against the delivered per-checkout
     * machinery (GH-309 F-1, F-3, F-4; OQ-3). Resolution is configuration-driven:
     * the host index and the declared-only workspace scan locate the selector the
     * configuration names. An unimplemented tracker kind is classified
     * `not-yet-supported` before any observation and never rejected; an
     * unresolvable member stays classified `unregistered` rather than silently
     * vanishing from `members[]`.
     */
    const readGroupMember = async (
      member: ProjectGroupMemberSelected,
      index: readonly HostIndexEntry[],
      workspace: readonly WorkspaceLocatedMember[],
    ): Promise<ProjectGroupMemberEntry> => {
      const markerRepoKey = member.kind === "root" ? identityProjectKeyFor(member.root) : undefined;
      const resolution = resolveProjectGroupMember({
        member,
        index,
        workspace,
        ...(markerRepoKey === undefined ? {} : { markerRepoKey }),
      });
      // An unlocated root-selected member carries the declaration in `root` and
      // an empty `repoKey` — mirroring the unlocated repoKey-selected member's
      // empty `root` — so the field named `repoKey` never carries a filesystem
      // path (GH-309 F-7).
      const displayKey =
        resolution.state === "located" ? resolution.repoKey : (resolution.repoKey ?? "");
      const unobserved = (health: ProjectGroupMemberEntry["health"]): ProjectGroupMemberEntry =>
        projectGroupMemberEntry({
          repoKey: displayKey,
          root: resolution.root,
          trackerKind: member.trackerKind,
          state: "shell",
          health,
          daemonReachable: selectDaemonReachability({ mount: { mounted: false } }),
        });
      const unimplemented = !(IMPLEMENTED_TRACKER_KINDS as readonly string[]).includes(
        member.trackerKind,
      );
      // `not-yet-supported` is mandatory for an unimplemented kind, even when the
      // checkout is also unlocatable: the classification names the adapter gap.
      if (unimplemented) return unobserved("not-yet-supported");
      if (resolution.state === "unlocated") return unobserved("unregistered");
      const stateLocation = projectStateRoot(hostRoot, resolution.repoKey);
      const classification = classifyStateLocationOnDisk(stateLocation);
      if (classification === "state-unavailable") return unobserved("state-unavailable");
      const handover =
        classification === "first-use"
          ? ({ ok: true, state: "shell" } as const)
          : readProjectHandover(stateLocation, resolution.repoKey);
      if (!handover.ok) return unobserved("state-unavailable");
      const daemon = await readDaemonReachability(stateLocation, classification === "ready");
      if (!daemon.ok) return unobserved("state-unavailable");
      return projectGroupMemberEntry({
        repoKey: resolution.repoKey,
        root: resolution.root,
        trackerKind: member.trackerKind,
        state: handover.state,
        health: projectMemberHealth({ outcome: "observed", daemonReachable: daemon.value }),
        daemonReachable: daemon.value,
      });
    };

    /**
     * Scan one group's registered workspace root for its declared members only
     * (GH-309 F-3, NFR-4). No scan runs without a configured `workspaceRoot`, and
     * the scan is handed exactly the declared selectors, so an undeclared clone is
     * never admitted at any depth.
     */
    const scanGroupWorkspace = (
      group: ProjectGroupValidated,
    ): readonly WorkspaceLocatedMember[] => {
      if (group.workspaceRoot === undefined) return [];
      const selectors = projectGroupMemberSelectors(group);
      return scanDeclaredWorkspaceMembers({
        workspaceRoot: group.workspaceRoot,
        declared: [
          ...selectors.roots.map((root) => ({ root })),
          ...selectors.repoKeys.map((repoKey) => ({ repoKey })),
        ],
        repoKeyOf: (root) => identityProjectKeyFor(root),
      });
    };

    /**
     * Load and validate the configuration document once for every
     * group-scoped read (GH-309 F-1, F-2, F-5). An absent or empty
     * configuration is the valid empty listing (opt-in adoption); a readable
     * but invalid document is `projects.config-invalid`; a document or
     * invoking scope that cannot be read is `projects.scope-unavailable`.
     */
    const readProjectGroupsConfiguration = ():
      | { readonly ok: true; readonly config: ProjectGroupsConfig }
      | { readonly ok: false; readonly code: string; readonly summary: string } => {
      const gitRoot = gitRootForConfig();
      if (gitRoot === undefined) {
        return {
          ok: false,
          code: "projects.scope-unavailable",
          summary: "the invoking scope cannot be read: no git work tree root was resolved",
        };
      }
      const read = readProjectGroupsConfig({
        gitRoot,
        configurationDirectoryName: brand.configDirectoryName,
      });
      if (read.state === "unreadable") {
        return {
          ok: false,
          code: "projects.scope-unavailable",
          summary: `the project configuration document at ${read.path} cannot be read`,
        };
      }
      if (read.state === "malformed") {
        return {
          ok: false,
          code: "projects.config-invalid",
          summary:
            `the project configuration document at ${read.path} is invalid: ` +
            "the document is not parsable YAML",
        };
      }
      const validated = validateProjectGroupsDocument(read.value);
      if (!validated.ok) {
        return {
          ok: false,
          code: "projects.config-invalid",
          summary:
            `the project configuration document at ${read.path} is invalid: ` +
            describeConfigInvalid(validated.reason),
        };
      }
      return { ok: true, config: validated.config };
    };

    /**
     * The one host-index read every group-scoped read shares (no maintenance).
     *
     * The index is a resolution AID, never a membership source (GH-309 F-3,
     * F-4): an unreadable or unparsable index is treated as empty, so a member
     * that needs it classifies `unregistered` at exit 0 while root-selected or
     * workspace-located members still resolve. Exit 2 stays reserved for an
     * unreadable configuration document or invoking scope; no fourth identity
     * exists on the group surface (spec F-5, PROJECT_GROUP_ERROR_CODES).
     */
    const readProjectGroupsHostIndex = (): readonly HostIndexEntry[] => {
      hostIndexAccess.countList();
      const indexRead = readHostIndexFile(hostRoot);
      if (indexRead.state !== "present") return [];
      const document = parseHostIndexDocument(indexRead.text);
      return document?.projects ?? [];
    };

    /** Observe one validated group's declared members in declared order. */
    const observeProjectGroup = async (
      group: ProjectGroupValidated,
      index: readonly HostIndexEntry[],
    ): Promise<ProjectGroupEntry> => {
      const workspace = scanGroupWorkspace(group);
      const members: ProjectGroupMemberEntry[] = [];
      for (const member of group.members) {
        members.push(await readGroupMember(member, index, workspace));
      }
      return projectGroupEntry({
        groupKey: group.groupKey,
        name: group.name,
        ...(group.workspaceRoot === undefined ? {} : { workspaceRoot: group.workspaceRoot }),
        members,
      });
    };

    /** The three queue-state buckets one observed member contributes (F-6). */
    type MemberQueueWork =
      | {
          readonly ok: true;
          readonly running: readonly QueueEntryProjection[];
          readonly waiting: readonly QueueEntryProjection[];
          readonly parked: readonly QueueEntryProjection[];
        }
      | { readonly ok: false };

    /**
     * Read one observed member's queue work over its own per-checkout state
     * (GH-309 F-5, F-6): the state layer's scope stays per-checkout, never a
     * group-scoped store. Each member opens its own state handle and computes
     * the delivered schedule, and the entries are split by that read's own
     * states: held entries run, ready/not-ready entries wait, parked/stuck
     * entries are parked. A state read that fails classifies the member
     * `state-unavailable` instead of failing the aggregate.
     */
    const readMemberQueueWork = (member: ProjectGroupMemberEntry): MemberQueueWork => {
      const memberStore = createStateStore(
        {
          level: "local",
          workspaceId,
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory: projectStateRoot(hostRoot, member.repoKey),
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      );
      const composition: QueueComposition = withRepositoryBinding(
        {
          store: memberStore,
          facts: queueFacts,
          nowIso,
          nowMs,
          newFenceToken,
          degraded: daemonReachability,
        },
        repositoryBindingOf(member.repoKey, member.root),
      );
      const read = createQueueCommandRuntime(composition).readSchedule(QUEUE_DEFAULT_NEXT_ACTIONS);
      if (!read.ok) return { ok: false };
      const entries = read.schedule.entries;
      // The scheduling read projects a lease per repository, so the running
      // bucket is exactly the entries a live lease names. Parked entries are
      // the ones the same read reports parked or stuck (or an active park
      // projection names); every other contributed entry waits.
      const runningRefs = new Set(read.schedule.leases.map((lease) => lease.ref));
      const parkedRefs = new Set(
        read.schedule.parks
          .filter((park) => park.recoveryState === "parked")
          .map((park) => park.ref),
      );
      const isParked = (ref: string, state: string): boolean =>
        parkedRefs.has(ref) || state === "parked" || state === "stuck";
      const isRunning = (ref: string): boolean => runningRefs.has(ref);
      return {
        ok: true,
        running: entries.filter((entry) => isRunning(entry.ref)),
        parked: entries.filter(
          (entry) => !isRunning(entry.ref) && isParked(entry.ref, entry.state),
        ),
        waiting: entries.filter(
          (entry) => !isRunning(entry.ref) && !isParked(entry.ref, entry.state),
        ),
      };
    };

    /**
     * The group read behind `projects list` (GH-309 F-1, F-2, F-4): the
     * configuration document is the sole membership source, and the enumeration
     * is over every configured group in declared order, filtered to the
     * requested key only when one is supplied. The default form enumerates every
     * configured group; `--project <groupKey>` scopes it to one. An absent or
     * empty configuration is the valid empty listing at exit 0. The aggregation
     * keys are applied once over the selected groups' members (F-5).
     */
    const readProjectGroups = async (groupKey?: string): Promise<ProjectGroupRuntimeRead> => {
      const configRead = readProjectGroupsConfiguration();
      if (!configRead.ok) return configRead;
      const groupsConfig = configRead.config;
      // An explicit --project is refused when the key is not declared, even
      // when the document is absent or declares zero groups (GH-309 F-1/F-2,
      // AC-F2-1, NFR-5): "not configured" is never rendered as "no work".
      if (groupKey !== undefined && !projectGroupDeclared(groupsConfig, groupKey)) {
        return {
          ok: false,
          code: "projects.unknown-group",
          summary: `project group "${groupKey}" is not declared by the configuration document`,
        };
      }
      // The unscoped default form keeps the empty listing for opt-in adoption.
      if (groupsConfig.state === "empty") {
        return { ok: true, data: { groups: [] } };
      }
      const index = readProjectGroupsHostIndex();
      const groups = selectProjectGroups(groupsConfig, groupKey);
      const entries: ProjectGroupEntry[] = [];
      for (const group of groups) {
        entries.push(await observeProjectGroup(group, index));
      }
      const aggregation = aggregateProjectMemberOutcomes(
        entries.flatMap((group) =>
          group.members.map((member) => ({
            repoKey: member.repoKey,
            outcome: projectMemberOutcomeOfHealth(member.health),
          })),
        ),
      );
      return { ok: true, data: { groups: entries, ...aggregation } };
    };

    /** The default group enumeration over every configured group (the flip). */
    const readEveryProjectGroup = async (): Promise<ProjectGroupRuntimeRead> => readProjectGroups();

    /** The scoped read behind `projects list --project <groupKey>`. */
    const readProjectGroup = async (groupKey: string): Promise<ProjectGroupRuntimeRead> =>
      readProjectGroups(groupKey);

    /**
     * The group-scoped work read behind `queue list --project <groupKey>` and
     * `status --project <groupKey>` (GH-309 F-5, F-6): the same configuration
     * load, the same refusal identities, and the same per-member resolution as
     * the group surface, then one per-checkout queue read per observed member.
     * Members are returned in declared order; a non-observed member contributes
     * no records but stays classified, and one `state-unavailable` member
     * yields `data.partial` true with `data.degradedMembers[]` while readable
     * members are still returned.
     */
    const readProjectGroupWorkFor = async (groupKey: string): Promise<ProjectGroupWorkRead> => {
      const configRead = readProjectGroupsConfiguration();
      if (!configRead.ok) return configRead;
      const config = configRead.config;
      // The scoped form always names a key, so an absent/zero-group document is
      // the same refusal as any other undeclared key (GH-309 F-2, AC-F2-1).
      if (!projectGroupDeclared(config, groupKey)) {
        return {
          ok: false,
          code: "projects.unknown-group",
          summary: `project group "${groupKey}" is not declared by the configuration document`,
        };
      }
      const group = selectProjectGroups(config, groupKey)[0];
      if (group === undefined) {
        return {
          ok: false,
          code: "projects.unknown-group",
          summary: `project group "${groupKey}" is not declared by the configuration document`,
        };
      }
      const index = readProjectGroupsHostIndex();
      const observed = await observeProjectGroup(group, index);
      const members: ProjectScopedMemberWork[] = [];
      for (const memberEntry of observed.members) {
        const outcome = projectMemberOutcomeOfHealth(memberEntry.health);
        if (outcome !== "observed") {
          members.push({
            repoKey: memberEntry.repoKey,
            root: memberEntry.root,
            trackerKind: memberEntry.trackerKind,
            outcome,
            health: memberEntry.health,
            running: [],
            waiting: [],
            parked: [],
          });
          continue;
        }
        const work = readMemberQueueWork(memberEntry);
        if (!work.ok) {
          members.push({
            repoKey: memberEntry.repoKey,
            root: memberEntry.root,
            trackerKind: memberEntry.trackerKind,
            outcome: "state-unavailable",
            health: "state-unavailable",
            running: [],
            waiting: [],
            parked: [],
          });
          continue;
        }
        members.push({
          repoKey: memberEntry.repoKey,
          root: memberEntry.root,
          trackerKind: memberEntry.trackerKind,
          outcome: "observed",
          health: memberEntry.health,
          running: work.running,
          waiting: work.waiting,
          parked: work.parked,
        });
      }
      const aggregation = aggregateProjectMemberOutcomes(members);
      return { ok: true, data: { groupKey, members, ...aggregation } };
    };
    readProjectGroupWork = readProjectGroupWorkFor;

    // The supervision battery's per-invocation action facts (F-2, F-8): the
    // injected run identity, the restart bound resolved once, and one blocker
    // ledger read shared by every exhausted lane in this run.
    const superviseRunId = invocation?.runId ?? globalThis.crypto.randomUUID();
    let superviseRestartBound: number | undefined;
    const supervisionRestartBound = (): number =>
      (superviseRestartBound ??=
        readDaemonConfiguration(checkoutRoot)?.restartBound ??
        PRODUCTION_DEFAULTS.lane["restart-budget"]);

    const configured: ConfigProgramOptions = {
      workingName: facts.workingName,
      environment,
      cwd,
      homeDirectory,
      ...(priorNames === undefined
        ? {}
        : { priorConfigurationDirectoryName: priorNames.configDirectoryName }),
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
      // The metrics read side is composed unconditionally over the same store
      // and checkout (GH-299 F-8, DEC-9): one read-only pass over the delivered
      // seams, the committed baseline log, the declaration node, and the
      // bounded committed corpus scan.
      metrics: {
        store,
        localContext: { path: pmContextPath, fs: localFs },
        projectRoot: checkoutRoot,
        configurationDirectoryName: brand.configDirectoryName,
        fs: { ...nodeFileSystemFacts(), list: (path) => readdirSync(path) },
        clock: { nowMs },
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
        newActionId: () => globalThis.crypto.randomUUID(),
        newClosureId: () => globalThis.crypto.randomUUID(),
        newFenceToken,
      },
      ceremony: {
        store,
        stateDirectory,
        changesDirectory,
        workspaceId,
        clock: { nowMs },
        newRunId: () => globalThis.crypto.randomUUID(),
        newFenceToken,
        gitRoot: checkoutRoot,
        configurationDirectoryName: brand.configDirectoryName,
        repositoryId:
          scope.value.scope.kind === "project" ? scope.value.scope.projectKey : "unbound",
      },
      // The steer family is composed unconditionally over the delivered
      // adapters (GH-298 F-8, DEC-9): the invoking store, injected clock and
      // fence factory, the derived checkout origin, the delivered phase fold,
      // and the delivered open-question view with the PDR-0003 join facts.
      steer: {
        store,
        clock: { nowMs, nowIso },
        newFenceToken,
        origin: () => {
          const context = readLocalPmContext({ path: pmContextPath, fs: localFs });
          return {
            change: context.ok ? (context.context.activeChange?.workItemRef ?? null) : null,
            repo:
              (repositoryFacts.originUrl === undefined
                ? undefined
                : normalizeRepositoryKey(repositoryFacts.originUrl)) ??
              (basename(checkoutRoot).toLowerCase() || "repository"),
            agent: "owner",
          };
        },
        readPhaseFold: (changeRef) => {
          if (changeRef === null) {
            return { ok: true, value: { present: false, entries: [] } };
          }
          const transitions = readChangeTransitionsTolerant(store, changeRef);
          if (!transitions.ok) return transitions;
          const folded = foldPhaseState(changeRef, transitions.value.transitions);
          return {
            ok: true,
            value: {
              present: transitions.value.present,
              entries: Object.entries(folded.phases).map(([phaseId, entry]) => ({
                phaseId,
                started: entry.started ?? "",
                completed: entry.completed,
              })),
            },
          };
        },
        readAsks: () => {
          const ledger = readBlockerLedger(store);
          if (!ledger.ok) return ledger;
          const ranking = rankBlockerQuestions(
            ledger.value.questions,
            ledger.value.answers,
            nowMs(),
          );
          return {
            ok: true,
            value: {
              facts: ranking.open.map((question, index) => ({
                id: question.id,
                type: question.type,
                audience: question.audience,
                lane: question.lane,
                ref: question.ref,
                question: question.question,
                askedAt: question.askedAt,
                age: question.age,
                rank: question.rank ?? index + 1,
              })),
              // No local defaultable-gate facts exist at the read point; the
              // delivered join therefore declares the bare `none` truth rather
              // than inventing a default.
              join: { defaultableRefs: {}, appliedRefs: [] },
            },
          };
        },
      },
      coordinator: createProductionCoordinatorComposition(),
      // GH-348 F-1/F-2/F-6: the loop profile over the delivered engine. Mounted
      // from this phase so every composition seam exists; the family joins
      // PROMPT_REQUIRED_COMMANDS only at phase 7, so the entrypoint drops it
      // until then (a registered extra is never advertised).
      loop: createProductionLoopComposition(),
      projects: {
        readProjects,
        readProjectGroups: readEveryProjectGroup,
        readProjectGroup,
      },
      repos: { readRepos },
      // The board is composed unconditionally over the delivered adapters
      // (GH-297 F-7, DEC-6): the invoking store, the one host-index reader, and
      // a per-repository store opener. It never maintains the index — it joins
      // the read-only `maintainsIndex` exception set above.
      board: {
        store,
        repository: { cwd, io: nodeRepositoryIo() },
        github: { instance, credentials, transport },
        nowIso,
        nowMs,
        newFenceToken,
        ...(scope.value.scope.kind === "project"
          ? { repositoryKey: scope.value.scope.projectKey }
          : {}),
        hostRoot,
        readHostIndex: () => {
          hostIndexAccess.countRead();
          return readHostIndexFile(hostRoot);
        },
        parseHostIndex: parseHostIndexDocument,
        rootExists: existsSafe,
        stateLocationFor: (projectKey: string) => projectStateRoot(hostRoot, projectKey),
        openStore: (stateLocation: string) =>
          createStateStore(
            {
              level: "local",
              workspaceId,
              fenceNamespace: "cli",
              schemaVersion: STATE_SCHEMA_VERSION,
              stateDirectory: stateLocation,
            },
            { driver: "jsonl", edge: createNodeStateEdge() },
          ),
        readOwnerHold,
      },
      // The supervise battery is composed unconditionally over the invoking
      // store and clock (GH-295 F-1, DEC-1): one read per run, no lane
      // composition, and no process surface. The run identity comes from the
      // invocation so every appended record is correlatable (F-8); the
      // restart bound is resolved once per composition instead of once per
      // parked lane, and the action path consumes the fold's restart facts.
      supervise: {
        repository: repositoryKey ?? (basename(checkoutRoot).toLowerCase() || "repository"),
        runId: superviseRunId,
        read: createStateSupervisionReadPort(store),
        write: createStateSupervisionWritePort({ store, newFenceToken }),
        economicsWrite: createSupervisionEconomicsWritePort({ store, newFenceToken }),
        admitRestart: ({ ref, restarts }): SupervisionRestartAdmission => {
          const decision = evaluateRestartBudget({
            workItemRef: ref,
            bound: supervisionRestartBound(),
            records: restarts,
          });
          if (decision.outcome === "admit") {
            return { outcome: "admit", restarts: decision.count };
          }
          if (decision.outcome === "refuse-budget") {
            return { outcome: "exhausted", restarts: decision.count };
          }
          return { outcome: "unavailable", restarts: 0, code: decision.code };
        },
        nowMs,
        nowIso,
      },
      // The taxonomy reference surface needs nothing: the runtime is the
      // compiled declaration, so the production composer supplies it
      // unconditionally (GH-290 F-2, DEC-F).
      events: {},
    };

    const program = createConfigProgram(configured);
    if (!program.ok) {
      throw new Error(`brand resolution failed: ${program.error.field}:${program.error.code}`);
    }

    /**
     * The install family's runtime (GH-346 F-4, D6, D7).
     *
     * The family is registered unconditionally in both composed programs. Its
     * one ownership fact arrives from the process edge, its running-artifact
     * path and identity are declared composition facts (never ambient reads),
     * and its daemon read and stop run through the delivered daemon runtime.
     */
    const installRuntime: InstallRuntime = (() => {
      const absoluteInstallPath = brand.installPath.startsWith("~/")
        ? `${homeDirectory}/${brand.installPath.slice(2)}`
        : brand.installPath;
      const installDirectory = dirname(absoluteInstallPath);
      const configRoot = `${homeDirectory}/${brand.configDirectoryName}`;
      const installFs = createNodeInstallFilePort();
      const enumeration = enumerateStateRoots({
        fs: installFs,
        hostRoot,
        projectsDirectory: `${hostRoot}/${INSTALL_STATE_ROOT_PROJECTS_DIRECTORY}`,
        cap: INSTALL_MAX_JUDGED_ROOTS,
      });
      const stateRoots = enumeration.roots.map((entry) => entry.root);
      const stateRootsTruncated = enumeration.truncated;
      const daemonPort: InstallDaemonPort = {
        status: async () => {
          const read = await daemonRuntime.status({ live: false });
          if (typeof read !== "object" || read === null || !("data" in read)) {
            return { running: false };
          }
          const data = (read as { readonly data?: unknown }).data;
          if (typeof data !== "object" || data === null) return { running: false };
          const snapshot = data as {
            readonly instance?: { readonly instanceId?: unknown; readonly pid?: unknown };
            readonly heartbeat?: { readonly state?: unknown };
          };
          const running = snapshot.heartbeat?.state === "running";
          const instance = snapshot.instance;
          return running
            ? {
                running: true,
                ...(typeof instance?.instanceId === "string"
                  ? { instanceId: instance.instanceId }
                  : {}),
                ...(typeof instance?.pid === "number" ? { pid: instance.pid } : {}),
              }
            : { running: false };
        },
        stop: async () => {
          const stopped = await daemonRuntime.stop({ mode: "drain" });
          return typeof stopped === "object" && stopped !== null && "data" in stopped
            ? { ok: true }
            : { ok: false };
        },
      };
      return {
        homeDirectory,
        destinationPath: absoluteInstallPath,
        installDirectory,
        slotPath: `${installDirectory}/${brand.binaryName}.previous`,
        recordPath: `${configRoot}/${INSTALL_RECORD_FILE_NAME}`,
        configRoot,
        stateRoot: hostRoot,
        stateRoots,
        stateRootsTruncated,
        acceptedStateSchemaVersion: STATE_SCHEMA_VERSION,
        ...(facts.buildIdentity === undefined ? {} : { runningIdentity: facts.buildIdentity }),
        runningArtifactPath: facts.runningArtifactPath ?? "",
        ownsInstallation: facts.ownsInstallation === true,
        invokedIdentity: brand.binaryName,
        environment,
        clock: { nowIso },
        fs: installFs,
        git: {
          readCheckout: (directory) => {
            const read = readCheckoutIdentity({ cwd: directory, io: nodeRepositoryIo() });
            return read.kind === "resolved"
              ? {
                  kind: "resolved",
                  checkoutRoot: read.checkoutRoot,
                  gitDir: read.gitDir,
                  commonDir: read.commonDir,
                }
              : read.kind === "unreadable"
                ? { kind: "unreadable", checkoutRoot: read.checkoutRoot }
                : { kind: "unbound" };
          },
        },
        daemon: daemonPort,
        priorNamespaceArtifacts: detectPriorNamespace({
          homeDirectory,
          exists: (path: string) => installFs.exists(path),
        }),
      };
    })();
    const installProgram = {
      commands: {
        ...program.program.commands,
        install: createInstallCommandDefinition(installRuntime),
      },
    };
    // An invocation outside every checkout keeps the declared `unbound` scope,
    // its exit code, and nothing registered: only one bounded warning changes.
    // Maintenance warnings (a repaired state location, a preserved corrupt
    // index) travel the same channel and never change an outcome.
    const warnings =
      scope.value.outcome === "unbound"
        ? [UNBOUND_SCOPE_WARNING, ...maintenanceWarnings, ...compositionNotices]
        : [...maintenanceWarnings, ...compositionNotices];
    return warnings.length === 0 ? installProgram : withScopeWarnings(installProgram, warnings);
  };
};
