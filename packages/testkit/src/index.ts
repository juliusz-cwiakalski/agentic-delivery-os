/**
 * `@delivery-os/testkit` — dev-only fakes and conformance helpers (`.`).
 * Re-exports the envelope conformance validator for test suites.
 */

export {
  createTempGitRepository,
  type RepoCommandResult,
  type TempGitRepository,
  type TempGitRepositoryOptions,
} from "./commit/git-repo.js";
export {
  createSafetyScanner,
  createScriptedCommitlint,
  createScriptedTransport,
  type ScriptedCommitlint,
  type ScriptedSafetyScanner,
  type ScriptedTransport,
  type ScriptedTransportStep,
  transportAvailability,
} from "./commit/transport-fakes.js";
export { CONFORMANCE_ADAPTERS } from "./conformance/adapters.js";
export {
  CONFORMANCE_FLOW_STATUSES,
  CONFORMANCE_LIMITS,
  CONFORMANCE_PROVIDER_STATUSES,
  CONFORMANCE_SCHEMA_ID,
  CONFORMANCE_SKIP_KINDS,
  CONFORMANCE_STATUSES,
  CONFORMANCE_STEP_STATUSES,
  CONFORMANCE_TIERS,
  CONFORMANCE_TRUNCATION_MARKER,
  serializeConformanceArtifact,
  toConformanceArtifact,
  validateConformanceArtifact,
} from "./conformance/artifact.js";
export {
  CAPSULE_CONFORMANCE_REGISTRY,
  type CapsuleConformanceEntry,
  capsuleConformanceViolations,
} from "./conformance/capsule.js";
export {
  LIVE_READ_OPERATIONS,
  runtimeCoverageViolations,
  structuralCoverageViolations,
} from "./conformance/coverage.js";
export { CONFORMANCE_FLOWS, findFlow } from "./conformance/flows.js";
export {
  HARNESS_CONFORMANCE_REGISTRY,
  HARNESS_CONFORMANCE_SCENARIOS,
  type HarnessConformanceDeps,
  type HarnessConformanceIo,
  type HarnessConformanceRegistration,
  type HarnessConformanceScenarioId,
  harnessConformanceViolations,
} from "./conformance/harness.js";
export type { MockTenantTransport } from "./conformance/mock-tenant.js";
export { createMockTenantTransport, decodeMockTenant } from "./conformance/mock-tenant.js";
export type {
  ParityCell,
  ParityCellEntry,
  ParityCellKind,
  ParityClauseId,
  ParityDifferenceClass,
  ParityEvidence,
  ParityGateInput,
  ParityMatrix,
  ParityMatrixColumn,
  ParityObservation,
  ParityObservationRecord,
  ParityObservationSet,
  ParityRegisterEntry,
  ParityViolation,
} from "./conformance/parity.js";
export {
  buildParityMatrix,
  PARITY_CELL_KINDS,
  PARITY_CLAUSE_IDS,
  PARITY_DETAIL_MAX_CHARS,
  PARITY_DIFFERENCE_CLASSES,
  PARITY_MATRIX,
  parityViolations,
  renderParityViolation,
} from "./conformance/parity.js";
export { runConformance } from "./conformance/runner.js";
export type {
  StatefulEffect,
  StatefulTenantOptions,
  StatefulTenantTransport,
} from "./conformance/stateful-double.js";
export {
  canonicalizeState,
  createStatefulTenantTransport,
  STATEFUL_EFFECTS,
} from "./conformance/stateful-double.js";
export type {
  TrackerClassification,
  TrackerDeliveredIdentity,
  TrackerErrorClass,
  TrackerErrorClassId,
  TrackerFamilyOutcome,
  TrackerObservableOutcome,
  TrackerStructuredDiscriminator,
  TrackerStructuredFailure,
  TrackerTrapFamily,
} from "./conformance/tracker-error-taxonomy.js";
export {
  classifyTrackerFailure,
  classifyTrackerOutcome,
  ownsHttpStatus,
  TRACKER_ERROR_CLASS_IDS,
  TRACKER_ERROR_TAXONOMY,
  TRACKER_FAMILY_OUTCOMES,
  TRACKER_TRAP_FAMILIES,
} from "./conformance/tracker-error-taxonomy.js";
export type {
  ConformanceAdapterClient,
  ConformanceAdapterRead,
  ConformanceAdapterReadFailure,
  ConformanceAdapterRegistration,
  ConformanceArtifact,
  ConformanceAssertionFamily,
  ConformanceClientBuildInput,
  ConformanceCredentialPort,
  ConformanceDecodeResult,
  ConformanceDeliveryState,
  ConformanceFailure,
  ConformanceFailureScalar,
  ConformanceFlow,
  ConformanceFlowResult,
  ConformanceFlowStatus,
  ConformanceFlowStep,
  ConformancePipelineJobState,
  ConformanceProviderFlowSummary,
  ConformanceProviderResult,
  ConformanceProviderStatus,
  ConformanceReport,
  ConformanceSkipKind,
  ConformanceStatus,
  ConformanceStepResult,
  ConformanceStepStatus,
  ConformanceTier,
  ConformanceTotals,
  ConformanceTransport,
  ConformanceTransportRequest,
  ConformanceTransportResponse,
  ConformanceWriteHandler,
  ConformanceWriteInput,
  ConformanceWriteOutcome,
  GithubMockAddressing,
  GitlabMockAddressing,
  JiraMockAddressing,
  MockTenant,
  MockTenantAddressing,
  MockTenantRoute,
  RunConformanceInput,
} from "./conformance/types.js";
export type {
  RuleId,
  ScriptedRuleId,
  ScriptedViolation,
  Violation,
} from "./result-conformance.js";
export {
  assertEnvelopeContract,
  assertScriptedProjection,
  RULES,
  SCRIPTED_RULES,
} from "./result-conformance.js";
