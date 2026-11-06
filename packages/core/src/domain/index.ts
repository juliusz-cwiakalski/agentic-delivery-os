/**
 * `@delivery-os/core` domain tier — pure rules.
 * No I/O, no runtime APIs; types only at scaffold.
 */

/** Placeholder marker for the pure domain tier. */
export type DomainPlaceholder = { readonly __tier: "domain" };

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
  collectorUnavailableCode,
  evaluateOwnerGateSla,
  isCollectorUnavailableFamilyCode,
  type OwnerGateSlaPolicyViolation,
  renderBoardHuman,
  toBoardData,
  validateOwnerGateSlaPolicy,
} from "./owner-gate-sla.js";
export {
  globToRegExp,
  normalizeRepoPath,
  packageCovers,
  scopeCoversPath,
  staticPrefix,
} from "./plan-paths.js";
export { computePlanDiff, type PlanDiffInput } from "./plan-diff.js";
export { computePlanOverlap, type PlanOverlapInput } from "./plan-overlap.js";
export {
  planDocumentFromValidateData,
  validatePlan,
  validatePlanValue,
  type PlanValidateInput,
} from "./plan-validate.js";
export {
  lintPmNotes,
  type PmNotesLintFinding,
  type PmNotesLintLocation,
  type PmNotesLintVerdict,
} from "./pm-notes-lint.js";
export { evaluateQueueReady, renderQueueReadyHuman } from "./queue-ready.js";
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
export { aggregateStatus, renderStatusHuman } from "./status.js";
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
export { commitTypeForPhase, resolveCommitSkeleton, type CommitSkeletonInput } from "./commit-skeleton.js";
export {
  buildCommitBundle,
  isGeneratedNoise,
  type CommitBundleInput,
  type CommitBundleResult,
} from "./commit-bundle.js";
export {
  computeStagingPlan,
  type CommitStagingInput,
} from "./commit-staging.js";
export {
  classifyCommitSafety,
  findingClasses,
  type CommitSafetyVerdict,
} from "./commit-safety.js";
export {
  renderCommitMessage,
  sanitizeCommitMessage,
  stripInventedRefs,
  templateCommitMessage,
  templateSubject,
  validateCommitMessage,
  type CommitMessageValidation,
  type CommitMessageValidationInput,
} from "./commit-message.js";
export {
  generateCommitMessage,
  selectCommitTransport,
  type CommitGeneration,
  type CommitTransportPorts,
  type CommitTransportSelection,
} from "./commit-transport.js";
export { classifyCommitDelta } from "./commit-converge.js";
export {
  messageText,
  runCommitAct,
  type CommitActFailure,
  type CommitActNoPending,
  type CommitActOutcome,
  type CommitActPorts,
  type CommitActRequest,
  type CommitActScope,
  type CommitActSuccess,
  type CommitExcluded,
} from "./commit-act.js";
