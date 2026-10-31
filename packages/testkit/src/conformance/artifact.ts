/**
 * `delivery.conformance.v1` schema constants (GH-189 F-8, D-1, D-3, D-9).
 *
 * Declarative constants only. The serializer and validator that consume them
 * live in the same module but are delivered with the artifact phase so every
 * phase boundary stays independently green.
 */
import type {
  ConformanceFlowStatus,
  ConformanceProviderStatus,
  ConformanceSkipKind,
  ConformanceStatus,
  ConformanceStepStatus,
  ConformanceTier,
} from "./types.js";

/** The versioned artifact schema identifier (DM-6). */
export const CONFORMANCE_SCHEMA_ID = "delivery.conformance.v1" as const;

/** The closed tier set. */
export const CONFORMANCE_TIERS = ["mock", "live"] as const satisfies readonly ConformanceTier[];

/** The closed overall/provider status set (D-3). */
export const CONFORMANCE_STATUSES = [
  "passed",
  "failed",
  "not-configured",
] as const satisfies readonly ConformanceStatus[];

/** Per-provider statuses are the same closed set; there is no provider-level skip. */
export const CONFORMANCE_PROVIDER_STATUSES =
  CONFORMANCE_STATUSES satisfies readonly ConformanceProviderStatus[];

/** The closed step status set. */
export const CONFORMANCE_STEP_STATUSES = [
  "executed",
  "skipped",
  "failed",
] as const satisfies readonly ConformanceStepStatus[];

/** The closed flow summary status set. */
export const CONFORMANCE_FLOW_STATUSES = [
  "passed",
  "failed",
  "skipped",
] as const satisfies readonly ConformanceFlowStatus[];

/** The closed skip-kind set (spec §24 v1.2). */
export const CONFORMANCE_SKIP_KINDS = [
  "declared-gap",
  "capability-absent",
  "live-read-only",
] as const satisfies readonly ConformanceSkipKind[];

/**
 * The finite artifact caps (D-1).
 *
 * Every value is a finite positive integer so bounds cannot be silently
 * disabled. `maxArtifactBytes` is 256 KiB.
 */
export const CONFORMANCE_LIMITS = {
  maxProviders: 16,
  maxFlows: 16,
  maxStepsPerFlow: 64,
  maxTotalSteps: 512,
  maxMissingSettingsPerProvider: 16,
  maxFailureDetailChars: 1024,
  maxArtifactBytes: 262144,
} as const;
