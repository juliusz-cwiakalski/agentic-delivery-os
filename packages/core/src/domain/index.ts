/**
 * `@delivery-os/core` domain tier — pure rules.
 * No I/O, no runtime APIs; types only at scaffold.
 */

/** Placeholder marker for the pure domain tier. */
export type DomainPlaceholder = { readonly __tier: "domain" };

export {
  type CapsuleReviewIngestion,
  capsuleCapBreach,
  capsuleCaps,
  capsuleDigest,
  capsuleDisclosureOf,
  capsuleEventGaps,
  capsuleGateEventKey,
  capsulePhaseEventKey,
  capsulePromotionCounts,
  canonicalCapsuleJson,
  deriveCapsuleEventKey,
  emptyCapsulePayload,
  ingestReviewArtifacts,
  isCapsuleCandidateClass,
  isCapsuleCandidateStatus,
  isCapsuleEventKind,
  isCapsuleWriter,
  parseCapsuleEvents,
  payloadFieldViolations,
  serializeCapsuleEvent,
} from "./capsule.js";
export type { CloseoutTelemetryRuntime } from "#contracts";
export { evaluateDiffSweep } from "./closeout-diff-sweep.js";
export { evaluateWorktreeSafety } from "./closeout-worktree.js";
export {
  type CandidateFileViolation,
  candidateFileViolations,
  evaluateCandidates,
  isDeclaredRejectionReason,
  normalizeCandidateStatement,
  validateCandidate,
} from "./capsule-candidates.js";
export {
  type BlockerDelegationDecision,
  type BlockerGuardRequest,
  type BlockerGuardVerdict,
  type BlockerPublishValidated,
  type BlockerPublishValidation,
  type BlockerRanking,
  type BlockerValidationCode,
  type BlockerValidationFailure,
  buildBlockerAnswerData,
  buildBlockerListData,
  buildBlockerPublishData,
  callerAudienceVariableName,
  evaluateBlockerGuard,
  formatBlockerQuestionId,
  isBlockerAudience,
  isBlockerQuestionType,
  isCoordinatorPickup,
  isCredentialNameShaped,
  projectBlockerLaneResume,
  rankBlockerQuestions,
  renderBlockerAnswerHuman,
  renderBlockerPublishHuman,
  renderBlockersHuman,
  resolveAnsweringAudience,
  resolveBlockerDelegation,
  validateBlockerAnswer,
  validateBlockerDelegationPolicy,
  validateBlockerPublish,
} from "./blockers.js";
export { projectBrief, renderBriefHuman } from "./brief.js";
export {
  boundCloseoutData,
  buildCloseoutPlan,
  type CloseoutBranchSafetyInput,
  type CloseoutBranchSafetyVerdict,
  type CloseoutBranchSelection,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  type CloseoutPlanProvider,
  type CloseoutRunInput,
  type CloseoutRunResult,
  canonicalCloseoutJson,
  closeoutStepDefinitions,
  deriveCloseoutOperationId,
  evaluateBranchSafety,
  foldCloseoutOutcomes,
  isProtectedRef,
  renderCloseoutHuman,
  resolveCloseoutBaseRef,
  runCloseout,
  selectMatchingBranch,
  summarizeCloseout,
} from "./closeout.js";
export {
  type CommitActFailure,
  type CommitActNoPending,
  type CommitActOutcome,
  type CommitActPorts,
  type CommitActRequest,
  type CommitActScope,
  type CommitActSuccess,
  type CommitExcluded,
  messageText,
  runCommitAct,
} from "./commit-act.js";
export {
  buildCommitBundle,
  type CommitBundleInput,
  type CommitBundleResult,
  isGeneratedNoise,
} from "./commit-bundle.js";
export { classifyCommitDelta } from "./commit-converge.js";
export {
  type CommitMessageValidation,
  type CommitMessageValidationInput,
  renderCommitMessage,
  sanitizeCommitMessage,
  stripInventedRefs,
  templateCommitMessage,
  templateSubject,
  validateCommitMessage,
} from "./commit-message.js";
export {
  type CommitSafetyVerdict,
  classifyCommitSafety,
  findingClasses,
} from "./commit-safety.js";
export {
  type CommitSkeletonInput,
  commitTypeForPhase,
  resolveCommitSkeleton,
} from "./commit-skeleton.js";
export {
  type CommitStagingInput,
  computeStagingPlan,
} from "./commit-staging.js";
export {
  type CommitGeneration,
  type CommitTransportPorts,
  type CommitTransportSelection,
  generateCommitMessage,
  selectCommitTransport,
} from "./commit-transport.js";
export {
  aggregateDoctorReport,
  formatDoctorFailureSummary,
  renderDoctorHuman,
  runIsolatedDoctorCheck,
} from "./doctor.js";
export {
  evaluateRestartBudget,
  foldRestartRecords,
  type RestartBudgetGateInput,
} from "./economics-budget.js";
export {
  economicsReferenceFor,
  formatBudgetEvidence,
  formatCapabilityGapEvidence,
  formatIncompleteEvidence,
  formatRefusalCorpus,
  formatStallEvidence,
  formatUneconomicalEvidence,
  formatUnevaluableEvidence,
  parseRefusalCorpus,
  type RefusalCorpus,
} from "./economics-evidence.js";
export {
  createOneShotResumeComposition,
  createSupervisedResumeComposition,
  evaluateResumeEconomics,
  isEconomicalRepay,
  type ResumeEconomicsDeps,
} from "./economics-resume.js";
export {
  deriveEconomicsView,
  latestUniqueProgressTokens,
} from "./economics-view.js";
export { canonicalHarnessJson } from "./harness-canonical.js";
export {
  type HarnessCapabilityInspection,
  harnessCapabilityViolations,
  inspectHarnessCapability,
} from "./harness-capability.js";
export { classifyHarnessEvidence } from "./harness-classify.js";
export {
  assembleHarnessLiveness,
  createHarnessLivenessSignalSource,
  createSourcedWatchdogSignalSource,
  harnessLivenessToWatchdogSignals,
} from "./harness-liveness.js";
export {
  type HarnessAdapterRegistration,
  type HarnessVersionProbe,
  harnessRegistryViolations,
  resolveHarnessInstance,
} from "./harness-registry.js";
export { buildHarnessSpawnEnvironment } from "./harness-spawn-env.js";
export {
  boundHarnessTelemetryCapture,
  renderHarnessTelemetryHuman,
} from "./harness-telemetry.js";
export {
  evaluateMergeFreshness,
  isStaleAge,
  type MergeFreshnessEvaluation,
  type MergeFreshnessVoidingReason,
  type MergeGateSetDelta,
  type MergeVerificationStateReason,
  mergeDefaultFreshnessSeconds,
  mergeFreshnessBoundMs,
  mergeGateSetDelta,
  mergeVerificationAgeMs,
} from "./merge-freshness.js";
export {
  batteryGateEntries,
  declaredGateSetOf,
  enforcedMergeGateEntries,
  type MergeEffectiveGateSet,
  type MergeGateSetFailure,
  mergeGateSetIdentity,
  mergeSurfaceEntries,
  resolveMergeGateSet,
  resolveMergeGateSetFromConfig,
} from "./merge-gate-set.js";
export {
  classifyTrackerTransition,
  evaluateRequiredJobGate,
  failedJobNames,
  type MergePosture,
  type MergeTrackerTransition,
  newRedJobs,
  ownerAttentionLabels,
  postureOf,
  type RequiredJobEvaluation,
  recordedFailedJobs,
} from "./merge-probe.js";
export {
  defaultFreshnessSeconds,
  gateSetFromValues,
  internalMergeFailure,
  type MergeCheckRunPage,
  type MergeFailure,
  type MergeFailureEvidence,
  type MergeLandResult,
  type MergeRead,
  type MergeRefreshResult,
  type MergeRequestDetailRead,
  type MergeTransactionConfig,
  type MergeTransactionOutcome,
  type MergeTransactionPorts,
  type MergeWorkItemRead,
  mergeBaseRef,
  mergePostLandingStepIds,
  policyRowForClass,
  renderMergeFailure,
  runMergeTransaction,
} from "./merge-transaction.js";
export {
  authorizeMergeWaiver,
  type MergeWaiverRefusalReason,
  type MergeWaiverVerdict,
  newestWaiverByGate,
  recordedWaiverAuthorizer,
} from "./merge-waiver.js";
export {
  collectorUnavailableCode,
  evaluateOwnerGateSla,
  isCollectorUnavailableFamilyCode,
  type OwnerGateSlaPolicyViolation,
  renderBoardHuman,
  toBoardData,
  validateOwnerGateSlaPolicy,
} from "./owner-gate-sla.js";
export { computePlanDiff, type PlanDiffInput } from "./plan-diff.js";
export { computePlanOverlap, type PlanOverlapInput } from "./plan-overlap.js";
export {
  globToRegExp,
  normalizeRepoPath,
  packageCovers,
  scopeCoversPath,
  staticPrefix,
} from "./plan-paths.js";
export {
  type PlanValidateInput,
  planDocumentFromValidateData,
  validatePlan,
  validatePlanValue,
} from "./plan-validate.js";
export {
  lintPmNotes,
  type PmNotesLintFinding,
  type PmNotesLintLocation,
  type PmNotesLintVerdict,
} from "./pm-notes-lint.js";
export {
  createDeployGateState,
  deployEvidenceOf,
  evaluateDependencyGate,
  evaluateDeployGate,
  producerLanding,
  QUEUE_DEPLOY_READ_BUDGET,
  type QueueDependencyGateOutcome,
  type QueueDeployGateState,
  type QueueDeployOutcome,
} from "./queue-deploy-gate.js";
export {
  buildAdjacency,
  canonicalQueueRef,
  defaultQueuePriority,
  detectCycleForEdge,
  foldLatestDependencies,
  foldLatestDependencyRecords,
  foldLatestEntries,
  foldQueueGraph,
  mergeEdges,
  normalizeEdges,
  normalizeRepositoryKey,
  projectEntry,
  type QueueGraphEdge,
  type QueueGraphFold,
  queueGraphDocument,
} from "./queue-graph.js";
export {
  foldLanes,
  type QueueLaneEconomics,
  type QueueLaneFoldInput,
  renderLanesHuman,
  selectLane,
} from "./queue-lanes.js";
export {
  claimScope,
  defaultLeaseTtlMs,
  earliestTakeoverAtIso,
  evaluateClaimPreconditions,
  foldActiveLeases,
  isLeaseStale,
  leaseConflict,
  leaseHeartbeatAgeMs,
  makeLeaseId,
  type QueueClaimPrecondition,
  type QueueLeaseConflict,
  renewalCadenceMs,
} from "./queue-lease.js";
export {
  clearObservedRecord,
  conditionTypeForCause,
  createParkRecord,
  defaultParkRecheckMs,
  evaluateParkPass,
  evaluateParkRecord,
  hasDuplicateActiveParks,
  latestParkRecords,
  observationGapMs,
  parkConditionForCause,
  type QueueParkContext,
  type QueueParkPass,
  recoveredRecord,
  releasedParkRecord,
} from "./queue-park.js";
export {
  boundQueuePlanData,
  boundQueueReadData,
  computeQueueSchedule,
  isDeclaredBlockingReason,
  QUEUE_NEXT_DEFAULT,
  type QueueHumanData,
  type QueueSchedule,
  type QueueScheduleOptions,
  renderQueueHuman,
} from "./queue-precedence.js";
export {
  isCloseRank,
  isPreemptionAction,
  preemptionBlock,
  preemptionParkCause,
  rankClassIndex,
  resolveRankClass,
} from "./queue-rank.js";
export {
  closeClassOf,
  evaluateQueueReadiness,
  QUEUE_SCHEDULER_CONDITION_ORDER,
  type QueueCiFact,
  type QueueCloseFact,
  type QueueDeployExpectation,
  type QueueDeployFacts,
  type QueueDeployVerdictFact,
  type QueueEntryCheapFacts,
  type QueueParkEvaluation,
  type QueueParkEvaluationState,
  type QueuePlanFact,
  type QueueProviderFact,
  type QueueReadiness,
  type QueueSchedulerFacts,
  type QueueWorkItemFact,
} from "./queue-readiness.js";
export { evaluateQueueReady, renderQueueReadyHuman } from "./queue-ready.js";
export {
  activeHeavyLease,
  isHeldByWeight,
  type QueueWeightLoad,
  type QueueWeightResolution,
  resolveQueueWeight,
  weightLoads,
} from "./queue-weight.js";
export {
  attemptOutOfSeamEvidenceWrite,
  collectRetro,
  evaluateRetroTruthChecks,
  exportRetroEvidence,
  isImplementedRetroLevel,
  RETRO_ENGINE_CHAIN_ANCHOR,
  RETRO_ENGINE_DEFAULT_LEVEL,
  RETRO_ENGINE_EVIDENCE_SCHEMA,
  RETRO_ENGINE_REPORT_SCHEMA,
  RETRO_ENGINE_TRUTH_CHECKS,
  RETRO_TARGET_SELECTION_ORDER,
  type RetroCollectDeps,
  type RetroExportDeps,
  type RetroExportOutcome,
  type RetroReportDeps,
  type RetroTruthCheckInput,
  type RetroTruthCheckOptions,
  recordMemoryAuditRun,
  reportRetro,
  retroLevelRefusalHint,
  selectRetroTarget,
} from "./retro.js";
export {
  classifyPruneCandidate,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  isLiveDbSession,
  type PruneCandidateDecision,
  type PruneCandidateFact,
  renderSessionAdminHuman,
  selectPruneCandidates,
} from "./session-admin.js";
export { sha256Hex } from "./sha256.js";
export {
  computeSpendReport,
  type SpendAbsence,
  type SpendFoldOutcome,
  spendDigestSection,
  spendTruncationWarning,
} from "./spend.js";
export { renderSpendHuman, type SpendHumanOptions } from "./spend-text.js";
export { aggregateStatus, evaluateStatusFindings, renderStatusHuman } from "./status.js";
export {
  classifyVerifyChange,
  classifyVerifyDocument,
  EvaluateVerifyChange,
  formatVerifySummary,
  type VerifyChangeSuccessData,
  type VerifyChangeVerdict,
  type VerifyDocumentClassification,
  type VerifyDocumentReady,
  type VerifyEvidence,
  type VerifyFailure,
  type VerifyFailureKind,
  type VerifyLedgerEvaluation,
  type VerifyRegistryEvidence,
} from "./verify-change.js";
export {
  artifactMatches,
  deployDecisiveEvidence,
  evaluateDeploy,
  projectDeployReport,
  renderStepEvidence,
} from "./verify-deploy.js";
export {
  evaluateDeclaredBattery,
  evaluateVerifyGates,
  isFullHexSha,
  renderVerifyGatesFailureSummary,
  renderVerifyGatesHuman,
  resolveOpenPr,
  type VerifyGatesAbsence,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesEvaluation,
  type VerifyGatesFacts,
  type VerifyGatesNotAttempted,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadFailure,
  type VerifyGatesReadFailureReason,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
  verifyGatesUnknownIdentity,
} from "./verify-gates.js";
export {
  buildWatchdogTeardownData,
  buildWatchdogVerdictData,
  classifyWatchdogLiveness,
  evaluateWatchdogPreflight,
  isLaneWorkspacePath,
  planWatchdogRestoration,
  readWatchdogSignals,
  type WatchdogLivenessEvaluation,
  type WatchdogPlannedAction,
  type WatchdogPreflightBuildInput,
  type WatchdogPreflightEvaluation,
  type WatchdogRestorationPlan,
  watchdogPreservedRefName,
} from "./watchdog.js";
export {
  daemonScopeDigest,
  evaluateDaemonLock,
  takeoverEvidence,
  type DaemonLockRefusal,
} from "./daemon-lock.js";
export {
  buildHeartbeat,
  foldDaemonLiveness,
  type DaemonHeartbeatInput,
  type DaemonLiveness,
} from "./daemon-heartbeat.js";
export {
  controlOfferedVersions,
  decodeControlLine,
  encodeControlFrame,
  unsupportedVersionError,
} from "./control-codec.js";
export {
  createControlSession,
  type ControlSessionApi,
  type ControlSessionOptions,
  type ControlSessionReceive,
  type ControlSubscriptionView,
} from "./control-session.js";
export {
  decideDaemonLane,
  type DaemonLaneDecision,
  type DaemonLaneEvidence,
} from "./daemon-reconcile.js";
export {
  foldDaemonStatus,
  renderDaemonStatusHuman,
  type DaemonStatusFoldInput,
} from "./daemon-status.js";
export {
  initialPollState,
  nextPollDelayMs,
  oneShotPollPlan,
  pollDue,
  pollFailure,
  pollIssued,
  pollSuccess,
  type PollPolicyState,
} from "./poll-policy.js";
export {
  classifyLaneProgress,
  nextSpawnOrdinal,
  shapeDaemonLane,
  type LaneProgressInput,
  type LaneShapingInput,
} from "./daemon-lane.js";
export {
  EFFECT_LEGAL_TRANSITIONS,
  commitIdempotencyKey,
  mayReapply,
  normalizeStagedPaths,
  pathSetsEqual,
  resolveCommitEffect,
  resolveTrackerEffect,
  transitionEffect,
  type CommitQueryOutcome,
  type EffectTransitionDecision,
  type TrackerQueryOutcome,
} from "./effect-protocol.js";
export {
  decidePreemption,
  PREEMPTION_WRITABLE_STATES,
  type PreemptionDecision,
  type PreemptionInput,
} from "./daemon-preemption.js";
export {
  boundWatchLine,
  createWatchProjection,
  type WatchLine,
  type WatchProjection,
} from "./watch-stream.js";
export {
  describeSupervisor,
  renderOwnershipMarker,
  renderSystemdUnit,
  supervisorKindFor,
  supervisorSupported,
  type SupervisorDescriptorInput,
  type SupervisorOwnershipMarker,
  type SupervisorPlatform,
  type SystemdUnitInput,
} from "./daemon-supervisor.js";
