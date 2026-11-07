/**
 * The designated runtime-aware edge (D12).
 *
 * Brand identity is resolved once, before any discovery, from an injected
 * environment record. Source acquisition, legacy fact mapping, shipped artifact
 * injection and the pure resolver are composed here; the command handler only
 * shapes the already-resolved snapshot.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  acquireFileConfig,
  createCommitlintProbe,
  createSecretScanner,
  type FileSystemFacts,
  neutralEnvironmentFacts,
  nodeFileSystemFacts,
  type PmNotesFileSystemFacts,
  parseConfigYaml,
  type RuntimePlatform,
  readCiWorkflowJobNames,
  readLocalPmContext,
  readPlanArtifact,
  readPmNotesText,
  runtimePlatform,
  stagePmNotesPhaseEntry,
} from "@delivery-os/adapters/file";
import {
  createGitBranchSeam,
  createGitCommitSeam,
  createWatchdogGitSeam,
  type GitBranchSeam,
  type GitBranchSeamOptions,
  type GitMergeSeam,
} from "@delivery-os/adapters/git";
import {
  createGitHubClient,
  createGitHubDeployTraceReader,
  GITHUB_ADAPTER_CONTRACT,
  type GithubClient,
  type GithubClientOptions,
} from "@delivery-os/adapters/github";
import { GITLAB_ADAPTER_CONTRACT, type GitLabClient } from "@delivery-os/adapters/gitlab";
import { JIRA_ADAPTER_CONTRACT, type JiraClient } from "@delivery-os/adapters/jira";
import { createLegacyCompat } from "@delivery-os/adapters/legacy";
import { createProviderWatchMappings } from "@delivery-os/adapters/provider-quota";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  type RepositoryIo,
  type RepositoryRootFacts,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import {
  createDeliverySessionFacts,
  createSessionAdmin,
  createSessionStore,
  type OpencodeSessionIo,
} from "@delivery-os/adapters/session";
import type { ConfigCatalog, DefaultPositionManifest } from "@delivery-os/core";
import {
  buildCloseoutPlan,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  callerAudienceVariableName,
  type CommitActRequest,
  type CommitTransportPorts,
  catalogPaths,
  classifyPruneCandidate,
  collectRetro,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  computeSpendReport,
  createSourcedWatchdogSignalSource,
  isLiveDbSession,
  type MergeTransactionPorts,
  newestWaiverByGate,
  PRODUCTION_CATALOG,
  reportRetro,
  resolveCloseoutBaseRef,
  resolveConfig,
  resolveMergeGateSet,
  runCloseout,
  runCommitAct,
  selectPruneCandidates,
  spendDigestSection,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
} from "@delivery-os/core";
import type { BrandingInputError, ResolverInput } from "@delivery-os/core/branding";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import {
  type AdapterCapabilityDeclaration,
  AUDIT_IDENTITY_VARIABLE_SUFFIX,
  type AuditAgentIdentity,
  type AuditInvocationFacts,
  BLOCKER_DELEGATION_POLICY,
  type BlockerCapabilityFact,
  type BlockerDelegationPolicy,
  type BrandIdentity,
  CLOSEOUT_MAX_DEPENDENTS,
  type CloseoutGitRuntime,
  type CloseoutProviderRuntime,
  type CloseoutReadObservation,
  type CloseoutReverseDependentObservation,
  type CloseoutStateRuntime,
  type CloseoutWriteOutcome,
  type CommitGitPort,
  type CommitlintPort,
  type CommitPlanPhaseContext,
  type CommitSafetyPort,
  type CommitSessionFacts,
  type CommitTelemetryRecord,
  type CommitTransportAvailability,
  type ConfigFailure,
  type CredentialPort,
  type DeliveryRequest,
  type DoctorCheckoutFacts,
  type DoctorCommitResolution,
  type DoctorCredentialPresence,
  type DoctorParkFoldRead,
  type DoctorProviderCredentialPresence,
  type DoctorStateStoresRead,
  type DoctorWiringRead,
  type ExternalSystemInstance,
  type HarnessLivenessFacts,
  OWNER_GATE_SLA_POLICY,
  type OwnerGateCollectorRead,
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  type PhaseTransitionRecord,
  type PlanDiffPort,
  type ProviderAnnouncementRecord,
  type ProviderClock,
  type ProviderParkRecord,
  type ProviderSleep,
  type QuotaTransport,
  type Result,
  type SpendDigestSection,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_SOURCE_ITEM_LIMIT,
  type StateStorePort,
  type StatusBlockersRead,
  type StatusLocalContextRead,
  type StatusParkRead,
  type StatusProviderConfigRead,
  type StatusReadFailure,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  VERIFY_GATES_FAILURE_CLASSES,
  type WatchdogGitPort,
  type WatchdogLaneRead,
  type WatchdogSignalSource,
  type WorkItem,
} from "@delivery-os/core/contracts";
import {
  createProfileProbePort,
  createProviderEngine,
  createProviderWatchStatus,
  evaluatePeakWindow,
  evaluateProfileLifecycle,
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  persistProfileTarget,
  readProfileTarget,
  readProviderLedger,
  readProviderParkViews,
  resolveProfileForSpawn,
  selectProfile,
} from "@delivery-os/core/provider";
import {
  appendAuditInvocation,
  appendBlockerAnswer,
  appendBlockerQuestion,
  appendCloseoutOutcome,
  appendCommitTelemetry,
  appendMergeGateVerification,
  appendMergeTransaction,
  appendMergeWaiver,
  appendOwnerGateSlaDecision,
  appendPhaseTransition,
  createNodeRetroSidecarIo,
  createNodeStateEdge,
  createRetroSidecar,
  createStateStore,
  foldCloseoutHistory,
  readAllMergeWaivers,
  readAuditLedger,
  readBlockerLedger,
  readChangeTransitionsTolerant,
  readCloseoutHistory,
  readCommitTelemetry,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
  readOwnerGateSlaDecisions,
  readRetroRegistry,
  readRetroRuns,
  readSpendLedger,
  recordRetroRun,
  replacePhaseProjection,
  STATE_SCHEMA_VERSION,
  seedRetroRegistry,
} from "@delivery-os/core/state";
import { resolveAppErrorCode } from "./classify.js";
import {
  type BlockersCommandRuntime,
  createBlockersCommandDefinition,
} from "./commands/blockers.js";
import { type BoardCommandRuntime, createBoardCommandDefinition } from "./commands/board.js";
import { createBriefCommandDefinition } from "./commands/brief.js";
import {
  type CloseoutCommandRuntime,
  createCloseoutCommandDefinition,
} from "./commands/closeout.js";
import {
  type CommitCommandRuntime,
  createCommitCommandDefinition,
  planPhaseForLifecycle,
} from "./commands/commit.js";
import {
  type ConfigCommandRuntime,
  type ConfigResolvedSnapshot,
  createConfigCommandDefinition,
} from "./commands/config.js";
import { createDbCommandDefinition, type DbCommandRuntime } from "./commands/db.js";
import { createDoctorCommandDefinition, type DoctorCommandRuntime } from "./commands/doctor.js";
import {
  createLintCommandDefinition,
  type LintCommandRuntime,
  type LintRegistryRead,
} from "./commands/lint.js";
import { createMergeCommandDefinition, type MergeCommandRuntime } from "./commands/merge.js";
import {
  createPhaseCommandDefinition,
  type PhaseCommandRuntime,
  type PhaseCommitEvidence,
  type PhaseCommitExtension,
  type PhasePlanRead,
} from "./commands/phase.js";
import { createPlanCommandDefinition, type PlanCommandRuntime } from "./commands/plan.js";
import {
  createProviderCommandDefinition,
  type ProviderCommandRuntime,
} from "./commands/provider.js";
import { createQueueReadyCommandDefinition } from "./commands/queue.js";
import { createRetroCommandDefinition } from "./commands/retro.js";
import { createSpendCommandDefinition, type SpendCommandRuntime } from "./commands/spend.js";
import { createStatusCommandDefinition, type StatusCommandRuntime } from "./commands/status.js";
import { createVerifyCommandDefinition, type VerifyCommandRuntime } from "./commands/verify.js";
import type { VerifyDeployRuntime } from "./commands/verify-deploy.js";
import type { VerifyGatesCommandRuntime } from "./commands/verify-gates.js";
import {
  createWatchdogCommandDefinition,
  type WatchdogCommandRuntime,
} from "./commands/watchdog.js";
import type {
  CliAuditDependencies,
  CliDependencies,
  CliMode,
  CommandDefinition,
  CommandFlags,
  CommandProgram,
} from "./index.js";

const NEUTRAL_OVERRIDE_NAME = "DELIVERY_OS_WORKING_NAME";

/**
 * Resolve the claimed agent identity from injected environment data (DEC-3).
 * The variable name is derived (brand prefix + declared suffix); presence is
 * decided on the trimmed value, while the recorded value stays verbatim.
 */
export const resolveAgentIdentity = (
  environment: Readonly<Record<string, string | undefined>>,
  environmentPrefix: string,
): AuditAgentIdentity | undefined => {
  const value = environment[`${environmentPrefix}${AUDIT_IDENTITY_VARIABLE_SUFFIX}`];
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return { kind: "claimed", value };
};

/** Resolve the machine-output mode from an injected stream-capability fact. */
export const resolveCliMode = (stream: { readonly isTTY?: boolean }): CliMode =>
  stream.isTTY === true ? "interactive" : "scripted";

export type CliAuditComposition = {
  readonly store: StateStorePort;
  readonly scope: string;
  readonly repo?: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix: string;
};

/**
 * Compose the audit seam at the runtime-aware edge: identity from injected
 * environment data, the store-backed writer, and the invocation scope.
 */
export const createCliAudit = (options: CliAuditComposition): CliAuditDependencies => {
  const identity = resolveAgentIdentity(options.environment, options.environmentPrefix);
  return {
    scope: options.scope,
    ...(options.repo === undefined ? {} : { repo: options.repo }),
    ...(identity === undefined ? {} : { identity }),
    record: (facts: AuditInvocationFacts) => {
      const appended = appendAuditInvocation(options.store, facts);
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    },
  };
};

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
    const read = readChangeTransitionsTolerant(options.store, changeRef);
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

/**
 * The commit surface composition seams (GH-227 F-1..F-5). Every I/O, time,
 * transport, scanner, commitlint, and session fact is injected.
 */
export type CommitRuntimeOptions = {
  readonly store: StateStorePort;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly git: CommitGitPort;
  readonly safety: CommitSafetyPort;
  readonly commitlint: CommitlintPort;
  readonly transports: CommitTransportPorts;
  readonly availability: CommitTransportAvailability;
  readonly sessionFacts: CommitSessionFacts | (() => CommitSessionFacts);
  readonly phaseCommit: boolean;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly resolveRef?: () => Promise<
    { readonly ref: string; readonly refSource: "branch" | "change-folder" } | undefined
  >;
};

const scopePathsOf = (scope: unknown): readonly string[] => {
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) return [];
  const record = scope as Record<string, unknown>;
  const paths: string[] = [];
  for (const key of ["files", "packages", "folders"]) {
    const values = record[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) if (typeof value === "string") paths.push(value);
  }
  return paths;
};

const planPhasesOf = (values: Record<string, unknown>): readonly CommitPlanPhaseContext[] => {
  const phases = values.phases;
  if (!Array.isArray(phases)) return [];
  const contexts: CommitPlanPhaseContext[] = [];
  for (const phase of phases) {
    if (typeof phase !== "object" || phase === null || Array.isArray(phase)) continue;
    const record = phase as Record<string, unknown>;
    const id = typeof record.id === "number" ? String(record.id) : undefined;
    const title = typeof record.title === "string" ? record.title : undefined;
    if (id === undefined || title === undefined) continue;
    const kind = record.kind === "planning" || record.kind === "delivery" ? record.kind : undefined;
    contexts.push({
      phaseId: id,
      title,
      ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
      declaredScopePaths: scopePathsOf(record.scope),
      ...(kind === undefined ? {} : { kind }),
    });
  }
  return contexts;
};

const readPlanContext = (
  options: Pick<CommitRuntimeOptions, "changesDirectory" | "fs">,
  changeRef: string,
): { readonly planPresent: boolean; readonly phases: readonly CommitPlanPhaseContext[] } => {
  const artifact = readPlanArtifact({
    changeRef,
    changesDirectory: options.changesDirectory,
    fs: options.fs,
  });
  if (!artifact.ok || artifact.artifact.kind !== "yaml") {
    return { planPresent: false, phases: [] };
  }
  const parsed = parseConfigYaml(artifact.text, "project-committed", artifact.artifact.path);
  return parsed.ok
    ? { planPresent: true, phases: planPhasesOf(parsed.facts.values) }
    : { planPresent: true, phases: [] };
};

const currentPhaseOf = (store: StateStorePort, changeRef: string): string | undefined => {
  const read = readChangeTransitionsTolerant(store, changeRef);
  if (!read.ok) return undefined;
  const latest = [...read.value.transitions]
    .reverse()
    .find((record) => record.operation === "complete");
  return latest?.phaseId;
};

const commitActPorts = (options: CommitRuntimeOptions): Parameters<typeof runCommitAct>[1] => ({
  git: options.git,
  safety: options.safety,
  commitlint: options.commitlint,
  transports: options.transports,
  availability: options.availability,
  nowIso: options.nowIso,
  appendTelemetry: async (record: CommitTelemetryRecord) => {
    const appended = appendCommitTelemetry(options.store, options.newFenceToken(), record);
    return appended.ok ? { ok: true } : { ok: false, detail: appended.error.code };
  },
});

/** Compose the phase-side atomic completion extension (GH-227 F-6/F-7). */
export const createPhaseCommitExtension = (
  options: CommitRuntimeOptions,
): PhaseCommitExtension => ({
  phaseCommit: options.phaseCommit,
  readPlanPhase: (changeRef, phaseId): PhasePlanRead => {
    const planContext = readPlanContext(options, changeRef);
    if (!planContext.planPresent) return { planPresent: false };
    const phase = planPhaseForLifecycle(planContext.phases, phaseId);
    return phase === undefined ? { planPresent: true } : { planPresent: true, planPhase: phase };
  },
  readEvidence: async (changeRef, phaseId): Promise<PhaseCommitEvidence> => {
    const read = readChangeTransitionsTolerant(options.store, changeRef);
    if (!read.ok) {
      return { recordPresent: false, commitPresent: false, readFailure: read.error };
    }
    let record: PhaseTransitionRecord | undefined;
    let latest: PhaseTransitionRecord | undefined;
    for (const entry of read.value.transitions) {
      if (entry.phaseId !== phaseId) continue;
      latest = entry;
      record = entry.operation === "complete" ? entry : undefined;
    }
    const reopenedAt = latest?.operation === "reopen" ? latest.timestamp : undefined;
    const telemetry = readCommitTelemetry(options.store, changeRef);
    // Commit presence is durable evidence, not a HEAD position: a later commit
    // moving HEAD must not degrade an earlier phase's landed commit to absent.
    // The telemetry event is bound to the record by its transition identity and
    // corroborates; the record's own `commitSha` is the primary evidence,
    // because telemetry emission is non-gating and may be absent or torn.
    const event = telemetry.ok
      ? [...telemetry.value.records]
          .reverse()
          .find(
            (entry) =>
              entry.phaseId === phaseId &&
              (reopenedAt === undefined || entry.landedAt > reopenedAt) &&
              (record === undefined || entry.transitionId === record.timestamp),
          )
      : undefined;
    const recordSha = record?.commitSha;
    const recordCommitPresent =
      recordSha !== undefined && (await options.git.commitExists(recordSha));
    const commitPresent = event !== undefined || recordCommitPresent;
    if (!commitPresent && !telemetry.ok && record?.commitIntent !== "record-only") {
      // Unreadable telemetry with no record-bound commit to corroborate: the
      // durable state cannot classify commit presence. Refuse instead of
      // reading a missing signal as commit-absent.
      return {
        recordPresent: record !== undefined,
        ...(record?.commitIntent === undefined ? {} : { recordIntent: record.commitIntent }),
        ...(record?.commitIntentBasis === undefined
          ? {}
          : { recordBasis: record.commitIntentBasis }),
        ...(record?.timestamp === undefined ? {} : { transitionId: record.timestamp }),
        commitPresent: false,
        readFailure: telemetry.error,
      };
    }
    const commitSha = event?.commitSha ?? recordSha;
    return {
      recordPresent: record !== undefined,
      ...(record?.commitIntent === undefined ? {} : { recordIntent: record.commitIntent }),
      ...(record?.commitIntentBasis === undefined ? {} : { recordBasis: record.commitIntentBasis }),
      ...(record?.timestamp === undefined ? {} : { transitionId: record.timestamp }),
      commitPresent,
      ...(commitSha === undefined ? {} : { commitSha }),
    };
  },
  currentHead: () => options.git.head(),
  runAct: (request: CommitActRequest) => runCommitAct(request, commitActPorts(options)),
});

/**
 * Compose the production commit seams over the delivered adapters.
 *
 * The git commit seam, the deterministic scanner, and the commitlint probe are
 * the runtime-aware implementations; transports and availability remain
 * explicit (a fresh install with no route degrades to the template).
 */
export type ProductionCommitRuntimeOptions = {
  readonly store: StateStorePort;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly sessionEnvironmentKeys: readonly string[];
  readonly phaseCommit: boolean;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly transports?: CommitTransportPorts;
  readonly availability?: CommitTransportAvailability;
};

export const createProductionCommitRuntimeOptions = (
  options: ProductionCommitRuntimeOptions,
): CommitRuntimeOptions => ({
  store: options.store,
  changesDirectory: options.changesDirectory,
  fs: options.fs,
  git: createGitCommitSeam({ cwd: options.cwd }),
  safety: { scan: createSecretScanner({ cwd: options.cwd }) },
  commitlint: createCommitlintProbe({ cwd: options.cwd }),
  transports: options.transports ?? {},
  availability: options.availability ?? {
    coreInference: { available: false, reason: "no-provider-route" },
    harnessOneShot: { available: false, reason: "no-harness-credentials" },
  },
  sessionFacts: createDeliverySessionFacts({
    environment: options.environment,
    keys: options.sessionEnvironmentKeys,
  }),
  phaseCommit: options.phaseCommit,
  nowIso: options.nowIso,
  newFenceToken: options.newFenceToken,
});

/** Compose the standalone `commit` surface (GH-227 F-1..F-5). */
export const createCommitCommandRuntime = (
  options: CommitRuntimeOptions,
  phase?: { readonly runtime: PhaseCommandRuntime; readonly extension: PhaseCommitExtension },
): CommitCommandRuntime => ({
  sessionFacts: () =>
    typeof options.sessionFacts === "function" ? options.sessionFacts() : options.sessionFacts,
  resolveRef:
    options.resolveRef ??
    (async () => {
      const head = await options.git.readTree();
      const match = /(?:^|\/)([A-Z][A-Z0-9]*-\d+)(?:$|\/)/.exec(head.branch);
      return match?.[1] === undefined ? undefined : { ref: match[1], refSource: "branch" as const };
    }),
  readContext: (changeRef) => {
    const plan = readPlanContext(options, changeRef);
    const currentPhaseId =
      currentPhaseOf(options.store, changeRef) ?? (plan.planPresent ? "delivery" : undefined);
    return {
      ...(currentPhaseId === undefined ? {} : { currentPhaseId }),
      planPresent: plan.planPresent,
      phases: plan.phases,
    };
  },
  runAct: (request) => runCommitAct(request, commitActPorts(options)),
  currentHead: () => options.git.head(),
  ...(phase === undefined ? {} : { phase }),
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

/** The injected I/O and provider seams for the gates runtime (GH-178). */
export type VerifyGatesRuntimeOptions = {
  readonly store: StateStorePort;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly repository: { readonly cwd: string; readonly io: RepositoryIo };
  readonly workflow: { readonly baseDirectory: string; readonly fs: FileSystemFacts };
  readonly github: {
    readonly instance: ExternalSystemInstance;
    readonly credentials: CredentialPort;
    readonly transport: StatusTransport;
  };
  /** The resolved declared gate set; absent yields the shipped default. */
  readonly readGateSet?: VerifyGatesCommandRuntime["readGateSet"];
  /** The EVT-1 append seam; absent leaves the evaluation unrecorded. */
  readonly appendVerification?: VerifyGatesCommandRuntime["appendVerification"];
  /** The injected clock in epoch milliseconds. */
  readonly nowMs?: () => number;
};

type ProviderFailureLike = { readonly ok: false; readonly code: string };

const providerReadFailure = <T>(failure: ProviderFailureLike): VerifyGatesReadResult<T> => {
  if (failure.code === "config.credential.missing") {
    return {
      ok: false,
      reason: "credential-unavailable",
      failureCode: "config.credential.missing",
    };
  }
  if (failure.code === "provider.not-found") {
    return { ok: false, reason: "not-found", failureClass: VERIFY_GATES_FAILURE_CLASSES[1] };
  }
  return { ok: false, reason: "read-failed", failureClass: VERIFY_GATES_FAILURE_CLASSES[0] };
};

const unaddressed = <T>(): VerifyGatesReadResult<T> => ({
  ok: false,
  reason: "address-unresolved",
});

const credentialRefusal = <T>(): VerifyGatesReadResult<T> => ({
  ok: false,
  reason: "credential-unavailable",
  failureCode: "config.credential.missing",
});

/** Compose the gates reads at the runtime-aware edge. */
export const createVerifyGatesCommandRuntime = (
  options: VerifyGatesRuntimeOptions,
): VerifyGatesCommandRuntime => {
  const instance = options.github.instance;
  const admitted =
    instance.systemKind === "vcs" && instance.authMethod.mechanism === "credential-reference";
  let target: StatusRepositoryTarget | undefined;

  const clientFor = (repository: StatusRepositoryTarget) =>
    createGitHubClient({
      instance,
      credentials: options.github.credentials,
      repository,
      transport: options.github.transport,
    });

  const readRepository = (): VerifyGatesRepositoryFacts => {
    const facts = readRepositoryFacts({
      cwd: options.repository.cwd,
      io: options.repository.io,
    });
    const parsed = parseGitHubRemote(facts.originUrl);
    if (parsed.ok) {
      target = { owner: parsed.owner, name: parsed.name };
      return { binding: "resolved", head: facts.head };
    }
    target = undefined;
    return {
      binding: parsed.reason === "remote-unsupported" ? "remote-unsupported" : "address-unresolved",
      head: facts.head,
    };
  };

  return {
    readLifecycle: (changeRef) => ({
      document: readPmNotesText({
        changeRef,
        changesDirectory: options.changesDirectory,
        fs: options.fs,
      }),
      registry: (() => {
        const read = readChangeTransitionsTolerant(options.store, changeRef);
        if (!read.ok) return { ok: false as const, error: read.error };
        return {
          ok: true as const,
          present: read.value.present,
          verifiedEmpty: read.value.verifiedEmpty,
          transitions: read.value.transitions,
          recordCount: read.value.evidence.recordCount,
        };
      })(),
    }),
    readRepository,
    readWorkflow: (): VerifyGatesWorkflowFacts => {
      const read = readCiWorkflowJobNames({
        baseDirectory: options.workflow.baseDirectory,
        fs: options.workflow.fs,
      });
      return { outcome: read.outcome, names: read.names };
    },
    readOpenPullRequests: async (limit): Promise<VerifyGatesReadResult<VerifyGatesOpenPrPage>> => {
      if (!admitted) return credentialRefusal();
      if (target === undefined) return unaddressed();
      const result = await clientFor(target).listDeliveryRequests(limit);
      if (!result.ok) return providerReadFailure(result);
      return {
        ok: true,
        value: { items: result.value.items, pageItemCount: result.value.pageItemCount },
      };
    },
    readDeliveryRequestDetail: async (
      pullNumber,
    ): Promise<VerifyGatesReadResult<VerifyGatesDetail>> => {
      if (!admitted) return credentialRefusal();
      if (target === undefined) return unaddressed();
      const result = await clientFor(target).readDeliveryRequest(Number(pullNumber));
      if (!result.ok) return providerReadFailure(result);
      return { ok: true, value: { request: result.value } };
    },
    readCheckRuns: async (sha, limit): Promise<VerifyGatesReadResult<VerifyGatesCheckRunPage>> => {
      if (!admitted) return credentialRefusal();
      if (target === undefined) return unaddressed();
      const result = await clientFor(target).readPipelineRun(sha, limit);
      if (!result.ok) return providerReadFailure(result);
      return {
        ok: true,
        value: { items: result.value.items, pageItemCount: result.value.pageItemCount },
      };
    },
    readWorkItem: async (changeRef): Promise<VerifyGatesReadResult<VerifyGatesWorkItem>> => {
      const match = /^[A-Za-z]+-([0-9]+)$/.exec(changeRef);
      const issueNumber = match?.[1];
      if (issueNumber === undefined) return { ok: false, reason: "unresolved" };
      if (!admitted) return credentialRefusal();
      if (target === undefined) return unaddressed();
      const result = await clientFor(target).readWorkItem(Number(issueNumber));
      if (!result.ok) return providerReadFailure(result);
      return { ok: true, value: { item: result.value } };
    },
    readGateSet:
      options.readGateSet ??
      (() => {
        const resolved = resolveMergeGateSet(undefined);
        return resolved.ok
          ? { ok: true as const, value: resolved.value }
          : { ok: false as const, code: resolved.failure.code, detail: resolved.failure.detail };
      }),
    appendVerification: options.appendVerification ?? (() => ({ ok: true as const })),
    nowMs: options.nowMs ?? (() => Date.now()),
  };
};

/** The injected seams for the merge command composition (GH-225 F-1..F-8). */
export type MergeCommandComposition = {
  readonly store: StateStorePort;
  readonly git: GitMergeSeam;
  readonly values: () => Readonly<Record<string, unknown>>;
  readonly readWorkItem: (
    changeRef: string,
  ) => Promise<
    { readonly ok: true; readonly item: WorkItem } | { readonly ok: false; readonly code: string }
  >;
  readonly readCheckRuns: (sha: string) => Promise<
    | {
        readonly ok: true;
        readonly items: readonly import("@delivery-os/core/contracts").PipelineRun[];
        readonly pageItemCount: number;
        readonly sha?: string;
      }
    | { readonly ok: false; readonly code: string }
  >;
  readonly readRequestDetail: () => Promise<
    | { readonly ok: true; readonly request: DeliveryRequest }
    | { readonly ok: false; readonly code: string }
  >;
  readonly ownerPrincipal?: string;
  readonly baseRef?: string;
  readonly branch?: string;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
  readonly newFenceToken: () => string;
};

/**
 * Compose the merge command runtime: the declared configuration, the three
 * merge ledgers, the bounded provider reads, and the git mutation seam.
 */
export const createMergeCommandRuntime = (
  composition: MergeCommandComposition,
): MergeCommandRuntime => {
  const policy = OWNER_GATE_SLA_POLICY;
  return {
    readConfig: () => {
      const values = composition.values();
      const merge = values.merge;
      const rawGates =
        typeof merge === "object" && merge !== null && !Array.isArray(merge)
          ? (merge as Record<string, unknown>).gates
          : undefined;
      const resolved = resolveMergeGateSet(rawGates);
      if (!resolved.ok) {
        return {
          ok: false as const,
          code: resolved.failure.code,
          detail: resolved.failure.detail,
        };
      }
      const freshness =
        typeof merge === "object" && merge !== null && !Array.isArray(merge)
          ? (merge as Record<string, unknown>)["gate-freshness"]
          : undefined;
      // A safety-relevant bound is never silently interpreted: an invalid
      // declared freshness fails closed as a classified configuration failure.
      if (
        freshness !== undefined &&
        (typeof freshness !== "number" || !Number.isFinite(freshness) || freshness < 0)
      ) {
        return {
          ok: false as const,
          code: "config.value.invalid",
          detail: "merge.gate-freshness must be a finite non-negative number of seconds",
        };
      }
      return {
        ok: true as const,
        config: {
          gateSet: resolved.value,
          freshnessBoundSeconds: typeof freshness === "number" ? freshness : 1800,
          comparator: policy.comparator,
          policy,
          ...(composition.ownerPrincipal === undefined
            ? {}
            : { ownerPrincipal: composition.ownerPrincipal }),
          baseRef: composition.baseRef ?? "main-tools",
          ...(composition.branch === undefined ? {} : { branch: composition.branch }),
        },
      };
    },
    createPorts: (changeRef): MergeTransactionPorts => ({
      nowIso: composition.nowIso,
      nowMs: composition.nowMs,
      readVerification: () => readMergeGateVerifications(composition.store, changeRef),
      readTransactions: () => readMergeTransactions(composition.store, changeRef),
      readWaivers: () => readMergeWaivers(composition.store, changeRef),
      appendVerification: (record) => {
        const result = appendMergeGateVerification(composition.store, {
          record,
          fenceToken: composition.newFenceToken(),
        });
        return result.ok ? { ok: true } : { ok: false, code: result.error.code };
      },
      appendWaiver: (record) => {
        const result = appendMergeWaiver(composition.store, {
          record,
          fenceToken: composition.newFenceToken(),
        });
        return result.ok ? { ok: true } : { ok: false, code: result.error.code };
      },
      appendTransaction: (record) => {
        const result = appendMergeTransaction(composition.store, {
          record,
          fenceToken: composition.newFenceToken(),
        });
        return result.ok ? { ok: true } : { ok: false, code: result.error.code };
      },
      readWorkItem: () => composition.readWorkItem(changeRef),
      readCheckRuns: async (sha) => {
        const read = await composition.readCheckRuns(sha);
        return read.ok
          ? {
              ok: true as const,
              value: {
                items: read.items,
                pageItemCount: read.pageItemCount,
                ...(read.sha === undefined ? {} : { sha: read.sha }),
              },
            }
          : read;
      },
      readRequestDetail: () => composition.readRequestDetail(),
      readHead: () => composition.git.head(),
      readBaseContainment: (sha) =>
        composition.git.isContained(sha, composition.baseRef ?? "main-tools"),
      refresh: async () =>
        composition.branch === undefined
          ? { outcome: "failed" as const, code: "branch-unresolved" }
          : composition.git.refresh({
              branch: composition.branch,
              baseRef: composition.baseRef ?? "main-tools",
            }),
      land: async (input) =>
        composition.branch === undefined
          ? { ok: false as const, code: "branch-unresolved" }
          : composition.git.squashLand({
              branch: composition.branch,
              baseRef: input.baseRef,
              message: `merge(${changeRef}): squash ${composition.branch}`,
            }),
      deleteBranch: async (input) =>
        input.branch === undefined
          ? "failed"
          : composition.git.deleteBranch({ branch: input.branch }),
    }),
  };
};

/** The injected seams for the `verify deploy` composition (GH-225 F-6). */
export type VerifyDeployComposition = {
  readonly resolve: VerifyDeployRuntime["resolve"];
  readonly github: {
    readonly instance: ExternalSystemInstance;
    readonly credentials: CredentialPort;
    readonly transport: StatusTransport;
    readonly repository: { readonly owner: string; readonly name: string };
  };
};

/**
 * Compose the deploy runtime: deterministic target resolution plus one bounded
 * trace read behind the GitHub transport. No trigger capability is composed.
 */
export const createVerifyDeployCommandRuntime = (
  composition: VerifyDeployComposition,
): VerifyDeployRuntime => {
  const reader = createGitHubDeployTraceReader({
    instance: composition.github.instance,
    credentials: composition.github.credentials,
    repository: composition.github.repository,
    transport: composition.github.transport,
  });
  return {
    resolve: composition.resolve,
    readTrace: async (target) => {
      const result = await reader.readDeployTrace(target.jobId, target.pipelineName);
      return result.ok ? { ok: true, trace: result.value } : { ok: false, code: result.code };
    },
  };
};

export type EdgeOptions = {
  readonly brand: BrandIdentity;
  readonly program: CommandProgram;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly secretKeys?: readonly string[];
  /** Injected stream capability fact; omitted means non-interactive. */
  readonly isTTY?: boolean;
  /** Injected state directory; defaults to `<home>/<stateDirectoryName>`. */
  readonly stateDirectory?: string;
  /** Injected home directory; defaults to the environment record's HOME. */
  readonly homeDirectory?: string;
  /** Injected workspace identity for the audit store. */
  readonly workspaceId?: string;
  /** Injected fence namespace for the audit store. */
  readonly fenceNamespace?: string;
};

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

const stateDirectoryFor = (options: EdgeOptions): string | undefined => {
  if (options.stateDirectory !== undefined) return options.stateDirectory;
  const environment = options.environment ?? {};
  const home = options.homeDirectory ?? environment.HOME ?? environment.USERPROFILE;
  if (home === undefined || home.length === 0) return undefined;
  return `${trimTrailingSeparators(home)}/${options.brand.stateDirectoryName}`;
};

/**
 * Assemble the production dependency set at the runtime-aware edge. The clock
 * is the epoch-millisecond UTC wall clock; the mode fact comes from the
 * injected stream capability; and the audit seam composes over the state
 * directory derived from the branding state-directory name.
 */
export function createProductionDependencies(options: EdgeOptions): CliDependencies {
  const environment = options.environment ?? {};
  const workspaceId = options.workspaceId ?? "default";
  const stateDirectory = stateDirectoryFor(options);
  const audit =
    stateDirectory === undefined
      ? undefined
      : createCliAudit({
          store: createStateStore(
            {
              level: "local",
              workspaceId,
              fenceNamespace: options.fenceNamespace ?? "cli-audit",
              schemaVersion: STATE_SCHEMA_VERSION,
              stateDirectory,
            },
            { driver: "jsonl", edge: createNodeStateEdge() },
          ),
          scope: workspaceId,
          environment,
          environmentPrefix: options.brand.environmentPrefix,
        });
  return {
    brand: options.brand,
    clock: { now: () => Date.now() },
    newRunId: () => globalThis.crypto.randomUUID(),
    secrets: registerEdgeSecrets(environment, options.secretKeys ?? []),
    program: options.program,
    mode: resolveCliMode(options.isTTY === undefined ? {} : { isTTY: options.isTTY }),
    ...(audit === undefined ? {} : { audit }),
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
        epicMembership: "available",
        storyPoints: "available",
        inSprint: "available",
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
    readBlockers: (): StatusBlockersRead => {
      const read = readBlockerLedger(options.store);
      return read.ok
        ? { ok: true, value: read.value }
        : { ok: false, reason: "state-unreadable", failureCode: read.error.code };
    },
    readSpend: (): SpendDigestSection => spendDigestFor(options),
    nowIso: options.clock.nowIso,
    nowMs: options.clock.nowMs,
  };
};

/**
 * The digest's spend projection over the already-composed store seam (DM-6).
 *
 * The active change ref comes from the same local PM context the digest already
 * reads; a missing context is digest data, never a command failure. The section
 * derives from the SAME `readSpendLedger` + fold the command consumes.
 */
const spendDigestFor = (options: {
  readonly store: StateStorePort;
  readonly localContext: { readonly path: string; readonly fs: FileSystemFacts };
}): SpendDigestSection => {
  const context = readLocalPmContext({
    path: options.localContext.path,
    fs: options.localContext.fs,
  });
  const ref = context.ok ? context.context.activeChange?.workItemRef : undefined;
  if (ref === undefined) {
    return {
      state: "unknown",
      reason: "local-context-missing",
      failureCode: "local-context-missing",
    };
  }
  const read = readSpendLedger(options.store, ref);
  if (!read.ok) {
    return { state: "unknown", reason: "state-unreadable", failureCode: read.error.code };
  }
  return spendDigestSection(read.value);
};

/** The doctor composition seams; the provider resolver is supplied by the edge. */
export type DoctorComposition = {
  readonly store: StateStorePort;
  readonly credentials: CredentialPort;
  readonly transport: StatusTransport;
  readonly repository: { readonly cwd: string; readonly io: RepositoryIo };
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly github: { readonly instance: ExternalSystemInstance };
  /** The brand environment prefix used only to name declared source keys. */
  readonly environmentPrefix: string;
  /** The injected local work-tree fact (doctor spawns no process). */
  readonly readWorkTree: () => { readonly readable: boolean; readonly clean: boolean };
  /** The additive retro registry store fact (GH-232 F-8). */
  readonly readRetroState?: () => DoctorStateStoresRead;
};

type DoctorLedgerSnapshot =
  | {
      readonly ok: true;
      readonly value: {
        readonly parks: readonly ProviderParkRecord[];
        readonly announcements: readonly ProviderAnnouncementRecord[];
        readonly evidence?: { readonly verifiedEmpty: boolean; readonly recordCount: number };
      };
    }
  | { readonly ok: false; readonly error: { readonly code: string } };

const doctorStateReason = (
  code: string,
): "store-torn" | "store-schema-mismatch" | "store-unreadable" | "store-unknown" | "unreadable" => {
  switch (code) {
    case "state.store.torn":
      return "store-torn";
    case "state.schema.mismatch":
      return "store-schema-mismatch";
    case "state.permission.denied":
      return "store-unreadable";
    case "state.store.unknown":
      return "store-unknown";
    default:
      return "unreadable";
  }
};

const doctorWiringRead = (result: { readonly ok: boolean }): DoctorWiringRead => {
  if (result.ok) {
    const page = (result as { readonly value?: { readonly pageItemCount?: number } }).value;
    return { ok: true, pageItemCount: page?.pageItemCount ?? 0 };
  }
  const failure = result as {
    readonly code?: string;
    readonly failureClass?: string;
    readonly httpStatus?: number;
  };
  if (failure.code === "config.credential.missing") {
    return {
      ok: false,
      reason: "credential-unavailable",
      failureCode: "config.credential.missing",
    };
  }
  return {
    ok: false,
    reason: "read-failed",
    ...(failure.code === undefined ? {} : { failureClass: failure.code }),
    ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
  };
};

/** Compose the doctor runtime, enforcing the credential-reference guard first. */
export const createDoctorCommandRuntime = (
  options: DoctorComposition,
  resolveProviderConfig: () => StatusProviderConfigRead,
): DoctorCommandRuntime => {
  const instance = options.github.instance;
  const admitted =
    instance.systemKind === "vcs" && instance.authMethod.mechanism === "credential-reference";
  const reference =
    instance.authMethod.mechanism === "credential-reference"
      ? instance.authMethod.reference
      : undefined;
  const envVar =
    reference === undefined
      ? undefined
      : reference.sourceKey.style === "literal"
        ? reference.sourceKey.name
        : `${options.environmentPrefix}${reference.sourceKey.suffix}`;
  const credentialRefusal: DoctorCredentialPresence = {
    ok: false,
    failureCode: "config.credential.missing",
    ...(envVar === undefined ? {} : { envVar }),
  };
  let factsCache: ReturnType<typeof readRepositoryFacts> | undefined;
  let ledgerCache: DoctorLedgerSnapshot | undefined;

  const repositoryFacts = (): ReturnType<typeof readRepositoryFacts> =>
    (factsCache ??= readRepositoryFacts({
      cwd: options.repository.cwd,
      io: options.repository.io,
    }));

  const ledger = (): NonNullable<typeof ledgerCache> => {
    if (ledgerCache === undefined) {
      const read = readProviderLedger(options.store);
      ledgerCache = read.ok
        ? {
            ok: true,
            value: {
              parks: read.value.parks,
              announcements: read.value.announcements,
              ...(read.value.evidence === undefined ? {} : { evidence: read.value.evidence }),
            },
          }
        : { ok: false, error: { code: read.error.code } };
    }
    return ledgerCache;
  };

  const clientFor = (target: { readonly owner: string; readonly name: string }) =>
    createGitHubClient({
      instance,
      credentials: options.credentials,
      repository: target,
      transport: options.transport,
    });

  const readRepository = (): DoctorCheckoutFacts => {
    const facts = repositoryFacts();
    const workTree = options.readWorkTree();
    const parsed = parseGitHubRemote(facts.originUrl);
    const binding = parsed.ok
      ? {
          state: "observed" as const,
          host: "github.com" as const,
          owner: parsed.owner,
          name: parsed.name,
        }
      : { state: "unavailable" as const, reason: "remote-unresolvable" as const };
    return {
      readable: facts.root !== undefined && workTree.readable,
      clean: workTree.clean,
      ...(facts.head.branch === undefined ? {} : { branch: facts.head.branch }),
      ...(facts.head.sha === undefined ? {} : { sha: facts.head.sha }),
      detached: facts.head.detached,
      binding,
    };
  };

  return {
    readRepository,
    resolveTrackerCredential: (): DoctorCredentialPresence => {
      if (!admitted || reference === undefined) return credentialRefusal;
      return options.credentials.resolve(reference).ok ? { ok: true } : credentialRefusal;
    },
    readTrackerPage: async (target, limit) => {
      if (!admitted)
        return {
          ok: false,
          reason: "credential-unavailable",
          failureCode: "config.credential.missing",
        };
      return doctorWiringRead(await clientFor(target).listWorkItems(limit));
    },
    resolveHeadCommit: (): DoctorCommitResolution => {
      const head = repositoryFacts().head;
      return {
        resolved: head.sha !== undefined && !head.detached,
        ...(head.branch === undefined ? {} : { branch: head.branch }),
        ...(head.sha === undefined ? {} : { sha: head.sha }),
        detached: head.detached,
      };
    },
    readCheckRuns: async (sha, limit) => {
      if (!admitted)
        return {
          ok: false,
          reason: "credential-unavailable",
          failureCode: "config.credential.missing",
        };
      const facts = repositoryFacts();
      const parsed = parseGitHubRemote(facts.originUrl);
      if (!parsed.ok) return { ok: false, reason: "read-failed" };
      return doctorWiringRead(
        await clientFor({ owner: parsed.owner, name: parsed.name }).readPipelineRun(sha, limit),
      );
    },
    readProviderConfig: resolveProviderConfig,
    resolveProviderCredential: (input): DoctorProviderCredentialPresence => ({
      providerName: input.providerName,
      sourceKey: input.sourceKey,
      ok: options.credentials.resolve(input.reference).ok,
    }),
    readParkFold: (): DoctorParkFoldRead => {
      const read = ledger();
      if (!read.ok) {
        return {
          ok: false,
          reason: "state-unreadable",
          failureCode: read.error.code,
        };
      }
      return {
        ok: true,
        parks: read.value.parks,
        announcements: read.value.announcements,
      };
    },
    readStateStores: (): DoctorStateStoresRead => {
      const read = ledger();
      if (!read.ok) {
        return {
          ok: false,
          reason: doctorStateReason(read.error.code),
          failureCode: read.error.code,
        };
      }
      const base: DoctorStateStoresRead = {
        ok: true,
        verifiedEmpty: read.value.evidence?.verifiedEmpty ?? false,
        recordCount: read.value.evidence?.recordCount ?? 0,
        stores: [
          {
            name: "delivery",
            verdict: read.value.evidence?.verifiedEmpty === true ? "verified-empty" : "valid",
          },
        ],
      };
      const retro = options.readRetroState?.();
      if (retro === undefined) return base;
      if (!retro.ok) return retro;
      return {
        ok: true,
        verifiedEmpty: base.verifiedEmpty && retro.verifiedEmpty,
        // The retro registry shares the delivery ledger (the reviewed PIN-4
        // single-store decision); `base.recordCount` already includes the retro
        // artifacts, so adding `retro.recordCount` would double-count them.
        recordCount: base.recordCount,
        stores: [
          ...(base.stores ?? []),
          ...(retro.stores ?? [
            { name: "retro-registry", verdict: retro.verifiedEmpty ? "verified-empty" : "valid" },
          ]),
        ],
      };
    },
    nowIso: options.clock.nowIso,
    nowMs: options.clock.nowMs,
  };
};

/** The injected I/O for the plan command family (GH-226). */
export type PlanRuntimeOptions = {
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly readDiff?: PlanDiffPort;
};

/** Compose the plan runtime over the file adapter and an injected diff reader. */
export const createPlanCommandRuntime = (options: PlanRuntimeOptions): PlanCommandRuntime => ({
  readPlan: (changeRef) =>
    readPlanArtifact({
      changeRef,
      changesDirectory: options.changesDirectory,
      fs: options.fs,
    }),
  readDiff:
    options.readDiff ?? ((workItemRef) => ({ ok: false, reason: "unreadable", workItemRef })),
  parseYaml: (text) => {
    const parsed = parseConfigYaml(text, "project-committed", "plan.yaml");
    return parsed.ok
      ? { ok: true, value: parsed.facts.values }
      : { ok: false, reason: "unparseable" };
  },
});

/** The watchdog composition seams. */
export type WatchdogComposition = {
  readonly readLane: (lane: string) => WatchdogLaneRead;
  readonly git?: WatchdogGitPort;
  readonly signalSources?: readonly WatchdogSignalSource[];
  /**
   * The adapter-sourced liveness facts read seam (GH-235 F-1). When supplied,
   * the runtime composes the sourced-signal bridge into the delivered probe
   * seam; when omitted, no signal source is declared and liveness stays
   * `watchdog.signals-absent`.
   */
  readonly readSourcedSignals?: (lane: string) => HarnessLivenessFacts | undefined;
};

/**
 * Compose the watchdog runtime: the injected lane reader, the bounded git seam
 * (a production seam by default), and the declared signal sources. A supplied
 * `readSourcedSignals` composes the adapter-sourced bridge, so a sourced lane
 * reaches `progressing`/`stalled` instead of always answering absent.
 */
export const createWatchdogCommandRuntime = (
  composition: WatchdogComposition,
): WatchdogCommandRuntime => ({
  readLane: composition.readLane,
  git: composition.git ?? createWatchdogGitSeam(),
  signalSources:
    composition.signalSources ??
    (composition.readSourcedSignals === undefined
      ? []
      : [createSourcedWatchdogSignalSource(composition.readSourcedSignals)]),
});

/**
 * The board composition seams (GH-229 D4): the real GitHub tracker read, the
 * state store, and injected time/id factories. The v0 mapping assigns every
 * observed owner-attention item to kind `owner-review`; waiver-kind gates become
 * reachable when the waiver-recording surface lands (GAP-9).
 */
export type BoardComposition = {
  readonly store: StateStorePort;
  readonly repository: { readonly cwd: string; readonly io: RepositoryIo };
  readonly github: {
    readonly instance: ExternalSystemInstance;
    readonly credentials: CredentialPort;
    readonly transport: StatusTransport;
  };
  readonly nowIso: () => string;
  readonly nowMs: () => number;
  readonly newFenceToken: () => string;
};

const ownerAttention = (item: WorkItem): boolean =>
  STATUS_OWNER_ATTENTION_LABELS.some((label) =>
    item.labels.some((candidate) => candidate.toLowerCase() === label.toLowerCase()),
  );

const openItem = (item: WorkItem): boolean =>
  item.status.deliveryState !== "done" && item.status.deliveryState !== "canceled";

/** Compose the board runtime over the real tracker read and the state ledger. */
export const createBoardCommandRuntime = (composition: BoardComposition): BoardCommandRuntime => {
  const instance = composition.github.instance;
  const admitted =
    instance.systemKind === "vcs" && instance.authMethod.mechanism === "credential-reference";
  const collectorCode = "status.collector.tracker.unavailable";

  const readTracker = async (): Promise<OwnerGateCollectorRead> => {
    if (!admitted) {
      return {
        ok: false,
        collector: "tracker",
        reason: "credential-unavailable",
        code: collectorCode,
      };
    }
    const facts = readRepositoryFacts({
      cwd: composition.repository.cwd,
      io: composition.repository.io,
    });
    const parsed = parseGitHubRemote(facts.originUrl);
    if (!parsed.ok) {
      return { ok: false, collector: "tracker", reason: "not-configured", code: collectorCode };
    }
    const client = createGitHubClient({
      instance,
      credentials: composition.github.credentials,
      repository: { owner: parsed.owner, name: parsed.name },
      transport: composition.github.transport,
    });
    const result = await client.listWorkItems(STATUS_SOURCE_ITEM_LIMIT);
    if (!result.ok) {
      return { ok: false, collector: "tracker", reason: "failed", code: collectorCode };
    }
    // The GH-229 GAP-9 flip: a recorded authorized waiver for the item's change
    // ref is collected as waiver-kind with its recorded authorizer. A gate
    // without a recorded waiver stays owner-review with `waivedBy: null` (no
    // synthesis); the board payload schema is unchanged.
    const waiverRead = readAllMergeWaivers(composition.store);
    const waiversByGate = waiverRead.ok ? newestWaiverByGate(waiverRead.records) : new Map();
    const waiverFor = (entityId: string) => {
      const numeric =
        /^[A-Za-z]+-([0-9]+)$/.exec(entityId)?.[1] ??
        (/^[0-9]+$/.test(entityId) ? entityId : undefined);
      for (const waiver of waiversByGate.values()) {
        if (waiver.gateId !== "owner-gate") continue;
        const changeNumeric = /^[A-Za-z]+-([0-9]+)$/.exec(waiver.changeRef)?.[1];
        if (changeNumeric !== undefined && changeNumeric === numeric) return waiver;
        if (waiver.changeRef === entityId) return waiver;
      }
      return undefined;
    };
    const gates = result.value.items
      .filter((item) => openItem(item) && ownerAttention(item))
      .map((item) => {
        const waiver = waiverFor(item.identity.entityId);
        return waiver === undefined
          ? {
              id: `${item.identity.entityId}:owner-review`,
              kind: "owner-review",
              ref: item.identity.entityId,
              ...(item.updatedAt === undefined ? {} : { activityAt: item.updatedAt }),
            }
          : {
              id: `${item.identity.entityId}:waiver`,
              kind: "waiver",
              ref: item.identity.entityId,
              waivedBy: waiver.authorizer,
              ...(item.updatedAt === undefined ? {} : { activityAt: item.updatedAt }),
            };
      });
    return {
      ok: true,
      collector: "tracker",
      gates,
      pageItemCount: result.value.pageItemCount,
    };
  };

  return {
    collectors: [{ id: "tracker", read: readTracker }],
    policy: OWNER_GATE_SLA_POLICY,
    readDecisions: () => readOwnerGateSlaDecisions(composition.store),
    appendDecision: (decision) =>
      appendOwnerGateSlaDecision(composition.store, {
        decision,
        fenceToken: composition.newFenceToken(),
      }),
    nowIso: composition.nowIso,
    nowMs: composition.nowMs,
  };
};

/**
 * The blockers composition seams: the state store, injected time/id/fence
 * factories, and the optional capability and delegation snapshots. The
 * caller-audience environment fact is resolved here from the branding-derived
 * variable name and handed to the handler as data.
 */
export type BlockersComposition = {
  readonly store: StateStorePort;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newQuestionSuffix?: () => string;
  readonly newFenceToken: () => string;
  readonly capability?: BlockerCapabilityFact;
  readonly delegationPolicy?: BlockerDelegationPolicy;
};

/** Compose the blockers runtime over the real state ledger. */
export const createBlockersCommandRuntime = (
  composition: BlockersComposition,
  brand: BrandIdentity,
  secrets: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): BlockersCommandRuntime => ({
  brand,
  clock: composition.clock,
  newQuestionSuffix: composition.newQuestionSuffix ?? (() => randomUUID()),
  newFenceToken: composition.newFenceToken,
  readBlockers: () => readBlockerLedger(composition.store),
  appendQuestion: (record, current) =>
    appendBlockerQuestion(composition.store, {
      record,
      fenceToken: composition.newFenceToken(),
      ...(current === undefined ? {} : { current }),
    }),
  appendAnswer: (record, current) =>
    appendBlockerAnswer(composition.store, {
      record,
      fenceToken: composition.newFenceToken(),
      ...(current === undefined ? {} : { current }),
    }),
  callerAudienceFact: environment[callerAudienceVariableName(brand)],
  capability: composition.capability,
  delegationPolicy: composition.delegationPolicy ?? BLOCKER_DELEGATION_POLICY,
  secrets,
});

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
  readonly plan?: PlanRuntimeOptions;
  readonly phase?: PhaseCommandRuntime;
  readonly commit?: CommitRuntimeOptions;
  readonly provider?: ProviderComposition;
  readonly verify?: VerifyCommandRuntime;
  readonly status?: StatusComposition;
  readonly brief?: StatusComposition;
  readonly queueReady?: StatusComposition;
  readonly doctor?: DoctorComposition;
  readonly db?: DbComposition;
  readonly closeout?: CloseoutComposition;
  readonly watchdog?: WatchdogComposition;
  readonly board?: BoardComposition;
  readonly blockers?: BlockersComposition;
  readonly merge?: MergeCommandRuntime;
  readonly retro?: RetroCompositionOptions;
  readonly spend?: SpendCompositionOptions;
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
    const planRuntime =
      options.plan === undefined ? undefined : createPlanCommandRuntime(options.plan);
    commands.lint = createLintCommandDefinition({
      ...options.lint,
      ...(planRuntime === undefined
        ? {}
        : { readPlan: planRuntime.readPlan, parseYaml: planRuntime.parseYaml }),
    });
  }
  if (options.plan !== undefined) {
    commands.plan = createPlanCommandDefinition(createPlanCommandRuntime(options.plan));
  }
  if (options.phase !== undefined) {
    const extension =
      options.commit === undefined ? undefined : createPhaseCommitExtension(options.commit);
    const phaseRuntime =
      extension === undefined ? options.phase : { ...options.phase, commit: extension };
    const committedPhaseRuntime =
      options.commit === undefined
        ? phaseRuntime
        : {
            ...phaseRuntime,
            sessionFacts: () => {
              const facts = options.commit?.sessionFacts;
              return typeof facts === "function"
                ? facts()
                : (facts ?? { insideDeliverySession: false });
            },
          };
    commands.phase = createPhaseCommandDefinition(committedPhaseRuntime);
    if (options.commit !== undefined && extension !== undefined) {
      commands.commit = createCommitCommandDefinition(
        createCommitCommandRuntime(options.commit, {
          runtime: committedPhaseRuntime,
          extension,
        }),
      );
    }
  } else if (options.commit !== undefined) {
    commands.commit = createCommitCommandDefinition(createCommitCommandRuntime(options.commit));
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
        let profileScope:
          | { readonly name: string; readonly providers: readonly string[] }
          | undefined;
        if (input.profile !== undefined) {
          const profileParsed = parseAndValidateProfileConfiguration(
            snapshot.value.config.values,
            parsed.config,
          );
          if (!profileParsed.ok) {
            return {
              ok: false,
              code: profileParsed.error.code,
              summary: profileParsed.error.detail,
            };
          }
          const profile = profileParsed.config.profiles[input.profile];
          if (profile === undefined) {
            return {
              ok: false,
              code: "provider.profile.invalid",
              summary: `profile ${input.profile} is not declared`,
            };
          }
          profileScope = { name: profile.name, providers: profile.providers };
        }
        return engine.resolve({
          config: parsed.config,
          ...(input.chainName === undefined ? {} : { chainName: input.chainName }),
          ...(profileScope === undefined ? {} : { profile: profileScope }),
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
      profileResolve: async (input) => {
        const snapshot = resolve({});
        if (!snapshot.ok) {
          return {
            ok: false,
            code: snapshot.error.code,
            summary: `configuration rejected (${snapshot.error.code})`,
          };
        }
        const providerParsed = parseAndValidateProviderConfiguration(snapshot.value.config.values);
        if (!providerParsed.ok) {
          return {
            ok: false,
            code: providerParsed.error.code,
            summary: providerParsed.error.detail,
          };
        }
        const profileParsed = parseAndValidateProfileConfiguration(
          snapshot.value.config.values,
          providerParsed.config,
        );
        if (!profileParsed.ok) {
          return {
            ok: false,
            code: profileParsed.error.code,
            summary: profileParsed.error.detail,
          };
        }
        const nowMs = provider.clock.nowMs();
        const probe = createProfileProbePort((providerName) => {
          const descriptor = providerParsed.config.entries[providerName];
          if (descriptor === undefined) {
            return {
              available: false,
              condition: "provider-outage",
              blockers: [
                {
                  kind: "condition",
                  value: "provider-outage",
                  detail: `provider ${providerName} is not declared`,
                },
              ],
              source: `provider ${providerName}: undeclared`,
            };
          }
          if (!descriptor.enabled) {
            return {
              available: false,
              condition: "disabled",
              blockers: [
                {
                  kind: "condition",
                  value: "disabled",
                  detail: `provider ${providerName} is disabled`,
                },
              ],
              source: `provider ${providerName}: disabled`,
            };
          }
          if (descriptor.peak !== undefined) {
            const peak = evaluatePeakWindow(descriptor.peak, nowMs);
            if (peak.status === "parked") {
              return {
                available: false,
                condition: "peak-window",
                blockers: [
                  {
                    kind: "condition",
                    value: "peak-window",
                    detail: `provider ${providerName}: peak window active`,
                  },
                ],
                source: `provider ${providerName}: peak window`,
              };
            }
          }
          return {
            available: true,
            condition: "clear",
            blockers: [],
            source: `provider ${providerName}: clear`,
          };
        });
        const selection = selectProfile({
          profiles: profileParsed.config,
          probe,
          nowMs,
          ...(input.agent === undefined ? {} : { agent: input.agent }),
        });
        if (!selection.ok) return selection;
        const baseProfileName = profileParsed.config.preferenceChain?.base;
        const baseProfile =
          baseProfileName === undefined
            ? undefined
            : profileParsed.config.profiles[baseProfileName];
        let lifecycleProvider: string | undefined;
        if (baseProfile !== undefined) {
          for (const providerName of baseProfile.providers) {
            if (!probe.probe(providerName).available) {
              lifecycleProvider = providerName;
              break;
            }
          }
        }
        const persisted = readProfileTarget(provider.stateStore);
        if (!persisted.ok) {
          return {
            ok: false,
            code: persisted.error.code,
            summary: `profile target read failed (${persisted.error.code})`,
          };
        }
        const lifecycle = evaluateProfileLifecycle({
          profiles: profileParsed.config,
          selection,
          ...(persisted.value === undefined ? {} : { persisted: persisted.value }),
          nowMs,
          ...(lifecycleProvider === undefined ? {} : { providerName: lifecycleProvider }),
        });
        if (lifecycle.append && lifecycle.target !== undefined) {
          const written = persistProfileTarget({
            store: provider.stateStore,
            fenceToken: provider.newFenceToken(),
            record: lifecycle.target,
          });
          if (!written.ok) {
            return {
              ok: false,
              code: written.error.code,
              summary: `profile target write failed (${written.error.code})`,
            };
          }
        }
        if (!lifecycle.selection.ok) return lifecycle.selection;
        if (input.forSpawn === true) {
          const outcome = resolveProfileForSpawn({
            profiles: profileParsed.config,
            probe,
            nowMs,
            namePrefix: input.namePrefix ?? "",
            ...(input.agent === undefined ? {} : { agent: input.agent }),
            ...(profileParsed.config.envRecord === undefined
              ? {}
              : { policy: profileParsed.config.envRecord }),
            selection: lifecycle.selection,
          });
          if (!outcome.ok) {
            return {
              ok: false,
              code: outcome.code,
              summary: outcome.summary,
              eligibility: outcome.eligibility,
              events: outcome.events,
            };
          }
          return outcome.selection;
        }
        return lifecycle.selection;
      },
      watchStatus: async (input) => {
        const snapshot = resolve({});
        if (!snapshot.ok) {
          return {
            ok: false,
            code: snapshot.error.code,
            summary: `configuration rejected (${snapshot.error.code})`,
          };
        }
        const providerParsed = parseAndValidateProviderConfiguration(snapshot.value.config.values);
        if (!providerParsed.ok) {
          return {
            ok: false,
            code: providerParsed.error.code,
            summary: providerParsed.error.detail,
          };
        }
        const profileParsed = parseAndValidateProfileConfiguration(
          snapshot.value.config.values,
          providerParsed.config,
        );
        if (!profileParsed.ok) {
          return {
            ok: false,
            code: profileParsed.error.code,
            summary: profileParsed.error.detail,
          };
        }
        const reader = createProviderWatchStatus({
          clock: provider.clock,
          credentialPort: provider.credentialPort,
          transport: provider.transport,
          mappings: createProviderWatchMappings(),
        });
        return reader.status({
          targets: profileParsed.config.watch ?? {},
          credentials: providerParsed.config.credentials,
          ...(input.providerName === undefined ? {} : { providerName: input.providerName }),
        });
      },
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
  if (options.brief !== undefined) {
    commands.brief = createBriefCommandDefinition(
      createStatusCommandRuntime(options.brief, resolveProviderConfig),
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
  if (options.doctor !== undefined) {
    commands.doctor = createDoctorCommandDefinition(
      createDoctorCommandRuntime(options.doctor, resolveProviderConfig),
      brand.environmentPrefix,
    );
  }
  if (options.db !== undefined) {
    commands.db = createDbCommandDefinition(createDbCommandRuntime(options.db));
  }
  if (options.closeout !== undefined) {
    commands.closeout = createCloseoutCommandDefinition(
      createCloseoutCommandRuntime(options.closeout),
    );
  }
  if (options.watchdog !== undefined) {
    commands.watchdog = createWatchdogCommandDefinition(
      createWatchdogCommandRuntime(options.watchdog),
    );
  }
  if (options.board !== undefined) {
    commands.board = createBoardCommandDefinition(createBoardCommandRuntime(options.board));
  }
  if (options.blockers !== undefined) {
    commands.blockers = createBlockersCommandDefinition(
      createBlockersCommandRuntime(options.blockers, brand, secrets, options.environment),
    );
  }
  if (options.merge !== undefined) {
    commands.merge = createMergeCommandDefinition(options.merge);
  }
  if (options.retro !== undefined) {
    commands.retro = createRetroCommandDefinition(createRetroCommandRuntime(options.retro));
  }
  if (options.spend !== undefined) {
    commands.spend = createSpendCommandDefinition(createSpendCommandRuntime(options.spend));
  }
  return {
    ok: true,
    brand,
    program: { commands },
    secrets,
  };
};

/**
 * The retro composition seams (GH-232 F-1/F-5/F-8): the delivery state store,
 * the sidecar runtime edge, the GET-only collector readers, the clock, and the
 * injected id factories. The export engine surface is deliberately NOT composed
 * into any command or flag (NG-1 amendment).
 */
export type RetroCompositionOptions = {
  readonly store: StateStorePort;
  readonly stateDirectory: string;
  readonly workspaceId: string;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newRunId: () => string;
  readonly newTraceId: () => string;
  readonly newFenceToken: () => string;
  readonly identity?: import("@delivery-os/core/contracts").RetroClaimedIdentity;
  readonly context?: "collector" | "delivery-agent";
  readonly collectors?: import("@delivery-os/core/contracts").RetroCollectorRead;
  readonly readChanges?: () => readonly import("@delivery-os/core/contracts").RetroChangeFacts[];
  readonly verifyArtifact?: (artifactRef: string) => boolean;
  /** The single redaction transform applied before evidence lands. */
  readonly redact?: (text: string) => string;
};

const retroChangeFactsFrom = (
  store: StateStorePort,
): readonly import("@delivery-os/core/contracts").RetroChangeFacts[] => {
  const records = store.readRecords();
  if (!records.ok) return [];
  const latest = new Map<string, import("@delivery-os/core/contracts").PhaseTransitionRecord[]>();
  for (const record of records.value.records) {
    if (record.kind !== "phase.transition") continue;
    const payload = record.payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) continue;
    const source = payload as Record<string, unknown>;
    const changeRef = source.changeRef;
    const transitions = source.transitions;
    if (typeof changeRef !== "string" || !Array.isArray(transitions)) continue;
    const parsed: import("@delivery-os/core/contracts").PhaseTransitionRecord[] = [];
    for (const entry of transitions) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.changeRef !== "string" ||
        typeof candidate.phaseId !== "string" ||
        (candidate.operation !== "complete" && candidate.operation !== "reopen") ||
        typeof candidate.timestamp !== "string" ||
        candidate.outcome !== "landed"
      ) {
        continue;
      }
      parsed.push({
        changeRef: candidate.changeRef,
        phaseId: candidate.phaseId,
        operation: candidate.operation,
        timestamp: candidate.timestamp,
        outcome: "landed",
      });
    }
    latest.set(changeRef, parsed);
  }
  const changes: import("@delivery-os/core/contracts").RetroChangeFacts[] = [];
  for (const [changeRef, transitions] of latest) {
    const last = transitions[transitions.length - 1];
    const completed =
      last !== undefined && last.phaseId === "pr_creation" && last.operation === "complete";
    changes.push({
      changeRef,
      ...(completed ? { completedAt: last.timestamp } : {}),
      transitions,
    });
  }
  return changes;
};

const retroNotesFrom = (
  options: RetroCompositionOptions,
  changeRef: string,
): import("@delivery-os/core/contracts").RetroNotesReadResult => {
  const read = readPmNotesText({
    changeRef,
    changesDirectory: options.changesDirectory,
    fs: options.fs,
  });
  if (!read.ok) return { ok: true, value: { retroNotes: [] } };
  const document = read.value;
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return { ok: true, value: { retroNotes: [] } };
  }
  const notes = (document as Record<string, unknown>).notes;
  if (!Array.isArray(notes)) return { ok: true, value: { retroNotes: [] } };
  const retroNotes: string[] = [];
  for (const entry of notes) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    if (candidate.type !== "retro" || typeof candidate.text !== "string") continue;
    retroNotes.push(candidate.text);
  }
  return { ok: true, value: { retroNotes } };
};

const retroStateFamiliesFrom = (
  store: StateStorePort,
  changeRef: string,
): import("@delivery-os/core/contracts").RetroStateFamiliesRead => {
  const transitions = readChangeTransitionsTolerant(store, changeRef);
  if (!transitions.ok) return { ok: false, error: transitions.error };
  const closeouts = readCloseoutHistory(store, changeRef);
  if (!closeouts.ok) return { ok: false, error: closeouts.error };
  const telemetry = readCommitTelemetry(store, changeRef);
  if (!telemetry.ok) return { ok: false, error: telemetry.error };
  return {
    ok: true,
    value: {
      transitions: transitions.value.transitions,
      closeouts: closeouts.value.map((record) => ({
        operationId: record.operationId,
        outcome: record.outcome,
        timestamp: record.timestamp,
      })),
      telemetry: telemetry.value.records.map((record) => ({
        ...(record.phaseId === undefined ? {} : { phaseId: record.phaseId }),
        commitSha: record.commitSha,
        landedAt: record.landedAt,
      })),
    },
  };
};

/** Compose the retro command runtime from injected seams. */
export const createRetroCommandRuntime = (
  options: RetroCompositionOptions,
): import("@delivery-os/core/contracts").RetroCommandRuntime => {
  const sidecar = createRetroSidecar(
    createNodeRetroSidecarIo({
      stateDirectory: options.stateDirectory,
      workspaceId: options.workspaceId,
    }),
  );
  const collectors: import("@delivery-os/core/contracts").RetroCollectorRead =
    options.collectors ?? {
      readAuditLedger: (query) => readAuditLedger(options.store, query),
      readStateFamilies: (changeRef) => retroStateFamiliesFrom(options.store, changeRef),
      readNotes: (changeRef) => retroNotesFrom(options, changeRef),
    };
  return {
    collect: (input) =>
      collectRetro({
        sidecar,
        registry: {
          read: () => readRetroRegistry(options.store),
          runs: (read) => readRetroRuns(read),
          recordRun: (run, token) => recordRetroRun(options.store, run, token),
          seed: (token) => seedRetroRegistry(options.store, token),
        },
        collectors,
        readChanges: options.readChanges ?? (() => retroChangeFactsFrom(options.store)),
        clock: { nowMs: options.clock.nowMs },
        newTraceId: options.newTraceId,
        newRunId: options.newRunId,
        newFenceToken: options.newFenceToken,
        level: input.level,
        ...(input.changeRef === undefined ? {} : { target: input.changeRef }),
        ...(options.identity === undefined ? {} : { identity: options.identity }),
        ...(options.context === undefined ? {} : { context: options.context }),
        ...(options.redact === undefined ? {} : { redact: options.redact }),
      }),
    report: (input) =>
      reportRetro({
        sidecar,
        registry: {
          read: () => readRetroRegistry(options.store),
          runs: (read) => readRetroRuns(read),
          recordRun: (run, token) => recordRetroRun(options.store, run, token),
          seed: (token) => seedRetroRegistry(options.store, token),
        },
        level: input.level,
        ...(options.verifyArtifact === undefined ? {} : { verifyArtifact: options.verifyArtifact }),
      }),
  };
};

/** Read the retro registry store verdict for the doctor `state check` (TC-056). */
export const readRetroRegistryState = (store: StateStorePort): DoctorStateStoresRead => {
  const read = readRetroRegistry(store);
  if (!read.ok) {
    return {
      ok: false,
      reason: doctorStateReason(read.error.code),
      failureCode: read.error.code,
    };
  }
  if (read.value.malformed.length > 0) {
    return {
      ok: false,
      reason: "store-unknown",
      failureCode: "state.store.unknown",
    };
  }
  return {
    ok: true,
    verifiedEmpty: read.value.verdict === "verified-empty",
    recordCount: read.value.artifacts.length,
    stores: [{ name: "retro-registry", verdict: read.value.verdict }],
  };
};

/**
 * The spend composition seams (GH-236 F-6): the delivery state store and the
 * local PM context. The command is read-only: no fence, no append, no spawn,
 * no credential resolution is composed here.
 */
export type SpendCompositionOptions = {
  readonly store: StateStorePort;
  readonly localContext: { readonly path: string; readonly fs: FileSystemFacts };
};

/** Compose the spend command runtime from the injected read-only seams. */
export const createSpendCommandRuntime = (
  options: SpendCompositionOptions,
): SpendCommandRuntime => ({
  resolveActiveRef: () => {
    const context = readLocalPmContext({
      path: options.localContext.path,
      fs: options.localContext.fs,
    });
    const ref = context.ok ? context.context.activeChange?.workItemRef : undefined;
    return ref === undefined ? { ref: null } : { ref };
  },
  report: (selection) => {
    const read = readSpendLedger(options.store, selection.workItemRef);
    if (!read.ok) {
      return {
        ok: false,
        error: {
          kind: "state",
          code: read.error.code,
          consequence: read.error.consequence,
          location: read.error.location,
        },
      };
    }
    const folded = computeSpendReport(read.value, selection);
    if (!folded.ok) {
      return { ok: false, error: { kind: "spend", code: folded.absence.code } };
    }
    return folded.warnings.length === 0
      ? { ok: true, data: folded.data }
      : { ok: true, data: folded.data, warnings: folded.warnings };
  },
});
