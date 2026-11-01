/**
 * `@delivery-os/core` domain tier — pure rules.
 * No I/O, no runtime APIs; types only at scaffold.
 */

/** Placeholder marker for the pure domain tier. */
export type DomainPlaceholder = { readonly __tier: "domain" };

export {
  boundCloseoutData,
  buildCloseoutPlan,
  canonicalCloseoutJson,
  closeoutStepDefinitions,
  deriveCloseoutOperationId,
  evaluateBranchSafety,
  foldCloseoutOutcomes,
  isProtectedRef,
  renderCloseoutHuman,
  resolveCloseoutBaseRef,
  selectMatchingBranch,
  summarizeCloseout,
  type CloseoutBranchSafetyInput,
  type CloseoutBranchSafetyVerdict,
  type CloseoutBranchSelection,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  type CloseoutPlanProvider,
} from "./closeout.js";
export { sha256Hex } from "./sha256.js";
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
export { aggregateStatus, renderStatusHuman } from "./status.js";
export {
  classifyVerifyChange,
  classifyVerifyDocument,
  formatVerifySummary,
  type VerifyChangeSuccessData,
  type VerifyChangeVerdict,
  type VerifyDocumentClassification,
  type VerifyDocumentReady,
  type VerifyEvidence,
  type VerifyFailure,
  type VerifyFailureKind,
  type VerifyRegistryEvidence,
} from "./verify-change.js";
