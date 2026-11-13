/**
 * `@delivery-os/core` domain tier — pure rules.
 * No I/O, no runtime APIs; types only at scaffold.
 */

/** Placeholder marker for the pure domain tier. */
export type DomainPlaceholder = { readonly __tier: "domain" };

export type { CloseoutTelemetryRuntime } from "#contracts";
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
  type CapsuleReviewIngestion,
  canonicalCapsuleJson,
  capsuleCapBreach,
  capsuleCaps,
  capsuleDigest,
  capsuleDisclosureOf,
  capsuleEventGaps,
  capsuleGateEventKey,
  capsulePhaseEventKey,
  capsulePromotionCounts,
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
export {
  type CandidateFileViolation,
  candidateFileViolations,
  evaluateCandidates,
  isDeclaredRejectionReason,
  normalizeCandidateStatement,
  validateCandidate,
} from "./capsule-candidates.js";
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
export { evaluateDiffSweep } from "./closeout-diff-sweep.js";
export { evaluateWorktreeSafety } from "./closeout-worktree.js";
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
  controlOfferedVersions,
  decodeControlLine,
  encodeControlFrame,
  unsupportedVersionError,
} from "./control-codec.js";
export {
  type ControlSessionApi,
  type ControlSessionOptions,
  type ControlSessionReceive,
  type ControlSubscriptionView,
  createControlSession,
} from "./control-session.js";
export {
  buildHeartbeat,
  type DaemonHeartbeatInput,
  type DaemonLiveness,
  foldDaemonLiveness,
} from "./daemon-heartbeat.js";
export {
  classifyLaneProgress,
  type LaneProgressInput,
  type LaneShapingInput,
  nextSpawnOrdinal,
  shapeDaemonLane,
} from "./daemon-lane.js";
export {
  type DaemonLockRefusal,
  daemonScopeDigest,
  evaluateDaemonLock,
  takeoverEvidence,
} from "./daemon-lock.js";
export {
  decidePeakResumes,
  decidePeakStops,
  type InterruptedRecoveryAdmission,
  type PeakEpisodeIdFactory,
  type PeakExhaustionPort,
  type PeakRecoveryAppendPort,
  type PeakReentryPort,
  type PeakResumeDecision,
  type PeakResumeRefusal,
  type PeakResumeRoute,
  type PeakRulesLookup,
  type PeakSessionResumePort,
  type PeakStopDecision,
  type PeakStopPort,
  type PeakWatchLane,
  peakWindowOpenAt,
  recoverInterruptedLane,
  runPeakResume,
  runPeakWatch,
} from "./daemon-peak-pause.js";
export {
  decidePreemption,
  PREEMPTION_WRITABLE_STATES,
  type PreemptionDecision,
  type PreemptionInput,
} from "./daemon-preemption.js";
export {
  type DaemonLaneDecision,
  type DaemonLaneEvidence,
  decideDaemonLane,
} from "./daemon-reconcile.js";
export {
  type DaemonStatusFoldInput,
  foldDaemonStatus,
  renderDaemonStatusHuman,
} from "./daemon-status.js";
export {
  describeSupervisor,
  renderOwnershipMarker,
  renderSystemdUnit,
  type SupervisorDescriptorInput,
  type SupervisorOwnershipMarker,
  type SupervisorPlatform,
  type SystemdUnitInput,
  supervisorKindFor,
  supervisorSupported,
} from "./daemon-supervisor.js";
export {
  buildDispatchAuthorityView,
  type DispatchAuthorityFold,
  dualRunAuthority,
  foldDispatchHandover,
  isAuthoritative,
  parseDispatchAuthorityText,
  parseDispatchAuthorityView,
} from "./dispatch-authority.js";
export {
  buildComparisonRecord,
  buildCorroborationRecord,
  type ComparisonInput,
  type CorroborationFact,
  type CorroborationFacts,
  classifyFalseSuccess,
  comparisonClassOf,
  corroborationSatisfied,
  dispatchFamilyOf,
  isComparisonDivergence,
  isComparisonShapeValid,
  requiredCorroboration,
  unreadableCorroborationSources,
} from "./dispatch-comparison.js";
export {
  COUNTED_EVIDENCE_CLASS,
  countedEvidenceClass,
  type DispatchEvidenceWindow,
  type DispatchGateEvaluation,
  type DispatchRepositoryScope,
  evaluateHandoverGate,
  foldEvidenceWindow,
  handoverConditionsSnapshot,
  longestConsecutiveRun as dispatchLongestConsecutiveRun,
  toSummaryData,
} from "./dispatch-gate.js";
export {
  DISPATCH_IDENTITY_SCHEMA,
  DISPATCH_IDENTITY_SOURCES,
  type DispatchIdentityResolution,
  type DispatchIdentitySource,
  isRepositoryIdentity,
  normalizeDispatchRepositoryKey,
  normalizeRepositoryRemote,
  parseIdentityMarker,
  resolveDispatchIdentity,
  serializeIdentityMarker,
} from "./dispatch-identity.js";
export {
  DISPATCH_LIVENESS_ABSENCE_REASONS,
  DISPATCH_LIVENESS_SIGNALS,
  DISPATCH_LIVENESS_UNKNOWN_REASONS,
  DISPATCH_LIVENESS_VERDICTS,
  type DispatchLivenessAbsent,
  type DispatchLivenessEvaluation,
  type DispatchLivenessReading,
  type DispatchLivenessSignal,
  type DispatchLivenessSourced,
  type DispatchLivenessUnknownReason,
  type DispatchLivenessVerdict,
  evaluateDispatchLiveness,
} from "./dispatch-liveness.js";
export {
  classifyDispatchFailure,
  classifySpawnRefusal,
  DISPATCH_FAILURE_KINDS,
  DISPATCH_READ_FAILURE_SOURCES,
  type DispatchArtifactFacts,
  type DispatchDerivation,
  type DispatchFailureClassification,
  type DispatchFailureKind,
  type DispatchHarnessFacts,
  type DispatchLedgerFacts,
  type DispatchPrFact,
  type DispatchRead,
  type DispatchReadFailure,
  type DispatchRestartFacts,
  type DispatchResumeAdmission,
  type DispatchSpawnRefusal,
  type DispatchTrackerFacts,
  type DispatchTruthInput,
  deriveDispatchResult,
} from "./dispatch-result.js";
export {
  admissionRefusalPair,
  admitDispatchRestart,
  type DispatchRestartDecision,
  type DispatchResumeEconomics,
  type DispatchResumePlan,
  evaluateDispatchResumeEconomics,
  planDispatchResume,
} from "./dispatch-resume.js";
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
export {
  type CommitQueryOutcome,
  commitIdempotencyKey,
  EFFECT_LEGAL_TRANSITIONS,
  type EffectTransitionDecision,
  mayReapply,
  normalizeStagedPaths,
  pathSetsEqual,
  resolveCommitEffect,
  resolveTrackerEffect,
  type TrackerQueryOutcome,
  transitionEffect,
} from "./effect-protocol.js";
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
  createLaneLaunchPlanner,
  type LaneLaunchPlanFacts,
  planLaneLaunch,
} from "./lane-launch-plan.js";
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
export type { OwnerHoldMarkerOutcome, OwnerHoldResolutionInput } from "./owner-hold.js";
// The pure owner-hold resolver (GH-280 F-1, DM-1, D12): one injected fact over
// an injected environment record, production store directory, and marker
// outcome; no ambient environment or filesystem access.
export {
  ownerHoldEnvironmentVariableName,
  resolveOwnerHoldFact,
  sanitizeOwnerHoldReason,
} from "./owner-hold.js";
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
  initialPollState,
  nextPollDelayMs,
  oneShotPollPlan,
  type PollPolicyState,
  pollDue,
  pollFailure,
  pollIssued,
  pollSuccess,
} from "./poll-policy.js";
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
  type QueuePresenceFacts,
  queueGraphDocument,
  queuePresenceFacts,
  queueRefPresent,
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
  attributedValue,
  attributeStep,
  joinAttributionSubstrates,
  type TelemetryAttribution,
  type TelemetryAttributionInput,
  type TelemetryAttributionSubstrates,
  type TelemetryClaimedIdentity,
  type TelemetrySessionIdentity,
} from "./telemetry-attribution.js";
export {
  decodeTelemetryStepFrame,
  emptyIngestTally,
  TELEMETRY_IGNORED_FRAME_TYPES,
  type TelemetryFrameContext,
  type TelemetryFrameOutcome,
  type TelemetryIngestTally,
  type TelemetrySessionTotals,
  type TelemetrySessionTotalsReader,
  tallyFrame,
  tallyIngestDegradation,
} from "./telemetry-ingest.js";
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
  boundWatchLine,
  createWatchProjection,
  type WatchLine,
  type WatchProjection,
} from "./watch-stream.js";
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

/* ---------------------- coordinator supervision (GH-241) ----------------- */

export {
  type CoordinatorRestartAdmission,
  evaluateCoordinatorRestartAdmission,
  nextRestartOrdinal,
} from "./coordinator-admission.js";
export {
  type CoordinatorEscalationPayload,
  type CoordinatorQuestionSlice,
  escalationOptions,
  isCoordinatorEscalationRef,
  isEscalationState,
  isReservedEscalationQuestion,
  projectEscalationState,
  projectReservedSlotQuestions,
} from "./coordinator-escalation.js";
export {
  boundEvidence,
  type CoordinatorEvidenceFacts,
  type CoordinatorStuckEvaluation,
  evaluateStuck,
  utf8ByteLength,
} from "./coordinator-evidence.js";
export {
  ageFallbackBoundMs,
  type CoordinatorClaimDecision,
  type CoordinatorClaimFacts,
  type CoordinatorLease,
  type CoordinatorLeaseFoldInput,
  decideCoordinatorClaim,
  foldCoordinatorLease,
  leaseAgeMs,
} from "./coordinator-fence.js";
export {
  type CoordinatorLifecycleDecision,
  type CoordinatorLifecycleFacts,
  type CoordinatorPriorSession,
  decideLifecycle,
  lifecycleEffect,
} from "./coordinator-lifecycle.js";
export {
  type CoordinatorObservationFacts,
  persistedTickVerdict,
  progressingTickVerdict,
  projectCoordinatorObservation,
} from "./coordinator-observe.js";
export { coordinatorUnitIdentity, projectCoordinatorRegime } from "./coordinator-regime.js";
export {
  type CoordinatorWakeEvaluation,
  type CoordinatorWakeFacts,
  type CoordinatorWakeHead,
  type CoordinatorWakeKey,
  evaluateWake,
  wakeKeyFor,
} from "./coordinator-wake.js";
export {
  createEventProjector,
  EVENT_PROJECTION_MAX_PER_TOPIC_PER_TICK,
  EVENT_TOPICS,
  type EventProjector,
  type EventProjectorOptions,
  type EventTopic,
  type ProjectedEvent,
  type ProjectionWatermarkEntry,
} from "./event-projection.js";
