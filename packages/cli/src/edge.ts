/**
 * The designated runtime-aware edge (D12).
 *
 * Brand identity is resolved once, before any discovery, from an injected
 * environment record. Source acquisition, legacy fact mapping, shipped artifact
 * injection and the pure resolver are composed here; the command handler only
 * shapes the already-resolved snapshot.
 */

import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  acquireFileConfig,
  affectedRepositoryTargets,
  applyPromotionWrite,
  ceremonyTierEvidenceFromLifecycle,
  checkPromotionConfinement,
  copyDecisionRecords,
  createCapsuleFileRuntime,
  createCeremonyArtifactStore,
  createCommitlintProbe,
  createSecretScanner,
  decisionRecordIds,
  ensureProjectIdentityMarkerText,
  type FileSystemFacts,
  type MetricsCorpusFileSystemFacts,
  neutralEnvironmentFacts,
  nodeCapsuleFileSystemFacts,
  nodeCeremonyTierContextFileSystem,
  nodeDecisionRecordFileSystem,
  nodeFileSystemFacts,
  type PmNotesFileSystemFacts,
  type ProviderMigrateFileSystem,
  parseCeremonyNoteText,
  parseConfigYaml,
  type RuntimePlatform,
  readCeremonyDeclarationDocument,
  readCeremonyTierContextFiles,
  readCiWorkflowJobNames,
  readDecisionRegister,
  readDispatchAuthority,
  readLocalPmContext,
  readMemoryFacts,
  readMetricsBaselineLog,
  readMetricsBurnRateNode,
  readPlanArtifact,
  readPmNotesText,
  readProjectGroupsConfig,
  readProjectIdentityMarker,
  readProviderMigrateSources,
  readProviderSimulateFixture,
  runtimePlatform,
  scanMetricsCorpus,
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
import { createLegacyCompat, PROVIDER_LEGACY_MIGRATION_TABLE } from "@delivery-os/adapters/legacy";
import { createProviderWatchMappings } from "@delivery-os/adapters/provider-quota";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  type RepositoryIo,
  type RepositoryRootFacts,
  readCheckoutIdentity,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import {
  createSessionAdmin,
  createSessionStore,
  type OpencodeSessionIo,
} from "@delivery-os/adapters/session";
import { createIntlZonePort } from "@delivery-os/adapters/time-zone";
import {
  type ActionArtifactVerdict,
  actionArtifactPlaneOpen,
  actionListEntry,
  actionWindowEntries,
  addQueueDependency,
  admitDispatchRestart,
  appendCommandReceipt,
  appendOutboxEffect,
  beginCommitEffect,
  boardNeedsDecisionHistory,
  buildCeremonyRegistry,
  buildCloseoutPlan,
  type CeremonyEngineFailure,
  type CeremonyTierInput,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  type CloseoutTelemetryRuntime,
  type CommitActOutcome,
  type CommitActRequest,
  type CommitTransportPorts,
  type ConfigCatalog,
  callerAudienceVariableName,
  canonicalChangeRef,
  capsuleGateEventKey,
  capsulePhaseEventKey,
  catalogPaths,
  catchUpCeremonies,
  catchUpScopeKey,
  ceremonyRegistryEntry,
  ceremonyRegistryIds,
  ceremonyTierIntake,
  claimQueueLease,
  claimSingleFlightRefusal,
  classifyPruneCandidate,
  closeRetroAction,
  collectRetro,
  compileTrustedSchema,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  computeMetricsReport,
  computeQueueSchedule,
  computeSpendReport,
  computeStagingPlan,
  conditionTypeForCause,
  configEnvironmentNames,
  createSourcedWatchdogSignalSource,
  type DefaultPositionManifest,
  type DispatchAdmission,
  type DispatchLeaseClaim,
  type DispatchPorts,
  type DispatchPreflightResult,
  type DispatchRepositoryScope,
  type DispatchTranscriptRead,
  type DispatchTruthReads,
  declareQueueEntry,
  decodeTelemetryStepFrame,
  defaultParkRecheckMs,
  deriveCapsuleEventKey,
  dispatchLogByteLength,
  emptyIngestTally,
  evaluateCeremonyTier,
  evaluateClaimPreconditions,
  evaluateDiffSweep,
  evaluateDispatchResumeEconomics,
  evaluateWorktreeSafety,
  fileRetroAction,
  foldLanes,
  type HarnessSettings,
  handoverDispatchEvidence,
  isHeldByWeight,
  isLiveDbSession,
  isMemberRef,
  joinAttributionSubstrates,
  listRetroActions,
  type MergeTransactionPorts,
  memberRefFor,
  normalizeStagedPaths,
  PRODUCTION_CATALOG,
  PRODUCTION_DEFAULTS,
  parkConditionForCause,
  parseCapsuleEvents,
  parseMemberRef,
  parseProjectIdentityMarker,
  payloadFieldViolations,
  planDispatchResume,
  prioritizeQueueEntry,
  type QueueCiFact,
  type QueueCloseFact,
  type QueueDependencyRemovalResult,
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
  type QueueRemovalMutationResult,
  type QueueSchedulerFacts,
  type QueueWorkItemFact,
  queueRemovalForCloseout,
  rankBlockerQuestions,
  readActiveLeases,
  readCommandReceipts,
  readDaemonLanes,
  readDispatchAttemptHistory,
  readDispatchAttempts,
  readDispatchLastMessage,
  readDispatchLog,
  readOperatorDelivering,
  readOperatorStatus,
  readOutboxEffects,
  readQueueFold,
  readQueueParkPass,
  readQueueParks,
  reconcileQueueEntries,
  recoverQueueParks,
  releaseQueueLease,
  removeQueueDependency,
  removeQueueEntry,
  reportRetro,
  resolveCloseoutBaseRef,
  resolveConfig,
  resolveDispatchDivergenceEvidence,
  resolveHostStateRoot,
  resolveMergeGateSet,
  resolveMetricsBurnRate,
  resolveMetricsWindow,
  resolveProjectScope,
  resolveQueueSettings,
  resolveQueueWeight,
  resumeCeremony,
  retroActionCeremonyFacts,
  revertDispatchHandoverEvidence,
  runCeremony,
  runCloseout,
  runCommitAct,
  runDispatch,
  selectPruneCandidates,
  serializeCapsuleEvent,
  sha256Hex,
  spendDigestSection,
  stateScopeRoots,
  summarizeDispatchEvidence,
  type TelemetryAttributionSubstrates,
  type TelemetryClaimedIdentity,
  type TelemetryFrameContext,
  type TelemetrySessionTotalsReader,
  tallyFrame,
  tallyIngestDegradation,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
  validateCeremonyNoteForDeclaration,
  type WatchRead,
  watchLines,
  windowDisclosures,
  windowSpendEvidence,
} from "@delivery-os/core";
import type { BrandingInputError, ResolverInput } from "@delivery-os/core/branding";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import type {
  CredentialFailureProjection,
  CredentialFailureReason,
  ProviderZoneFacts,
} from "@delivery-os/core/contracts";
import {
  ACTION_WIP_LIMIT,
  type AdapterCapabilityDeclaration,
  AUDIT_IDENTITY_VARIABLE_SUFFIX,
  type AuditAgentIdentity,
  type AuditInvocationFacts,
  BLOCKER_DELEGATION_POLICY,
  type BlockerCapabilityFact,
  type BlockerDelegationPolicy,
  BOARD_MAX_LANES,
  BOARD_MAX_REPOSITORIES,
  type BoardActionFact,
  type BoardAskFact,
  type BoardLaneFact,
  type BoardOwnerHold,
  type BoardParkedFact,
  type BrandIdentity,
  CANONICAL_PHASE_IDS,
  CAPSULE_MAX_SESSIONS,
  type CapabilityGapReason,
  type CapsuleFileRuntime,
  type CapsuleFileSystemFacts,
  type CapsuleProducerPort,
  CEREMONY_NOTE_MAX_BYTES,
  type CeremonyDeclaration,
  type CeremonyInputRead,
  type CeremonyInputSource,
  type CeremonyMemoryPort,
  type CeremonyMirrorPort,
  type CeremonyNote,
  type CeremonyStepRecord,
  type CeremonyTierVerdict,
  CLOSEOUT_MAX_DEPENDENTS,
  type CloseoutDiffRead,
  type CloseoutExpectedCapsuleEvent,
  type CloseoutGitRuntime,
  type CloseoutPromotionRuntime,
  type CloseoutProviderRuntime,
  type CloseoutQueueRemovalData,
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
  type ConfigValue,
  type ControlTransport,
  type CredentialPort,
  type CrossRepositoryCloseoutObservation,
  type DaemonClockPort,
  type DeliveryRequest,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  DISPATCH_MAX_MACHINE_BYTES,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type DispatchLaneFacts,
  type DispatchLogFileSystem,
  type DispatchOwnerProbe,
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
  type HarnessSeatBinding,
  type HarnessSessionPort,
  type HarnessTruncation,
  type MergeDeliveryRequestInput,
  type MetricsReadSeams,
  type MetricsStateRead,
  OWNER_GATE_SLA_POLICY,
  type OwnerGateCollectorRead,
  type OwnerGateSlaDecisionRecord,
  type OwnerHoldFact,
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  type PhaseTransitionRecord,
  type PlanDiffPort,
  type PlanMemberDeclaration,
  PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
  type ProfileProviderAvailability,
  type ProviderAnnouncementRecord,
  type ProviderClock,
  type ProviderConfiguration,
  type ProviderParkRecord,
  type ProviderParkView,
  type ProviderSleep,
  type ProviderSpendTotalsPort,
  type ProviderSpendTotalsRead,
  type ProviderWatchTarget,
  type ProviderWorkItemRefResolver,
  QUEUE_BATTERY_ONLY_PARK_CAUSES,
  type QueueDegradationReason,
  type QueueTrackerRead,
  type QuotaTransport,
  type Result,
  type RetroSpendEvidence,
  renderPriorIdentityNotice,
  resolveWorkingNameOverride,
  type SpendDigestSection,
  STATUS_MAX_LANE_PARKS,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_SOURCE_ITEM_LIMIT,
  type StateFenceHandle,
  type StateResult,
  type StateStorePort,
  type StatusBlockersRead,
  type StatusLanePark,
  type StatusLocalContextRead,
  type StatusParkRead,
  type StatusProviderConfigRead,
  type StatusReadFailure,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  type SteerAskSource,
  type SteerOrigin,
  type SteerPhaseFoldView,
  TELEMETRY_CAPTURE_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  type TelemetryIngestCaptureRecord,
  type TelemetryIngestSink,
  VERIFY_GATES_FAILURE_CLASSES,
  type WatchdogGitPort,
  type WatchdogLaneRead,
  type WatchdogSignalSource,
  type WorkItem,
} from "@delivery-os/core/contracts";
import {
  bindZoneFacts,
  buildProviderMigrationProposal,
  createProfileProbePort,
  createProviderEngine,
  createProviderWatchStatus,
  evaluatePeakWindow,
  evaluateProfileLifecycle,
  isWatchObservationStale,
  normaliseZoneName,
  PROVIDER_MIGRATE_TARGET_NAME,
  PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS,
  type ProviderMigrateAssignment,
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  parseProviderMigrateSource,
  parseProviderSimulateFixture,
  persistProfileTarget,
  providerMigrateNoCheckoutRefusal,
  providerMigrateRefusalSummary,
  readProfileTarget,
  readProviderLedger,
  readProviderParkViews,
  resolveProfileForSpawn,
  selectProfile,
  simulateProviderResolution,
  UTC_ZONE_FACTS,
  watchObservationAgeSeconds,
} from "@delivery-os/core/provider";
import {
  appendAuditInvocation,
  appendBlockerAnswer,
  appendBlockerQuestion,
  appendCloseoutOutcome,
  appendCommitTelemetry,
  appendCoordinatorFence,
  appendCoordinatorRestart,
  appendCoordinatorStuck,
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
  appendLoopSession,
  appendLoopStop,
  appendMergeGateVerification,
  appendMergeTransaction,
  appendMergeWaiver,
  appendOwnerGateSlaDecision,
  appendPhaseTransition,
  appendSteeringCompletion,
  appendSteeringMessage,
  appendSteeringOutcomes,
  appendTelemetryCaptureOutcome,
  appendTelemetryStep,
  type CeremonyLifecycleTransition,
  type CeremonyStatePartition,
  captureTelemetryBaseline,
  createCeremonyRecordPort,
  createNodeRetroSidecarIo,
  createNodeStateEdge,
  createRetroActionRegistryPort,
  createRetroSidecar,
  createStateStore,
  foldCeremonyRunVerdict,
  foldCloseoutHistory,
  foldPhaseState,
  type MetricsLedgerComposition,
  readActionRegistry,
  readAllMergeWaivers,
  readAuditLedger,
  readBlockerLedger,
  readCeremonyRuns,
  readCeremonyState,
  readChangeTransitionsTolerant,
  readCloseoutHistory,
  readCommitTelemetry,
  readCoordinatorRecords,
  readLoopRecords,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
  readMetricsLedger,
  readOwnerGateSlaDecisions,
  readRetroRegistry,
  readRetroRuns,
  readSpendLedger,
  readSteeringQueue,
  readTelemetrySteps,
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
import {
  type BoardCommandRuntime,
  type BoardRepositoryLoad,
  createBoardCommandDefinition,
} from "./commands/board.js";
import { createBriefCommandDefinition } from "./commands/brief.js";
import {
  type CeremonyCommandResult,
  type CeremonyCommandRuntime,
  createCeremonyCommandDefinition,
} from "./commands/ceremony.js";
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
  type DispatchAttemptsRuntime,
  type DispatchCommandRuntime,
  type DispatchDeliveringRuntime,
  type DispatchLogRuntime,
  type DispatchMessageRuntime,
  type DispatchStatusRuntime,
} from "./commands/dispatch.js";
import { createDoctorCommandDefinition, type DoctorCommandRuntime } from "./commands/doctor.js";
import { createEventsCommandDefinition, type EventsCommandRuntime } from "./commands/events.js";
import {
  type CoordinatorCommandRuntime,
  type CoordinatorSupervisorPorts,
  createCoordinatorCommandDefinition,
  createCoordinatorSupervisor,
  createLoopCommandDefinition,
  createLoopSupervisor,
  type LoopCommandRuntime,
  type LoopLedgerPort,
  type LoopSupervisorPorts,
} from "./commands/index.js";
import { createLanesCommandDefinition } from "./commands/lanes.js";
import {
  createLintCommandDefinition,
  type LintCommandRuntime,
  type LintRegistryRead,
} from "./commands/lint.js";
import { createMergeCommandDefinition, type MergeCommandRuntime } from "./commands/merge.js";
import { createMetricsCommandDefinition, type MetricsCommandRuntime } from "./commands/metrics.js";
import {
  createPhaseCommandDefinition,
  type PhaseCommandRuntime,
  type PhaseCommitEvidence,
  type PhaseCommitExtension,
  type PhasePlanRead,
} from "./commands/phase.js";
import { createPlanCommandDefinition, type PlanCommandRuntime } from "./commands/plan.js";
import {
  createProjectsCommandDefinition,
  type ProjectGroupWorkRead,
  type ProjectsCommandRuntime,
} from "./commands/projects.js";
import {
  createProviderCommandDefinition,
  type ProviderCommandRuntime,
} from "./commands/provider.js";
import {
  createQueueCommandDefinition,
  createQueueReadyCommandDefinition,
  type QueueCommandRuntime,
  type QueueReadyCommandRuntime,
  type QueueRuntimeDependencyRemoval,
  type QueueRuntimeFailure,
  type QueueRuntimeMutation,
  type QueueRuntimeRemoval,
  type QueueRuntimeSchedule,
  toQueueReadData,
} from "./commands/queue.js";
import { createReposCommandDefinition, type ReposCommandRuntime } from "./commands/repos.js";
import {
  createRetroCommandDefinition,
  type RetroCommandRuntimeWithActions,
} from "./commands/retro.js";
import { createSpendCommandDefinition, type SpendCommandRuntime } from "./commands/spend.js";
import { createStatusCommandDefinition, type StatusCommandRuntime } from "./commands/status.js";
import { createSteerCommandDefinition, type SteerCommandRuntime } from "./commands/steer.js";
import {
  createSuperviseCommandDefinition,
  type SuperviseCommandRuntime,
} from "./commands/supervise.js";
import { createVerifyCommandDefinition, type VerifyCommandRuntime } from "./commands/verify.js";

export type {
  DispatchAttemptsRuntime,
  DispatchCommandRuntime,
  DispatchDeliveringRuntime,
  DispatchLogRuntime,
  DispatchMessageRuntime,
  DispatchStatusRuntime,
} from "./commands/dispatch.js";

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
  SecretRegistry,
} from "./index.js";
import { createSecretRegistry } from "./index.js";

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
 * acquired by a read. The verified fold is carried additively (DM-8,
 * TDR-0055 §4) so the both-target comparison reads the ledger, never the
 * projection document and never the pm-notes bytes.
 */
export const createRegistryLintReader = (
  store: StateStorePort,
): ((changeRef: string) => LintRegistryRead) => {
  return (changeRef) => {
    const read = store.read({ requiredKeys: [] });
    if (!read.ok) return { ok: false, error: read.error };
    const { evidence, values } = read.value;
    const transitions = readChangeTransitionsTolerant(store, changeRef);
    if (!transitions.ok) return { ok: false, error: transitions.error };
    const projectionName = `${PHASE_STATE_DOCUMENT_PREFIX}${changeRef}${PHASE_STATE_DOCUMENT_SUFFIX}`;
    return {
      ok: true,
      verifiedEmpty: evidence.verifiedEmpty,
      recordCount: evidence.recordCount,
      verification: evidence.verification,
      projection: { present: Object.hasOwn(values, `document:${projectionName}`) },
      fold: foldPhaseState(changeRef, transitions.value.transitions),
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
  /**
   * The one bounded configuration-document map read (GH-300 DM-9). The
   * composition memoizes the single resolution attempt; absent means undeclared
   * and the delivered behaviour stands.
   */
  readonly readSuiteMap?: VerifyGatesCommandRuntime["readSuiteMap"];
  /** The resolved declared gate set; absent yields the shipped default. */
  readonly readGateSet?: VerifyGatesCommandRuntime["readGateSet"];
  /** The EVT-1 append seam; absent leaves the evaluation unrecorded. */
  readonly appendVerification?: VerifyGatesCommandRuntime["appendVerification"];
  /** The injected clock in epoch milliseconds. */
  readonly nowMs?: () => number;
  /** The non-gating capsule producer port (GH-240 F-2). */
  readonly capsule?: CapsuleProducerPort;
  /**
   * The additive cross-repository seam (GH-310 F-3, F-6): the declared member
   * read plus the injected landing/review observations. Absent keeps the
   * delivered single-target handler and the member-less bytes unchanged.
   */
  readonly members?: VerifyGatesCommandRuntime["members"];
  /**
   * Additive redrive evidence source (TDR-0014 INV-8): the durable DM-18 receipt
   * for the change ref and phase, supplying the proven discovered SHA.
   */
  readonly readRedriveEvidence?: (
    changeRef: string,
    phaseId: string,
  ) => Promise<{ readonly commitSha: string; readonly source: "redrive" } | undefined>;
};

type ProviderFailureLike = {
  readonly ok: false;
  readonly code: string;
  /** The credential projection rides the reified resolution failure (DEC-14). */
  readonly source?: string;
  readonly reason?: CredentialFailureReason;
  readonly remedy?: string;
};

/** The credential projection a reified failure carries, if any. */
const credentialProjectionOf = (
  failure: ProviderFailureLike,
): CredentialFailureProjection | undefined =>
  failure.source === undefined && failure.reason === undefined && failure.remedy === undefined
    ? undefined
    : {
        ...(failure.source === undefined ? {} : { source: failure.source }),
        ...(failure.reason === undefined ? {} : { reason: failure.reason }),
        ...(failure.remedy === undefined ? {} : { remedy: failure.remedy }),
      };

const providerReadFailure = <T>(failure: ProviderFailureLike): VerifyGatesReadResult<T> => {
  if (failure.code === "config.credential.missing") {
    const credential = credentialProjectionOf(failure);
    return {
      ok: false,
      reason: "credential-unavailable",
      failureCode: "config.credential.missing",
      ...(credential === undefined ? {} : { credential }),
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

const credentialRefusal = <T>(failure?: ProviderFailureLike): VerifyGatesReadResult<T> => {
  const credential = failure === undefined ? undefined : credentialProjectionOf(failure);
  return {
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
    ...(credential === undefined ? {} : { credential }),
  };
};

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
    ...(options.members === undefined ? {} : { members: options.members }),
    ...(options.readSuiteMap === undefined ? {} : { readSuiteMap: options.readSuiteMap }),
  };
};

/** The injected seams for the merge command composition (GH-225 F-1..F-8). */
export type MergeCommandComposition = {
  readonly store: StateStorePort;
  /**
   * The git seam the transaction composes: head, base containment, and branch
   * deletion. Its retained `squashLand` and `refresh` capabilities are never
   * composed here — a landing is the provider-side operation.
   */
  readonly git: GitMergeSeam;
  /** The one composed landing mechanism: the closed provider-side operation. */
  readonly land: (
    input: MergeDeliveryRequestInput,
  ) => Promise<
    | { readonly ok: true; readonly requestState: string; readonly mergeCommitSha?: string }
    | { readonly ok: false; readonly code: string }
  >;
  /**
   * The adapter's declared capability for the landing operation: `undefined`
   * when supported, or the declared gap reason.
   */
  readonly landingGap: () => CapabilityGapReason | undefined;
  /**
   * Return the local checkout to the base ref. The provider landing leaves the
   * checkout on the delivery branch, so the delivered post-landing branch
   * deletion needs one local HEAD move to the base first (no fetch, no push, no
   * remote read, and no base mutation).
   */
  readonly restoreCheckout: (baseRef: string) => Promise<"ok" | "failed">;
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
  readonly ownerPrincipal?: string | undefined;
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
      readLandingGap: () => composition.landingGap(),
      land: (input) => composition.land(input),
      deleteBranch: async (input) => {
        if (input.branch === undefined) return "failed";
        // The provider landing leaves the checkout on the delivery branch, so the
        // delivered post-landing deletion first returns the checkout to the base
        // (one local HEAD move; never a fetch, push, or base mutation).
        await composition.restoreCheckout(composition.baseRef ?? "main-tools");
        return composition.git.deleteBranch({ branch: input.branch });
      },
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
  /** Injected state directory (an explicit project root); wins over the policy. */
  readonly stateDirectory?: string;
  /**
   * The invoking working directory. When supplied, the audit store opens at the
   * policy-derived PROJECT root for that checkout (GH-288 AC-F6-1/AC-F6-2), so
   * the audit ledger lives beside the delivery store it describes.
   */
  readonly cwd?: string;
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
  const home = options.homeDirectory === undefined ? {} : { homeDirectory: options.homeDirectory };
  if (options.cwd !== undefined) {
    const scope = resolveProjectScope({
      environment,
      environmentPrefix: options.brand.environmentPrefix,
      stateDirectoryName: options.brand.stateDirectoryName,
      ...home,
      checkout: readCheckoutIdentity({ cwd: options.cwd, io: nodeRepositoryIo() }),
      ports: {
        readMarker: (commonDir) => readProjectIdentityMarker(commonDir),
        writeMarker: (commonDir, text) => ensureProjectIdentityMarkerText(commonDir, text),
        newProjectIdentifier: () => globalThis.crypto.randomUUID().replace(/-/gu, ""),
      },
    });
    return scope.ok ? stateScopeRoots(scope.value).projectRoot : undefined;
  }
  const host = resolveHostStateRoot({
    environment,
    environmentPrefix: options.brand.environmentPrefix,
    stateDirectoryName: options.brand.stateDirectoryName,
    ...home,
  });
  return host.ok ? host.value : undefined;
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
    secrets: createSecretRegistry(registerEdgeSecrets(environment, options.secretKeys ?? [])),
    program: options.program,
    mode: resolveCliMode(options.isTTY === undefined ? {} : { isTTY: options.isTTY }),
    ...(audit === undefined ? {} : { audit }),
  };
}

/** Injected I/O and seams for the provider command family (GH-182 PD-G; GH-350 F-2). */
export type ProviderComposition = {
  readonly clock: ProviderClock;
  readonly credentialPort: CredentialPort;
  readonly transport: QuotaTransport;
  readonly sleep: ProviderSleep;
  readonly stateStore: StateStorePort;
  readonly newFenceToken: () => string;
  /**
   * The one read-only spend-totals port (GH-350, DM-3). Absent means the edge
   * projects it from this composition's store; an injected port (the tests'
   * counting fake) wins.
   */
  readonly spendTotals?: ProviderSpendTotalsPort;
  /** The local delivery-context tier of the budget ref seam (TDR-0064). */
  readonly resolveWorkItemRef?: ProviderWorkItemRefResolver;
  /** The context path the unresolvable-ref refusal names. */
  readonly workItemContextPath?: string;
  /**
   * The filesystem seam the simulate fixture read uses (GH-350 F-5). Absent
   * means the composition's configuration filesystem, then the node facts; a
   * test injects its recording stub here so a fixture open is observable.
   */
  readonly fixtureFs?: FileSystemFacts;
  /**
   * The filesystem seam the migration reads use (GH-350 F-6). Absent means the
   * composition's configuration filesystem extended with directory listing.
   */
  readonly migrateFs?: ProviderMigrateFileSystem;
  /**
   * The observation instant a watch read stands for (GH-350 F-7). Absent means
   * the read instant, which is what this composition supplies by default; a test
   * injects a retained instant to exercise staleness.
   */
  readonly watchObservedAtMs?: () => number;
  /**
   * Composition-supplied per-provider observations for the profile availability
   * seam (GH-377 DM-7, §8.6). Keyed by provider name, consumed at the read
   * instant, never persisted, fetched, or written. Absent means no observation,
   * which is the delivered production steady state.
   */
  readonly availabilityObservations?: Readonly<Record<string, ProviderAvailabilityObservation>>;
  /**
   * The zone seam the peak evaluation binds through (GH-350 F-1/F-8, ADR-0013).
   * Absent means the engine's zone-unaware default: a non-UTC window refuses
   * `provider.peak.zone-unknown` at the edge. The production composition supplies
   * the Intl-backed binder so a declared IANA zone evaluates.
   */
  readonly zoneFactsFor?: (zone: string) => ProviderZoneFacts | undefined;
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
  /** The declared truth-read reference names, when the composition is admitted. */
  readonly credentialReference?: { readonly referenceName: string; readonly sourceKey: string };
  /** The per-pass owner-hold reader supplied by the production composition. */
  readonly readOwnerHold?: () => OwnerHoldFact;
  /**
   * The group-scoped work read behind `status --project <groupKey>`
   * (GH-309 F-5, F-6); absent leaves the digest-only surface.
   */
  readonly readProjectGroup?: (
    groupKey: string,
  ) => ProjectGroupWorkRead | Promise<ProjectGroupWorkRead>;
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
  /**
   * The additive non-step queue-removal hook (GH-292 F-2, DM-6); the
   * composition wires it over the same store the state runtime fences.
   */
  readonly queueRemoval?: (input: {
    readonly mode: "plan" | "apply";
    readonly workItemRef: string;
    readonly mergedObserved: boolean;
    readonly handle?: StateFenceHandle;
  }) => CloseoutQueueRemovalData | undefined;
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
  /**
   * The injected per-member closeout observations (GH-310 DM-8, DEC-20). One
   * entry per declared member in declared order; absent leaves the delivered
   * single-request closeout unchanged. No port, provider operation, or durable
   * store is added, and the durable production carrier is deferred (OQ-6).
   */
  readonly readMembers?: (
    workItemRef: string,
  ) => readonly CrossRepositoryCloseoutObservation[] | undefined;
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
  /**
   * The integer-millisecond clock. Optional: it defaults to `nowIso()` parsed,
   * so a caller that supplies only the ISO clock keeps one time source.
   */
  readonly nowMs?: () => number;
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
  return async (input) =>
    createOpencodeTelemetryExtractor({
      opener: createBunSqliteStoreOpener(),
      storePath: settings.opencodeDatabasePath,
      now: nowIso,
      ...(input.pinnedVersion === undefined ? {} : { pinnedVersion: input.pinnedVersion }),
    }).extract(input);
};

/**
 * Resolve the work item's session attribution from its recorded dispatch
 * attempts (GH-335 DM-8, AC-F5-5).
 *
 * The union of every attempt's held identities, each attempt's recorded
 * binding attached only to its own identities, and an attempt that recorded no
 * identity counted — never inferred from the store, a title, or a directory.
 * An empty union is the caller's `skipped-gap`, and a truncated attempt-ledger
 * read is disclosed rather than silently narrowing the union.
 */
export const resolveSessionAttribution = (
  store: StateStorePort,
  workItemRef: string,
): {
  readonly heldSessionIds: readonly string[];
  readonly bindings: Readonly<Record<string, HarnessSeatBinding>>;
  readonly observedVersion?: string;
  readonly unattributedAttempts: number;
  readonly attemptTruncation?: HarnessTruncation;
} => {
  const read = readDispatchAttempts(store);
  if (!read.ok) {
    return { heldSessionIds: [], bindings: {}, unattributedAttempts: 0 };
  }
  const identities = new Set<string>();
  const bindings: Record<string, HarnessSeatBinding> = {};
  let unattributedAttempts = 0;
  for (const attempt of read.records) {
    if (attempt.ref !== workItemRef) continue;
    const sessionIds = attempt.sessionIds ?? [];
    if (sessionIds.length === 0) {
      unattributedAttempts += 1;
      continue;
    }
    for (const sessionId of sessionIds) {
      identities.add(sessionId);
      if (attempt.binding !== undefined) bindings[sessionId] = attempt.binding;
    }
  }
  const observedVersion =
    [...read.records]
      .filter((attempt) => attempt.ref === workItemRef)
      .map((attempt) => attempt.harnessVersion)
      .find((version): version is string => typeof version === "string" && version.length > 0) ??
    undefined;
  return {
    heldSessionIds: [...identities].sort(),
    bindings,
    ...(observedVersion === undefined ? {} : { observedVersion }),
    unattributedAttempts,
    ...(read.truncation === undefined
      ? {}
      : {
          attemptTruncation: {
            truncated: true as const,
            omitted: read.truncation.omittedRecords,
            cap: read.truncation.bound,
          },
        }),
  };
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
  const closeoutNowMs = options.nowMs ?? (() => Date.parse(options.nowIso()));
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
    if (sessions === undefined && options.harness !== undefined) {
      // GH-335: attribution is the union the work item's recorded attempts hold.
      // With no harness configured the step keeps its delivered no-op; with one
      // configured an empty union is the declared attribution gap.
      // An empty union is the delivered `skipped-gap`, never a store scan.
      const attribution = resolveSessionAttribution(options.store, workItemRef);
      const commit = latestVerifiedCommit(options.store, workItemRef);
      const capped = attribution.heldSessionIds.slice(0, CAPSULE_MAX_SESSIONS);
      sessions = {
        available: attribution.heldSessionIds.length > 0,
        sessionIds: capped,
        ...(attribution.heldSessionIds.length > capped.length
          ? {
              truncated: {
                truncated: true,
                omitted: attribution.heldSessionIds.length - capped.length,
              },
            }
          : {}),
        ...(Object.keys(attribution.bindings).length === 0
          ? {}
          : { bindings: attribution.bindings }),
        ...(attribution.unattributedAttempts === 0
          ? {}
          : { unattributedAttempts: attribution.unattributedAttempts }),
        ...(attribution.attemptTruncation === undefined
          ? {}
          : { attemptTruncation: attribution.attemptTruncation }),
        ...(attribution.observedVersion === undefined
          ? {}
          : { observedVersion: attribution.observedVersion }),
        ...(commit === undefined ? {} : { lastVerifiedCommit: commit }),
      };
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
        const absenceCounts = new Map<string, number>();
        for (const absence of capture.absences ?? []) {
          absenceCounts.set(absence.reason, (absenceCounts.get(absence.reason) ?? 0) + 1);
        }
        const outcome = {
          schemaId: HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
          workItemRef: capture.workItemRef,
          runId: capture.runId,
          captured: capture.records.length,
          degraded: capture.records.filter((record) => record.warnings.length > 0).length,
          failed: capture.failedSessions.length,
          warnings: capture.warnings,
          ...(absenceCounts.size === 0
            ? {}
            : {
                absences: [...absenceCounts]
                  .map(([reason, count]) => ({ reason: reason as never, count }))
                  .sort((left, right) => (left.reason < right.reason ? -1 : 1)),
              }),
          ...(capture.unattributedAttempts === undefined
            ? {}
            : { unattributedAttempts: capture.unattributedAttempts }),
          ...(capture.attemptTruncation === undefined
            ? {}
            : { attemptTruncation: capture.attemptTruncation }),
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
  // GH-292 F-2: the closeout's landed-removal hook shares the transaction's
  // fence; the merged delivery request is the merge truth it discloses on.
  const queueRemoval = (hook: {
    readonly mode: "plan" | "apply";
    readonly workItemRef: string;
    readonly mergedObserved: boolean;
    readonly handle?: StateFenceHandle;
  }) =>
    queueRemovalForCloseout(options.store, {
      mode: hook.mode,
      workItemRef: hook.workItemRef,
      mergedObserved: hook.mergedObserved,
      recordedAt: options.nowIso(),
      nowMs: closeoutNowMs(),
      ...(hook.handle === undefined ? {} : { handle: hook.handle }),
    });
  return {
    planFacts,
    provider,
    git,
    state: createCloseoutStateRuntime(options.store),
    queueRemoval,
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
    const baseFacts = await composition.planFacts(workItemRef);
    const injectedMembers = composition.readMembers?.(workItemRef);
    const facts =
      injectedMembers === undefined || injectedMembers.length === 0
        ? baseFacts
        : { ...baseFacts, members: injectedMembers };
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
      ...(composition.queueRemoval === undefined ? {} : { queueRemoval: composition.queueRemoval }),
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

const providerFailure = (failure: ProviderFailureLike): StatusReadFailure => {
  if (failure.code === "config.credential.missing") {
    const credential = credentialProjectionOf(failure);
    return {
      ok: false,
      reason: "credential-unavailable",
      failureCode: "config.credential.missing",
      ...(credential === undefined ? {} : { credential }),
    };
  }
  return { ok: false, reason: "read-failed", failureClass: failure.code };
};

/**
 * The delivered profile probe over a parsed provider configuration's entries
 * (GH-294 F-1): the availability verdict per provider the profile selection
 * and the nomination predicate both read — undeclared and disabled providers
 * are unavailable, a declared peak window parks, and a clear entry is
 * available. Module-level so the provider command path and the production
 * nomination composition read one probe truth.
 */
const providerZonePort = createIntlZonePort();

/** Resolve a declared zone to its bound facts through the single Intl edge. */
const providerZoneFactsFor = (zone: string): ProviderZoneFacts | undefined => {
  const normalised = normaliseZoneName(zone);
  if (normalised === "UTC") return UTC_ZONE_FACTS;
  return providerZonePort.isKnownZone(normalised)
    ? bindZoneFacts(normalised, providerZonePort)
    : undefined;
};

/**
 * The first declared peak zone in `names` that this composition cannot resolve
 * (GH-350 F-1/F-8, NFR-5). A surface that would probe these providers uses this
 * to refuse `provider.peak.zone-unknown` before any probe, so an unresolvable
 * zone is never silently evaluated as UTC. `names` may be every declared entry
 * or the entries a profile selection can probe.
 */
export const unknownProviderPeakZone = (
  entries: ProviderConfiguration["entries"],
  names: readonly string[],
  zoneFactsFor: (zone: string) => ProviderZoneFacts | undefined = providerZoneFactsFor,
): { readonly providerName: string; readonly zone: string } | undefined => {
  for (const name of names) {
    const peak = entries[name]?.peak;
    if (peak === undefined) continue;
    if (zoneFactsFor(peak.timezone) === undefined) {
      return { providerName: name, zone: peak.timezone };
    }
  }
  return undefined;
};

/** The classification a zone refusal carries at the command surface. */
const zoneUnknownRefusal = (unknown: { readonly providerName: string; readonly zone: string }) => ({
  ok: false as const,
  code: "provider.peak.zone-unknown" as const,
  summary:
    `provider ${unknown.providerName} declares peak zone ${unknown.zone}, which this composition ` +
    `cannot resolve; correct the zone name, or run where zone data is available (a UTC declaration ` +
    `needs none)`,
});

const stepInstantMs = (step: {
  readonly finishedAt: string | null;
  readonly capturedAt: string;
}): number => Date.parse(step.finishedAt ?? step.capturedAt);

/**
 * The one read-only spend-totals projection (GH-350 F-2, DM-3, TDR-0059 D2).
 *
 * One verified `readSpendLedger` per evaluation, then one projection per
 * declared budget scope over the delivered fold (`computeSpendReport`): both
 * bases are returned for every scope so budgets on different bases share the
 * read, and no per-record data crosses the port. A failed read returns the
 * delivered `state.*` identity; verified-empty telemetry measures zero.
 */
export const createProviderSpendTotalsPort = (store: StateStorePort): ProviderSpendTotalsPort => ({
  read: async (input) => {
    const read = readSpendLedger(store, input.workItemRef);
    if (!read.ok)
      return { status: "failed", code: read.error.code } satisfies ProviderSpendTotalsRead;
    const ledger = read.value;
    if (ledger.verifiedEmpty) return { status: "empty" };
    const { scopes } = input;
    const totals = scopes.map((scope) => {
      const steps = (ledger.steps ?? []).filter((step) => stepInstantMs(step) >= scope.fromMs);
      const records = ledger.records.filter(
        (record) => Date.parse(record.capturedAt) >= scope.fromMs,
      );
      const folded = computeSpendReport(
        { ...ledger, steps, records },
        { workItemRef: ledger.workItemRef },
      );
      const newestCandidates = [
        ...steps.map(stepInstantMs),
        ...records.map((record) => Date.parse(record.capturedAt)),
      ].filter((instant) => Number.isFinite(instant));
      const tokens = folded.ok
        ? Object.values(folded.data.tokensByClass).reduce((sum, value) => sum + value, 0)
        : 0;
      return {
        scopeKey: scope.scopeKey,
        cost: folded.ok ? (folded.data.costTotals.total ?? 0) : 0,
        tokens,
        newestAtMs: newestCandidates.length === 0 ? null : Math.max(...newestCandidates),
        ...(folded.ok ? { sparse: folded.data.costTotals.sparse } : {}),
      };
    });
    return { status: "measured", totals };
  },
});

/** A composition-supplied per-provider watch observation (GH-377 DM-7). */
export type ProviderAvailabilityObservation = {
  readonly condition: string;
  readonly observedAtMs: number;
};

/**
 * The optional park/observation facts the composed availability probe consumes
 * (GH-377 DM-6/DM-7, §8.6). The verified park fold is read once, here, and the
 * returned verdict is memoized by the selection pass, so no per-seat re-read
 * occurs. Absent facts preserve the delivered three-check probe exactly.
 */
export type ProviderAvailabilityFacts = {
  /** The store the verified park fold is read through, once per resolution. */
  readonly store?: StateStorePort;
  /** An already-read park fold (tests and injected compositions); wins when set. */
  readonly parks?: StateResult<readonly ProviderParkView[]>;
  /** Composition-supplied observations keyed by provider name. */
  readonly observations?: Readonly<Record<string, ProviderAvailabilityObservation>>;
  /** The declared watch targets keyed by provider name. */
  readonly watch?: Readonly<Record<string, ProviderWatchTarget>>;
};

/**
 * The probe verdict plus the recorded-unavailability marker (GH-377 F-3). The
 * marker is internal to the availability seam: it says the provider is blocked
 * by recorded state (an active provider-attributable park, a stale declared
 * watch target, or an unreadable park fold), never by declaration, enablement,
 * or the declared peak window. The seat-level re-check consumes only this
 * marker, so the seat gate is not widened.
 */
type ProviderAvailabilityVerdict = ProfileProviderAvailability & {
  readonly recordedUnavailable?: boolean;
};

/** `chain-exhausted` and `reevaluation-cap` describe the chain or loop, not a provider. */
const CHAIN_LEVEL_PARK_CAUSES: ReadonlySet<string> = new Set([
  "chain-exhausted",
  "reevaluation-cap",
]);

export const createResolvedProviderProbe = (
  entries: ProviderConfiguration["entries"],
  nowMs: number,
  zoneFactsFor: (zone: string) => ProviderZoneFacts | undefined = providerZoneFactsFor,
  facts: ProviderAvailabilityFacts = {},
): ReturnType<typeof createProfileProbePort> => {
  // One verified park-fold read per resolution (GH-377 DM-6, NFR-2/NFR-4).
  const parkFold: StateResult<readonly ProviderParkView[]> =
    facts.parks ??
    (facts.store === undefined
      ? { ok: true, value: [] }
      : readProviderParkViews(facts.store, nowMs, { all: true }));
  const recordedParkFailure = parkFold.ok ? undefined : parkFold.error.code;
  const activeProviderParks = new Map<string, ProviderParkView>();
  if (parkFold.ok) {
    for (const view of parkFold.value) {
      if (
        view.subjectKind === "provider" &&
        view.state === "active" &&
        !CHAIN_LEVEL_PARK_CAUSES.has(view.cause)
      ) {
        activeProviderParks.set(view.subjectName, view);
      }
    }
  }

  return createProfileProbePort((providerName): ProviderAvailabilityVerdict => {
    if (recordedParkFailure !== undefined) {
      // A fold read failure is never availability and never a crash: it is the
      // delivered probe-failure shape with a delivered condition value.
      return {
        available: false,
        condition: "provider-outage",
        blockers: [
          {
            kind: "condition",
            value: "provider-outage",
            detail: `provider ${providerName}: park state unreadable (${recordedParkFailure})`,
          },
        ],
        source: `provider ${providerName}: park state unreadable`,
        recordedUnavailable: true,
      };
    }
    const descriptor = entries[providerName];
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
    // Recorded provider truth outranks the declared peak window (RSK-10): a
    // recorded peak-window park and a declared peak produce the same blocker
    // value, but only the recorded one is seat-level unavailability.
    const recordedPark = activeProviderParks.get(providerName);
    if (recordedPark !== undefined) {
      return {
        available: false,
        condition: recordedPark.cause,
        blockers: [
          {
            kind: "condition",
            value: recordedPark.cause,
            detail: `provider ${providerName}: recorded ${recordedPark.cause} park`,
          },
        ],
        source: `provider ${providerName}: recorded ${recordedPark.cause} park`,
        recordedUnavailable: true,
      };
    }
    if (descriptor.peak !== undefined) {
      const zoneFacts = zoneFactsFor(descriptor.peak.timezone);
      if (zoneFacts === undefined) {
        // Never read an unresolvable zone as UTC: the provider is unavailable
        // for a reason that names the zone, and the command surfaces refuse
        // `provider.peak.zone-unknown` before they call this probe.
        return {
          available: false,
          condition: "provider.peak.zone-unknown",
          blockers: [
            {
              kind: "condition",
              value: "provider.peak.zone-unknown",
              detail:
                `provider ${providerName}: peak zone ${descriptor.peak.timezone} cannot be ` +
                `resolved by this composition`,
            },
          ],
          source: `provider ${providerName}: peak zone ${descriptor.peak.timezone} unresolved`,
        };
      }
      const peak = evaluatePeakWindow(descriptor.peak, nowMs, zoneFacts);
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
    // Only freshness is consumed at the observation seam (§8.6): a fresh
    // observation contributes nothing, whatever condition it carries, and a
    // provider with no declared watch target is never stale.
    const watchTarget = facts.watch?.[providerName];
    const observation = facts.observations?.[providerName];
    if (watchTarget !== undefined && observation !== undefined) {
      const maxAgeSeconds = watchTarget.maxAgeSeconds ?? PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS;
      const ageSeconds = watchObservationAgeSeconds({
        nowMs,
        observedAtMs: observation.observedAtMs,
      });
      if (isWatchObservationStale({ ageSeconds, maxAgeSeconds })) {
        return {
          available: false,
          condition: "watch-stale",
          blockers: [
            {
              kind: "condition",
              value: "watch-stale",
              detail:
                `provider ${providerName}: watch target ${providerName} observed ` +
                `${ageSeconds}s ago (max ${maxAgeSeconds}s)`,
            },
          ],
          source: `provider ${providerName}: watch target ${providerName} stale`,
          recordedUnavailable: true,
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
};

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
    // The lane park fields ride the same collector pass (GH-294 F-3, NFR-8):
    // the producer performs its one bounded park read inside the collection,
    // never as a second pass of its own.
    readLaneParks: (nowMs): readonly StatusLanePark[] => laneParkViews(options.store, nowMs),
    readLocalContext: (): StatusLocalContextRead =>
      readLocalPmContext({ path: options.localContext.path, fs: options.localContext.fs }),
    readBlockers: (): StatusBlockersRead => {
      const read = readBlockerLedger(options.store);
      return read.ok
        ? { ok: true, value: read.value }
        : { ok: false, reason: "state-unreadable", failureCode: read.error.code };
    },
    readSpend: (): SpendDigestSection => spendDigestFor(options),
    readCredentialPrerequisite: () => (admitted ? options.credentialReference : undefined),
    ...(options.readOwnerHold === undefined ? {} : { readOwnerHold: options.readOwnerHold }),
    ...(options.readProjectGroup === undefined
      ? {}
      : { readProjectGroup: options.readProjectGroup }),
    nowIso: options.clock.nowIso,
    nowMs: options.clock.nowMs,
  };
};

/**
 * The `QueueParkRecord -> StatusLanePark` producer (GH-294 F-3, NFR-8, DM-4;
 * AMB-P3): ONE bounded park read per collector pass, folded to the latest
 * record per ref, filtered to the open episodes — causes `peak-window` /
 * `owner-hold` in the `parked` recovery state — with read-time expiry applied
 * (an expired peak-window park is no longer an open episode) and the values
 * carried verbatim. An `owner-hold` park's `until` is the declared classified
 * absence and stays absent. The digest fold bounds the rendered set by
 * `STATUS_MAX_LANE_PARKS`; the producer bounds its own array to the same cap.
 * An unreadable store reads as no open episodes — digest data, never a
 * command failure.
 */
const laneParkViews = (store: StateStorePort, nowMs: number): readonly StatusLanePark[] => {
  const read = readQueueParks(store);
  if (!read.ok) return [];
  const latest = new Map<string, (typeof read.records)[number]>();
  for (const record of read.records) latest.set(record.ref, record);
  const parks: StatusLanePark[] = [];
  for (const record of latest.values()) {
    if (record.cause !== "peak-window" && record.cause !== "owner-hold") continue;
    if (record.recoveryState !== "parked") continue;
    if (record.cause === "peak-window") {
      const until = record.until === undefined ? undefined : Date.parse(record.until);
      if (until === undefined || !Number.isFinite(until) || nowMs >= until) continue;
    }
    parks.push({
      ref: record.ref,
      reason: record.cause,
      ...(record.until === undefined ? {} : { until: record.until }),
      ...(record.preservation === undefined ? {} : { preservation: record.preservation }),
      ...(record.providerProfile === undefined ? {} : { providerProfile: record.providerProfile }),
    });
    if (parks.length >= STATUS_MAX_LANE_PARKS) break;
  }
  return parks;
};

/**
 * The digest's spend projection over the already-composed store seam (DM-6).
 *
 * The active change ref comes from the same local PM context the digest already
 * reads; a missing context is digest data, never a command failure. The section
 * derives from the SAME `readSpendLedger` + fold the command consumes.
 */ const spendDigestFor = (options: {
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
  /** The additive action-registry store fact (GH-287 DEC-7). */
  readonly readActionState?: () => DoctorStateStoresRead;
  /** The per-run owner-hold reader supplied by the production composition. */
  readonly readOwnerHold?: () => OwnerHoldFact;
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
    reference === undefined || reference.sourceKey.style === "command"
      ? undefined
      : reference.sourceKey.style === "environment-prefixed"
        ? `${options.environmentPrefix}${reference.sourceKey.suffix}`
        : reference.sourceKey.style === "literal"
          ? reference.sourceKey.name
          : undefined;
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
      const resolved = options.credentials.resolve(reference);
      if (resolved.ok) return { ok: true };
      // Forward the failure's projection fields beside the delivered identity
      // (DEC-14): the refusal keeps the environment variable name for the two
      // environment styles and gains the source identity for all four.
      return {
        ok: false,
        failureCode: "config.credential.missing",
        ...(envVar === undefined ? {} : { envVar }),
        ...(resolved.source === undefined ? {} : { source: resolved.source }),
        ...(resolved.reason === undefined ? {} : { reason: resolved.reason }),
        ...(resolved.remedy === undefined ? {} : { remedy: resolved.remedy }),
      };
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
      if (retro !== undefined && !retro.ok) return retro;
      const action = options.readActionState?.();
      if (action !== undefined && !action.ok) return action;
      if (retro === undefined && action === undefined) return base;
      return {
        ok: true,
        verifiedEmpty:
          base.verifiedEmpty &&
          (retro === undefined || retro.verifiedEmpty) &&
          (action === undefined || action.verifiedEmpty),
        // All three stores share the delivery ledger (the reviewed PIN-4
        // single-store decision); `base.recordCount` already includes their
        // artifacts, so adding their counts would double-count them.
        recordCount: base.recordCount,
        stores: [
          ...(base.stores ?? []),
          ...(retro?.stores ??
            (retro === undefined
              ? []
              : [
                  {
                    name: "retro-registry",
                    verdict: retro.verifiedEmpty ? ("verified-empty" as const) : ("valid" as const),
                  },
                ])),
          ...(action?.stores ??
            (action === undefined
              ? []
              : [
                  {
                    name: "action-registry",
                    verdict: action.verifiedEmpty
                      ? ("verified-empty" as const)
                      : ("valid" as const),
                  },
                ])),
        ],
      };
    },
    ...(options.readOwnerHold === undefined ? {} : { readOwnerHold: options.readOwnerHold }),
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
  /** The invoking checkout's repository key, when already resolved. */
  readonly repositoryKey?: string;
  readonly readOwnerHold?: () => BoardOwnerHold;
  /** The resolved host root for the one index read `--all`/`--project` needs. */
  readonly hostRoot?: string;
  readonly readHostIndex?: () => BoardHostIndexRead;
  readonly hostIndexPath?: () => string;
  readonly parseHostIndex?: (text: string) => BoardHostIndexDocument | undefined;
  readonly rootExists?: (root: string) => boolean;
  readonly stateLocationFor?: (projectKey: string) => string;
  readonly openStore?: (stateLocation: string) => StateStorePort;
};

const ownerAttention = (item: WorkItem): boolean =>
  STATUS_OWNER_ATTENTION_LABELS.some((label) =>
    item.labels.some((candidate) => candidate.toLowerCase() === label.toLowerCase()),
  );

const openItem = (item: WorkItem): boolean =>
  item.status.deliveryState !== "done" && item.status.deliveryState !== "canceled";

/**
 * The host-index read seam supplied by the production composition (DM-7).
 *
 * Absent in the in-process composition that resolves one checkout: the default
 * form reads no index by contract, and `--all`/`--project` then answer with the
 * invoking checkout alone.
 */
export type BoardHostIndexRead =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly text: string }
  | { readonly state: "unreadable" };

/** The parsed host-index facts the board selection consumes. */
export type BoardHostIndexDocument = {
  readonly projects: readonly {
    readonly projectKey: string;
    readonly root: string;
    readonly stateLocation: string;
  }[];
};

/** Compose the board runtime over the real tracker read and the state ledger. */
/**
 * The board's single named action-registry source (GH-287 F-6): one bounded
 * read per repository, projected as open actions with their aging state and
 * the window count/limit disclosure. Damage classifies as unavailable.
 */
type BoardActionsReadLocal =
  | { readonly ok: true; readonly facts: readonly BoardActionFact[] }
  | { readonly ok: false };

const boardActionsFrom = (store: StateStorePort, nowMs: number): BoardActionsReadLocal => {
  const read = readActionRegistry(store);
  if (!read.ok) return { ok: false };
  if (read.value.malformed.length > 0) return { ok: false };
  const snapshot = { actions: read.value.actions, closures: read.value.closures };
  const disclosures = new Map(
    windowDisclosures(actionWindowEntries(snapshot)).map((entry) => [entry.window, entry]),
  );
  const facts: BoardActionFact[] = [];
  for (const action of snapshot.actions) {
    const row = actionListEntry(action, snapshot, nowMs);
    if (row.artifactClosure !== "open") continue;
    const disclosure = disclosures.get(row.window);
    facts.push({
      actionId: row.actionId,
      owner: row.owner,
      level: row.level,
      age: row.age,
      agingState: row.agingState,
      window: row.window,
      windowOpenCount: disclosure?.openCount ?? 0,
      windowLimit: disclosure?.limit ?? ACTION_WIP_LIMIT,
    });
  }
  return { ok: true, facts };
};

export const createBoardCommandRuntime = (composition: BoardComposition): BoardCommandRuntime => {
  const instance = composition.github.instance;
  const admitted =
    instance.systemKind === "vcs" && instance.authMethod.mechanism === "credential-reference";
  const collectorCode = "status.collector.tracker.unavailable";

  const deriveRepositoryKey = (root: string): string | undefined => {
    const identity = readCheckoutIdentity({ cwd: root, io: composition.repository.io });
    if (identity.kind !== "resolved") return undefined;
    const markerRead = readProjectIdentityMarker(identity.commonDir);
    if (markerRead.state !== "present") return undefined;
    return parseProjectIdentityMarker(markerRead.text)?.projectKey;
  };

  const readTrackerFor = async (
    root: string,
    store: StateStorePort,
  ): Promise<OwnerGateCollectorRead> => {
    if (!admitted) {
      return {
        ok: false,
        collector: "tracker",
        reason: "credential-unavailable",
        code: collectorCode,
      };
    }
    const facts = readRepositoryFacts({ cwd: root, io: composition.repository.io });
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
    // The waiver join reads the TARGET repository's own ledger (F-1): a
    // non-invoking repository's recorded waivers must surface there, and a
    // numeric ref collision must never import the invoking repository's waiver.
    const waiverRead = readAllMergeWaivers(store);
    const waiverRecords = waiverRead.ok ? waiverRead.records : [];
    // Resolve per REF (not per gate id): several refs may each carry their own
    // recorded waiver, and the newest matching record wins for one ref.
    const waiverFor = (entityId: string) => {
      const numeric =
        /^[A-Za-z]+-([0-9]+)$/.exec(entityId)?.[1] ??
        (/^[0-9]+$/.test(entityId) ? entityId : undefined);
      let chosen: (typeof waiverRecords)[number] | undefined;
      for (const waiver of waiverRecords) {
        if (waiver.gateId !== "owner-gate") continue;
        const changeNumeric = /^[A-Za-z]+-([0-9]+)$/.exec(waiver.changeRef)?.[1];
        const matches =
          waiver.changeRef === entityId ||
          (changeNumeric !== undefined && numeric !== undefined && changeNumeric === numeric);
        if (!matches) continue;
        if (chosen === undefined || waiver.authorizedAt >= chosen.authorizedAt) chosen = waiver;
      }
      return chosen;
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

  const managedSet = (
    invoking: string | undefined,
  ):
    | {
        readonly ok: true;
        readonly keys: readonly string[];
        readonly entries: ReadonlyMap<
          string,
          { readonly projectKey: string; readonly root: string; readonly stateLocation: string }
        >;
      }
    | { readonly ok: false; readonly summary: string } => {
    const entries = new Map<
      string,
      { readonly projectKey: string; readonly root: string; readonly stateLocation: string }
    >();
    const keys = new Set<string>();
    const read = composition.readHostIndex?.();
    if (read !== undefined && read.state !== "absent") {
      const path =
        composition.hostIndexPath?.() ??
        `${composition.hostRoot ?? composition.repository.cwd}/host-index.json`;
      if (read.state === "unreadable") {
        return { ok: false, summary: `host index ${path} is unreadable` };
      }
      const document = composition.parseHostIndex?.(read.text);
      if (document === undefined) {
        return { ok: false, summary: `host index ${path} is unparseable` };
      }
      for (const entry of document.projects) {
        if (!(composition.rootExists?.(entry.root) ?? true)) continue;
        if (keys.has(entry.projectKey)) continue;
        keys.add(entry.projectKey);
        entries.set(entry.projectKey, entry);
      }
    }
    if (invoking !== undefined && !keys.has(invoking)) {
      keys.add(invoking);
    }
    return { ok: true, keys: [...keys].sort(), entries };
  };

  const phaseFor = (
    store: StateStorePort,
    ref: string,
  ):
    | {
        readonly ok: true;
        readonly phase: string | null;
        readonly phaseUnknownReason?: "phase-unrecorded" | "phases-complete";
      }
    | { readonly ok: false; readonly code: string } => {
    const read = readChangeTransitionsTolerant(store, ref);
    if (!read.ok) return { ok: false, code: read.error.code };
    if (!read.value.present || read.value.transitions.length === 0) {
      return { ok: true, phase: null, phaseUnknownReason: "phase-unrecorded" };
    }
    const state = foldPhaseState(ref, read.value.transitions);
    const open = Object.entries(state.phases).filter(
      ([, entry]) => (entry as { readonly completed: string | null }).completed === null,
    );
    if (open.length === 0) return { ok: true, phase: null, phaseUnknownReason: "phases-complete" };
    const latest = open.reduce((current, candidate) => {
      const currentIndex = (CANONICAL_PHASE_IDS as readonly string[]).indexOf(current[0]);
      const candidateIndex = (CANONICAL_PHASE_IDS as readonly string[]).indexOf(candidate[0]);
      return candidateIndex > currentIndex ? candidate : current;
    });
    return { ok: true, phase: latest[0] };
  };

  const repositoryStores = new Map<string, StateStorePort>();

  let resolvedSelection:
    | {
        readonly selection: string;
        readonly entries: ReadonlyMap<
          string,
          { readonly projectKey: string; readonly root: string; readonly stateLocation: string }
        >;
      }
    | undefined;

  const loadRepositoryFacts = async (repository: string): Promise<BoardRepositoryLoad> => {
    const invoking = composition.repositoryKey ?? deriveRepositoryKey(composition.repository.cwd);
    const entry =
      resolvedSelection !== undefined && resolvedSelection.selection !== "current"
        ? resolvedSelection.entries.get(repository)
        : undefined;
    const root = entry?.root ?? (repository === invoking ? composition.repository.cwd : undefined);
    if (root === undefined || !(composition.rootExists?.(root) ?? true)) {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} root is unavailable`,
      };
    }
    const stateLocation =
      entry?.stateLocation ??
      composition.stateLocationFor?.(repository) ??
      `${composition.hostRoot ?? composition.repository.cwd}/projects/${repository}`;
    let store: StateStorePort;
    try {
      store = composition.openStore?.(stateLocation) ?? composition.store;
    } catch {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} state location is unavailable`,
      };
    }
    repositoryStores.set(repository, store);
    // The board's actions surface reads the repository's own action registry
    // once (GH-287 F-6): a failed read is disclosed and fabricates no row.
    const actionFacts = boardActionsFrom(store, composition.nowMs());
    const tracker = await readTrackerFor(root, store);
    if (!tracker.ok) return { ok: false, kind: "status", code: tracker.code };

    const nowMs = composition.nowMs();
    const blockerRead = readBlockerLedger(store);
    if (!blockerRead.ok) {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} blocker ledger is unavailable`,
      };
    }
    const ranking = rankBlockerQuestions(
      blockerRead.value.questions,
      blockerRead.value.answers,
      nowMs,
    );
    const asks: BoardAskFact[] = ranking.open
      .filter((question) => question.audience === "owner")
      .map((question) => ({
        id: question.id,
        type: question.type,
        audience: "owner",
        ref: question.ref,
        lane: question.lane,
        question: question.question,
        askedAt: question.askedAt,
        age: question.age,
        owner: "owner",
      }));

    const parkRead = readQueueParks(store);
    if (!parkRead.ok) {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} park store is unavailable`,
      };
    }
    const latestPark = new Map<string, (typeof parkRead.records)[number]>();
    for (const record of parkRead.records) latestPark.set(record.ref, record);
    const parks: BoardParkedFact[] = [];
    for (const record of latestPark.values()) {
      if (record.cause !== "peak-window" && record.cause !== "owner-hold") continue;
      if (record.recoveryState !== "parked") continue;
      if (record.cause === "peak-window") {
        const until = record.until === undefined ? undefined : Date.parse(record.until);
        if (until === undefined || !Number.isFinite(until) || nowMs >= until) continue;
      }
      parks.push({
        ref: record.ref,
        reason: record.cause,
        until: record.until ?? null,
        ...(record.cause === "owner-hold" ? { untilReason: "owner-hold-no-expiry" as const } : {}),
        ...(record.preservation === undefined ? {} : { preservation: record.preservation }),
        ...(record.providerProfile === undefined
          ? {}
          : { providerProfile: record.providerProfile }),
        owner: null,
      });
    }

    const leaseRead = readActiveLeases(store, nowMs);
    if (!leaseRead.ok) {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} lane ledger is unavailable`,
      };
    }
    const failedRefs = new Set<string>();
    const daemonRead = readDaemonLanes(store);
    if (!daemonRead.ok) {
      return {
        ok: false,
        kind: "board",
        code: "board.state-unavailable",
        summary: `repository ${repository} daemon lane ledger is unavailable`,
      };
    }
    for (const lane of daemonRead.records) {
      if (lane.state === "failed") failedRefs.add(lane.ref);
    }
    // Cap BEFORE phase resolution so NFR-5's "<= 1 phase read per active lane
    // (<= 20)" matches the code; the omitted count is carried to the payload.
    const laneCandidates: {
      readonly ref: string;
      readonly lease?: (typeof leaseRead.active)[number];
    }[] = [
      ...leaseRead.active.map((lease) => ({ ref: lease.ref, lease })),
      ...[...failedRefs]
        .filter((ref) => !leaseRead.active.some((lease) => lease.ref === ref))
        .map((ref) => ({ ref })),
    ].sort((left, right) => (left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0));
    const keptLanes = laneCandidates.slice(0, BOARD_MAX_LANES);
    const omittedLanes = laneCandidates.length - keptLanes.length;
    const lanes: BoardLaneFact[] = [];
    for (const candidate of keptLanes) {
      const phase = phaseFor(store, candidate.ref);
      if (!phase.ok) {
        return {
          ok: false,
          kind: "board",
          code: "board.state-unavailable",
          summary: `repository ${repository} phase history for ${candidate.ref} is unavailable`,
        };
      }
      const lease = candidate.lease;
      lanes.push({
        ref: candidate.ref,
        laneId: candidate.ref,
        state: lease === undefined || failedRefs.has(candidate.ref) ? "failed" : "delivering",
        holder: lease === undefined ? null : lease.holder,
        ...(lease === undefined ? {} : { leaseId: lease.leaseId }),
        ...(phase.phase === null
          ? {
              phase: null,
              ...(phase.phaseUnknownReason === undefined
                ? {}
                : { phaseUnknownReason: phase.phaseUnknownReason }),
            }
          : { phase: phase.phase }),
      });
    }

    let records: readonly OwnerGateSlaDecisionRecord[] = [];
    if (
      boardNeedsDecisionHistory({
        gates: tracker.gates,
        asks,
        policy: OWNER_GATE_SLA_POLICY,
        nowMs,
      })
    ) {
      const decisions = readOwnerGateSlaDecisions(store);
      if (!decisions.ok) {
        return { ok: false, kind: decisions.error.kind, code: decisions.error.code };
      }
      records = decisions.value.records;
    }
    return {
      ok: true,
      facts: {
        key: repository,
        gates: tracker.gates,
        lanes,
        ...(omittedLanes > 0 ? { omittedLanes } : {}),
        asks,
        actions: actionFacts.ok ? actionFacts.facts : [],
        actionsSource: actionFacts.ok ? "available" : "unavailable",
        parks,
        decisions: records,
      },
    };
  };

  return {
    resolve: (invocation) => {
      const invoking = composition.repositoryKey ?? deriveRepositoryKey(composition.repository.cwd);
      const projectFlag =
        typeof invocation.flags["--project"] === "string"
          ? (invocation.flags["--project"] as string)
          : undefined;
      const all = invocation.flags["--all"] === true;
      if (!all && projectFlag === undefined) {
        // The default form performs ZERO host-index reads and uses only the
        // invoking checkout; an underivable identity resolves `unbound` (C-15).
        if (invoking === undefined) {
          return {
            ok: true,
            scope: "unbound",
            selection: "current",
            repositories: [],
            omittedRepositories: 0,
          };
        }
        return {
          ok: true,
          scope: "repository",
          selection: "current",
          repositories: [invoking],
          omittedRepositories: 0,
        };
      }
      const managed = managedSet(invoking);
      if (!managed.ok) {
        return {
          ok: false,
          kind: "board",
          code: "board.state-unavailable",
          summary: managed.summary,
        };
      }
      resolvedSelection = { selection: all ? "all" : "project", entries: managed.entries };
      if (projectFlag !== undefined) {
        if (!managed.entries.has(projectFlag) && projectFlag !== invoking) {
          return {
            ok: false,
            kind: "board",
            code: "board.repository-unknown",
            summary: `repository ${projectFlag} is not in the managed set`,
          };
        }
        return {
          ok: true,
          scope: "repository",
          selection: "project",
          repositories: [projectFlag],
          omittedRepositories: 0,
        };
      }
      const sorted = [...managed.keys];
      let retained = sorted;
      if (sorted.length > BOARD_MAX_REPOSITORIES) {
        const invokingIncluded =
          invoking !== undefined && sorted.slice(0, BOARD_MAX_REPOSITORIES).includes(invoking);
        if (invokingIncluded || invoking === undefined) {
          retained = sorted.slice(0, BOARD_MAX_REPOSITORIES);
        } else {
          retained = [...sorted.slice(0, BOARD_MAX_REPOSITORIES - 1), invoking].sort(
            (left, right) => (left < right ? -1 : left > right ? 1 : 0),
          );
        }
      }
      return {
        ok: true,
        scope: "repository",
        selection: "all",
        repositories: retained,
        omittedRepositories: sorted.length - retained.length,
      };
    },
    loadRepository: loadRepositoryFacts,
    appendDecision: (repository, decision) =>
      appendOwnerGateSlaDecision(repositoryStores.get(repository) ?? composition.store, {
        decision,
        fenceToken: composition.newFenceToken(),
      }),
    ownerHold: () => composition.readOwnerHold?.() ?? { active: false },
    policy: OWNER_GATE_SLA_POLICY,
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

/**
 * The coordinator supervision composition seams (GH-241 F-1, F-8): the state
 * store, injected clock and id/fence factories, the resolved coordinator
 * settings, the process port with its declared capabilities, the harness
 * session facts/effects, and the injected cycle driver. Nothing here reads an
 * ambient clock, spawns a real process, or registers a daemon command.
 */
export type CoordinatorComposition = Omit<CoordinatorSupervisorPorts, "coordinatorId"> & {
  /** The coordinator identity; defaults to the single stored coordinator. */
  readonly coordinatorId?: string;
};

/** Compose the coordinator family over the injected seams. */
export const createCoordinatorCommandRuntime = (
  composition: CoordinatorComposition,
): CoordinatorCommandRuntime =>
  createCoordinatorSupervisor({
    ...composition,
    coordinatorId: composition.coordinatorId ?? "coordinator-main",
  });

/**
 * The loop supervision composition seams (GH-348 F-1, F-2, F-6): the injected
 * ledger port, clock and id/fence factories, the resolved coordinator settings
 * (consumed, not added), the process port with its declared capabilities, the
 * session-effect port, the bounded log sink, and the injected cycle driver. The
 * loop is a profile over the delivered engine under the distinct identity
 * `loop-main`; nothing here reads an ambient clock or spawns a process.
 */
export type LoopComposition = Omit<LoopSupervisorPorts, "loopId"> & {
  /** The supervisor identity; defaults to the single declared loop identity. */
  readonly loopId?: string;
};

/** Compose the loop family over the injected seams. */
export const createLoopCommandRuntime = (composition: LoopComposition): LoopCommandRuntime =>
  createLoopSupervisor({
    ...composition,
    loopId: composition.loopId ?? "loop-main",
  });

/**
 * Build the loop's ledger port from the delivered store: the two loop record
 * kinds plus the coordinator record kinds the cycle reuses under the loop
 * identity. Every append rides the delivered NON-CLAIM per-append fence path.
 */
export const createLoopLedgerPort = (
  store: StateStorePort,
  loopId: string,
  newFenceToken: () => string,
): LoopLedgerPort => ({
  read: () => {
    const raw = store.readRecords();
    // ONE verified read for both halves: the cached view folds the coordinator
    // and loop record sets from the same snapshot (NFR-11).
    const cached: StateStorePort = { ...store, readRecords: () => raw };
    return {
      loop: readLoopRecords(cached, loopId),
      coordinator: readCoordinatorRecords(cached, loopId),
    };
  },
  acquireFence: (token) => store.acquireFence(token),
  releaseFence: (handle) => {
    store.releaseFence(handle);
  },
  fenceStatus: () => {
    const status = store.fenceStatus();
    return { held: status.held, stale: status.stale };
  },
  recoverFence: (token) => store.recoverFence(token).ok,
  appendSession: (record) => appendLoopSession(store, newFenceToken(), record),
  appendStuck: (record) => {
    const appended = appendCoordinatorStuck(store, newFenceToken(), record);
    return appended.ok
      ? { ok: true, appended: appended.appended }
      : { ok: false, code: appended.code };
  },
  appendStop: (record) => {
    const appended = appendLoopStop(store, newFenceToken(), record);
    return appended.ok
      ? { ok: true, appended: appended.appended }
      : { ok: false, code: appended.code };
  },
  appendRestart: (record) => {
    const appended = appendCoordinatorRestart(store, newFenceToken(), record);
    return appended.ok
      ? { ok: true, appended: appended.appended }
      : { ok: false, code: appended.code };
  },
  lastRestartSequence: () => {
    const read = store.readRecords();
    if (!read.ok) return null;
    for (let index = read.value.records.length - 1; index >= 0; index -= 1) {
      const entry = read.value.records[index];
      if (entry?.kind === "coordinator.restart" && entry.key.endsWith(`:${loopId}`)) {
        return entry.sequence;
      }
    }
    return null;
  },
  appendFence: (record, held) => {
    if (held !== undefined) {
      const appended = store.append(held, {
        kind: "coordinator.fence",
        recordKey: `coordinator.fence:${loopId}`,
        payload: record,
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    }
    const appended = appendCoordinatorFence(store, newFenceToken(), record);
    return appended.ok ? { ok: true } : { ok: false, code: appended.code };
  },
});

/**
 * The steer composition seams (GH-298 F-1..F-8): the shared state store,
 * injected time/id/fence factories, the derived invoking-checkout origin, the
 * delivered phase fold, and the delivered open-question view with its
 * PDR-0003 join facts. Everything variable arrives injected; the runtime reads
 * no ambient clock, git, tracker, or network source.
 */
export type SteerComposition = {
  readonly store: StateStorePort;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newMessageSuffix?: () => string;
  readonly newFenceToken: () => string;
  readonly origin: () => SteerOrigin;
  readonly readPhaseFold: (changeRef: string | null) => StateResult<SteerPhaseFoldView>;
  readonly readAsks: () => StateResult<SteerAskSource>;
};

/** Compose the steer runtime over the real state ledger and delivered reads. */
export const createSteerCommandRuntime = (
  composition: SteerComposition,
  brand: BrandIdentity,
  secrets: readonly string[],
): SteerCommandRuntime => ({
  brand,
  clock: composition.clock,
  newMessageSuffix: composition.newMessageSuffix ?? (() => randomUUID()),
  newFenceToken: composition.newFenceToken,
  origin: composition.origin,
  readQueue: () => readSteeringQueue(composition.store),
  appendMessage: (record, current) =>
    appendSteeringMessage(composition.store, {
      record,
      fenceToken: composition.newFenceToken(),
      ...(current === undefined ? {} : { current }),
    }),
  appendOutcomes: (records, current) =>
    appendSteeringOutcomes(composition.store, {
      records,
      fenceToken: composition.newFenceToken(),
      ...(current === undefined ? {} : { current }),
    }),
  appendCompletion: (record, current) =>
    appendSteeringCompletion(composition.store, {
      record,
      fenceToken: composition.newFenceToken(),
      ...(current === undefined ? {} : { current }),
    }),
  readPhaseFold: composition.readPhaseFold,
  readAsks: composition.readAsks,
  secrets,
});

export type ConfigProgramOptions = {
  readonly workingName: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
  /**
   * The prior identity's configuration-directory name (GH-320 F-3). The config
   * program resolves through the fallback-aware acquisition; the test-only
   * composition helper never receives it.
   */
  readonly priorConfigurationDirectoryName?: string;
  /** A composition-notice sink; lines travel stderr, never a payload. */
  readonly onNotice?: (line: string) => void;
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
  readonly coordinator?: CoordinatorComposition;
  readonly loop?: LoopComposition;
  readonly retro?: RetroCompositionOptions;
  readonly ceremony?: CeremonyCompositionOptions;
  readonly steer?: SteerComposition;
  readonly supervise?: SuperviseCommandRuntime;
  readonly spend?: SpendCompositionOptions;
  readonly metrics?: MetricsCompositionOptions;
  readonly projects?: ProjectsCommandRuntime;
  readonly repos?: ReposCommandRuntime;
  readonly events?: EventsCommandRuntime;
};

export type ConfigProgramResult =
  | {
      readonly ok: true;
      readonly brand: BrandIdentity;
      readonly program: CommandProgram;
      readonly secrets: SecretRegistry;
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

/** The ceremony family composition seam (GH-296 F-1, F-6, F-7). */
/** The open recorded actions one registry read exposes (GH-287 F-7). */
const openRegistryActions = (store: StateStorePort) => {
  const read = readActionRegistry(store);
  if (!read.ok || read.value.malformed.length > 0) return [];
  const snapshot = { actions: read.value.actions, closures: read.value.closures };
  return snapshot.actions.filter((action) => actionArtifactPlaneOpen(action.actionId, snapshot));
};

/** The registry follow-through reader the retro report/collect folds consume. */
const registryFollowThroughFor = (
  store: StateStorePort,
  level: import("@delivery-os/core/contracts").RetroLevelName,
): readonly import("@delivery-os/core/contracts").RetroFollowThroughRegistryEntry[] =>
  openRegistryActions(store)
    .filter((action) => action.level === level)
    .map((action) => ({ action: action.actionId, artifactRef: action.verificationArtifact }));

/** The ceremony retro-evidence facts the registry produces (GH-287 F-7). */
const ceremonyRegistryFacts = (
  store: StateStorePort,
  verify: (artifactRef: string) => ActionArtifactVerdict,
): { readonly retroRegistry?: unknown } => {
  const actions = openRegistryActions(store).map((action) => ({
    actionId: action.actionId,
    verificationArtifact: action.verificationArtifact,
  }));
  if (actions.length === 0) return {};
  return retroActionCeremonyFacts(actions, verify);
};

export type CeremonyCompositionOptions = {
  readonly store: StateStorePort;
  readonly stateDirectory: string;
  readonly changesDirectory: string;
  readonly workspaceId: string;
  readonly clock: { readonly nowMs: () => number };
  readonly newRunId: () => string;
  readonly newFenceToken: () => string;
  readonly gitRoot: string;
  readonly configurationDirectoryName: string;
  readonly repositoryId: string;
  /**
   * An injected tier context; when absent, the runtime resolves the invoking
   * checkout's delivery context from the recorded lifecycle transitions and
   * the change's committed pm-notes and plan documents (F-7, DM-7).
   */
  readonly tierContext?: CeremonyTierInput;
  /**
   * The artifact oracle the registry follow-through reads (GH-287 F-7). Absent
   * means every artifact is unresolvable, so verdicts degrade rather than
   * fabricate.
   */
  readonly verifyActionArtifact?: (artifactRef: string) => ActionArtifactVerdict;
};

const ceremonyFailure = (error: CeremonyEngineFailure): CeremonyCommandResult => ({
  ok: false,
  error: {
    code: error.code,
    summary: error.summary,
    ...(error.field === undefined ? {} : { field: error.field }),
  },
});

const parseCeremonyNote = (
  path: string,
): { readonly note: CeremonyNote } | { readonly error: CeremonyEngineFailure } => {
  try {
    // The note read is bounded in bytes before any parse (DM-2, §21): the
    // bound is the configuration parser class's declared size limit.
    const size = statSync(path).size;
    if (size > CEREMONY_NOTE_MAX_BYTES) {
      return {
        error: {
          code: "ceremony.note-invalid",
          summary: `the ceremony note at "${path}" is ${String(size)} bytes; the declared bound is ${String(CEREMONY_NOTE_MAX_BYTES)}`,
          field: "document",
        },
      };
    }
    return { note: parseCeremonyNoteText(readFileSync(path, "utf8")) as CeremonyNote };
  } catch {
    return {
      error: {
        code: "ceremony.note-invalid",
        summary: `the ceremony note at "${path}" cannot be read or parsed`,
        field: "document",
      },
    };
  }
};

/** Compose the ceremony runtime over the delivered state, artifact and file seams. */
export const createCeremonyCommandRuntime = (
  options: CeremonyCompositionOptions,
): CeremonyCommandRuntime => {
  const registryRead = () =>
    buildCeremonyRegistry({
      document: readCeremonyDeclarationDocument({
        gitRoot: options.gitRoot,
        configurationDirectoryName: options.configurationDirectoryName,
      }),
    });
  const memoryDirectory = `${options.gitRoot}/.ai/memory/ceremony`;
  const memory: CeremonyMemoryPort = {
    readNote(scopeKey) {
      const path = `${memoryDirectory}/${encodeURIComponent(scopeKey)}.md`;
      if (!existsSync(path)) return { state: "absent" };
      try {
        return { state: "present", body: readFileSync(path, "utf8") };
      } catch {
        return { state: "absent" };
      }
    },
    writeNote(input) {
      try {
        mkdirSync(memoryDirectory, { recursive: true });
        const path = `${memoryDirectory}/${encodeURIComponent(input.scopeKey)}.md`;
        if (input.append) appendFileSync(path, `\n${input.body}`, "utf8");
        else writeFileSync(path, input.body, "utf8");
        return { ok: true };
      } catch {
        return { ok: false, detail: "the memory slot is not writable" };
      }
    },
  };
  const decisionFs = nodeDecisionRecordFileSystem();
  type MirrorTargetEntry = ReturnType<typeof affectedRepositoryTargets>[number];
  let mirrorContext:
    | {
        readonly register: ReturnType<typeof readDecisionRegister>;
        readonly targets: readonly MirrorTargetEntry[];
        readonly roots: ReadonlyMap<string, string>;
      }
    | undefined;
  const mirrorTargetsOf = () => {
    if (mirrorContext !== undefined) return mirrorContext;
    const config = readProjectGroupsConfig({
      gitRoot: options.gitRoot,
      configurationDirectoryName: options.configurationDirectoryName,
    });
    const targets =
      config.state === "document"
        ? affectedRepositoryTargets(config.value, options.repositoryId)
        : [];
    const roots = new Map<string, string>();
    for (const target of targets) {
      if (target.root !== undefined) roots.set(target.target, target.root);
    }
    mirrorContext = {
      register: readDecisionRegister({ gitRoot: options.gitRoot, fs: decisionFs }),
      targets,
      roots,
    };
    return mirrorContext;
  };
  const mirror: CeremonyMirrorPort = {
    inspect(target) {
      const context = mirrorTargetsOf();
      const root = context.roots.get(target);
      if (root === undefined || !decisionFs.pathExists(root) || !decisionFs.isDirectory(root)) {
        return { state: "absent", mirrorSet: [], sourceSet: [] };
      }
      // A declared checkout is clean when it is present; its mirrored record
      // set is what the equality check compares in both directions (NFR-12).
      return {
        state: "clean",
        mirrorSet: decisionRecordIds(`${root.replace(/[\\/]+$/, "")}/doc/decisions`, decisionFs),
        sourceSet: [],
      };
    },
    apply(target, records) {
      const context = mirrorTargetsOf();
      const root = context.roots.get(target);
      if (root === undefined) {
        return { ok: false, detail: `target "${target}" declares no local checkout root` };
      }
      return copyDecisionRecords({
        targetRoot: root,
        ids: records,
        sourceDirectory: context.register.directory,
        fs: decisionFs,
      });
    },
  };
  const envFor = (origin: "built-in" | "project", note: CeremonyNote | undefined) => {
    let retrospectiveEvidence: readonly string[] | undefined;
    const retroEvidenceRefs = (): readonly string[] => {
      if (retrospectiveEvidence !== undefined) return retrospectiveEvidence;
      const read = readRetroRegistry(options.store);
      const refs = new Set<string>();
      if (read.ok) {
        for (const run of readRetroRuns(read.value)) {
          refs.add(`retro.run:${run.runId}`);
          for (const check of run.truth.checks) {
            for (const ref of check.evidenceRefs) refs.add(ref);
          }
        }
      }
      retrospectiveEvidence = [...refs].sort();
      return retrospectiveEvidence;
    };
    const input = (source: CeremonyInputSource): CeremonyInputRead => {
      if (source === "owner-note" && note !== undefined) {
        // The note's declared items are the assessment's item source. A fact
        // may carry its own evidence reference; the citation is never
        // synthesised, and the assessment grants `covered` only when it
        // resolves in the delivered evidence (AC-F3-4).
        return {
          state: "present",
          facts: {
            items: (note.facts ?? []).map((fact) =>
              typeof fact === "string"
                ? { text: fact }
                : {
                    text: fact.text,
                    ...(fact.evidenceRef === undefined ? {} : { evidenceRef: fact.evidenceRef }),
                  },
            ),
          },
        };
      }
      if (source === "retro-evidence" || source === "retro-runs") {
        // The delivered evidence is the ledger's recorded retro runs: their
        // truth-check evidence references are what a follow-through verdict may
        // cite. The supplied note's own citations are never echoed back as
        // evidence (AC-F9-3).
        const registryFacts = ceremonyRegistryFacts(
          options.store,
          options.verifyActionArtifact ?? (() => "unresolvable"),
        );
        return {
          state: "present",
          facts: { evidenceRefs: [...retroEvidenceRefs()], ...registryFacts },
        };
      }
      if (source === "affected-repositories") {
        // The declared affected-repository set is the committed projects
        // configuration's member identities, minus the invoking repository
        // (F-3, NFR-12). Absent configuration is a declared degradation, never
        // an invented target set.
        const context = mirrorTargetsOf();
        if (context.targets.length === 0) {
          return {
            state: "unavailable",
            reason: "no affected repository is declared in the committed projects configuration",
          };
        }
        return {
          state: "present",
          facts: { targets: context.targets.map((target) => target.target) },
        };
      }
      if (source === "decision-register") {
        // The register set is the invoking repository's committed decision
        // records; every declared target mirrors the same register set (F-3).
        const context = mirrorTargetsOf();
        if (context.register.state !== "present") {
          return {
            state: "unavailable",
            reason: "the decision register directory doc/decisions is absent",
          };
        }
        const repositories: Record<string, readonly string[]> = {};
        for (const target of context.targets) repositories[target.target] = context.register.ids;
        return { state: "present", facts: { repositories } };
      }
      return {
        state: "unavailable",
        reason: `collector "${source}" is not composed for this invocation`,
      };
    };
    return {
      clock: options.clock,
      ids: { nextRunId: options.newRunId },
      input,
      artifacts: createCeremonyArtifactStore({
        stateDirectory: options.stateDirectory,
        workspaceId: options.workspaceId,
      }),
      records: createCeremonyRecordPort(options.store, options.newFenceToken()),
      memory,
      mirror,
      repositoryId: options.repositoryId,
      origin,
    } as const;
  };
  /**
   * Read the stored note back for a resume and re-validate it against the
   * note contract (DM-2): a stored body that merely parses but no longer
   * satisfies the schema refuses the resume with the field named, rather than
   * entering the agenda as an unvalidated document.
   */
  const noteFor = (
    declaration: CeremonyDeclaration,
    scopeKey: string,
  ): { readonly note: CeremonyNote } | { readonly error: CeremonyEngineFailure } | undefined => {
    const body = memory.readNote(scopeKey);
    if (body.state === "absent") return undefined;
    let note: CeremonyNote;
    try {
      note = JSON.parse(body.body) as CeremonyNote;
    } catch {
      return {
        error: {
          code: "ceremony.note-invalid",
          summary: "the stored ceremony note cannot be parsed",
          field: "document",
        },
      };
    }
    const failure = validateCeremonyNoteForDeclaration(declaration, note);
    if (failure !== undefined) {
      return {
        error: {
          code: failure.code,
          summary: `the stored ceremony note fails read-back validation: ${failure.summary}`,
          ...(failure.field === undefined ? {} : { field: failure.field }),
        },
      };
    }
    return { note };
  };
  /**
   * Select the checkout's delivery change from the recorded lifecycle
   * transitions: the change whose latest recorded transition timestamp is the
   * newest wins; ties break on the lexicographically greatest ref. Deterministic
   * over the recorded truth, with no file crawling.
   */
  const selectDeliveryChangeRef = (
    transitions: readonly CeremonyLifecycleTransition[],
  ): string | undefined => {
    let best: { ref: string; timestamp: string } | undefined;
    for (const entry of transitions) {
      if (
        best === undefined ||
        entry.timestamp > best.timestamp ||
        (entry.timestamp === best.timestamp && entry.changeRef > best.ref)
      ) {
        best = { ref: entry.changeRef, timestamp: entry.timestamp };
      }
    }
    return best?.ref;
  };

  /** Evaluate the tier verdict over one verified state partition (F-7, DM-7). */
  const tierFromState = (
    state: CeremonyStatePartition | undefined,
  ): CeremonyTierVerdict | undefined => {
    if (options.tierContext !== undefined) return evaluateCeremonyTier(options.tierContext);
    if (state === undefined) return undefined;
    const changeRef = selectDeliveryChangeRef(state.transitions);
    if (changeRef === undefined) return undefined;
    const files = readCeremonyTierContextFiles({
      changeRef,
      changesDirectory: options.changesDirectory,
      fs: nodeCeremonyTierContextFileSystem(),
    });
    const evidence = ceremonyTierEvidenceFromLifecycle({
      transitions: state.transitions
        .filter((entry) => entry.changeRef === changeRef)
        .map((entry) => ({
          phaseId: entry.phaseId,
          operation: entry.operation,
          ...(entry.reason === undefined ? {} : { reason: entry.reason }),
        })),
      ownerEscalation: files.ownerEscalation,
    });
    return evaluateCeremonyTier({
      plan: { tier: files.planTier },
      variant: files.variant,
      evidence,
    });
  };

  /** The invocation's tier verdict; one verified state read when self-resolved. */
  const tierVerdict = (): CeremonyTierVerdict | undefined => {
    if (options.tierContext !== undefined) return tierFromState(undefined);
    const ledger = readCeremonyState(options.store);
    return tierFromState(ledger.ok ? ledger.value : undefined);
  };
  return {
    list: async () => {
      const built = registryRead();
      if (!built.ok) return { ok: false, error: built.error };
      // One verified state read partitions runs, steps, and the recorded
      // lifecycle transitions the tier evidence maps (NFR-11: list reads at
      // most two verified state reads). The local is named `ledger` so no
      // property chain carries the reserved `state.` code namespace.
      const ledger = readCeremonyState(options.store);
      const usable =
        ledger.ok && ledger.value.verdict !== "torn" && ledger.value.verdict !== "unknown";
      const runs = usable ? ledger.value.runs : [];
      const stepsByRun = new Map<string, CeremonyStepRecord[]>();
      if (usable) {
        for (const step of ledger.value.steps) {
          const bucket = stepsByRun.get(step.runId) ?? [];
          bucket.push(step);
          stepsByRun.set(step.runId, bucket);
        }
      }
      const verdict = tierFromState(ledger.ok ? ledger.value : undefined);
      const ceremonies = built.registry.entries.map((entry) => {
        const own = runs
          .filter((run) => run.ceremonyId === entry.declaration.id)
          .sort((left, right) => left.startedAtMs - right.startedAtMs);
        const last = own[own.length - 1];
        let lastRun: { runId: string; verdict: string; startedAtMs: number } | undefined;
        if (last !== undefined) {
          const steps = stepsByRun.get(last.runId) ?? [];
          lastRun = {
            runId: last.runId,
            verdict: foldCeremonyRunVerdict(steps),
            startedAtMs: last.startedAtMs,
          };
        }
        return {
          id: entry.declaration.id,
          origin: entry.origin,
          tiers: entry.declaration.tiers,
          triggers: entry.declaration.triggers.map((trigger) =>
            trigger.kind === "schedule" ? `schedule:${trigger.cadence}` : `event:${trigger.event}`,
          ),
          catchUp: entry.declaration.catchUp.mode,
          ...(verdict === undefined
            ? {}
            : { obligated: entry.declaration.tiers.includes(verdict.effectiveTier) }),
          ...(lastRun === undefined ? {} : { lastRun }),
        };
      });
      return {
        ok: true,
        data: {
          ceremonies,
          ...(verdict === undefined ? {} : { tier: verdict }),
        },
      };
    },
    run: async (request) => {
      const built = registryRead();
      if (!built.ok) return { ok: false, error: built.error };
      const entry = ceremonyRegistryEntry(built.registry, request.name);
      if (entry === undefined) {
        return {
          ok: false,
          error: {
            code: "input.value.rejected",
            summary: `ceremony "${request.name}" is not declared; declared: ${ceremonyRegistryIds(built.registry).join(", ")}`,
            field: "name",
          },
        };
      }
      const parsed =
        request.notePath === undefined ? undefined : parseCeremonyNote(request.notePath);
      if (parsed !== undefined && "error" in parsed) return { ok: false, error: parsed.error };
      const note = parsed?.note;
      // An explicit run is never tier-gated (AC-F7-5); the verdict only rides
      // the record so the run carries the tier facts it consumed (DM-3, DM-7).
      const verdict = tierVerdict();
      const run = runCeremony({
        declaration: entry.declaration,
        env: envFor(entry.origin, note),
        noteSupplied: note !== undefined,
        ...(note === undefined ? {} : { note }),
        ...(request.window === undefined ? {} : { window: request.window }),
        ...(verdict === undefined ? {} : { tier: verdict }),
        apply: request.apply,
      });
      return run.ok ? { ok: true, data: run.data } : { ok: false, error: run.error };
    },
    resume: async (request) => {
      const built = registryRead();
      if (!built.ok) return { ok: false, error: built.error };
      const runs = readCeremonyRuns(options.store);
      if (!runs.ok) {
        return ceremonyFailure({
          code: runs.error.code,
          summary: "ceremony records are unreadable",
        });
      }
      const run = runs.value.records.find((candidate) => candidate.runId === request.runId);
      if (run === undefined) {
        return {
          ok: false,
          error: {
            code: "input.value.rejected",
            summary: `no ceremony run "${request.runId}" is recorded`,
            field: "runId",
          },
        };
      }
      const entry = ceremonyRegistryEntry(built.registry, run.ceremonyId);
      if (entry === undefined) {
        return {
          ok: false,
          error: {
            code: "input.value.rejected",
            summary: `ceremony "${run.ceremonyId}" is no longer declared; history stays readable`,
            field: "runId",
          },
        };
      }
      const noteResult = noteFor(entry.declaration, run.scopeKey.value);
      if (noteResult !== undefined && "error" in noteResult) {
        return { ok: false, error: noteResult.error };
      }
      const note = noteResult?.note;
      const resumed = resumeCeremony({
        runId: request.runId,
        declaration: entry.declaration,
        env: envFor(entry.origin, note),
        apply: request.apply,
        ...(note === undefined ? {} : { note }),
      });
      return resumed.ok ? { ok: true, data: resumed.data } : { ok: false, error: resumed.error };
    },
    catchUp: async (request) => {
      const built = registryRead();
      if (!built.ok) return { ok: false, error: built.error };
      if (
        request.name !== undefined &&
        ceremonyRegistryEntry(built.registry, request.name) === undefined
      ) {
        return {
          ok: false,
          error: {
            code: "input.value.rejected",
            summary: `ceremony "${request.name}" is not declared; declared: ${ceremonyRegistryIds(built.registry).join(", ")}`,
            field: "name",
          },
        };
      }
      const entries =
        request.name === undefined
          ? built.registry.entries
          : built.registry.entries.filter((entry) => entry.declaration.id === request.name);
      // Tiered intake governs automated and catch-up intake (F-7, AC-F7-5):
      // only declarations whose declared tiers include the effective tier carry
      // an obligation. An explicit `ceremony run` is never gated.
      const verdict = tierVerdict();
      const eligible =
        verdict === undefined
          ? entries
          : entries.filter(
              (entry) =>
                ceremonyTierIntake(
                  [{ id: entry.declaration.id, tiers: entry.declaration.tiers }],
                  verdict,
                )[0]?.obligated === true,
            );
      const targets = eligible.map((entry) => ({
        declaration: entry.declaration,
        scopeKey:
          catchUpScopeKey({ declaration: entry.declaration, repositoryId: options.repositoryId }) ??
          "",
        origin: entry.origin,
      }));
      const report = catchUpCeremonies({
        targets,
        env: envFor("built-in", undefined),
        nowMs: options.clock.nowMs(),
        apply: false,
        ...(verdict === undefined ? {} : { tier: verdict }),
      });
      return report.ok ? { ok: true, data: report.data } : { ok: false, error: report.error };
    },
  };
};

/** Deep-merge plain objects; the proposal is validated over the shipped defaults. */
const isConfigRecord = (value: unknown): value is Record<string, ConfigValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergePlain = (
  base: Readonly<Record<string, ConfigValue>>,
  overlay: Readonly<Record<string, ConfigValue>>,
): Record<string, ConfigValue> => {
  const merged: Record<string, ConfigValue> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = merged[key];
    merged[key] =
      isConfigRecord(value) && isConfigRecord(current) ? mergePlain(current, value) : value;
  }
  return merged;
};

/**
 * Validate a migration proposal before it is printed or written (GH-350 F-6,
 * DM-7). The document is validated as one configuration **layer** — the exact
 * partial view the delivered resolver applies to every supplied source before
 * merging (F-3) — and its provider branch is then checked by the delivered
 * provider validator over the shipped defaults it overrides, so an entry's
 * `class` and a quota's endpoint/credential reference come from the defaults
 * rather than from an invented value.
 */
const validateProviderMigrateProposal = (
  yaml: string,
  catalog: ConfigCatalog,
): { readonly ok: true } | { readonly ok: false; readonly detail: string } => {
  const parsed = parseConfigYaml(yaml, "project-committed", "migration proposal");
  if (!parsed.ok) return { ok: false, detail: "the proposal is not a parseable document" };
  const values: Record<string, unknown> = { ...parsed.facts.values };
  const schemaReference = values.$schema;
  if (schemaReference !== undefined && typeof schemaReference !== "string") {
    return { ok: false, detail: "the schema pointer is not a string" };
  }
  delete values.$schema;
  if (!compileTrustedSchema(catalog, true)(values)) {
    return { ok: false, detail: "the proposal does not satisfy the configuration schema" };
  }
  const overlay = isConfigRecord(values.provider) ? values.provider : {};
  const defaults = isConfigRecord(PRODUCTION_DEFAULTS.provider) ? PRODUCTION_DEFAULTS.provider : {};
  const validated = parseAndValidateProviderConfiguration({
    provider: mergePlain(defaults, overlay),
  });
  if (!validated.ok) return { ok: false, detail: validated.error.detail };
  return { ok: true };
};

/** Compose a frozen brand, acquired sources, legacy facts and the packed defaults
 * manifest into one config command program. Brand resolution happens before any
 * filesystem or root discovery.
 */
export const createConfigProgram = (options: ConfigProgramOptions): ConfigProgramResult => {
  const resolveBrand = options.resolveBrand ?? resolveBrandIdentity;
  // The prefix is derived from the declared working name by the default resolver;
  // an injected resolver is the one identity call (the frozen-branding spy).
  const prefixIdentity = resolveBrandIdentity({ workingName: options.workingName });
  const overrideResolution = prefixIdentity.ok
    ? resolveWorkingNameOverride({
        environment: options.environment,
        environmentPrefix: prefixIdentity.value.environmentPrefix,
      })
    : undefined;
  if (overrideResolution?.channel === "prior" || overrideResolution?.channel === "pre-freeze") {
    options.onNotice?.(
      renderPriorIdentityNotice({
        reason: "override-read",
        priorLocation:
          overrideResolution.channel === "prior"
            ? overrideResolution.priorVariable
            : overrideResolution.preFreezeVariable,
        currentLocation: overrideResolution.currentVariable,
      }),
    );
  }
  const branded =
    overrideResolution?.override === undefined
      ? resolveBrand({ workingName: options.workingName })
      : resolveBrand({ workingName: options.workingName, override: overrideResolution.override });
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
    catalogEnvironmentNames: configEnvironmentNames(catalog, brand.environmentPrefix),
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
  const secrets = createSecretRegistry(registerEdgeSecrets(initialLegacy.environment, secretKeys));

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
      ...(options.priorConfigurationDirectoryName === undefined
        ? {}
        : { priorConfigurationDirectoryName: options.priorConfigurationDirectoryName }),
      fs,
    });
    if (!acquired.ok) return acquired;
    const manifest = options.defaultPositions ?? readShippedDefaultsManifest();
    const resolved = resolveConfig({
      sources: acquired.sources,
      skipped: acquired.skipped,
      environment: neutralEnvironmentFacts(legacyFacts.environment, [
        ...(overrideResolution === undefined
          ? []
          : [
              overrideResolution.currentVariable,
              overrideResolution.priorVariable,
              overrideResolution.preFreezeVariable,
            ]),
        selectorName,
      ]),
      environmentPrefix: brand.environmentPrefix,
      excludedEnvironmentNames: [
        ...(overrideResolution === undefined
          ? []
          : [
              overrideResolution.currentVariable,
              overrideResolution.priorVariable,
              overrideResolution.preFreezeVariable,
            ]),
        selectorName,
      ],
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
    const engine = createProviderEngine({
      ...provider,
      ...(provider.spendTotals === undefined
        ? { spendTotals: createProviderSpendTotalsPort(provider.stateStore) }
        : {}),
    });
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
        // Validate every zone the selection can probe before probing: an
        // unresolvable declared zone refuses by name instead of reading as UTC.
        const probeNames = [
          ...new Set(
            Object.values(profileParsed.config.profiles).flatMap((profile) => profile.providers),
          ),
        ];
        const unknownZone = unknownProviderPeakZone(
          providerParsed.config.entries,
          probeNames,
          provider.zoneFactsFor ?? providerZoneFactsFor,
        );
        if (unknownZone !== undefined) return zoneUnknownRefusal(unknownZone);
        const nowMs = provider.clock.nowMs();
        const probe = createResolvedProviderProbe(
          providerParsed.config.entries,
          nowMs,
          provider.zoneFactsFor ?? providerZoneFactsFor,
          {
            store: provider.stateStore,
            ...(profileParsed.config.watch === undefined
              ? {}
              : { watch: profileParsed.config.watch }),
            ...(provider.availabilityObservations === undefined
              ? {}
              : { observations: provider.availabilityObservations }),
          },
        );
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
      migrate: async (input) => {
        const fs: ProviderMigrateFileSystem = provider.migrateFs ?? {
          ...(options.fs ?? nodeFileSystemFacts()),
          readDirectory: (path) => readdirSync(path),
        };
        const read = readProviderMigrateSources({
          homeDirectory: options.homeDirectory,
          ...(options.priorConfigurationDirectoryName === undefined
            ? {}
            : { priorDirectoryName: options.priorConfigurationDirectoryName }),
          ...(input.profilesDir === undefined ? {} : { profilesDir: input.profilesDir }),
          ...(input.hookPath === undefined ? {} : { hookPath: input.hookPath }),
          fs,
        });
        if (!read.ok) {
          const location = read.source === undefined ? "" : ` at ${read.source}`;
          return {
            ok: false,
            code: "provider.migrate.refused",
            summary: `provider migrate legacy refused (${read.reason})${location}: ${read.summary}`,
          };
        }
        const parsedAssignments: ProviderMigrateAssignment[] = [];
        for (const source of read.sources) {
          const parsedSource = parseProviderMigrateSource(source);
          if (!parsedSource.ok) {
            return {
              ok: false,
              code: "provider.migrate.refused",
              summary: providerMigrateRefusalSummary(parsedSource.refusal),
            };
          }
          parsedAssignments.push(...parsedSource.assignments);
        }
        const built = buildProviderMigrationProposal({
          sources: read.states,
          assignments: parsedAssignments,
          table: PROVIDER_LEGACY_MIGRATION_TABLE,
        });
        if (!built.ok) {
          return {
            ok: false,
            code: "provider.migrate.refused",
            summary: providerMigrateRefusalSummary(built.refusal),
          };
        }
        const validation = validateProviderMigrateProposal(
          built.proposal.yaml,
          options.catalog ?? PRODUCTION_CATALOG,
        );
        if (!validation.ok) {
          return {
            ok: false,
            code: "provider.migrate.refused",
            summary: `provider migrate legacy refused (proposal-invalid): ${validation.detail}`,
          };
        }
        let report = built.proposal.report;
        if (input.write) {
          // The project-committed document lives at the effective checkout root,
          // the same root the configuration resolver reads. The root is resolved
          // only on the write path: a read-only invocation produces its proposal
          // wherever it runs and needs no checkout. A write from a subdirectory
          // resolves to the checkout root rather than creating a document no
          // layer reads.
          const checkoutRoot = findGitRoot(options.cwd, repositoryIo);
          if (checkoutRoot === undefined) {
            return {
              ok: false,
              code: "provider.migrate.refused",
              summary: providerMigrateRefusalSummary(providerMigrateNoCheckoutRefusal(options.cwd)),
            };
          }
          const target = `${checkoutRoot}/${brand.configDirectoryName}/${PROVIDER_MIGRATE_TARGET_NAME}`;
          if (fs.exists(target)) {
            return {
              ok: false,
              code: "provider.migrate.refused",
              summary: `provider migrate legacy refused (target-exists) at ${target}: the project-committed document already exists and is never modified; merge the proposal by hand`,
            };
          }
          mkdirSync(`${checkoutRoot}/${brand.configDirectoryName}`, { recursive: true });
          writeFileSync(target, built.proposal.yaml);
          report = { ...report, writtenPath: target };
        }
        return { ok: true, data: { proposal: built.proposal.yaml, report } };
      },
      simulate: async (input) => {
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
        // One bounded read, then the pure parser: a fixture defect refuses
        // before any evaluation and never echoes the document.
        const read = readProviderSimulateFixture({
          path: input.fixturePath,
          fs: provider.fixtureFs ?? options.fs ?? nodeFileSystemFacts(),
          maxBytes: PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
        });
        if (!read.ok) return { ok: false, code: read.code, summary: read.summary };
        const fixtureParsed = parseProviderSimulateFixture(
          read.document,
          PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
        );
        if (!fixtureParsed.ok) {
          return { ok: false, code: fixtureParsed.code, summary: fixtureParsed.summary };
        }
        let profileScope:
          | { readonly name: string; readonly providers: readonly string[] }
          | undefined;
        if (fixtureParsed.fixture.profile !== undefined) {
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
          const profile = profileParsed.config.profiles[fixtureParsed.fixture.profile];
          if (profile === undefined) {
            return {
              ok: false,
              code: "provider.profile.invalid",
              summary: `profile ${fixtureParsed.fixture.profile} is not declared`,
            };
          }
          profileScope = { name: profile.name, providers: profile.providers };
        }
        return simulateProviderResolution({
          fixturePath: input.fixturePath,
          fixture: fixtureParsed.fixture,
          config: parsed.config,
          ...(profileScope === undefined ? {} : { profile: profileScope }),
          zoneFactsFor: (zone) => providerZoneFactsFor(zone),
        });
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
          ...(provider.watchObservedAtMs === undefined
            ? {}
            : { observedAtMs: provider.watchObservedAtMs() }),
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
  // The mount unit's command definition: composed here because the entrypoint
  // throws for a prompt-required name the program lacks (GH-288 F-9, DEC-13).
  if (options.projects !== undefined) {
    commands.projects = createProjectsCommandDefinition(options.projects);
  }
  if (options.repos !== undefined) {
    commands.repos = createReposCommandDefinition(options.repos);
  }
  // The taxonomy reference surface (GH-290 F-2, DEC-F): registered when the edge
  // is given the runtime, which is the declaration itself.
  if (options.events !== undefined) {
    commands.events = createEventsCommandDefinition(options.events);
  }
  if (options.verify !== undefined) {
    commands.verify = createVerifyCommandDefinition(options.verify);
  }
  if (options.dispatch !== undefined) {
    // The registered credential set the composition root already holds is the
    // set the message composition redacts with BEFORE bounding (AC-F4-7). A
    // runtime that already carries an injected set is never shadowed.
    commands.dispatch = createDispatchCommandDefinition(
      options.dispatch.secrets === undefined
        ? { ...options.dispatch, secrets: secrets.values() }
        : options.dispatch,
    );
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
      createBlockersCommandRuntime(options.blockers, brand, secrets.values(), options.environment),
    );
  }
  if (options.merge !== undefined) {
    commands.merge = createMergeCommandDefinition(options.merge);
  }
  if (options.retro !== undefined) {
    commands.retro = createRetroCommandDefinition(createRetroCommandRuntime(options.retro));
  }
  if (options.ceremony !== undefined) {
    commands.ceremony = createCeremonyCommandDefinition(
      createCeremonyCommandRuntime(options.ceremony),
    );
  }
  if (options.steer !== undefined) {
    commands.steer = createSteerCommandDefinition(
      createSteerCommandRuntime(options.steer, brand, secrets.values()),
    );
  }
  if (options.spend !== undefined) {
    commands.spend = createSpendCommandDefinition(createSpendCommandRuntime(options.spend));
  }
  if (options.supervise !== undefined) {
    commands.supervise = createSuperviseCommandDefinition(options.supervise);
  }
  if (options.metrics !== undefined) {
    commands.metrics = createMetricsCommandDefinition(createMetricsCommandRuntime(options.metrics));
  }
  if (options.daemon !== undefined) {
    commands.daemon = createDaemonCommandDefinition(options.daemon);
  }
  if (options.coordinator !== undefined) {
    commands.coordinator = createCoordinatorCommandDefinition(
      createCoordinatorCommandRuntime(options.coordinator),
    );
  }
  if (options.loop !== undefined) {
    commands.loop = createLoopCommandDefinition(createLoopCommandRuntime(options.loop));
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
  /** The additive action/closure identity factories (GH-287 DEC-7). */
  readonly newActionId?: () => string;
  readonly newClosureId?: () => string;
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

/**
 * The additive spend telemetry evidence for one change (GH-291 AC-F8-1).
 *
 * The figures come from the same verified read and fold the spend command and
 * the digest consume. A selection with no telemetry is the classified absence;
 * an unreadable store yields no evidence rather than a false absence.
 */
const retroSpendFrom = (
  store: StateStorePort,
  changeRef: string,
): RetroSpendEvidence | undefined => {
  const read = readSpendLedger(store, changeRef);
  if (!read.ok) return undefined;
  const folded = computeSpendReport(read.value, { workItemRef: changeRef });
  if (!folded.ok) return { state: "absent" };
  const report = folded.data;
  return {
    state: "present",
    tokensByClass: report.tokensByClass,
    roles: report.breakdowns.role.map((entry) => ({
      role: entry.value ?? "(unattributed)",
      tokens: entry.tokens,
    })),
    models: report.breakdowns.model.map((entry) => ({
      model: entry.value ?? "(unattributed)",
      tokens: entry.tokens,
    })),
    timing: report.phaseTiming.map((entry) => ({
      phase: entry.phase,
      durationMs: entry.durationMs,
    })),
    reconciliation: {
      verdict: report.reconciliation.verdict,
      tolerance: report.reconciliation.tolerance,
      basis: report.reconciliation.basis,
    },
  };
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
): RetroCommandRuntimeWithActions => {
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
      readSpend: (changeRef) => retroSpendFrom(options.store, changeRef),
    };
  let actionSeq = 0;
  let closureSeq = 0;
  const actionPort = createRetroActionRegistryPort(options.store);
  const redactText = options.redact ?? ((text: string) => text);
  const redactDraft = (
    draft: import("@delivery-os/core/contracts").RetroActionDraft,
  ): import("@delivery-os/core/contracts").RetroActionDraft => ({
    ...draft,
    ...(draft.owner === undefined ? {} : { owner: redactText(draft.owner) }),
    ...(draft.measurableOutcome === undefined
      ? {}
      : { measurableOutcome: redactText(draft.measurableOutcome) }),
    ...(draft.trackerEntry === undefined ? {} : { trackerEntry: redactText(draft.trackerEntry) }),
    ...(draft.verificationArtifact === undefined
      ? {}
      : { verificationArtifact: redactText(draft.verificationArtifact) }),
    ...(draft.rollbackCondition === undefined
      ? {}
      : { rollbackCondition: redactText(draft.rollbackCondition) }),
    ...(draft.outcomeVerifier === undefined
      ? {}
      : {
          outcomeVerifier: {
            ...draft.outcomeVerifier,
            evidence: redactText(draft.outcomeVerifier.evidence),
          },
        }),
  });
  const actions: import("@delivery-os/core/contracts").RetroActionCommandRuntime = {
    file: (draft) => {
      actionSeq += 1;
      return fileRetroAction(actionPort, {
        draft: redactDraft(draft),
        actionId: options.newActionId?.() ?? `action-${String(actionSeq)}`,
        filedAt: options.clock.nowMs(),
        fenceToken: options.newFenceToken(),
      });
    },
    close: (request) => {
      closureSeq += 1;
      return closeRetroAction(
        actionPort,
        {
          ...request,
          ...(request.decision === undefined ? {} : { decision: redactText(request.decision) }),
          ...(request.reason === undefined ? {} : { reason: redactText(request.reason) }),
          ...(request.evidence === undefined ? {} : { evidence: redactText(request.evidence) }),
          ...(request.artifact === undefined ? {} : { artifact: redactText(request.artifact) }),
          ...(request.successor === undefined ? {} : { successor: redactText(request.successor) }),
        },
        {
          closureId: options.newClosureId?.() ?? `closure-${String(closureSeq)}`,
          decidedAt: options.clock.nowMs(),
          nowMs: options.clock.nowMs(),
          fenceToken: options.newFenceToken(),
        },
      );
    },
    list: (input) =>
      listRetroActions(actionPort, {
        nowMs: options.clock.nowMs(),
        ...(input.window === undefined ? {} : { window: input.window }),
      }),
  };
  return {
    actions,
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
        readFollowThrough: () => registryFollowThroughFor(options.store, input.level),
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
        readFollowThrough: (level) => registryFollowThroughFor(options.store, level),
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
 * Read the action-registry store verdict for the doctor `state check`
 * (GH-287 DEC-7), composed at the edge exactly like the retro-registry fact.
 */
export const readActionRegistryState = (store: StateStorePort): DoctorStateStoresRead => {
  const read = readActionRegistry(store);
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
    recordCount: read.value.actions.length + read.value.closures.length,
    stores: [{ name: "action-registry", verdict: read.value.verdict }],
  };
};

/* ------------------------- telemetry ingest edge ------------------------- */

/**
 * The telemetry ingest composition (GH-291 F-1, F-2, F-4; OQ-T2 §1).
 *
 * The dispatch spawn seam builds one sink per harness session from the
 * delivery's work-item ref and the invocation's run identity. Every decoded
 * frame is counted and, when it is a step, attributed through the injected
 * substrate ports and stored; at stream close the session's harness-reported
 * totals are captured through the injected read-only totals reader and the
 * session's ingest accounting lands as one durable record. The sink is
 * non-gating: storage faults are counted here and never change the delivery.
 */
export type TelemetryIngestComposition = {
  readonly store: StateStorePort;
  readonly workItemRef: string;
  readonly runId: string;
  readonly harnessKind: HarnessKind;
  readonly harnessVersion?: string | null;
  readonly treeRoot?: string | null;
  readonly repository?: string | null;
  readonly claimed?: TelemetryClaimedIdentity;
  /**
   * The delivered attribution substrates: the economics session identity and
   * the command-audit claimed identity. When supplied, every step's role and
   * lane are joined from them instead of the static `claimed` value.
   */
  readonly attribution?: TelemetryAttributionSubstrates;
  readonly model?: string | null;
  readonly nowIso: () => string;
  readonly newFenceToken: () => string;
  readonly sessionTotals?: TelemetrySessionTotalsReader;
};

/** Compose the per-session ingest sink over the injected state seam. */
export const createTelemetryIngestSink = (
  input: TelemetryIngestComposition,
): TelemetryIngestSink => {
  let tally = emptyIngestTally();
  const claimedFor = (sessionId: string): TelemetryClaimedIdentity => {
    const attribution = input.attribution;
    if (attribution === undefined) return input.claimed ?? { agentRole: null, lane: null };
    const joined = joinAttributionSubstrates(
      {
        workItemRef: input.workItemRef,
        runId: input.runId,
        sessionId,
        repository: input.repository ?? null,
        model: input.model ?? null,
      },
      attribution,
    );
    return { agentRole: joined.agentRole, lane: joined.lane };
  };
  const context = (sessionId: string): TelemetryFrameContext => ({
    workItemRef: input.workItemRef,
    runId: input.runId,
    sessionId,
    harnessKind: input.harnessKind,
    harnessVersion: input.harnessVersion ?? null,
    treeRoot: input.treeRoot ?? null,
    repository: input.repository ?? null,
    model: input.model ?? null,
    claimed: claimedFor(sessionId),
    capturedAt: input.nowIso(),
  });
  return {
    onFrame: (frame, frameContext) => {
      const sessionId = frameContext.sessionId;
      if (sessionId === undefined) {
        // A frame that arrived before its session is known is disclosed, not
        // dropped: it can never be attributed to a session.
        tally = tallyIngestDegradation(tally, {
          reason: "unattributable-session",
          failed: false,
        });
        return;
      }
      const outcome = decodeTelemetryStepFrame(frame, context(sessionId));
      if (outcome.kind !== "captured") {
        tally = tallyFrame(tally, outcome);
        return;
      }
      try {
        appendTelemetryStep(input.store, input.newFenceToken(), outcome.record);
      } catch {
        // The state tier classifies the failure; ingest only counts it. A step
        // whose record did not land is failed, never captured.
        tally = tallyIngestDegradation(tally, { reason: "capture-append-failed", failed: true });
        return;
      }
      tally = tallyFrame(tally, outcome);
    },
    onSessionClose: (sessionId) => {
      if (input.sessionTotals !== undefined) {
        try {
          captureTelemetryBaseline({
            store: input.store,
            fenceToken: input.newFenceToken(),
            workItemRef: input.workItemRef,
            runId: input.runId,
            sessionId,
            capturedAt: input.nowIso(),
            readTotals: input.sessionTotals,
          });
        } catch {
          // A failed baseline read lands no record and fabricates no figure; the
          // degradation is counted under the delivered session-capture reason.
          tally = tallyIngestDegradation(tally, { reason: "session-capture-failed", failed: true });
        }
      }
      const record: TelemetryIngestCaptureRecord = {
        schemaId: TELEMETRY_CAPTURE_SCHEMA_ID,
        storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
        workItemRef: input.workItemRef,
        runId: input.runId,
        sessionId,
        counts: tally.counts,
        byReason: tally.byReason,
        capturedAt: input.nowIso(),
      };
      try {
        appendTelemetryCaptureOutcome(input.store, input.newFenceToken(), record);
      } catch {
        // The accounting record is the durable disclosure, never a gate: a
        // failed append here cannot change the delivery or the drain.
      }
    },
    accounting: () => ({ counts: tally.counts, byReason: tally.byReason }),
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
    return {
      ok: true,
      data: folded.data,
      ...(folded.warnings.length === 0 ? {} : { warnings: folded.warnings }),
      ...(folded.truncation === undefined ? {} : { truncation: folded.truncation }),
    };
  },
  windowEvidence: (request) => {
    // The telemetry v2 storage identity read: the only source the window-
    // scoped reading consumes (no harness-store query of its own, GH-291).
    const read = readTelemetrySteps(options.store, request.ref);
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
    // The profile names the episode's recorded nomination, read from the
    // latest peak-window park record — never re-derived from a model string.
    const parks = readQueueParks(options.store);
    const profile = parks.ok
      ? [...parks.records]
          .reverse()
          .find(
            (record) =>
              record.ref === request.ref &&
              record.cause === "peak-window" &&
              record.providerProfile !== undefined,
          )?.providerProfile
      : undefined;
    return {
      ok: true,
      data: windowSpendEvidence({
        steps: read.value.records,
        ref: request.ref,
        providerProfile: profile ?? "",
        from: request.from,
        through: request.through,
      }),
    };
  },
});

/* ------------------------------ metrics edge ------------------------------ */

/**
 * The metrics composition seams (GH-299 F-1..F-8): the read-only store, the
 * local PM context, the project root and its configuration directory, the
 * injected clock, and the file facts. The command is read-only: no fence, no
 * append, no process launch, no secret resolution, and no provider or network
 * client is composed here.
 */
export type MetricsCompositionOptions = {
  readonly store: StateStorePort;
  readonly localContext: { readonly path: string; readonly fs: FileSystemFacts };
  readonly projectRoot: string;
  readonly configurationDirectoryName: string;
  readonly fs: MetricsCorpusFileSystemFacts;
  readonly clock: { readonly nowMs: () => number };
  readonly platform?: RuntimePlatform;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory?: string;
  readonly changesDirectory?: string;
};

/** The seam-injected runtime: one window resolution, one node read, then reads. */
export type MetricsRuntimeOptions = {
  readonly seams: MetricsReadSeams;
  readonly clock: { readonly nowMs: () => number };
  readonly resolveActiveRef: () => { readonly ref: string } | { readonly ref: null };
};

/**
 * Compose the metrics runtime from injected seams.
 *
 * The declaration node is validated before any telemetry, log, ceremony,
 * transition, or corpus read: an absent node is undeclared, a defective node is
 * `config.value.invalid`, and a damaged baseline log is the one metrics
 * identity. The window is resolved from the injected clock, so every timestamp
 * on the payload is reproducible from the fixture.
 */
export const createMetricsRuntimeFromSeams = (
  options: MetricsRuntimeOptions,
): MetricsCommandRuntime => ({
  resolveActiveRef: options.resolveActiveRef,
  report: (request) => {
    const nowMs = options.clock.nowMs();
    const window = resolveMetricsWindow({
      ...(request.from === undefined ? {} : { from: request.from }),
      ...(request.through === undefined ? {} : { through: request.through }),
      nowMs,
    });
    if (!window.ok) {
      return {
        ok: false,
        error: {
          kind: "input",
          code: "input.value.rejected",
          summary: `metrics: ${window.reason}`,
        },
      };
    }
    const nodeRead = options.seams.readConfigNode();
    if (!nodeRead.ok) {
      return {
        ok: false,
        error: {
          kind: "config",
          code: "config.value.invalid",
          summary: "metrics: the project-committed configuration document is not usable",
          cause: `document.${nodeRead.state}`,
        },
      };
    }
    const resolved =
      nodeRead.state === "absent"
        ? ({ ok: true, declared: false } as const)
        : resolveMetricsBurnRate(nodeRead.node);
    if (!resolved.ok) {
      return {
        ok: false,
        error: {
          kind: "config",
          code: "config.value.invalid",
          summary: "metrics: the metrics.burn-rate declaration is defective",
          ...(resolved.detail === undefined ? {} : { cause: resolved.detail }),
        },
      };
    }
    const state = options.seams.readState(request.ref);
    if (!state.ok) return { ok: false, error: state.error };
    const baseline = options.seams.readBaselineLog();
    if (!baseline.ok) {
      return {
        ok: false,
        error: {
          kind: "metrics",
          code: "metrics.baseline-unreadable",
          summary:
            "metrics: the committed measurement baseline log exists but cannot be parsed or validated",
        },
      };
    }
    const corpus = options.seams.readCorpus();
    const data = computeMetricsReport({
      ref: request.ref,
      window: window.window,
      nowMs,
      state: state.value,
      baseline,
      node: resolved,
      corpus,
    });
    return { ok: true, data };
  },
});

/** Project the verified ledger onto the pure fold's state input (DM-3, DEC-14). */
export const metricsStateFromLedger = (
  ledger: MetricsLedgerComposition,
  ref: string,
): MetricsStateRead => {
  const spend = ledger.spend;
  const ledgerRecords = spend.records;
  const ledgerTransitions = spend.transitions;
  const folded = computeSpendReport(spend, { workItemRef: ref });
  const dispatch = folded.ok
    ? {
        tokensByClass: folded.data.tokensByClass,
        costTotals: folded.data.costTotals,
        restarts: folded.data.restarts,
        perAgent: folded.data.perAgent.map((entry) => ({
          role: entry.agent,
          model: entry.model,
          calls: entry.calls,
          tokens: entry.tokens,
        })),
        breakdowns: {
          role: folded.data.breakdowns.role,
          model: folded.data.breakdowns.model,
        },
        reconciliation: {
          basis: folded.data.reconciliation.basis,
          verdict: folded.data.reconciliation.verdict,
        },
      }
    : undefined;
  return {
    workItemRef: ref,
    telemetryState: ledger.telemetryState,
    records: ledgerRecords.map((record) => ({
      runId: record.runId,
      sessionId: record.sessionId,
      capturedAt: record.capturedAt,
      tokens: record.tokens,
      cost: record.cost,
      calls: record.calls,
    })),
    steps: (spend.steps ?? []).map((step) => ({
      runId: step.runId,
      sessionId: step.sessionId,
      model: step.model,
      agentRole: step.agentRole,
      tokens: step.tokens,
      calls: step.calls,
      cost: step.cost,
      capturedAt: step.capturedAt,
    })),
    transitions: ledgerTransitions.map((transition) => ({
      phaseId: transition.phaseId,
      operation: transition.operation,
      timestamp: transition.timestamp,
    })),
    ceremony: ledger.ceremony,
    ...(ledger.telemetryState === "absent" ? { absenceReason: "spend.telemetry-absent" } : {}),
    ...(dispatch === undefined ? {} : { dispatch }),
  };
};

/** Compose the metrics runtime from the injected read-only seams. */
export const createMetricsCommandRuntime = (
  options: MetricsCompositionOptions,
): MetricsCommandRuntime =>
  createMetricsRuntimeFromSeams({
    clock: options.clock,
    resolveActiveRef: () => {
      const context = readLocalPmContext({
        path: options.localContext.path,
        fs: options.localContext.fs,
      });
      const ref = context.ok ? context.context.activeChange?.workItemRef : undefined;
      return ref === undefined ? { ref: null } : { ref };
    },
    seams: {
      readState: (ref) => {
        const ledger = readMetricsLedger(options.store, ref);
        if (!ledger.ok) return { ok: false, error: ledger.error };
        return { ok: true, value: metricsStateFromLedger(ledger.value, ref) };
      },
      readBaselineLog: () =>
        readMetricsBaselineLog({ projectRoot: options.projectRoot, fs: options.fs }),
      readConfigNode: () =>
        readMetricsBurnRateNode({
          platform: options.platform ?? "linux",
          homeDirectory: options.homeDirectory ?? "",
          environment: options.environment ?? {},
          gitRoot: options.projectRoot,
          enableSystemConfig: false,
          enableUserConfig: false,
          enableProjectLocalConfig: false,
          configurationDirectoryName: options.configurationDirectoryName,
          fs: options.fs,
        }),
      readCorpus: () =>
        scanMetricsCorpus({
          projectRoot: options.projectRoot,
          changesDirectory: options.changesDirectory ?? "doc/changes",
          fs: options.fs,
        }),
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
  /**
   * The bounded local plan-member read (GH-310 F-2, DEC-21, DM-6): one plan
   * read that supplies the declared `members[]` for a change ref. Absent, a
   * member-less plan, or an unreadable plan keeps the delivered single-ref
   * queue path byte-identical. No configuration and no network are read.
   */
  readonly readPlanMembers?: (ref: string) => readonly PlanMemberDeclaration[] | undefined;
  /** The producer-root config resolution seam; absent means use injected facts. */
  readonly deployExpectations?: QueueDeployExpectationPort;
  readonly runner?: string;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
  readonly newFenceToken: () => string;
  /**
   * The degradation marker set, or a resolver consulted per projection. The
   * array member keeps the delivered semantics; absence keeps the delivered
   * `["daemon-unreachable"]` fallback.
   */
  readonly degraded?: readonly QueueDegradationReason[] | (() => readonly QueueDegradationReason[]);
  readonly economics?: Readonly<Record<string, QueueLaneEconomics>>;
  readonly readyRuntime?: QueueReadyCommandRuntime;
  /** The per-pass owner-hold reader supplied by the production composition. */
  readonly readOwnerHold?: () => OwnerHoldFact;
  /**
   * The group-scoped work read behind `queue list --project <groupKey>`
   * (GH-309 F-5, F-6); absent leaves the repository-scoped read only.
   */
  readonly readProjectGroup?: (
    groupKey: string,
  ) => ProjectGroupWorkRead | Promise<ProjectGroupWorkRead>;
  /**
   * The per-item tracker delivery-state read for `queue reconcile` (GH-292
   * F-5): the verified closeout/verify read bridge wired by the composition.
   * Absent means the tracker surface is not wired and reconcile refuses.
   */
  readonly readTrackerDeliveryState?: (ref: string) => Promise<QueueTrackerRead>;
  /** The additive live-watch seam (GH-238 F-13); absent degrades to polling. */
  readonly watch?: {
    readonly transport?: ControlTransport;
    readonly clock?: DaemonClockPort;
    readonly signal?: { readonly interrupted: () => boolean };
    readonly intervalMs?: number;
    readonly maxIterations?: number;
  };
  /**
   * The peak-pause composition fact (GH-294 F-5): whether THIS composition
   * actually supplies the profile-window watcher ports. The lanes machine
   * read's `peakEnforcement.mode` derives from this fact — never from daemon
   * reachability, which says nothing about whether a window watcher exists.
   * Absent means no watch is composed and the delivered iteration-start
   * gating is the whole story.
   */
  readonly peakWatchComposed?: boolean;
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

/** The bounded claim summary naming the winning source and optional reason. */
const ownerHoldSummary = (hold: Extract<OwnerHoldFact, { readonly active: true }>): string =>
  hold.reason === undefined
    ? `reason=owner-hold; owner hold active (${hold.source})`
    : `reason=owner-hold; owner hold active (${hold.source}): ${hold.reason}`;

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
      ...(composition.readOwnerHold === undefined
        ? {}
        : { ownerHold: composition.readOwnerHold() }),
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
    ...(composition.readOwnerHold === undefined ? {} : { ownerHold: composition.readOwnerHold() }),
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

/** The recomputed ready set (ready refs in schedule order) after a mutation. */
const readySetAfterMutation = (composition: QueueComposition): readonly string[] => {
  const built = buildQueueFacts(composition, parkContextFor(composition));
  if (!built.ok) return [];
  const schedule = computeQueueSchedule(built.facts, { next: 20 });
  return schedule.entries.filter((entry) => entry.state === "ready").map((entry) => entry.ref);
};

/** The removal outcome projected onto the command runtime (GH-292 F-1). */
const removalOutcome = (
  result: Extract<QueueRemovalMutationResult, { ok: true }>,
  degraded: readonly QueueDegradationReason[],
  composition: QueueComposition,
): QueueRuntimeRemoval => ({
  ok: true,
  ref: result.value.ref,
  reason: result.value.reason,
  readySet: readySetAfterMutation(composition),
  degraded,
});

/** The dependency-removal outcome projected onto the command runtime (GH-292 F-3). */
const dependencyRemovalOutcome = (
  result: Extract<QueueDependencyRemovalResult, { ok: true }>,
  degraded: readonly QueueDegradationReason[],
  composition: QueueComposition,
): QueueRuntimeDependencyRemoval => {
  const value = result.value;
  const fallbackEntry = value.fold.entries.find((entry) => entry.ref === value.ref) ?? {
    ref: value.ref,
    ...(value.entry.repository === undefined ? {} : { repository: value.entry.repository }),
    priority: value.entry.priority,
    edges: value.edges,
    weightClass: "standard" as const,
    rankClass: "new-start" as const,
    recordedAt: value.entry.recordedAt,
  };
  const weight = resolveQueueWeight(composition.facts.plans[value.ref]);
  const built = buildQueueFacts(composition, parkContextFor(composition));
  const projected = built.ok
    ? computeQueueSchedule(built.facts, { next: 20 }).entries.find(
        (entry) => entry.ref === value.ref,
      )
    : undefined;
  return {
    ok: true,
    ref: value.ref,
    entry: projected
      ? { ...fallbackEntry, rankClass: projected.rankClass, weightClass: projected.weightClass }
      : fallbackEntry,
    entryState: projected?.state ?? "not-ready",
    blocking: projected?.blocking ?? [
      fallbackEntry.repository === undefined
        ? { reason: "not-ready" as const, detail: "repository-binding-unresolved" }
        : { reason: "not-ready" as const, detail: "state-unreadable" },
    ],
    weightClass: projected?.weightClass ?? weight.weightClass,
    weightClassSource: projected?.weightClassSource ?? weight.source,
    edges: value.edges,
    result: value.result,
    readySet: readySetAfterMutation(composition),
    degraded,
  };
};

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

/** One resolved add target for a declared member (GH-310 DEC-21, DM-6). */
type QueueMemberTarget = {
  readonly ref: string;
  readonly repoKey: string;
  readonly edges: readonly string[];
};

/**
 * Resolve the declared member targets for one `queue add` (GH-310 F-2,
 * DEC-21, DM-6). Returns `undefined` for the delivered single-ref path: no
 * composed plan read, a member-less plan, an unreadable plan, or a member ref
 * naming no declared member. A member ref adds only that member; the bare
 * change ref adds every declared member in declared order.
 */
const declaredMemberTargets = (
  composition: QueueComposition,
  ref: string,
  cliDeps: readonly string[] | undefined,
): readonly QueueMemberTarget[] | undefined => {
  if (composition.readPlanMembers === undefined) return undefined;
  const parsed = parseMemberRef(ref);
  const changeRef = parsed?.changeRef ?? canonicalChangeRef(ref);
  if (changeRef === undefined) return undefined;
  const declared = composition.readPlanMembers(changeRef);
  if (declared === undefined || declared.length === 0) return undefined;
  const selected =
    parsed === undefined
      ? declared
      : declared.filter((member) => member.repoKey === parsed.repoKey);
  if (selected.length === 0) return undefined;
  return selected.map((member, index) => ({
    ref: memberRefFor(changeRef, member.repoKey),
    repoKey: member.repoKey,
    edges: [
      ...(member.dependsOn ?? []).map((dependency) => memberRefFor(changeRef, dependency)),
      ...(index === 0 ? (cliDeps ?? []) : []),
    ],
  }));
};

/** Aggregate the per-member add outcomes into the delivered result vocabulary. */
const memberAddResult = (outcomes: readonly QueueIntentOutcome[]): "added" | "updated" | "noop" =>
  outcomes.some((outcome) => outcome.result === "added")
    ? "added"
    : outcomes.some((outcome) => outcome.result === "updated")
      ? "updated"
      : "noop";

/** Resolve the degradation marker set; absence keeps the delivered fallback. */
const resolveDegraded = (value: QueueComposition["degraded"]): readonly QueueDegradationReason[] =>
  value === undefined
    ? (["daemon-unreachable"] as const)
    : typeof value === "function"
      ? value()
      : value;

/** Compose the full queue command runtime from the injected state and facts. */
export const createQueueCommandRuntime = (composition: QueueComposition): QueueCommandRuntime => {
  // The markers are resolved per projection (schedule read, mutation outcome,
  // lanes read, and every watch iteration), never captured once: a captured
  // value would report a stale verdict for the whole process lifetime.
  const readSchedule = (next: number): QueueRuntimeSchedule => {
    const built = buildQueueFacts(composition, parkContextFor(composition));
    if (!built.ok) return built;
    return {
      ok: true,
      schedule: computeQueueSchedule(built.facts, { next }),
      degraded: resolveDegraded(composition.degraded),
    };
  };
  const mutate = (operation: () => QueueIntentResult): QueueRuntimeMutation => {
    const recovered = recoverParksForMutation(composition);
    if (recovered !== undefined) return recovered;
    const result = operation();
    if (!result.ok) return mapQueueFailure(result);
    return mutationOutcome(result.value, resolveDegraded(composition.degraded), composition);
  };
  return {
    readSchedule,
    ...(composition.readProjectGroup === undefined
      ? {}
      : { readProjectGroup: composition.readProjectGroup }),
    watch: watchStreamFor(composition, "queue", () => {
      const read = readSchedule(20);
      return read.ok
        ? { ok: true as const, data: toQueueReadData(read.schedule, []) }
        : { ok: false as const, code: read.code };
    }),
    add: (input) => {
      const targets = declaredMemberTargets(composition, input.ref, input.deps);
      if (targets === undefined) {
        return mutate(() =>
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
        );
      }
      const recovered = recoverParksForMutation(composition);
      if (recovered !== undefined) return recovered;
      const outcomes: QueueIntentOutcome[] = [];
      for (const target of targets) {
        const declared = declareQueueEntry(composition.store, {
          ref: target.ref,
          repository: target.repoKey,
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(target.edges.length === 0 ? {} : { edges: target.edges }),
          recordedAt: composition.nowIso(),
          fenceToken: composition.newFenceToken(),
        });
        if (!declared.ok) return mapQueueFailure(declared);
        outcomes.push(declared.value);
      }
      const first = outcomes[0];
      if (first === undefined) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary: "no declared member entry was added",
        };
      }
      const projected = mutationOutcome(first, resolveDegraded(composition.degraded), composition);
      if (!projected.ok) return projected;
      const edges: string[] = [];
      for (const target of targets) {
        for (const edge of target.edges) {
          if (!edges.includes(edge)) edges.push(edge);
        }
      }
      return {
        ...projected,
        edges,
        result: memberAddResult(outcomes),
        members: targets.map((target) => ({
          ref: target.ref,
          repoKey: target.repoKey,
          lane: target.ref,
        })),
      };
    },
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
      // The hold gates BEFORE ref selection, so a no-ref claim never falls
      // through to no-eligible-action; an unreadable store still fails above.
      const hold = composition.readOwnerHold?.();
      if (hold?.active === true) {
        return {
          ok: false,
          kind: "queue",
          code: "queue.precondition.unmet",
          summary: ownerHoldSummary(hold),
        };
      }
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
      // GH-310 AC-F4-1: a member start whose declared prerequisite is unlanded
      // names the member and the prerequisite it waits on. The delivered
      // refusal identity and exit are unchanged; only the bounded summary of a
      // member-ref refusal is enriched.
      if (!precheck.ok && precheck.reason === "dependency-open" && isMemberRef(selected)) {
        const prerequisites = entry.deps.filter((dependency) => dependency !== selected);
        return {
          ok: false,
          kind: "queue",
          code: precheck.code,
          summary: [
            "reason=dependency-open",
            `member=${selected}`,
            ...(prerequisites.length === 0 ? [] : [`prerequisite=${prerequisites.join(",")}`]),
            ...(precheck.detail === undefined ? [] : [precheck.detail]),
          ].join("; "),
        };
      }
      // GH-292 F-4 (TDR-0026 DC-2/DC-3): the claim path's holder-aware
      // admission refuses another holder's live same-ref lease before the
      // fence; the own-holder renewal, the other-ref conflict, and the stale
      // takeover stay the delivered claim-primitive behaviour.
      const singleFlight = claimSingleFlightRefusal(composition.store, {
        ref: selected,
        holder: input.holder,
        nowMs: composition.nowMs(),
      });
      if (singleFlight !== undefined) {
        return {
          ok: false,
          kind: "queue",
          code: singleFlight.code,
          ...(singleFlight.summary === undefined ? {} : { summary: singleFlight.summary }),
          ...(singleFlight.holder === undefined ? {} : { holder: singleFlight.holder }),
        };
      }
      const claimed = claimQueueLease(composition.store, {
        ref: selected,
        holder: input.holder,
        runner: built.facts.runner,
        weightClass: weight.weightClass,
        ...(composition.settings === undefined ? {} : { ttlMs: composition.settings.leaseTtlMs }),
        nowIso: composition.nowIso(),
        nowMs: composition.nowMs(),
        fenceToken: composition.newFenceToken(),
        ...(hold === undefined ? {} : { ownerHold: hold }),
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
        degraded: resolveDegraded(composition.degraded),
      };
    },
    release: (input) => {
      // GH-295 DEC-9(a): the supervised-stall cause is battery-written only.
      // The mirrored edge runtime refuses it identically to the command layer,
      // before any read or write, so no second writer path can accept it.
      if (
        input.parkCause !== undefined &&
        (QUEUE_BATTERY_ONLY_PARK_CAUSES as readonly string[]).includes(input.parkCause)
      ) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary:
            `reason=park-${input.parkCause}-battery-only; ` +
            `accepted=provider-window|provider-quota|preempted-for-close-item|peak-window|owner-hold`,
        };
      }
      // GH-294 F-2: both expiry-carrying window causes pair with `--until`
      // exactly alike at the edge runtime — required and accepted (the
      // command-layer grammar already enforces the same rule; this is the
      // defense-in-depth twin). Every other cause (owner-hold included)
      // refuses `--until`: an owner-hold park's `until` is a declared
      // classified absence (DEC-12), never a synthesized timestamp.
      const windowCause =
        input.parkCause === "provider-window" || input.parkCause === "peak-window";
      if (windowCause && input.parkUntil === undefined) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary: `${input.parkCause} park requires --until <iso>`,
        };
      }
      if (!windowCause && input.parkUntil !== undefined) {
        return {
          ok: false,
          kind: "input",
          code: "input.value.rejected",
          summary: "--until is accepted only with --park provider-window or --park peak-window",
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
                composition.settings?.parkRecheckMs[conditionTypeForCause(input.parkCause)] ??
                defaultParkRecheckMs(conditionTypeForCause(input.parkCause)),
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
        degraded: resolveDegraded(composition.degraded),
      };
    },
    remove: (input) => {
      const recovered = recoverParksForMutation(composition);
      if (recovered !== undefined) return recovered;
      // GH-292 F-1: the removal seam owns the pre-append refusal set. A
      // missing reason arrives as the queue identity; an out-of-vocabulary
      // value is refused by the command grammar before this seam runs.
      const removed = removeQueueEntry(composition.store, {
        ref: input.ref,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        recordedAt: composition.nowIso(),
        nowMs: composition.nowMs(),
        fenceToken: composition.newFenceToken(),
      });
      if (!removed.ok) return mapQueueFailure(removed);
      return removalOutcome(removed, resolveDegraded(composition.degraded), composition);
    },
    depRemove: (input) => {
      const recovered = recoverParksForMutation(composition);
      if (recovered !== undefined) return recovered;
      // GH-292 F-3: an absent edge is a noop at exit 0 with zero appends and
      // zero events; a present edge appends one dependency record and runs no
      // cycle check (removal cannot close a cycle).
      const removed = removeQueueDependency(composition.store, {
        ref: input.ref,
        onRef: input.onRef,
        recordedAt: composition.nowIso(),
        fenceToken: composition.newFenceToken(),
      });
      if (!removed.ok) return mapQueueFailure(removed);
      return dependencyRemovalOutcome(removed, resolveDegraded(composition.degraded), composition);
    },
    reconcile: async (input) => {
      // GH-292 F-5: the tracker read rides the composition's verified read
      // bridge. Without it the tracker surface is not wired and reconcile
      // refuses truthfully instead of manufacturing an observation.
      const port = composition.readTrackerDeliveryState;
      if (port === undefined) {
        return {
          ok: false,
          kind: "queue",
          code: "queue.precondition.unmet",
          summary: "reason=tracker-read-unavailable",
        };
      }
      const recovered = recoverParksForMutation(composition);
      if (recovered !== undefined) return recovered;
      const swept = await reconcileQueueEntries(composition.store, {
        ...(input.ref === undefined ? {} : { ref: input.ref }),
        readTracker: port,
        recordedAt: composition.nowIso(),
        nowMs: composition.nowMs(),
        fenceToken: composition.newFenceToken,
      });
      if (!swept.ok) {
        // The provider identity surfaces as-is: no queue synonym (AC-F5-4).
        if (swept.kind === "provider") {
          return { ok: false, kind: "provider", code: swept.code };
        }
        return mapQueueFailure(swept);
      }
      return {
        ok: true,
        value: swept.value,
        readySet: readySetAfterMutation(composition),
        degraded: resolveDegraded(composition.degraded),
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
    // The declared peak-enforcement state (GH-294 F-8, OQ-TP-6; F-5): the
    // mode names what enforcement is active and derives from the composition
    // fact — whether this composition actually supplies the profile-window
    // watcher. Daemon reachability says nothing about a watcher and never
    // claims one. `parkClaimed` is record-derived: the durable park records
    // are the only truth about whether a park was claimed, by whatever
    // writer. The already-resolved degradation is reused: no second
    // reachability resolution.
    const degraded = resolveDegraded(composition.degraded);
    const watchComposed = composition.peakWatchComposed === true;
    const parksRead = readQueueParks(composition.store);
    const parkClaimed =
      parksRead.ok &&
      parksRead.records.some(
        (record) => record.cause === "peak-window" && record.recoveryState === "parked",
      );
    return {
      ok: true as const,
      data: foldLanes({
        schedule,
        economics: composition.economics ?? {},
        degraded,
        ...(daemon.ok ? { daemonLanes: daemon.records } : {}),
        peakEnforcement: {
          mode: watchComposed ? "window-watch" : "iteration-start-gating",
          parkClaimed,
        },
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
/** One pre-session harness admission refusal (GH-335 F-1, F-2; NFR-1). */
export type DispatchHarnessAdmissionRefusal = {
  readonly kind: "harness" | "config" | "provider";
  readonly code: string;
  readonly summary?: string;
  readonly field?: string;
  readonly harness?: import("@delivery-os/core/contracts").CommandFailureHarnessDetail;
};

/** The pre-session harness admission outcome. */
export type DispatchHarnessAdmissionOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DispatchHarnessAdmissionRefusal };

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
  /**
   * The nomination gate (GH-294 F-1, TDR-0028 D1): the admission's first
   * predicate, passed through to `runDispatch` before the preflight, the
   * owner-hold gate, and the lease claim. Production builds it over
   * `nominateProviderProfile` from the resolved provider configuration, the
   * delivered probe, and the clock, and supplies it whenever the resolved
   * configuration declares the `provider.profiles` branch; a composition that
   * omits it keeps the delivered no-nomination behavior (a project with no
   * profiles branch has no enforcement key to record).
   */
  readonly nominate?: DispatchPorts["nominate"];
  readonly repository: (ref: string) => string;
  readonly readTruth: (ref: string) => Promise<DispatchTruthReads>;
  /**
   * The admission precondition, invoked after harness/input validation and
   * before `claimLease` and any session start. Production always supplies it; a
   * direct composition may omit it and keep the delivered run order.
   */
  readonly preflight?: (ref: string) => Promise<DispatchPreflightResult>;
  /**
   * The pre-session harness admission (GH-335 F-1, F-2; NFR-1): the version
   * gate and the mode availability, evaluated once before the lease claim and
   * before any session-bearing child process. A refusal claims no lease, opens
   * no attempt record, and writes no telemetry.
   */
  readonly harnessAdmission?: () => Promise<DispatchHarnessAdmissionOutcome>;
  /**
   * The harness facts the admission resolved, read by the composition's port
   * gate and disclosed on a pre-session refusal (TDR-0041). Absent on the
   * non-dispatch lanes and for a harness kind outside the delivery window.
   */
  readonly harnessFacts?: DispatchPorts["harnessFacts"];
  /** The caller-supplied agent identity for this run (DEC-16, DEC-15). */
  readonly harnessAgent?: (ref: string) => string | undefined;
  /** The composition-resolved single-seat binding for this run (TDR-0040). */
  readonly harnessBinding?: (ref: string) => DispatchPorts["harnessBinding"];
  /** The advisory lane owner facts (GH-347 DM-1); absent keeps the lane write off. */
  readonly laneOwner?: DispatchPorts["laneOwner"];
  /** The deterministic title fact (GH-347 DM-6); absent keeps the run role-less. */
  readonly freshTitle?: (ref: string) => string | undefined;
  /** The borrowed terminate grace (GH-347 DEC-4). */
  readonly killGraceMs?: number;
  /** The delivered `economics.restart` append (GH-347 F-6). */
  readonly appendRestart?: DispatchPorts["appendRestart"];
  readonly claimLease: (
    ref: string,
    repository: string,
  ) => DispatchLeaseClaim | Promise<DispatchLeaseClaim>;
  readonly releaseLease: (ref: string, cause: "completed" | "aborted") => boolean;
  readonly phaseLedger: (ref: string) => DispatchPhaseLedger;
  /**
   * The one injected delay fact (GH-347 AC-F9-2): the composition owns the
   * timer. Production binds a real one; the offline battery injects a recorder.
   */
  readonly delay?: DispatchPorts["delay"];
  /**
   * The one injected ensure-push capability (GH-386 F-1, DEC-1): composed at
   * the production edge over the adapters push seam. Absent keeps the delivered
   * no-act behavior for a composition that declares no act.
   */
  readonly pushParity?: DispatchPorts["pushParity"];
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
  /**
   * The operator read surfaces' composition facts (GH-354 DEC-7). Additive and
   * optional: a composition that supplies none keeps exactly the delivered
   * dispatch family, and each query refuses `input.value.rejected`.
   */
  readonly operator?: DispatchOperatorComposition;
};

/**
 * The delivered lane facts a resume admits against (GH-347 DM-1): one
 * definition, relocated to `packages/core/src/contracts/dispatch.ts` because the
 * resolver lives in core and core cannot import CLI. This is an alias, never a
 * second shape.
 */
export type { DispatchLaneFacts };

const isHarnessKind = (value: string): value is HarnessKind =>
  (HARNESS_KINDS as readonly string[]).includes(value);

/** The composition surface the evidence-gate command family needs. */
export type DispatchGateComposition = {
  readonly store: DispatchPorts["store"];
  readonly stateRoot: string;
  readonly fenceToken: string;
  readonly nowIso: () => string;
  readonly gate: NonNullable<DispatchComposition["gate"]>;
  /**
   * The attempt-history read ports (GH-289). Optional like every other gate
   * member: a composition that supplies none keeps exactly the delivered three
   * gate surfaces.
   */
  readonly attempts?: {
    readonly resolveRepository: () => string | undefined;
    readonly resolveActiveRef: () => string | null;
    readonly contextPath: string;
  };
};

/**
 * Build the typed evidence-gate runtime (`dual-run summary`, `dual-run resolve`,
 * `handover [--revert]`, and `attempts` when its ports are supplied) over the
 * injected store and identity resolver. It needs no harness settings, so a
 * composition can expose it without resolving them.
 */
export const createDispatchGateRuntime = (
  composition: DispatchGateComposition,
): Required<
  Pick<import("./commands/dispatch.js").DispatchCommandRuntime, "summary" | "resolve" | "handover">
> & { readonly attempts?: DispatchAttemptsRuntime } => {
  const attemptsPorts = composition.attempts;
  return {
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
              ...(composition.gate.max === undefined ? {} : { max: composition.gate.max }),
            })
          : handoverDispatchEvidence({
              store: composition.store,
              fenceToken: composition.fenceToken,
              repository,
              scope: composition.gate.scope,
              nowIso: composition.nowIso(),
              principal: composition.gate.principal,
              ...(composition.gate.max === undefined ? {} : { max: composition.gate.max }),
            });
      },
    },
    ...(attemptsPorts === undefined
      ? {}
      : {
          attempts: {
            read: async (input: { readonly ref?: string; readonly limit?: number }) =>
              readDispatchAttemptHistory(
                {
                  store: composition.store,
                  resolveRepository: attemptsPorts.resolveRepository,
                  resolveActiveRef: attemptsPorts.resolveActiveRef,
                  contextPath: attemptsPorts.contextPath,
                },
                input,
              ),
          },
        }),
  };
};

/**
 * The operator read surfaces' composition facts (GH-354 DEC-7, API-6..API-10).
 *
 * Every fact is injected at the same edge that mounts `claimLease`,
 * `existingLane`, and `attempts`. The store is the delivered state port; the
 * repository resolver must resolve with persistence DISABLED, and the probe is
 * the advisory owner-liveness observation.
 */
export type DispatchOperatorComposition = {
  readonly store: DispatchPorts["store"];
  readonly resolveRepository: () => string | undefined;
  readonly probe: DispatchOwnerProbe;
  /** The artifact family's root and edge (GH-354 API-7); absent = uncomposed. */
  readonly artifactRoot?: string;
  readonly artifactFs?: DispatchLogFileSystem;
  /** The injected transcript read (GH-354 API-9); absent = uncomposed. */
  readonly transcript?: DispatchTranscriptRead;
  /** The adapter's declared `session-introspection` support (GH-354 DM-3). */
  readonly supportsIntrospection?: (kind: HarnessKind) => boolean;
};

/**
 * Build the operator read surfaces over the injected store and probe.
 *
 * A store failure keeps the store's own typed `state.*` code so the envelope's
 * error-table row supplies the exit projection (`state.store.torn` → 2,
 * `state.permission.denied` → 1). No surface answers around it.
 */
export const createDispatchOperatorRuntime = (
  composition: DispatchOperatorComposition,
): {
  readonly status: DispatchStatusRuntime;
  readonly delivering: DispatchDeliveringRuntime;
  readonly log?: DispatchLogRuntime;
  readonly message?: DispatchMessageRuntime;
} => {
  const failureOf = (read: { readonly code: string }, summary: string) => ({
    ok: false as const,
    error: { kind: "state", code: read.code, summary },
  });
  return {
    status: {
      read: async (input) => {
        const repository = composition.resolveRepository();
        if (repository === undefined) {
          return {
            ok: false as const,
            error: {
              kind: "input",
              code: "input.value.rejected",
              summary: "repository identity is unresolvable",
            },
          };
        }
        const read = readOperatorStatus({
          store: composition.store,
          repository,
          ref: input.ref,
          probe: composition.probe,
        });
        if (!read.ok) return failureOf(read, `dispatch lane read failed (${read.code})`);
        return { ok: true as const, data: read.data };
      },
    },
    delivering: {
      read: async (input) => {
        const repository = composition.resolveRepository();
        if (repository === undefined) {
          return {
            ok: false as const,
            error: {
              kind: "input",
              code: "input.value.rejected",
              summary: "repository identity is unresolvable",
            },
          };
        }
        const read = readOperatorDelivering({
          store: composition.store,
          repository,
          ...(input.ref === undefined ? {} : { ref: input.ref }),
          probe: composition.probe,
        });
        if (!read.ok) return failureOf(read, `dispatch lane read failed (${read.code})`);
        return { ok: true as const, data: read.data };
      },
    },
    ...(composition.artifactRoot === undefined || composition.artifactFs === undefined
      ? {}
      : {
          log: {
            // The machine `data` is bounded by BYTES only (GH-354 AC-F2-5,
            // NFR-3, DM-6): the requested tail selects the lines and the
            // declared machine bound trims them. The human 200-line and
            // 32 768-byte bounds are the human renderer's, so a machine answer
            // never reports a line bound it did not apply.
            read: async (input: { readonly ref: string; readonly tail: number }) => ({
              ok: true as const,
              data: readDispatchLog({
                familyRoot: composition.artifactRoot as string,
                ref: input.ref,
                tail: input.tail,
                fs: composition.artifactFs as DispatchLogFileSystem,
                maxBytes: DISPATCH_MAX_MACHINE_BYTES,
                measureBytes: (candidate: readonly string[]) =>
                  dispatchLogByteLength(
                    JSON.stringify({
                      query: "log",
                      ref: input.ref,
                      available: true,
                      tail: input.tail,
                      lines: candidate,
                      truncation: {
                        scope: "bytes",
                        bound: DISPATCH_MAX_MACHINE_BYTES,
                        omittedLines: 99999,
                      },
                    }),
                  ),
              }),
            }),
          },
        }),
    ...(composition.transcript === undefined || composition.supportsIntrospection === undefined
      ? {}
      : {
          message: {
            read: async (input: { readonly ref: string; readonly secrets: readonly string[] }) => {
              const repository = composition.resolveRepository();
              if (repository === undefined) {
                return {
                  ok: false as const,
                  error: {
                    kind: "input",
                    code: "input.value.rejected",
                    summary: "repository identity is unresolvable",
                  },
                };
              }
              const read = await readDispatchLastMessage({
                store: composition.store,
                repository,
                ref: input.ref,
                transcript: composition.transcript as DispatchTranscriptRead,
                supportsIntrospection: composition.supportsIntrospection as (
                  kind: HarnessKind,
                ) => boolean,
                secrets: input.secrets,
              });
              if (!read.ok) {
                return {
                  ok: false as const,
                  error: {
                    kind: "state",
                    code: read.code,
                    summary: `dispatch lane read failed (${read.code})`,
                  },
                };
              }
              return { ok: true as const, data: read.data };
            },
          },
        }),
  };
};

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
        // GH-347 AC-F3-2/DEC-5: the operator resume is admitted regardless of
        // the persisted bound; only an automatic restart consults it.
        const restart = admitDispatchRestart({
          count: lane.restartCount,
          bound: composition.restartBudget ?? 0,
          scope: "operator-resume",
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
      const preflight = composition.preflight;
      const harnessAgent = composition.harnessAgent?.(input.ref);
      const harnessBinding = composition.harnessBinding?.(input.ref);
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
        ...(composition.nominate === undefined ? {} : { nominate: composition.nominate }),
        newAttemptId: () => composition.newAttemptId(input.ref),
        newDivergenceId: () => composition.newDivergenceId(input.ref),
        readTruth: () => composition.readTruth(input.ref),
        ...(preflight === undefined ? {} : { preflight: () => preflight(input.ref) }),
        ...(composition.harnessAdmission === undefined
          ? {}
          : {
              harnessAdmission: async () => {
                const admitted = await composition.harnessAdmission?.();
                if (admitted === undefined) return { ok: true };
                if (admitted.ok) return { ok: true };
                const error = admitted.error;
                return {
                  ok: false,
                  error: {
                    kind: error.kind,
                    code: error.code,
                    ...(error.summary === undefined ? {} : { summary: error.summary }),
                    ...(error.field === undefined ? {} : { field: error.field }),
                    ...(error.harness === undefined ? {} : { harness: error.harness }),
                  },
                };
              },
            }),
        ...(composition.harnessFacts === undefined
          ? {}
          : { harnessFacts: composition.harnessFacts }),
        ...(harnessAgent === undefined ? {} : { harnessAgent }),
        ...(harnessBinding === undefined ? {} : { harnessBinding }),
        ...(composition.laneOwner === undefined ? {} : { laneOwner: composition.laneOwner }),
        ...(composition.killGraceMs === undefined ? {} : { killGraceMs: composition.killGraceMs }),
        ...(composition.freshTitle === undefined
          ? {}
          : (() => {
              const title = composition.freshTitle?.(input.ref);
              return title === undefined ? {} : { freshTitle: title };
            })()),
        ...(composition.appendRestart === undefined
          ? {}
          : { appendRestart: composition.appendRestart }),
        claimLease: () => composition.claimLease(input.ref, repository),
        releaseLease: (cause) => composition.releaseLease(input.ref, cause),
        phaseLedger: composition.phaseLedger(input.ref),
        ...(composition.delay === undefined ? {} : { delay: composition.delay }),
        ...(composition.pushParity === undefined ? {} : { pushParity: composition.pushParity }),
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
  ...(composition.operator === undefined
    ? {}
    : createDispatchOperatorRuntime(composition.operator)),
});
