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
export {
  CLOSEOUT_MEMBER_FOLD_PRECEDENCE,
  type CloseoutMemberFoldTier,
  type CloseoutMemberOperationOutcome,
  type CloseoutMemberOutcomeIndex,
  type CloseoutMemberReportMode,
  closeoutMemberRef,
  foldCloseoutMemberOutcomes,
  projectCloseoutMember,
  projectCloseoutMemberCleanup,
  projectCloseoutMemberIssueClosure,
  projectCloseoutMembers,
} from "./closeout-members.js";
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
  windowCorroborationRequirement,
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
  isSpawnTitle,
  normalizeDispatchRepositoryKey,
  normalizeRepositoryRemote,
  parseIdentityMarker,
  resolveDispatchIdentity,
  serializeIdentityMarker,
  spawnTitleFor,
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
  DISPATCH_TRACKER_EXHAUSTED_IDENTITY,
  DISPATCH_TRACKER_LADDER_ATTEMPTS,
  DISPATCH_TRACKER_LADDER_BASE_MS,
  DISPATCH_TRACKER_LADDER_CAP_MS,
  type DispatchTrackerLadderOutcome,
  dispatchTrackerLadderWait,
  runDispatchTrackerLadder,
} from "./dispatch-tracker.js";
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
  evaluateHarnessModeAvailability,
  type HarnessModeAvailability,
  type HarnessModeResolution,
  resolveHarnessMode,
} from "./harness-mode.js";
export {
  bindingEnvironmentRecords,
  bindingInvocationArgs,
  evaluateModelExpressibility,
  type HarnessAgentIdentityViolation,
  type HarnessBindingResolution,
  type HarnessModelExpressibility,
  type HarnessProfileView,
  type HarnessSelectionView,
  harnessAgentIdentityViolation,
  resolveBinding,
} from "./harness-profile-propagation.js";
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
  evaluateHarnessVersion,
  type HarnessVersionEvaluation,
  type HarnessVersionRequirement,
  harnessVersionInWindow,
  indeterminateHarnessVersion,
  normalizeHarnessVersion,
} from "./harness-version-window.js";
export {
  createLaneLaunchPlanner,
  type LaneLaunchPlanFacts,
  planLaneLaunch,
} from "./lane-launch-plan.js";
export { evaluateMemory } from "./memory-lint.js";
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
  BASELINE_ENTRY_DECLARATIONS,
  boundMetricsReport,
  computeMetricsReport,
  drawMetricsWindow,
  METRICS_ENTRY_ORDER,
  METRICS_VERDICTS,
  type MetricsFoldInput,
  type MetricsWindowOutcome,
  mapMeasurementKind,
  resolveMetricsBurnRate,
  resolveMetricsWindow,
} from "./metrics.js";
export { renderMetricsHuman } from "./metrics-text.js";
export {
  boardNeedsDecisionHistory,
  collectorUnavailableCode,
  evaluateOwnerGateSla,
  isCollectorUnavailableFamilyCode,
  type OwnerGateSlaPolicyViolation,
  projectBoard,
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
export {
  canonicalChangeRef,
  isMemberRef,
  MEMBER_REF_SEPARATOR,
  memberRefFor,
  type ParsedMemberRef,
  parseMemberRef,
  parsePlanMembers,
} from "./plan-members.js";
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
  reviewFlowFor,
  reviewRunId,
} from "./review-flow.js";
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
  windowSpendEvidence,
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
  blockingMembersOf,
  type CrossRepositoryMemberOutcome,
  crossRepositoryReport,
  evaluateCrossRepositoryGates,
  evaluateCrossRepositoryMember,
  isCrossRepositoryVerifyGatesReport,
  memberCiReading,
  memberVerdict,
  renderCrossRepositoryVerifyGatesHuman,
  type VerifyGatesMemberReads,
} from "./verify-gates-members.js";
export {
  extractVerifySuiteMapNode,
  renderSuiteMapCauseLine,
  renderVerifyGatesNarrowedFailureSummary,
  resolveVerifySuiteBreadth,
  resolveVerifySuiteMap,
  resolveVerifySuiteMapFromConfig,
  suiteBreadthCitationOf,
  suiteMapReadOfDocument,
  VERIFY_SUITE_MAP_BRANCH_KEY,
  type VerifySuiteBreadthCitation,
  type VerifySuiteBreadthEvaluation,
  type VerifySuiteBreadthWorkflowFacts,
  type VerifySuiteMapNode,
} from "./verify-gates-suite-map.js";
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

/** The derived aging ladder (GH-287 F-3; DEC-3, DEC-9). */
export {
  actionOpenDays,
  evaluateActionAging,
  secondMissReached,
} from "./action-aging.js";
/** Explicit two-plane closure and the list projection (GH-287 F-4; DEC-4, DEC-11). */
export {
  type ActionClosureEvaluation,
  actionClosures,
  actionListEntry,
  actionPlanes,
  closeRetroAction,
  evaluateActionClosure,
  listRetroActions,
  verificationWindowState,
} from "./action-closure.js";
/** The retro action-registry filing gate and improvement-window projection (GH-287 F-1/F-2/F-5). */
export {
  ACTION_PLACEHOLDER_TRACKER_TOKENS,
  type ActionFilingValidation,
  actionArtifactPlaneOpen,
  actionWindowEntries,
  fileRetroAction,
  validateActionFiling,
} from "./action-filing.js";
export {
  type ActionWindowEntry,
  openActionCount,
  windowAtLimit,
  windowDisclosure,
  windowDisclosures,
} from "./action-window.js";
/** The built-in ceremony folds and renderers (GH-296 F-3). */
export {
  CEREMONY_ASSESSMENT_VERDICTS,
  CEREMONY_BUILTIN_SCHEMAS,
  CEREMONY_CHECK_STATE_VALUES,
  CEREMONY_DECLARED_CHECKS,
  CEREMONY_FOLLOW_THROUGH_SCHEMA,
  CEREMONY_RETRO_ACTIONS_SCHEMA,
  CEREMONY_RETRO_EVIDENCE_SCHEMA,
  CEREMONY_RETRO_INSIGHTS_SCHEMA,
  CEREMONY_ROLLOVER_REASONS,
  ceremonyBuiltinConforms,
  ceremonyFollowThroughItems,
  renderCeremonyFollowThrough,
  renderCeremonyRetroActions,
  renderCeremonyRetroEvidence,
  renderCeremonyRetroInsights,
} from "./ceremony-builtins.js";
/** Ceremony measurement and the committed comparison record (GH-296 F-8). */
export {
  buildCeremonyComparison,
  CEREMONY_TREND_TOKENS,
  type CeremonyComparisonBefore,
  type CeremonyComparisonInput,
  type CeremonyMeasurementFold,
  type CeremonyMeasurementRun,
  ceremonyComparisonHonestyViolations,
  ceremonyP90Ms,
  foldCeremonyMeasurement,
} from "./ceremony-comparison.js";
/**
 * The ceremony declaration validator (GH-296 F-2): one pure validator over the
 * closed vocabulary, bounds, and scope-key derivation, shared by built-ins and
 * project declarations.
 */
export {
  CEREMONY_DECLARATION_INVALID,
  type CeremonyDeclarationFailure,
  type CeremonyDeclarationValidation,
  type CeremonyDeclarationValidationOptions,
  ceremonyDeclarationDigest,
  ceremonyExecutableField,
  ceremonyScheduleTrigger,
  ceremonySingleTriggerLabel,
  ceremonyTriggerLabels,
  ceremonyUtf8Bytes,
  validateCeremonyDeclaration,
  validateCeremonyDocument,
} from "./ceremony-declaration.js";
/** The ceremony intake resolution (GH-296 F-1, F-2, F-4, F-9). */
export {
  type CeremonyIntake,
  type CeremonyIntakeFailure,
  type CeremonyIntakeFailureCode,
  type CeremonyIntakeOutcome,
  type CeremonyIntakeRequest,
  type CeremonyRunIdentity,
  ceremonyNoteLevel,
  deriveCeremonyCadenceWindow,
  explicitTriggerResolution,
  isCeremonyScopeKeyDerivation,
  matchDeclaredTrigger,
  resolveCeremonyIntake,
  validateCeremonyNoteForDeclaration,
} from "./ceremony-intake.js";
/** The mirror-sync planning module (GH-296 F-3, NFR-12). */
export {
  CEREMONY_MIRROR_REPORT_SCHEMA,
  CEREMONY_MIRROR_TARGET_SCHEMA,
  type CeremonyMirrorPlan,
  type CeremonyMirrorPlanInput,
  type CeremonyMirrorTargetPlan,
  planCeremonyMirror,
} from "./ceremony-mirror.js";
/** The project ceremony registry (GH-296 F-6). */
export {
  buildCeremonyRegistry,
  type CeremonyDeclarationDocumentFacts,
  type CeremonyOrigin,
  type CeremonyRegistry,
  type CeremonyRegistryEntry,
  type CeremonyRegistryFailure,
  type CeremonyRegistryRead,
  ceremonyProjectEntries,
  ceremonyRegistryEntry,
  ceremonyRegistryIds,
} from "./ceremony-registry.js";
/** Ceremony resume (GH-296 F-4): torn refusal and first-unverified restart. */
export {
  type CeremonyResumeRequest,
  resumeCeremony,
  validateCeremonyStepSequence,
} from "./ceremony-resume.js";
/** The retro ceremony module (GH-296 F-9; GH-287 F-7 producer). */
export {
  ACTION_ARTIFACT_VERDICTS,
  type ActionArtifactVerdict,
  type CeremonyRegistryAction,
  ceremonyFollowThroughFirst,
  isCeremonyLevelName,
  missingRetroNoteMembers,
  RETRO_FIXED_MEMBERS,
  RETRO_LEVEL_TRIGGER_LABELS,
  retroActionCeremonyFacts,
  retroDeclarationShape,
  retroLevelForTrigger,
  retroLevelOf,
  retroLevelTriggerLabel,
} from "./ceremony-retro.js";
/** The ceremony runner engine (GH-296 F-4, F-8). */
export {
  CEREMONY_NIGHT_WATCH_CHECKS,
  type CeremonyCarriedSummary,
  type CeremonyEngineFailure,
  type CeremonyRunData,
  type CeremonyRunEnvironment,
  type CeremonyRunOutcome,
  type CeremonyRunRequest,
  type CeremonyStepOutcome,
  compactCeremonyCarried,
  declarationHasSyncStep,
  executeCeremonyAgenda,
  flattenCeremonyAgenda,
  runCeremony,
} from "./ceremony-run.js";
/** Ceremony schedule evaluation and catch-up (GH-296 F-5). */
export {
  CEREMONY_CATCH_UP_LOOKBACK,
  type CeremonyCatchUpCeremony,
  type CeremonyCatchUpDisposition,
  type CeremonyCatchUpOutcome,
  type CeremonyCatchUpReport,
  type CeremonyCatchUpRequest,
  type CeremonyCatchUpRunData,
  type CeremonyCatchUpTarget,
  type CeremonyRemovedTarget,
  catchUpCeremonies,
  catchUpScopeKey,
  ceremonyCadencePeriodMs,
  ceremonyWindowRecorded,
  dueCeremonyWindows,
  evaluateCeremonySchedule,
} from "./ceremony-schedule.js";
/** The single-source ceremony tier engine (GH-296 F-7). */
export {
  type CeremonyTierEvidence,
  type CeremonyTierInput,
  type CeremonyTierObligation,
  ceremonyPhaseSetForVariant,
  ceremonyTierIntake,
  evaluateCeremonyTier,
  NO_CEREMONY_TIER_EVIDENCE,
} from "./ceremony-tier.js";
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
/**
 * The project group configuration validator (GH-309 F-1, F-2, OQ-1): the
 * pinned load-time rules and the declared-member resolution helpers.
 */
export {
  projectGroupDeclared,
  projectGroupMemberSelectors,
  selectProjectGroups,
  validateProjectGroupsDocument,
} from "./project-groups.js";

/** The pure steering domain (GH-298 F-1..F-10, DM-1..DM-6, DM-8). */
export {
  buildSteerCompleteData,
  buildSteerListData,
  buildSteerReadData,
  buildSteerSendData,
  composeSteerAsks,
  deriveSteerBoundary,
  deriveSteerLifecycle,
  evaluateSteerGuard,
  formatSteerMessageId,
  parseSteerTtl,
  planSteerRead,
  rankSteerMessages,
  renderSteerCompleteHuman,
  renderSteerListHuman,
  renderSteerReadHuman,
  renderSteerSendHuman,
  type SteerCompletionValidated,
  type SteerCompletionValidation,
  type SteerDerivedNote,
  type SteerGuardRequest,
  type SteerGuardVerdict,
  type SteerMessageValidation,
  type SteerReadPlanInput,
  type SteerSendValidated,
  type SteerSendValidation,
  type SteerTtlParse,
  type SteerValidationCode,
  type SteerValidationFailure,
  steerAgeMs,
  steerExpiresAt,
  steerTtlElapsed,
  validateSteerCompletion,
  validateSteerMessage,
  validateSteerSend,
} from "./steer.js";

/**
 * The supervision tri-state fold (GH-295 F-2..F-4, DEC-4, DEC-5): pure
 * classification over artifact facts, the report-count derivation, the lane
 * bound, and the evidence byte bound.
 */
export {
  boundSupervisionEvidence,
  boundSupervisionLanes,
  classifySupervision,
  type SupervisionClassification,
  summarizeSupervision,
} from "./supervise.js";
