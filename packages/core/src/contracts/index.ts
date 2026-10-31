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
// The eleven-token delivery result vocabulary and its total taxonomy (GH-177
// C-4, TDR-0005): the single enum home, data and types only.
export {
  DELIVERY_RESULT_DERIVATION_CLASSES,
  DELIVERY_RESULT_PROJECTION_CLASSES,
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultDerivationClass,
  type DeliveryResultProjectionClass,
  type DeliveryResultTaxonomyEntry,
  type DeliveryResultToken,
} from "./delivery-result.js";
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
// pm-notes schema vocabulary (GH-179 C-1, C-2): types and `as const` data only.
export {
  CANONICAL_PHASE_IDS,
  LITE_REQUIRED_PHASES,
  PM_NOTES_COLLECTION_KEYS,
  PM_NOTES_DEFAULT_VARIANT,
  PM_NOTES_LINT_CODES,
  PM_NOTES_OPTIONAL_STRING_KEYS,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
  PM_NOTES_REQUIRED_TOP_LEVEL_KEYS,
  PM_NOTES_VARIANT_VALUES,
  type PmNotesCollectionEntry,
  type PmNotesDocument,
  type PmNotesEffectiveVariant,
  type PmNotesLintCode,
  type PmNotesLitePhaseId,
  type PmNotesParseFailure,
  type PmNotesParseOutcome,
  type PmNotesPhaseEntry,
  type PmNotesPhaseId,
  type PmNotesTimestamp,
  type PmNotesVariant,
} from "./pm-notes.js";
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
// Delivery registry record vocabulary (GH-179 C-5, PIN-3).
export {
  PHASE_STATE_DOCUMENT_NAME_PATTERN,
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  PHASE_TRANSITION_KIND,
  type PhaseStateProjection,
  type PhaseStateProjectionEntry,
  type PhaseTransitionOperation,
  type PhaseTransitionOutcome,
  type PhaseTransitionRecord,
  REGISTRY_SCHEMA_VERSION,
} from "./registry.js";
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
// The state layer's driver-neutral store vocabulary (GH-174 D1, DM-1..DM-5).
// Runtime-neutral: types and the single `as const` schema-version home only.
export {
  STATE_DRIVER_KINDS,
  STATE_LEVELS,
  STATE_SCHEMA_VERSION,
  type StateAppendOutcome,
  type StateAppendRequest,
  type StateDocumentReplaceRequest,
  type StateDocumentReport,
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
