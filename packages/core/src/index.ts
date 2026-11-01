/**
 * `@delivery-os/core` — the composition-root (`.`) entry module.
 * Empty-but-enforced: the signature is declared, not implemented, at scaffold.
 */

/** Resolved configuration passed in by a runtime-aware surface. */
export type RuntimeConfig = { readonly __kind: "runtime-config" };

/** Adapter instances passed in by a runtime-aware surface. */
export type RuntimeAdapters = { readonly __kind: "runtime-adapters" };

/** State store instance passed in by a runtime-aware surface. */
export type RuntimeStore = { readonly __kind: "runtime-store" };

/** Time source passed in by a runtime-aware surface. */
export type RuntimeClock = { readonly __kind: "runtime-clock" };

/** Wired application services returned by the composition root. */
export type Runtime = { readonly __kind: "runtime" };

/** The one composition root: `createRuntime({ config, adapters, store, clock })`. */
export declare function createRuntime(options: {
  config: RuntimeConfig;
  adapters: RuntimeAdapters;
  store: RuntimeStore;
  clock: RuntimeClock;
}): Runtime;

export {
  BOOTSTRAP_DESCRIPTOR,
  type CatalogField,
  type ConfigCatalog,
  catalogPaths,
  compileTrustedSchema,
  type DefaultPositionManifest,
  defaultsFor,
  generateConfigSchema,
  originLabel,
  PRODUCTION_CATALOG,
  PRODUCTION_DEFAULTS,
  PRODUCTION_SCHEMA,
  type ResolveConfigInput,
  type ResolvedConfig,
  resolveConfig,
  serializeProductionSchema,
} from "./config/index.js";
export {
  aggregateStatus,
  boundCloseoutData,
  buildCloseoutPlan,
  canonicalCloseoutJson,
  classifyPruneCandidate,
  closeoutStepDefinitions,
  deriveCloseoutOperationId,
  evaluateBranchSafety,
  foldCloseoutOutcomes,
  isProtectedRef,
  renderCloseoutHuman,
  resolveCloseoutBaseRef,
  runCloseout,
  selectMatchingBranch,
  sha256Hex,
  summarizeCloseout,
  type CloseoutBranchSafetyInput,
  type CloseoutBranchSafetyVerdict,
  type CloseoutBranchSelection,
  type CloseoutDependentFact,
  type CloseoutPlanFacts,
  type CloseoutPlanProvider,
  type CloseoutRunInput,
  type CloseoutRunResult,
  classifyVerifyChange,
  classifyVerifyDocument,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  evaluateQueueReady,
  formatVerifySummary,
  isLiveDbSession,
  lintPmNotes,
  type PmNotesLintFinding,
  type PmNotesLintLocation,
  type PmNotesLintVerdict,
  renderQueueReadyHuman,
  type PruneCandidateDecision,
  type PruneCandidateFact,
  renderSessionAdminHuman,
  renderStatusHuman,
  selectPruneCandidates,
  type VerifyChangeSuccessData,
  type VerifyChangeVerdict,
  type VerifyDocumentClassification,
  type VerifyDocumentReady,
  type VerifyEvidence,
  type VerifyFailure,
  type VerifyFailureKind,
  type VerifyRegistryEvidence,
} from "./domain/index.js";
