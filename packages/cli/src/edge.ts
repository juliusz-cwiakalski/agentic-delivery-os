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
  applyPromotionWrite,
  checkPromotionConfinement,
  createCapsuleFileRuntime,
  createCommitlintProbe,
  createSecretScanner,
  type FileSystemFacts,
  neutralEnvironmentFacts,
  nodeCapsuleFileSystemFacts,
  nodeFileSystemFacts,
  type PmNotesFileSystemFacts,
  parseConfigYaml,
  type RuntimePlatform,
  readCiWorkflowJobNames,
  readDispatchAuthority,
  readLocalPmContext,
  readMemoryFacts,
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
import {
  createBunSqliteStoreOpener,
  createClaudeTelemetryExtractor,
  createNodeFileReader,
  createOpencodeTelemetryExtractor,
} from "@delivery-os/adapters/harness";
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
  createSessionAdmin,
  createSessionStore,
  type OpencodeSessionIo,
} from "@delivery-os/adapters/session";
import type { ConfigCatalog, DefaultPositionManifest } from "@delivery-os/core";
import {
  addQueueDependency,
  admitDispatchRestart,
  appendCommandReceipt,
  appendOutboxEffect,
  beginCommitEffect,
  buildCloseoutPlan,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  type CloseoutTelemetryRuntime,
  type CommitActOutcome,
  type CommitActRequest,
  type CommitTransportPorts,
  callerAudienceVariableName,
  capsuleGateEventKey,
  capsulePhaseEventKey,
  catalogPaths,
  claimQueueLease,
  classifyPruneCandidate,
  collectRetro,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  computeQueueSchedule,
  computeSpendReport,
  computeStagingPlan,
  createSourcedWatchdogSignalSource,
  type DispatchAdmission,
  type DispatchLeaseClaim,
  type DispatchPorts,
  type DispatchRepositoryScope,
  type DispatchTruthReads,
  declareQueueEntry,
  defaultParkRecheckMs,
  deriveCapsuleEventKey,
  evaluateClaimPreconditions,
  evaluateDiffSweep,
  evaluateDispatchResumeEconomics,
  evaluateWorktreeSafety,
  foldLanes,
  type HarnessSettings,
  handoverDispatchEvidence,
  isHeldByWeight,
  isLiveDbSession,
  type MergeTransactionPorts,
  newestWaiverByGate,
  normalizeStagedPaths,
  PRODUCTION_CATALOG,
  parkConditionForCause,
  parseCapsuleEvents,
  payloadFieldViolations,
  planDispatchResume,
  prioritizeQueueEntry,
  type QueueCiFact,
  type QueueCloseFact,
  type QueueDeployExpectation,
  type QueueDeployFacts,
  type QueueGraphFold,
  type QueueIntentFailure,
  type QueueIntentOutcome,
  type QueueIntentResult,
  type QueueLaneEconomics,
  type QueueLeaseFailure,
  type QueuePlanFact,
  type QueueProviderFact,
  type QueueSchedulerFacts,
  type QueueWorkItemFact,
  readActiveLeases,
  readCommandReceipts,
  readDaemonLanes,
  readOutboxEffects,
  readQueueFold,
  readQueueParkPass,
  recoverQueueParks,
  releaseQueueLease,
  reportRetro,
  resolveCloseoutBaseRef,
  resolveConfig,
  resolveDispatchDivergenceEvidence,
  resolveMergeGateSet,
  resolveQueueSettings,
  resolveQueueWeight,
  resolveStateDirectoryScope,
  revertDispatchHandoverEvidence,
  runCloseout,
  runCommitAct,
  runDispatch,
  selectPruneCandidates,
  serializeCapsuleEvent,
  sha256Hex,
  spendDigestSection,
  summarizeDispatchEvidence,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
  type WatchRead,
  watchLines,
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
  type CapsuleFileRuntime,
  type CapsuleFileSystemFacts,
  type CapsuleProducerPort,
  CLOSEOUT_MAX_DEPENDENTS,
  type CloseoutDiffRead,
  type CloseoutExpectedCapsuleEvent,
  type CloseoutGitRuntime,
  type CloseoutPromotionRuntime,
  type CloseoutProviderRuntime,
  type CloseoutReadObservation,
  type CloseoutRetroFacts,
  type CloseoutReverseDependentObservation,
  type CloseoutSessionFacts,
  type CloseoutStateRuntime,
  type CloseoutWorktreeFacts,
  type CloseoutWriteOutcome,
  COMMAND_RECEIPT_PAYLOAD_SCHEMA,
  type CommitGitPort,
  type CommitlintPort,
  type CommitPlanPhaseContext,
  type CommitSafetyPort,
  type CommitSessionFacts,
  type CommitTelemetryRecord,
  type CommitTransportAvailability,
  type ConfigFailure,
  type ControlTransport,
  type CredentialPort,
  type DaemonClockPort,
  type DeliveryRequest,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type DispatchPhaseLedger,
  type DispatchResumeMode,
  type DoctorCheckoutFacts,
  type DoctorCommitResolution,
  type DoctorCredentialPresence,
  type DoctorParkFoldRead,
  type DoctorProviderCredentialPresence,
  type DoctorStateStoresRead,
  type DoctorWiringRead,
  type ExternalSystemInstance,
  HARNESS_KINDS,
  HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessKind,
  type HarnessLivenessFacts,
  type HarnessSessionHandle,
  type HarnessSessionPort,
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
  type QueueDegradationReason,
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
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
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
import { createDaemonCommandDefinition, type DaemonCommandRuntime } from "./commands/daemon.js";
import { createDbCommandDefinition, type DbCommandRuntime } from "./commands/db.js";
import {
  createDispatchCommandDefinition,
  type DispatchCommandRuntime,
} from "./commands/dispatch.js";
import { createDoctorCommandDefinition, type DoctorCommandRuntime } from "./commands/doctor.js";
import { createLanesCommandDefinition } from "./commands/lanes.js";
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
import {
  createQueueCommandDefinition,
  createQueueReadyCommandDefinition,
  type QueueCommandRuntime,
  type QueueReadyCommandRuntime,
  type QueueRuntimeFailure,
  type QueueRuntimeMutation,
  type QueueRuntimeSchedule,
  toQueueReadData,
} from "./commands/queue.js";
import { createRetroCommandDefinition } from "./commands/retro.js";
import { createSpendCommandDefinition, type SpendCommandRuntime } from "./commands/spend.js";
import { createStatusCommandDefinition, type StatusCommandRuntime } from "./commands/status.js";
import { createVerifyCommandDefinition, type VerifyCommandRuntime } from "./commands/verify.js";

export type { DispatchCommandRuntime } from "./commands/dispatch.js";

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

/**
 * Compose the production capsule producer port (GH-240 F-2).
 *
 * Every read/write goes through the append-only file runtime; the port keeps
 * the per-command surface non-gating and disclosure-only.
 */
export const createCapsuleProducerPort = (options: {
  readonly changesDirectory: string;
  readonly fs?: CapsuleFileSystemFacts;
  readonly nowIso: () => string;
  readonly runId?: () => string;
}): CapsuleProducerPort => {
  const runtime = createCapsuleFileRuntime({
    changesDirectory: options.changesDirectory,
    fs: options.fs ?? nodeCapsuleFileSystemFacts(),
    nowIso: options.nowIso,
    rules: {
      parse: parseCapsuleEvents,
      serialize: serializeCapsuleEvent,
      payloadFieldViolations,
      deriveEventKey: deriveCapsuleEventKey,
    },
  });
  return {
    append: (request) =>
      runtime.append({
        changeRef: request.changeRef,
        workspaceChangesDirectory: options.changesDirectory,
        writer: request.writer,
        kind: request.kind,
        eventKey: request.eventKey,
        payload: request.payload,
        runId: request.runId ?? options.runId?.() ?? "capsule-run",
        ...(request.occurredAt === undefined ? {} : { occurredAt: request.occurredAt }),
      }),
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
  /** The repository-relative change folder for a ref (staging scope input). */
  readonly readChangeFolder?: (changeRef: string) => string | undefined;
  /** The non-gating capsule producer port (GH-240 F-2). */
  readonly capsule?: CapsuleProducerPort;
  /**
   * Additive redrive evidence source (TDR-0014 INV-8): the durable DM-18 receipt
   * for the change ref and phase, supplying the proven discovered SHA.
   */
  readonly readRedriveEvidence?: (
    changeRef: string,
    phaseId: string,
  ) => Promise<{ readonly commitSha: string; readonly source: "redrive" } | undefined>;
};

export const createPhaseCommandRuntime = (options: PhaseRuntimeOptions): PhaseCommandRuntime => ({
  readPmNotes: (changeRef) =>
    readPmNotesText({
      changeRef,
      changesDirectory: options.changesDirectory,
      fs: options.fs,
    }),
  ...(options.readChangeFolder === undefined ? {} : { readChangeFolder: options.readChangeFolder }),
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
  ...(options.capsule === undefined ? {} : { capsule: options.capsule }),
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
  /** The repository-relative change folder for a ref (staging scope input). */
  readonly readChangeFolder?: (changeRef: string) => string | undefined;
  readonly resolveRef?: () => Promise<
    { readonly ref: string; readonly refSource: "branch" | "change-folder" } | undefined
  >;
  /** The non-gating capsule producer port (GH-240 F-2). */
  readonly capsule?: CapsuleProducerPort;
  /**
   * Additive redrive evidence source (TDR-0014 INV-8): the durable DM-18 receipt
   * for the change ref and phase, supplying the proven discovered SHA.
   */
  readonly readRedriveEvidence?: (
    changeRef: string,
    phaseId: string,
  ) => Promise<{ readonly commitSha: string; readonly source: "redrive" } | undefined>;
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

/**
 * The TDR-0014 owner-side commit-effect wrapper (INV-1..INV-4).
 *
 * Reads HEAD once for the intent and the act's reset baseline, computes the
 * sorted normalized staged path set with the same pure staging computation the
 * act uses over the same scope, and appends the `outbox.effect` intent before
 * the delivered commit primitive runs. A HEAD read failure starts no effect.
 * The act's message composition, format, and landing order are untouched.
 */
const createCommitActRunner = (
  options: CommitRuntimeOptions,
  contextOf: (request: CommitActRequest) => { readonly changeRef: string; readonly phase: string },
): ((request: CommitActRequest) => Promise<CommitActOutcome>) => {
  const ports = commitActPorts(options);
  return async (request) => {
    if (request.dryRun) return runCommitAct(request, ports);
    const context = contextOf(request);
    const head = await options.git.head();
    if (head === undefined) {
      return { kind: "failure", code: "commit.atomic-abort", detail: "baseline HEAD unreadable" };
    }
    const tree = await options.git.readTree();
    const staging = computeStagingPlan({
      files: tree.files,
      scopePaths: request.scope.paths,
      scopeSource: request.scope.source,
    });
    const stagedPaths = normalizeStagedPaths(staging.include.map((entry) => entry.path));
    let effectId: string | undefined;
    if (stagedPaths.length > 0) {
      effectId = `commit:${context.changeRef}:${context.phase}:${head}`;
      const intent = beginCommitEffect({
        store: options.store,
        fenceToken: options.newFenceToken(),
        effectId,
        intentId: effectId,
        ref: request.skeleton.ref,
        changeRef: context.changeRef,
        phase: context.phase,
        baselineHead: head,
        stagedPaths,
        payloadDigest: sha256Hex(JSON.stringify({ effectId, baselineHead: head, stagedPaths })),
        nowIso: options.nowIso(),
      });
      if (!intent.ok) {
        return { kind: "failure", code: "commit.atomic-abort", detail: intent.code };
      }
      // Appendix I: the effect is `in-flight` while the primitive runs. A kill in
      // the commit window therefore leaves the daemon something to detect.
      const dispatched = appendOutboxEffect(options.store, options.newFenceToken(), {
        ...intent.record,
        state: "in-flight",
        attempts: Math.max(1, intent.record.attempts),
        recordedAt: options.nowIso(),
      });
      if (!dispatched.ok) {
        return { kind: "failure", code: "commit.atomic-abort", detail: dispatched.code };
      }
    }
    const outcome = await runCommitAct({ ...request, baselineHead: head }, ports);
    if (
      effectId !== undefined &&
      (outcome.kind === "landed" ||
        outcome.kind === "failure" ||
        outcome.kind === "no-pending-work")
    ) {
      // The act returned (no kill): close the effect with a per-attempt receipt
      // and its terminal state. A failed closure leaves it `in-flight`, which is
      // safe: detection resolves it from the bounded log read.
      const applied = outcome.kind === "landed" && outcome.commitSha !== undefined;
      const appliedSha = applied ? outcome.commitSha : undefined;
      appendCommandReceipt(options.store, options.newFenceToken(), {
        schema: COMMAND_RECEIPT_PAYLOAD_SCHEMA,
        effectId,
        attempt: 1,
        queryVerdict: applied ? "found" : "not-found",
        status: applied ? "applied" : "failed",
        evidence: [{ key: "check", value: "query-by-log-since" }],
        ...(appliedSha === undefined ? {} : { discoveredSha: appliedSha }),
        baselineHead: head,
        recordedAt: options.nowIso(),
      });
      const effects = readOutboxEffects(options.store);
      const prior = effects.ok ? effects.latest.get(effectId) : undefined;
      if (prior !== undefined) {
        appendOutboxEffect(options.store, options.newFenceToken(), {
          ...prior,
          state: applied ? "applied" : "failed",
          attempts: 1,
          recordedAt: options.nowIso(),
        });
      }
    }
    return outcome;
  };
};

/**
 * The durable DM-18 redrive receipt reader (TDR-0014 INV-7/INV-8).
 *
 * Only an attempt-0 redrive receipt whose effect belongs to the change ref and
 * phase and whose recorded baseline equals the effect's baseline yields a SHA.
 * Absent, foreign, or unknown evidence never fabricates one.
 */
export const createRedriveEvidenceReader = (
  store: StateStorePort,
): ((
  changeRef: string,
  phaseId: string,
) => Promise<{ readonly commitSha: string; readonly source: "redrive" } | undefined>) => {
  return async (changeRef, phaseId) => {
    const effects = readOutboxEffects(store);
    if (!effects.ok) return undefined;
    const receipts = readCommandReceipts(store);
    if (!receipts.ok) return undefined;
    const receiptByEffect = new Map<string, (typeof receipts.records)[number]>();
    for (const receipt of receipts.records) receiptByEffect.set(receipt.effectId, receipt);
    for (const effect of [...effects.records].reverse()) {
      if (effect.effectKind !== "commit") continue;
      if (effect.changeRef !== changeRef || effect.phase !== phaseId) continue;
      if (effect.baselineHead === undefined) continue;
      const receipt = receiptByEffect.get(effect.effectId);
      if (receipt === undefined) continue;
      if (receipt.attempt !== 0) continue;
      if (receipt.queryVerdict !== "found" || receipt.status !== "unknown") continue;
      if (receipt.discoveredSha === undefined) continue;
      if (receipt.baselineHead !== effect.baselineHead) continue;
      const redrive = receipt.evidence.some(
        (entry) => entry.key === "redrive" && entry.value === "DM-18",
      );
      if (!redrive) continue;
      return { commitSha: receipt.discoveredSha, source: "redrive" };
    }
    return undefined;
  };
};

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
    if (!commitPresent && options.readRedriveEvidence !== undefined) {
      const redrive = await options.readRedriveEvidence(changeRef, phaseId);
      if (redrive !== undefined) {
        return {
          recordPresent: record !== undefined,
          ...(record?.commitIntent === undefined ? {} : { recordIntent: record.commitIntent }),
          ...(record?.commitIntentBasis === undefined
            ? {}
            : { recordBasis: record.commitIntentBasis }),
          ...(record?.timestamp === undefined ? {} : { transitionId: record.timestamp }),
          commitPresent: true,
          commitSha: redrive.commitSha,
          evidenceSource: "redrive",
        };
      }
    }
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
  runAct: createCommitActRunner(options, (request) => ({
    changeRef: request.skeleton.ref,
    phase: request.skeleton.phaseId ?? "delivery",
  })),
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
  readonly phaseCommit: boolean;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly readChangeFolder?: (changeRef: string) => string | undefined;
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
  sessionFacts: { insideDeliverySession: false },
  phaseCommit: options.phaseCommit,
  nowIso: options.nowIso,
  newFenceToken: options.newFenceToken,
  readRedriveEvidence: createRedriveEvidenceReader(options.store),
  ...(options.readChangeFolder === undefined ? {} : { readChangeFolder: options.readChangeFolder }),
});

/** Compose the standalone `commit` surface (GH-227 F-1..F-5). */
export const createCommitCommandRuntime = (
  options: CommitRuntimeOptions,
  phase?: { readonly runtime: PhaseCommandRuntime; readonly extension: PhaseCommitExtension },
): CommitCommandRuntime => ({
  sessionFacts: () =>
    typeof options.sessionFacts === "function" ? options.sessionFacts() : options.sessionFacts,
  ...(options.readChangeFolder === undefined ? {} : { readChangeFolder: options.readChangeFolder }),
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
  runAct: createCommitActRunner(options, (request) => ({
    changeRef: request.skeleton.ref,
    phase: request.skeleton.phaseId ?? "standalone",
  })),
  currentHead: () => options.git.head(),
  ...(phase === undefined ? {} : { phase }),
  ...(options.capsule === undefined ? {} : { capsule: options.capsule }),
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
  /** The non-gating capsule producer port (GH-240 F-2). */
  readonly capsule?: CapsuleProducerPort;
  /**
   * Additive redrive evidence source (TDR-0014 INV-8): the durable DM-18 receipt
   * for the change ref and phase, supplying the proven discovered SHA.
   */
  readonly readRedriveEvidence?: (
    changeRef: string,
    phaseId: string,
  ) => Promise<{ readonly commitSha: string; readonly source: "redrive" } | undefined>;
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
    ...(options.capsule === undefined ? {} : { capsule: options.capsule }),
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

const stateDirectoryFor = (options: EdgeOptions): string | undefined => {
  if (options.stateDirectory !== undefined) return options.stateDirectory;
  const environment = options.environment ?? {};
  const scope = resolveStateDirectoryScope({
    environment,
    environmentPrefix: options.brand.environmentPrefix,
    stateDirectoryName: options.brand.stateDirectoryName,
    ...(options.homeDirectory === undefined ? {} : { homeDirectory: options.homeDirectory }),
  });
  return scope.ok ? scope.value : undefined;
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
  /** The append-only capsule runtime (GH-240 F-3); absent leaves the step a gap. */
  readonly capsule?: CapsuleFileRuntime;
  /** The expected capsule events derived from durable state (GH-240 F-3). */
  readonly capsuleExpected?: (workItemRef: string) => readonly CloseoutExpectedCapsuleEvent[];
  /** The promotion runtime for one work item (GH-240 F-4). */
  readonly promotion?: (workItemRef: string) => CloseoutPromotionRuntime;
  /** The one bounded merged-diff read (GH-240 F-5). */
  readonly diffRead?: CloseoutDiffRead;
  /** The retro-coverage facts (GH-240 F-8). */
  readonly retro?: CloseoutRetroFacts;
  /** The session-attribution facts (GH-240 F-9). */
  readonly sessions?: CloseoutSessionFacts;
  /** Per-work-item session attribution from the harness store (F-9). */
  readonly sessionsFor?: (workItemRef: string) => CloseoutSessionFacts | undefined;
  /** Per-work-item retro coverage read from the registry (F-8). */
  readonly retroFor?: (workItemRef: string) => CloseoutRetroFacts | undefined;
  /** Per-work-item merged-diff read (F-5). */
  readonly diffReadFor?: (workItemRef: string) => CloseoutDiffRead | undefined;
  /** The non-gating harness telemetry capture capability (GH-240 F-10). */
  readonly telemetry?: CloseoutTelemetryRuntime;
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
  /** A raw provider source, or an already-built runtime for composition tests. */
  readonly provider?: CloseoutProviderSource;
  readonly providerRuntime?: CloseoutProviderRuntime;
  /** An already-built seam, or the construction options for the real seam. */
  readonly git: GitBranchSeam | GitBranchSeamOptions;
  readonly store: StateStorePort;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly dependentsLimit?: number;
  readonly mergedRequestLimit?: number;
  readonly entityIdFor?: (workItemRef: string, kind: CloseoutProviderSource["kind"]) => string;
  /** The append-only capsule runtime (GH-240 F-3). */
  readonly capsule?: CapsuleFileRuntime;
  /** The injected memory root for promotion home writes (GH-240 F-4). */
  readonly memoryRoot?: string;
  /** The retro-coverage facts (GH-240 F-8). */
  readonly retro?: CloseoutRetroFacts;
  /** The session-attribution facts (GH-240 F-9). */
  readonly sessions?: CloseoutSessionFacts;
  /** Per-work-item session attribution from the harness store (F-9). */
  readonly sessionsFor?: (workItemRef: string) => CloseoutSessionFacts | undefined;
  /** Per-work-item retro coverage read from the registry (F-8). */
  readonly retroFor?: (workItemRef: string) => CloseoutRetroFacts | undefined;
  /** Per-work-item merged-diff read (F-5). */
  readonly diffReadFor?: (workItemRef: string) => CloseoutDiffRead | undefined;
  /** The non-gating harness telemetry capture capability (GH-240 F-10). */
  readonly telemetry?: CloseoutTelemetryRuntime;
  /** The resolved harness configuration used to construct the capture capability. */
  readonly harness?: HarnessSettings;
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
/** Derive the capsule events the durable state records require (F-3, D-11). */
const capsuleExpectedEvents = (
  store: StateStorePort,
  workItemRef: string,
): readonly CloseoutExpectedCapsuleEvent[] => {
  const records = store.readRecords();
  if (!records.ok) return [];
  const expected: CloseoutExpectedCapsuleEvent[] = [];
  for (const record of records.value.records) {
    const payload = record.payload as unknown as Record<string, unknown>;
    if (payload.changeRef !== workItemRef) continue;
    if (record.kind === "phase.transition") {
      const phaseId = typeof payload.phaseId === "string" ? payload.phaseId : undefined;
      const operation = typeof payload.operation === "string" ? payload.operation : undefined;
      if (phaseId === undefined || operation === undefined) continue;
      const commitSha = typeof payload.commitSha === "string" ? payload.commitSha : undefined;
      expected.push({
        kind: "phase.transition",
        eventKey: capsulePhaseEventKey({
          changeRef: workItemRef,
          phaseId,
          operation,
          ...(commitSha === undefined ? {} : { commitSha }),
          ...(typeof payload.timestamp === "string" ? { transitionId: payload.timestamp } : {}),
        }),
        identity: `${phaseId}:${operation}`,
      });
      continue;
    }
    if (record.kind === "commit.telemetry" && typeof payload.commitSha === "string") {
      expected.push({
        kind: "commit.landed",
        eventKey: payload.commitSha,
        identity: payload.commitSha,
      });
      continue;
    }
    if (record.kind === "merge.gate-verification" && typeof payload.headSha === "string") {
      const gateSet = payload.gateSet as { schemaVersion?: unknown; ids?: unknown } | undefined;
      const schemaVersion =
        typeof gateSet?.schemaVersion === "string"
          ? gateSet.schemaVersion
          : "delivery.merge.gates.v1";
      const ids = Array.isArray(gateSet?.ids)
        ? gateSet.ids.filter((id): id is string => typeof id === "string")
        : [];
      const identity = `${schemaVersion}:${ids.join(",")}`;
      expected.push({
        kind: "gate.outcome",
        eventKey: capsuleGateEventKey(identity, payload.headSha),
        identity: payload.headSha,
      });
    }
  }
  return expected;
};

/** The read-only capsule pre-flight facts for the plan (GH-240 F-3). */
const capsuleFactsOf = (
  runtime: CapsuleFileRuntime,
  workItemRef: string,
): NonNullable<CloseoutPlanFacts["capsule"]> => {
  const read = runtime.read(workItemRef);
  const candidates = runtime.readCandidates(workItemRef);
  if (!read.ok) {
    return {
      present: true,
      valid: false,
      refusal: {
        code: read.code,
        detail: read.detail,
        ...(read.line === undefined ? {} : { line: read.line }),
      },
      events: 0,
      candidates: 0,
    };
  }
  return {
    present: read.events.length > 0,
    valid: candidates.ok,
    events: read.events.length,
    candidates: candidates.ok ? candidates.candidates.length : 0,
    ...(candidates.ok ? {} : { refusal: { code: candidates.code, detail: candidates.detail } }),
  };
};

/** Construct the harness-neutral extractor from resolved configuration (F-10). */
const closeoutHarnessExtractor = (
  settings: HarnessSettings,
  nowIso: () => string,
): CloseoutTelemetryRuntime["extract"] => {
  if (settings.kind === "claude-code") {
    const extractor = createClaudeTelemetryExtractor({
      directory: settings.claudeCodeSessionDirectory,
      reader: createNodeFileReader(),
      now: nowIso,
    });
    return async (input) => extractor.extract(input);
  }
  const extractor = createOpencodeTelemetryExtractor({
    opener: createBunSqliteStoreOpener(),
    storePath: settings.opencodeDatabasePath,
    now: nowIso,
  });
  return async (input) => extractor.extract(input);
};

/** The latest verified commit attributed to the delivery (F-9). */
const latestVerifiedCommit = (store: StateStorePort, workItemRef: string): string | undefined => {
  const records = store.readRecords();
  if (!records.ok) return undefined;
  for (let index = records.value.records.length - 1; index >= 0; index -= 1) {
    const record = records.value.records[index];
    if (record?.kind !== "commit.telemetry") continue;
    const payload = record.payload as unknown as Record<string, unknown>;
    if (payload.changeRef === workItemRef && typeof payload.commitSha === "string") {
      return payload.commitSha;
    }
  }
  return undefined;
};

/** The recorded squash SHA of a merged delivery, if any (F-5). */
const mergedSquashSha = (store: StateStorePort, workItemRef: string): string | undefined => {
  const records = store.readRecords();
  if (!records.ok) return undefined;
  for (let index = records.value.records.length - 1; index >= 0; index -= 1) {
    const record = records.value.records[index];
    if (record?.kind !== "merge.transaction") continue;
    const payload = record.payload as unknown as Record<string, unknown>;
    if (payload.changeRef !== workItemRef || payload.result !== "merged") continue;
    if (typeof payload.squashSha === "string") return payload.squashSha;
  }
  return undefined;
};

export const createCloseoutComposition = (
  options: CloseoutCompositionOptions,
): CloseoutComposition => {
  const provider =
    options.providerRuntime ??
    bridgeCloseoutProvider(
      options.provider ?? {
        kind: "declared",
        systemName: "declared",
        capabilities: {
          supportedOperations: [],
          declaredGaps: [],
          writableCarriers: [],
          readableCarriers: [],
        },
      },
    );
  const git = gitSeamFor(options.git);
  const extractor =
    options.harness === undefined
      ? undefined
      : closeoutHarnessExtractor(options.harness, options.nowIso);
  const diffReads = new Map<string, CloseoutDiffRead>();
  const sessionFacts = new Map<string, CloseoutSessionFacts>();
  const retroFacts = new Map<string, CloseoutRetroFacts>();
  const dependentsLimit = options.dependentsLimit ?? CLOSEOUT_MAX_DEPENDENTS;
  const mergedRequestLimit = options.mergedRequestLimit ?? 20;
  const entityIdFor = options.entityIdFor ?? defaultCloseoutEntityId;

  const planFacts = async (workItemRef: string): Promise<CloseoutPlanFacts> => {
    const entityId = entityIdFor(workItemRef, options.provider?.kind ?? "declared");
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

    const currentWorktree =
      git.currentWorktreePath === undefined ? undefined : await git.currentWorktreePath();
    const worktrees = git.listWorktrees === undefined ? [] : await git.listWorktrees();
    const deliveryWorktree =
      deliveryBranch.length === 0
        ? undefined
        : worktrees.find((entry) => entry.branch === deliveryBranch);
    let worktree: CloseoutWorktreeFacts;
    if (deliveryWorktree === undefined) {
      worktree = { present: false, safe: false, reason: "no-worktree" };
    } else {
      const worktreeClean =
        git.isWorktreeClean === undefined
          ? cleanWorktree
          : await git.isWorktreeClean({ path: deliveryWorktree.path });
      const verdict = evaluateWorktreeSafety({
        present: true,
        mergedObserved:
          mergedRequest.observation === "observed" && mergedRequest.value.reviewState === "merged",
        conventionMatch: deliveryWorktree.branch === deliveryBranch,
        ...(deliveryWorktree.head === undefined ? {} : { localHead: deliveryWorktree.head }),
        ...(mergedHeadSha === undefined ? {} : { mergedHeadSha }),
        clean: worktreeClean,
        isCurrent: currentWorktree !== undefined && deliveryWorktree.path === currentWorktree,
        locked: deliveryWorktree.locked,
        foreign:
          deliveryWorktree.branch === undefined || deliveryWorktree.branch !== deliveryBranch,
        restoreSucceeded: baseRefExists,
        earlierFailure: false,
      });
      worktree = {
        present: true,
        safe: verdict.safe,
        ...(verdict.reason === undefined ? {} : { reason: verdict.reason }),
        path: deliveryWorktree.path,
        ...(deliveryWorktree.head === undefined ? {} : { head: deliveryWorktree.head }),
        ...(deliveryWorktree.branch === undefined ? {} : { branch: deliveryWorktree.branch }),
      };
    }

    // A safe delivery worktree is removed before branch cleanup, so it no
    // longer holds the branch when the branch predicate is evaluated.
    const effectiveCheckedOutElsewhere = checkedOutElsewhere.filter(
      (name) => !(worktree.safe && name === deliveryBranch),
    );

    const squashSha = mergedSquashSha(options.store, workItemRef);
    let diff: CloseoutPlanFacts["diff"];
    if (squashSha !== undefined && git.readMergedDiff !== undefined) {
      const read = await git.readMergedDiff({ squashSha });
      if (read !== undefined) {
        const diffRead: CloseoutDiffRead = {
          text: read.text,
          files: read.files,
          squashSha,
          parentSha: `${squashSha}^`,
        };
        diffReads.set(workItemRef, diffRead);
        const sweep = evaluateDiffSweep({ diff: diffRead, workItemRef });
        const ambiguousHits = sweep.hits
          .filter((hit) => !hit.resolved)
          .map((hit) => ({
            kind: hit.kind,
            location: `${hit.filePath}:${hit.line}`,
          }));
        diff = {
          available: true,
          hits: sweep.hits.length,
          ambiguous: ambiguousHits.length,
          ...(ambiguousHits.length === 0 ? {} : { ambiguousHits }),
        };
      }
    }

    let sessions = options.sessions;
    if (sessions === undefined && extractor !== undefined) {
      const captured = await extractor({ workItemRef, runId: "closeout-attribution" });
      const commit = latestVerifiedCommit(options.store, workItemRef);
      if (!captured.ok) {
        sessions = {
          available: false,
          sessionIds: [],
          ...(commit === undefined ? {} : { lastVerifiedCommit: commit }),
        };
      } else {
        const ids = [...new Set(captured.value.records.map((record) => record.sessionId))];
        sessions = {
          available: ids.length > 0 || captured.value.failedSessions.length === 0,
          sessionIds: ids,
          ...(commit === undefined ? {} : { lastVerifiedCommit: commit }),
        };
      }
      sessionFacts.set(workItemRef, sessions);
    }

    let retro = options.retro;
    if (retro === undefined) {
      const registry = readRetroRegistry(options.store);
      if (!registry.ok) {
        retro = { available: false, collected: false };
      } else {
        const runs = readRetroRuns(registry.value).filter(
          (run) => run.level === "change" && run.scope === workItemRef,
        );
        const latest = runs[runs.length - 1];
        retro = {
          available: true,
          collected: latest !== undefined,
          ...(latest === undefined ? {} : { runId: latest.runId }),
        };
      }
      retroFacts.set(workItemRef, retro);
    }

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
      checkedOutElsewhere: effectiveCheckedOutElsewhere,
      persisted: foldCloseoutHistory(history.value),
      ...(options.capsule === undefined
        ? {}
        : { capsule: capsuleFactsOf(options.capsule, workItemRef) }),
      worktree,
      ...(mergedRequest.observation === "observed"
        ? {
            threadAuthorFacts: mergedRequest.value.threads.map((thread) => ({
              threadId: thread.threadId,
              authorPrincipal: thread.authorLogin ?? "unknown",
              authorKind: thread.authorKind ?? "unknown",
            })),
          }
        : {}),
      ...(diff === undefined ? {} : { diff }),
      ...(retro === undefined ? {} : { retro }),
      ...(sessions === undefined ? {} : { sessions }),
    };
  };

  const promotionFor = (workItemRef: string): CloseoutPromotionRuntime => {
    const memoryRoot = options.memoryRoot ?? "";
    const documents = options.capsule?.readCandidateDocuments(workItemRef);
    return {
      candidates: documents?.ok === true ? documents.documents : [],
      memory: readMemoryFacts(memoryRoot),
      write: (write) => {
        const result = applyPromotionWrite(memoryRoot, write);
        return result.ok
          ? result
          : {
              ok: false,
              code: result.code === "escape" ? "escape" : "conflict",
              detail: result.detail,
            };
      },
      preflight: (writes) => {
        for (const write of writes) {
          const checked = checkPromotionConfinement(memoryRoot, write);
          if (!checked.ok) return { ok: false, code: "escape", detail: checked.detail };
        }
        return { ok: true };
      },
    };
  };
  const buildTelemetry = (): CloseoutTelemetryRuntime | undefined => {
    if (options.telemetry !== undefined) return options.telemetry;
    if (extractor === undefined) return undefined;
    return {
      extract: extractor,
      append: (capture) => {
        let appended = 0;
        let skipped = 0;
        for (const record of capture.records) {
          const result = appendHarnessTelemetry(options.store, options.newFenceToken(), record);
          if (!result.ok) return { ok: false, error: result.error };
          appended += result.value.report.appended;
          skipped += result.value.report.skipped;
        }
        const outcome = {
          schemaId: HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
          workItemRef: capture.workItemRef,
          runId: capture.runId,
          captured: capture.records.length,
          degraded: capture.records.filter((record) => record.warnings.length > 0).length,
          failed: capture.failedSessions.length,
          warnings: capture.warnings,
          capturedAt: capture.capturedAt,
        };
        const appendedOutcome = appendHarnessCaptureOutcome(
          options.store,
          options.newFenceToken(),
          outcome,
        );
        if (!appendedOutcome.ok) return appendedOutcome;
        return { ok: true, value: { appended, skipped } };
      },
    };
  };

  const telemetry = buildTelemetry();
  return {
    planFacts,
    provider,
    git,
    state: createCloseoutStateRuntime(options.store),
    nowIso: options.nowIso,
    newFenceToken: options.newFenceToken,
    ...(options.capsule === undefined || options.memoryRoot === undefined
      ? {}
      : { promotion: promotionFor }),
    ...(options.retro === undefined ? {} : { retro: options.retro }),
    sessionsFor: (workItemRef) => options.sessions ?? sessionFacts.get(workItemRef),
    retroFor: (workItemRef) => options.retro ?? retroFacts.get(workItemRef),
    diffReadFor: (workItemRef) => diffReads.get(workItemRef),
    ...(telemetry === undefined ? {} : { telemetry }),
    ...(options.capsule === undefined ? {} : { capsule: options.capsule }),
    capsuleExpected: (workItemRef) => capsuleExpectedEvents(options.store, workItemRef),
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
      ...(composition.capsule === undefined ? {} : { capsule: composition.capsule }),
      ...(composition.capsuleExpected === undefined
        ? {}
        : { capsuleExpected: composition.capsuleExpected(workItemRef) }),
      ...(composition.promotion === undefined
        ? {}
        : { promotion: composition.promotion(workItemRef) }),
      ...(() => {
        const diffRead = composition.diffRead ?? composition.diffReadFor?.(workItemRef);
        return diffRead === undefined ? {} : { diffRead };
      })(),
      ...(() => {
        const retro = composition.retro ?? composition.retroFor?.(workItemRef);
        return retro === undefined ? {} : { retro };
      })(),
      ...(() => {
        const sessions = composition.sessions ?? composition.sessionsFor?.(workItemRef);
        return sessions === undefined ? {} : { sessions };
      })(),
      ...(composition.telemetry === undefined ? {} : { telemetry: composition.telemetry }),
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
  readonly dispatch?: DispatchCommandRuntime;
  readonly status?: StatusComposition;
  readonly brief?: StatusComposition;
  readonly queueReady?: StatusComposition;
  readonly queue?: QueueComposition;
  readonly lanes?: QueueComposition;
  readonly doctor?: DoctorComposition;
  readonly db?: DbComposition;
  readonly closeout?: CloseoutComposition;
  readonly watchdog?: WatchdogComposition;
  readonly board?: BoardComposition;
  readonly blockers?: BlockersComposition;
  readonly merge?: MergeCommandRuntime;
  readonly daemon?: DaemonCommandRuntime;
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
    const committedPhaseRuntime = { ...phaseRuntime };
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
  if (options.queue !== undefined) {
    const readyRuntime =
      options.queueReady === undefined
        ? undefined
        : createStatusCommandRuntime(options.queueReady, resolveProviderConfig);
    const resolvedSettings = (() => {
      const snapshot = resolve({});
      if (!snapshot.ok) return undefined;
      const settings = resolveQueueSettings(
        snapshot.value.config.values,
        snapshot.value.config.origins,
      );
      return settings.ok ? settings.value : undefined;
    })();
    commands.queue = createQueueCommandDefinition(
      createQueueCommandRuntime({
        ...options.queue,
        ...(options.queue.settings === undefined && resolvedSettings !== undefined
          ? { settings: resolvedSettings }
          : {}),
        ...(readyRuntime === undefined ? {} : { readyRuntime }),
      }),
    );
  } else if (options.queueReady !== undefined) {
    commands.queue = createQueueReadyCommandDefinition(
      createStatusCommandRuntime(options.queueReady, resolveProviderConfig),
    );
  }
  if (options.lanes !== undefined) {
    commands.lanes = createLanesCommandDefinition(createLanesCommandRuntime(options.lanes));
  }
  if (options.verify !== undefined) {
    commands.verify = createVerifyCommandDefinition(options.verify);
  }
  if (options.dispatch !== undefined) {
    commands.dispatch = createDispatchCommandDefinition(options.dispatch);
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
  if (options.daemon !== undefined) {
    commands.daemon = createDaemonCommandDefinition(options.daemon);
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

/* ------------------------- scheduling engine edge ------------------------- */

/** The injected non-store facts a scheduling pass consumes. */
export type QueueFactSource = {
  readonly plans: Readonly<Record<string, QueuePlanFact>>;
  readonly workItems: Readonly<Record<string, QueueWorkItemFact>>;
  readonly ci: Readonly<Record<string, QueueCiFact>>;
  readonly provider: QueueProviderFact;
  readonly close: Readonly<Record<string, QueueCloseFact>>;
  readonly deploy: QueueDeployFacts;
};

/** One producer-root configuration read for deploy-expectation resolution. */
export type QueueDeployExpectationRead =
  | {
      readonly ok: true;
      readonly declared: boolean;
      readonly steps: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: "config-missing" | "config-invalid";
    };

/**
 * The producer-root resolution seam (C-6, AC-F6-2, DM-12). Candidate roots come
 * only from entry records; the returned normalized remote is compared to the
 * producer entry's recorded key by exact string equality.
 */
export type QueueDeployExpectationPort = {
  readonly normalizedRemote: (root: string) => string | undefined;
  readonly deployExpectations: (root: string) => QueueDeployExpectationRead;
};

/** The scheduling-engine composition seams supplied by the caller. */
export type QueueComposition = {
  readonly store: StateStorePort;
  readonly facts: QueueFactSource;
  readonly settings?: {
    readonly leaseTtlMs: number;
    readonly parkRecheckMs: Readonly<Record<string, number>>;
  };
  readonly repositoryBinding?: {
    readonly repository?: string;
    readonly repositoryRoot?: string;
  };
  /** The producer-root config resolution seam; absent means use injected facts. */
  readonly deployExpectations?: QueueDeployExpectationPort;
  readonly runner?: string;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
  readonly newFenceToken: () => string;
  readonly degraded?: readonly QueueDegradationReason[];
  readonly economics?: Readonly<Record<string, QueueLaneEconomics>>;
  readonly readyRuntime?: QueueReadyCommandRuntime;
  /** The additive live-watch seam (GH-238 F-13); absent degrades to polling. */
  readonly watch?: {
    readonly transport?: ControlTransport;
    readonly clock?: DaemonClockPort;
    readonly signal?: { readonly interrupted: () => boolean };
    readonly intervalMs?: number;
    readonly maxIterations?: number;
  };
};

type QueueBuilt =
  | {
      readonly ok: true;
      readonly facts: QueueSchedulerFacts;
      readonly parkRecords: readonly unknown[];
    }
  | QueueRuntimeFailure;

const queueStateFailure = (code: string): QueueRuntimeFailure => ({
  ok: false,
  kind: "state",
  code,
  summary: `state read failed (${code})`,
});

/**
 * Resolve producer deploy expectations from the producer's own configuration
 * (AC-F6-2, C-6, DM-12). Candidate roots are discovered ONLY from entry records
 * and matched to the producer entry's recorded key by exact normalized-remote
 * equality; the invocation root is never substituted. No matching root, a
 * two-root collision, or a missing/unreadable/invalid config yields `unknown`.
 */
const resolveDeployExpectations = (
  composition: QueueComposition,
  fold: QueueGraphFold,
): Readonly<Record<string, QueueDeployExpectation>> => {
  const port = composition.deployExpectations;
  if (port === undefined) return composition.facts.deploy.expectations;

  const rootsByKey = new Map<string, Set<string>>();
  for (const entry of fold.entryRecords) {
    if (entry.repository === undefined || entry.repositoryRoot === undefined) continue;
    const roots = rootsByKey.get(entry.repository) ?? new Set<string>();
    roots.add(entry.repositoryRoot);
    rootsByKey.set(entry.repository, roots);
  }

  const producers = new Set<string>();
  for (const entry of fold.entries) {
    for (const producer of entry.edges) producers.add(producer);
  }

  const expectations: Record<string, QueueDeployExpectation> = {
    ...composition.facts.deploy.expectations,
  };
  for (const producer of [...producers].sort()) {
    const record = fold.entryRecords.find((entry) => entry.ref === producer);
    if (record?.repository === undefined) {
      expectations[producer] = { state: "unknown", reason: "root-unresolved" };
      continue;
    }
    const roots = [...(rootsByKey.get(record.repository) ?? [])].sort();
    if (roots.length === 0) {
      expectations[producer] = { state: "unknown", reason: "root-unresolved" };
      continue;
    }
    if (roots.length > 1) {
      expectations[producer] = { state: "unknown", reason: "root-collision" };
      continue;
    }
    const root = roots[0];
    if (root === undefined) {
      expectations[producer] = { state: "unknown", reason: "root-unresolved" };
      continue;
    }
    const remote = port.normalizedRemote(root);
    if (remote === undefined || remote !== record.repository) {
      expectations[producer] = { state: "unknown", reason: "root-unresolved" };
      continue;
    }
    const config = port.deployExpectations(root);
    if (!config.ok) {
      expectations[producer] = { state: "unknown", reason: config.reason };
      continue;
    }
    expectations[producer] = config.declared
      ? { state: "declared", steps: config.steps }
      : { state: "not-declared" };
  }
  return expectations;
};

const buildQueueFacts = (
  composition: QueueComposition,
  parkContext: {
    readonly providerAvailable: boolean;
    readonly leaseHeldRepositories: readonly string[];
  },
): QueueBuilt => {
  const nowMs = composition.nowMs();
  const nowIso = composition.nowIso();
  const fold = readQueueFold(composition.store);
  if (!fold.ok) return queueStateFailure(fold.code);
  const active = readActiveLeases(composition.store, nowMs);
  if (!active.ok) return queueStateFailure(active.code);
  const parks = readQueueParkPass(composition.store, nowMs, parkContext);
  if (!parks.ok) return queueStateFailure(parks.code);
  return {
    ok: true,
    facts: {
      nowIso,
      nowMs,
      fold: fold.value,
      plans: composition.facts.plans,
      workItems: composition.facts.workItems,
      ci: composition.facts.ci,
      provider: composition.facts.provider,
      leases: active.active,
      parkEvaluations: parks.pass.evaluations,
      parkRecords: parks.pass.records,
      close: composition.facts.close,
      deploy: {
        ...composition.facts.deploy,
        expectations: resolveDeployExpectations(composition, fold.value),
      },
      runner: composition.runner ?? "runner-a",
    },
    parkRecords: parks.pass.records,
  };
};

const parkContextFor = (
  composition: QueueComposition,
): {
  readonly providerAvailable: boolean;
  readonly leaseHeldRepositories: readonly string[];
} => {
  const active = readActiveLeases(composition.store, composition.nowMs());
  return {
    providerAvailable: composition.facts.provider.state === "available",
    leaseHeldRepositories: active.ok ? active.active.map((lease) => lease.repository) : [],
  };
};

const recoverParksForMutation = (
  composition: QueueComposition,
): QueueRuntimeFailure | undefined => {
  const active = readActiveLeases(composition.store, composition.nowMs());
  if (!active.ok) return queueStateFailure(active.code);
  const context = parkContextFor(composition);
  const recovered = recoverQueueParks(composition.store, {
    nowIso: composition.nowIso(),
    nowMs: composition.nowMs(),
    context,
    fenceToken: composition.newFenceToken(),
  });
  if (recovered.ok) return undefined;
  return mapQueueFailure(recovered);
};

const mapQueueFailure = (
  failure:
    | QueueIntentFailure
    | QueueLeaseFailure
    | {
        readonly ok: false;
        readonly kind: string;
        readonly code: string;
        readonly reason?: string;
        readonly detail?: string;
        readonly path?: readonly string[];
        readonly conflict?: { readonly holder: string; readonly leaseId: string };
      },
): QueueRuntimeFailure => {
  if (failure.kind === "state") {
    return {
      ok: false,
      kind: "state",
      code: failure.code,
      summary: `state failure (${failure.code})`,
    };
  }
  if (failure.kind === "input") {
    return {
      ok: false,
      kind: "input",
      code: failure.code,
      summary: "detail" in failure ? failure.detail : "input rejected",
    };
  }
  if (failure.code === "queue.dependency-cycle") {
    return {
      ok: false,
      kind: "queue",
      code: failure.code,
      summary: `existing path: ${(failure.path ?? []).join(" -> ")}`,
    };
  }
  if (failure.code === "queue.lease-conflict") {
    const conflict = "conflict" in failure ? failure.conflict : undefined;
    return {
      ok: false,
      kind: "queue",
      code: failure.code,
      summary:
        "detail" in failure && failure.detail !== undefined
          ? failure.detail
          : conflict === undefined
            ? "lease conflict"
            : `holder:${conflict.holder}; lease:${conflict.leaseId}`,
    };
  }
  if (failure.code === "queue.precondition.unmet") {
    return {
      ok: false,
      kind: "queue",
      code: failure.code,
      summary: `reason=${(failure as { reason?: string }).reason ?? "unmet"}${(failure as { detail?: string }).detail === undefined ? "" : `; ${(failure as { detail?: string }).detail}`}`,
    };
  }
  if (failure.code === "queue.park-condition-stuck") {
    return {
      ok: false,
      kind: "queue",
      code: failure.code,
      summary: "park condition cleared without recovery",
    };
  }
  return {
    ok: false,
    kind: "queue",
    code: failure.code,
    summary: (failure as { detail?: string }).detail ?? failure.code,
  };
};

const claimLeaseProjection = (lease: {
  readonly leaseId: string;
  readonly scope: "repo-exclusive" | "worktree";
  readonly repository: string;
  readonly holder: string;
  readonly ref: string;
  readonly runner: string;
  readonly weightClass: "standard" | "heavy";
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly ttlMs: number;
  readonly takeover?: { readonly leaseId: string };
}) => ({
  leaseId: lease.leaseId,
  scope: lease.scope,
  repository: lease.repository,
  holder: lease.holder,
  ref: lease.ref,
  runner: lease.runner,
  weightClass: lease.weightClass,
  acquiredAt: lease.acquiredAt,
  heartbeatAt: lease.heartbeatAt,
  ttlMs: lease.ttlMs,
  ...(lease.takeover === undefined ? {} : { takeoverOf: lease.takeover.leaseId }),
});

const mutationOutcome = (
  result: QueueIntentOutcome,
  degraded: readonly QueueDegradationReason[],
  composition: QueueComposition,
): QueueRuntimeMutation => {
  const fallbackEntry = result.fold.entries.find((entry) => entry.ref === result.entry.ref) ?? {
    ref: result.entry.ref,
    ...(result.entry.repository === undefined ? {} : { repository: result.entry.repository }),
    priority: result.entry.priority,
    edges: result.edges,
    weightClass: "standard" as const,
    rankClass: "new-start" as const,
    recordedAt: result.entry.recordedAt,
  };
  const weight = resolveQueueWeight(composition.facts.plans[result.entry.ref]);
  const built = buildQueueFacts(composition, parkContextFor(composition));
  const projected = built.ok
    ? computeQueueSchedule(built.facts, { next: 20 }).entries.find(
        (entry) => entry.ref === result.entry.ref,
      )
    : undefined;
  const entryProjection =
    projected === undefined
      ? fallbackEntry
      : {
          ...fallbackEntry,
          rankClass: projected.rankClass,
          weightClass: projected.weightClass,
        };
  return {
    ok: true,
    ref: result.entry.ref,
    entry: entryProjection,
    entryState: projected?.state ?? "not-ready",
    blocking: projected?.blocking ?? [
      fallbackEntry.repository === undefined
        ? { reason: "not-ready" as const, detail: "repository-binding-unresolved" }
        : { reason: "not-ready" as const, detail: "state-unreadable" },
    ],
    weightClass: projected?.weightClass ?? weight.weightClass,
    weightClassSource: projected?.weightClassSource ?? weight.source,
    edges: result.edges,
    result: result.result,
    degraded,
  };
};

/** The additive live-watch composition shared by queue and lanes (F-13). */
const watchClockFor = (composition: QueueComposition): DaemonClockPort =>
  composition.watch?.clock ?? {
    nowMs: composition.nowMs,
    nowIso: composition.nowIso,
    sleep: (ms, signal) =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        if (signal?.cancelled() === true) {
          clearTimeout(timer);
          resolve();
        }
      }),
  };

const watchStreamFor = (
  composition: QueueComposition,
  topic: "queue" | "lanes",
  read: () => WatchRead,
): (() => AsyncIterable<string>) => {
  const config = composition.watch;
  const clock = watchClockFor(composition);
  return () =>
    watchLines({
      topic,
      read,
      clock,
      intervalMs: config?.intervalMs ?? 5_000,
      signal: config?.signal ?? { interrupted: () => false },
      ...(config?.transport === undefined ? {} : { transport: config.transport }),
      ...(config?.maxIterations === undefined ? {} : { maxIterations: config.maxIterations }),
    });
};

/** Compose the full queue command runtime from the injected state and facts. */
export const createQueueCommandRuntime = (composition: QueueComposition): QueueCommandRuntime => {
  const degraded = composition.degraded ?? (["daemon-unreachable"] as const);
  const readSchedule = (next: number): QueueRuntimeSchedule => {
    const built = buildQueueFacts(composition, parkContextFor(composition));
    if (!built.ok) return built;
    return {
      ok: true,
      schedule: computeQueueSchedule(built.facts, { next }),
      degraded,
    };
  };
  const mutate = (operation: () => QueueIntentResult): QueueRuntimeMutation => {
    const recovered = recoverParksForMutation(composition);
    if (recovered !== undefined) return recovered;
    const result = operation();
    if (!result.ok) return mapQueueFailure(result);
    return mutationOutcome(result.value, degraded, composition);
  };
  return {
    readSchedule,
    watch: watchStreamFor(composition, "queue", () => {
      const read = readSchedule(20);
      return read.ok
        ? { ok: true as const, data: toQueueReadData(read.schedule, []) }
        : { ok: false as const, code: read.code };
    }),
    add: (input) =>
      mutate(() =>
        declareQueueEntry(composition.store, {
          ref: input.ref,
          ...(composition.repositoryBinding?.repository === undefined
            ? {}
            : { repository: composition.repositoryBinding.repository }),
          ...(composition.repositoryBinding?.repositoryRoot === undefined
            ? {}
            : { repositoryRoot: composition.repositoryBinding.repositoryRoot }),
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(input.deps === undefined ? {} : { edges: input.deps }),
          recordedAt: composition.nowIso(),
          fenceToken: composition.newFenceToken(),
        }),
      ),
    prioritize: (input) =>
      mutate(() =>
        prioritizeQueueEntry(composition.store, {
          ref: input.ref,
          priority: input.priority,
          recordedAt: composition.nowIso(),
          fenceToken: composition.newFenceToken(),
        }),
      ),
    dep: (input) =>
      mutate(() =>
        addQueueDependency(composition.store, {
          ref: input.ref,
          onRef: input.onRef,
          recordedAt: composition.nowIso(),
          fenceToken: composition.newFenceToken(),
        }),
      ),
    claim: (input) => {
      const recovered = recoverParksForMutation(composition);
      if (recovered !== undefined) return recovered;
      const built = buildQueueFacts(composition, parkContextFor(composition));
      if (!built.ok) return built;
      const schedule = computeQueueSchedule(built.facts, { next: 20 });
      const selected =
        input.ref ?? schedule.nextActions.find((action) => action.preemption === undefined)?.ref;
      if (selected === undefined) {
        return {
          ok: false,
          kind: "queue",
          code: "queue.precondition.unmet",
          summary: "reason=no-eligible-action",
        };
      }
      const entry = schedule.entries.find((candidate) => candidate.ref === selected);
      if (entry === undefined) {
        return {
          ok: false,
          kind: "queue",
          code: "queue.entry.unobserved",
          summary: `entry ${selected} is not observed`,
        };
      }
      const outranking = schedule.nextActions.find(
        (action) =>
          action.preemption === undefined &&
          action.repository === entry.repository &&
          action.ref !== selected,
      );
      const weight = resolveQueueWeight(built.facts.plans[selected]);
      const heavyLease = isHeldByWeight(weight, built.facts.leases, built.facts.runner, selected);
      const precheck = evaluateClaimPreconditions(built.facts, selected, {
        ...(outranking === undefined ? {} : { outrankedBy: outranking.ref }),
        ...(heavyLease === undefined ? {} : { weightHeldBy: heavyLease.ref }),
      });
      const claimed = claimQueueLease(composition.store, {
        ref: selected,
        holder: input.holder,
        runner: built.facts.runner,
        weightClass: weight.weightClass,
        ...(composition.settings === undefined ? {} : { ttlMs: composition.settings.leaseTtlMs }),
        nowIso: composition.nowIso(),
        nowMs: composition.nowMs(),
        fenceToken: composition.newFenceToken(),
        precheck: () => precheck,
      });
      if (!claimed.ok) return mapQueueFailure(claimed);
      const action = schedule.nextActions.find((candidate) => candidate.ref === selected) ?? {
        ref: selected,
        ...(entry.repository === undefined ? {} : { repository: entry.repository }),
        rankClass: entry.rankClass,
        reason: "close-first" as const,
        priority: entry.priority,
        weightClass: entry.weightClass,
        weightClassSource: entry.weightClassSource,
        lease: { state: "free" as const },
        blocking: [],
      };
      return {
        ok: true,
        result: claimed.value.result,
        selectedRef: selected,
        lease: claimLeaseProjection(claimed.value.lease),
        action,
        degraded,
      };
    },
    release: (input) => {
      if (input.parkCause === "provider-window" && input.parkUntil === undefined) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary: "provider-window park requires --until <iso>",
        };
      }
      if (input.parkCause !== "provider-window" && input.parkUntil !== undefined) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary: "--until is accepted only with --park provider-window",
        };
      }
      const park =
        input.parkCause === undefined
          ? undefined
          : {
              cause: input.parkCause,
              condition: parkConditionForCause(input.parkCause, {
                ...(input.parkUntil === undefined ? {} : { expiresAt: input.parkUntil }),
              }),
              recheckMs:
                composition.settings?.parkRecheckMs[
                  input.parkCause === "preempted-for-close-item" ? "preemption" : input.parkCause
                ] ??
                defaultParkRecheckMs(
                  input.parkCause === "preempted-for-close-item" ? "preemption" : input.parkCause,
                ),
            };
      const released = releaseQueueLease(composition.store, {
        ref: input.ref,
        ...(input.holder === undefined ? {} : { holder: input.holder }),
        ...(park === undefined ? {} : { park }),
        nowIso: composition.nowIso(),
        nowMs: composition.nowMs(),
        fenceToken: composition.newFenceToken(),
      });
      if (!released.ok) return mapQueueFailure(released);
      const parkRecord = released.value.park;
      return {
        ok: true,
        result: released.value.result,
        ...(released.value.lease === undefined
          ? {}
          : { lease: claimLeaseProjection(released.value.lease) }),
        ...(parkRecord === undefined
          ? {}
          : {
              park: {
                ref: parkRecord.ref,
                cause: parkRecord.cause,
                conditionType: parkRecord.conditionType,
                recheckMs: parkRecord.recheckMs,
                ...(parkRecord.condition.type === "provider-window"
                  ? { expiresAt: parkRecord.condition.expiresAt }
                  : {}),
                lastEvaluatedAt: parkRecord.evaluatedAt,
                ...(parkRecord.clearObservedAt === undefined
                  ? {}
                  : { clearObservedAt: parkRecord.clearObservedAt }),
                recoveryState: parkRecord.recoveryState,
                ...(parkRecord.clearedAt === undefined ? {} : { clearedAt: parkRecord.clearedAt }),
              },
            }),
        degraded,
      };
    },
    ...(composition.readyRuntime === undefined
      ? {}
      : { readyDefinition: createQueueReadyCommandDefinition(composition.readyRuntime) }),
  };
};

/** Compose the lanes command runtime from the same scheduling seams. */
export const createLanesCommandRuntime = (
  composition: QueueComposition,
): import("./commands/lanes.js").LanesCommandRuntime => {
  const readLanes = () => {
    const built = buildQueueFacts(composition, parkContextFor(composition));
    if (!built.ok) {
      return {
        ok: false as const,
        code: "status.collector.lanes.unavailable",
        summary: `queue store is unreadable (${built.code})`,
      };
    }
    const schedule = computeQueueSchedule(built.facts, { next: 20 });
    const daemon = readDaemonLanes(composition.store);
    return {
      ok: true as const,
      data: foldLanes({
        schedule,
        economics: composition.economics ?? {},
        degraded: composition.degraded ?? (["daemon-unreachable"] as const),
        ...(daemon.ok ? { daemonLanes: daemon.records } : {}),
      }),
    };
  };
  return {
    readLanes,
    watch: watchStreamFor(composition, "lanes", () => {
      const read = readLanes();
      return read.ok ? { ok: true, data: read.data } : { ok: false, code: read.code };
    }),
  };
};

/**
 * The dispatch composition seam (GH-239 F-1, F-4, F-5, F-6).
 *
 * Every fact is injected: the fenced store, the selected harness session port
 * and descriptor, the truth reads, the lease claim/release pair, and the
 * declared evidence class. The runtime never invents an exit literal and never
 * composes a merge port.
 */
export type DispatchComposition = {
  readonly store: DispatchPorts["store"];
  readonly stateRoot: string;
  readonly fenceToken: string;
  readonly nowIso: () => string;
  readonly newAttemptId: (ref: string) => string;
  readonly newDivergenceId: (ref: string) => string;
  readonly harnesses: Readonly<Partial<Record<HarnessKind, HarnessSessionPort>>>;
  readonly defaultHarness: HarnessKind;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly prompt: (ref: string) => string;
  readonly evidenceClass?: DispatchEvidenceClass;
  readonly repository: (ref: string) => string;
  readonly readTruth: (ref: string) => Promise<DispatchTruthReads>;
  readonly claimLease: (ref: string, repository: string) => DispatchLeaseClaim;
  readonly releaseLease: (ref: string, cause: "completed" | "aborted") => boolean;
  readonly phaseLedger: (ref: string) => DispatchPhaseLedger;
  readonly restartBudget?: number;
  /** The delivery's persisted restart count, read at run time (AC-F3-2). */
  readonly restartCount?: (ref: string) => number;
  readonly livenessIntervalMs?: number;
  readonly resumeAmplification?: string;
  readonly existingLane?: (ref: string) => DispatchLaneFacts | undefined;
  /**
   * The cancellable cadence wait the one-shot watcher polls on. Absence means
   * the session is not watched while it runs; the composition owns the timer.
   */
  readonly waitForCadence?: (cadenceMs: number) => {
    readonly promise: Promise<void>;
    readonly cancel: () => void;
  };
  /**
   * The delivered terminal restart-budget exhaustion append. Absence leaves the
   * refusal recorded with an unrecorded-exhaustion evidence reference.
   */
  readonly ensureRestartExhaustion?: (input: {
    readonly ref: string;
    readonly runId: string;
    readonly restarts: number;
    readonly recordedAt: string;
  }) => boolean;
  readonly gate?: {
    readonly scope: DispatchRepositoryScope;
    readonly principal: string;
    readonly max?: number;
    readonly resolveRepository: (repo: string) => string | undefined;
  };
};

/** The delivered lane facts a resume admits against. */
export type DispatchLaneFacts = {
  readonly handle: HarnessSessionHandle;
  readonly completedPhases: readonly string[];
  readonly adapterSupportsResumeInjection: boolean;
  readonly restartCount: number;
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
};

const isHarnessKind = (value: string): value is HarnessKind =>
  (HARNESS_KINDS as readonly string[]).includes(value);

/** The composition surface the evidence-gate command family needs. */
export type DispatchGateComposition = {
  readonly store: DispatchPorts["store"];
  readonly stateRoot: string;
  readonly fenceToken: string;
  readonly nowIso: () => string;
  readonly gate: NonNullable<DispatchComposition["gate"]>;
};

/**
 * Build the typed evidence-gate runtime (`dual-run summary`, `dual-run resolve`,
 * `handover [--revert]`) over the injected store and identity resolver. It needs
 * no harness settings, so a composition can expose it without resolving them.
 */
export const createDispatchGateRuntime = (
  composition: DispatchGateComposition,
): Required<
  Pick<import("./commands/dispatch.js").DispatchCommandRuntime, "summary" | "resolve" | "handover">
> => ({
  summary: {
    summarize: async (repo: string) => {
      const repository = composition.gate.resolveRepository(repo);
      if (repository === undefined) {
        return { ok: false as const, error: { kind: "input", code: "input.value.rejected" } };
      }
      const result = summarizeDispatchEvidence({
        store: composition.store,
        repository,
        scope: composition.gate.scope,
        nowIso: composition.nowIso(),
        ...(composition.gate.max === undefined ? {} : { max: composition.gate.max }),
      });
      return result.ok
        ? { ok: true as const, data: result.data }
        : { ok: false as const, error: result.error };
    },
  },
  resolve: {
    resolve: async (input: { readonly divergenceId: string; readonly note: string }) =>
      resolveDispatchDivergenceEvidence({
        store: composition.store,
        fenceToken: composition.fenceToken,
        divergenceId: input.divergenceId,
        note: input.note,
        principal: composition.gate.principal,
        nowIso: composition.nowIso(),
      }),
  },
  handover: {
    handover: async (input: { readonly repo: string; readonly revert: boolean }) => {
      const repository = composition.gate.resolveRepository(input.repo);
      if (repository === undefined) {
        return { ok: false as const, error: { kind: "input", code: "input.value.rejected" } };
      }
      return input.revert
        ? revertDispatchHandoverEvidence({
            store: composition.store,
            fenceToken: composition.fenceToken,
            repository,
            scope: composition.gate.scope,
            nowIso: composition.nowIso(),
            principal: composition.gate.principal,
          })
        : handoverDispatchEvidence({
            store: composition.store,
            fenceToken: composition.fenceToken,
            repository,
            scope: composition.gate.scope,
            nowIso: composition.nowIso(),
            principal: composition.gate.principal,
          });
    },
  },
});

/**
 * Build the dispatch command runtime. An unknown or uncomposed harness is a
 * classified refusal, never a crash; the production default class is `pilot`.
 */
export const createDispatchCommandRuntime = (
  composition: DispatchComposition,
): DispatchCommandRuntime => ({
  run: {
    run: async (input) => {
      const selected = input.harness ?? composition.defaultHarness;
      if (!isHarnessKind(selected)) {
        return { ok: false, error: { kind: "input", code: "input.value.rejected" } };
      }
      const harness = composition.harnesses[selected];
      if (harness === undefined) {
        return {
          ok: false,
          error: { kind: "harness", code: "harness.capability.gap", summary: selected },
        };
      }
      const repository = composition.repository(input.ref);
      const handover: DispatchHandoverState = readDispatchAuthority(
        composition.stateRoot,
        repository,
      ).authority;
      const lane =
        input.resumePrompt === undefined ? undefined : composition.existingLane?.(input.ref);
      let admission: DispatchAdmission | undefined;
      let resumeMode: DispatchResumeMode | undefined;
      let prefillCostAcknowledged: boolean | undefined;
      if (lane !== undefined) {
        const plan = planDispatchResume({
          adapterSupportsResumeInjection: lane.adapterSupportsResumeInjection,
          completedPhases: lane.completedPhases,
        });
        resumeMode = plan.mode;
        prefillCostAcknowledged = plan.prefillCostAcknowledged;
        const restart = admitDispatchRestart({
          count: lane.restartCount,
          bound: composition.restartBudget ?? 0,
        });
        if (!restart.admitted) {
          admission = {
            admitted: false,
            code: restart.reason,
            terminal: true,
            escalation: restart.escalation,
            resumeMode: plan.mode,
          };
        } else {
          const economics = evaluateDispatchResumeEconomics({
            mode: plan.mode,
            ...(lane.prefillCost === undefined ? {} : { prefillCost: lane.prefillCost }),
            ...(lane.uniqueProgress === undefined ? {} : { uniqueProgress: lane.uniqueProgress }),
          });
          admission = economics.admitted
            ? {
                admitted: true,
                resumeMode: plan.mode,
                prefillCostAcknowledged: plan.prefillCostAcknowledged,
                restarts: lane.restartCount,
              }
            : { admitted: false, code: economics.code, resumeMode: plan.mode };
        }
      }
      return runDispatch({
        store: composition.store,
        fenceToken: composition.fenceToken,
        harness,
        harnessKind: selected,
        descriptor: composition.descriptor,
        prompt: composition.prompt(input.ref),
        ref: input.ref,
        evidenceClass: composition.evidenceClass ?? DISPATCH_DEFAULT_EVIDENCE_CLASS,
        repository,
        handoverState: handover,
        nowIso: composition.nowIso,
        newAttemptId: () => composition.newAttemptId(input.ref),
        newDivergenceId: () => composition.newDivergenceId(input.ref),
        readTruth: () => composition.readTruth(input.ref),
        claimLease: () => composition.claimLease(input.ref, repository),
        releaseLease: (cause) => composition.releaseLease(input.ref, cause),
        phaseLedger: composition.phaseLedger(input.ref),
        ...(composition.restartBudget === undefined
          ? {}
          : { restartBudget: composition.restartBudget }),
        ...(composition.restartCount === undefined
          ? {}
          : { initialRestarts: composition.restartCount(input.ref) }),
        ...(composition.livenessIntervalMs === undefined
          ? {}
          : { livenessIntervalMs: composition.livenessIntervalMs }),
        ...(composition.waitForCadence === undefined
          ? {}
          : { waitForCadence: composition.waitForCadence }),
        ...(composition.ensureRestartExhaustion === undefined
          ? {}
          : { ensureRestartExhaustion: composition.ensureRestartExhaustion }),
        ...(composition.resumeAmplification === undefined
          ? {}
          : { resumeAmplification: composition.resumeAmplification }),
        ...(input.resumePrompt === undefined ? {} : { resumePrompt: input.resumePrompt }),
        ...(lane === undefined ? {} : { existingHandle: lane.handle }),
        ...(admission === undefined ? {} : { admission: () => admission }),
        ...(resumeMode === undefined ? {} : { resumeMode }),
        ...(prefillCostAcknowledged === undefined ? {} : { prefillCostAcknowledged }),
      });
    },
  },
  ...(composition.gate === undefined
    ? {}
    : createDispatchGateRuntime({
        store: composition.store,
        stateRoot: composition.stateRoot,
        fenceToken: composition.fenceToken,
        nowIso: composition.nowIso,
        gate: composition.gate,
      })),
});
