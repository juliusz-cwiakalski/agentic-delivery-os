/**
 * `@delivery-os/testkit` — dev-only fakes and conformance helpers (`.`).
 * Re-exports the envelope conformance validator for test suites.
 */

export {
  CONFORMANCE_FLOW_STATUSES,
  CONFORMANCE_LIMITS,
  CONFORMANCE_PROVIDER_STATUSES,
  CONFORMANCE_SCHEMA_ID,
  CONFORMANCE_SKIP_KINDS,
  CONFORMANCE_STATUSES,
  CONFORMANCE_STEP_STATUSES,
  CONFORMANCE_TIERS,
} from "./conformance/artifact.js";
export { CONFORMANCE_ADAPTERS } from "./conformance/adapters.js";
export {
  LIVE_READ_OPERATIONS,
  runtimeCoverageViolations,
  structuralCoverageViolations,
} from "./conformance/coverage.js";
export { CONFORMANCE_FLOWS, findFlow } from "./conformance/flows.js";
export { createMockTenantTransport, decodeMockTenant } from "./conformance/mock-tenant.js";
export { runConformance } from "./conformance/runner.js";
export type { MockTenantTransport } from "./conformance/mock-tenant.js";
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
export { assertEnvelopeContract } from "./result-conformance.js";
