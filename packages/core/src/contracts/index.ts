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

export {
  ADAPTER_OPERATIONS,
  type AdapterCapabilityDeclaration,
  type AdapterOperation,
  CARRIER_KINDS,
  type CapabilityGap,
  type CapabilityGapReason,
  type CarrierKind,
  type CarrierSelectionInput,
  type DeclaredCarrierWrite,
} from "./adapter-capabilities.js";

export type {
  CredentialFailureCode,
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  CredentialResolutionFailure,
  CredentialSourceKey,
  SecretMaterial,
} from "./credentials.js";

export {
  type CommentReadView,
  type CommentWriteRequest,
  DEGRADATION_REASONS,
  type DegradationReason,
  ENVELOPE_KINDS,
  ENVELOPE_MAX_BYTES,
  ENVELOPE_SCHEMA_ID,
  type EnvelopeCarrierKind,
  type EnvelopeCommentProvenance,
  type EnvelopeDeliveryLinkage,
  type EnvelopeKind,
  type EnvelopeV1Payload,
  type HeuristicProvenance,
  type MetadataDegradationEvidence,
  type MetadataEnvelopeV1,
} from "./envelope.js";
// The error table is the single machine-readable source of failure identity.
export {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableDomainKind,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
} from "./error-table.js";
export type {
  AdapterContract,
  DeliveryRequest,
  DeliveryRequestReviewState,
  DeliveryStateAlias,
  DeliveryThread,
  ExternalSystemAuthMethod,
  ExternalSystemInstance,
  ExternalSystemKind,
  IdempotencyKey,
  PipelineJob,
  PipelineJobState,
  PipelineRun,
  ProviderQualifiedIdentity,
  RetryBackoff,
  RetryPolicy,
  TraceEvidenceRef,
  WorkflowMap,
  WorkflowStateMapping,
  WorkflowTransitionMechanism,
  WorkItem,
  WorkItemComment,
  WorkItemRelation,
  WorkItemRelationKind,
  WorkItemStatus,
} from "./ports.js";
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
