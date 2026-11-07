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
export { runConformance } from "./conformance/runner.js";
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
export {
  type CapsuleConformanceEntry,
  CAPSULE_CONFORMANCE_REGISTRY,
  capsuleConformanceViolations,
} from "./conformance/capsule.js";
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
