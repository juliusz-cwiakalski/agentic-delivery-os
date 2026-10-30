/**
 * `@delivery-os/core/contracts` — the shared language.
 * Runtime-neutral and I/O-free; types only at scaffold.
 */

/** Discriminated result envelope shared by every package. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: E;
    };

export {
  CONFIG_LAYERS,
  type ConfigAcquisition,
  type ConfigErrorCode,
  type ConfigFailure,
  type ConfigFileLayer,
  type ConfigLayer,
  type ConfigLoadedFile,
  type ConfigLocation,
  type ConfigNodeOrigins,
  type ConfigOrigin,
  type ConfigPosition,
  type ConfigSkippedLayer,
  type ConfigSkipReason,
  type ConfigSource,
  type ConfigSourceFacts,
  type ConfigValue,
  type ConfigWarning,
} from "./config.js";

/**
 * The twelve DEC-8 brand values.
 *
 * Defined once in `./contracts`; consumed as parameters; never re-derived.
 * Values originate from the pure resolver in `@delivery-os/core/branding`,
 * invoked at a runtime-aware edge with config-driven data.
 */
export type BrandIdentity = {
  readonly productName: string;
  readonly binaryName: string;
  readonly packageScope: string;
  readonly environmentPrefix: string;
  readonly configDirectoryName: string;
  readonly stateDirectoryName: string;
  readonly mcpToolPrefix: string;
  readonly telemetryNamespace: string;
  readonly docsBaseUrl: string;
  readonly repositoryUrl: string;
  readonly releaseAssetPrefix: string;
  readonly installPath: string;
};

/**
 * EVT-1 — reserved brand-neutral telemetry event schema name.
 *
 * The schema name carries no producer identity. The producer name is branding
 * metadata (`BrandIdentity.telemetryNamespace`); it is never part of a schema
 * name. No emission path exists.
 */
export type TelemetryEventSchemaName = "delivery.event.v1";

/**
 * EVT-2 — reserved brand-neutral telemetry metric schema name (same rule).
 */
export type TelemetryMetricSchemaName = "delivery.metric.v1";

// The state layer's driver-neutral store vocabulary (GH-174 D1, DM-1..DM-5).
// Runtime-neutral: types and the single `as const` schema-version home only.
export {
  STATE_DRIVER_KINDS,
  STATE_LEVELS,
  STATE_SCHEMA_VERSION,
  type StateAppendOutcome,
  type StateAppendRequest,
  type StateDocumentReport,
  type StateDocumentReplaceRequest,
  type StateDriverKind,
  type StateFailure,
  type StateFailureCode,
  type StateFenceAcquisition,
  type StateFenceHandle,
  type StateFenceRecoveryReport,
  type StateFenceReleaseReport,
  type StateFenceStatus,
  type StateIndexRebuildReport,
  type StateIntegrityOutcome,
  type StateJsonValue,
  type StateLevel,
  type StateReadEvidence,
  type StateReadOutcome,
  type StateReadRequest,
  type StateRecord,
  type StateRepairOutcome,
  type StateResult,
  type StateSafeLocation,
  type StateSchemaVersion,
  type StateStoreIdentity,
  type StateStorePort,
  type StateTornTailRepairReport,
  type StateVerificationClass,
} from "./state.js";

// The error table is the single machine-readable source of failure identity.
export {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableDomainKind,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
} from "./error-table.js";
// The command-surface envelope lives beside the generic `Result<T, E>` and does
// not replace it (DEC-1). See `./result` for the full contract documentation.
export {
  type AppErrorCode,
  type CommandResult,
  type CommandResultError,
  type CommandResultFailure,
  type CommandResultSuccess,
  type ErrorCategory,
  type ErrorConsequence,
  type ProjectionClass,
  RESULT_SCHEMA_VERSION,
  type RunTiming,
  type VoidSuccessPayload,
} from "./result.js";
