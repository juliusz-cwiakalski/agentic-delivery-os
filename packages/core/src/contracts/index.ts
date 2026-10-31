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
  type ContentPolicyVerdict,
  DEGRADATION_REASONS,
  type DegradationReason,
  ENVELOPE_KINDS,
  ENVELOPE_MAX_BYTES,
  ENVELOPE_SCHEMA_ID,
  type EnvelopeCarrierKind,
  type EnvelopeCommentProvenance,
  type EnvelopeContentPolicy,
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
// Provider-engine vocabulary (GH-182 F-1..F-9, DM-1..DM-13): types and the
// closed sets/allowlists only; the pure policy lives in `./provider`.
export {
  ANNOUNCEMENT_CODES,
  ANNOUNCEMENT_EVIDENCE_FIELDS,
  ANNOUNCEMENT_SEVERITIES,
  type AnnouncementCode,
  type AnnouncementSeverity,
  type CombinedProviderCondition,
  DEFAULT_MAX_SLEEP_LOOPS,
  PARK_CAUSES,
  PARK_EVIDENCE_FIELDS,
  type ParkCause,
  PROVIDER_ANNOUNCEMENT_RECORD_KEY,
  PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_CONDITION_TIE_ORDER,
  PROVIDER_COST_CLASSES,
  PROVIDER_EVIDENCE_MAX_BYTES,
  PROVIDER_EVIDENCE_MAX_FIELDS,
  PROVIDER_PARK_RECORD_KEY,
  PROVIDER_PARK_SCHEMA_ID,
  PROVIDER_PARK_STATES,
  PROVIDER_PARKS_DOCUMENT_NAME,
  PROVIDER_PARKS_PROJECTION_SCHEMA_ID,
  PROVIDER_PEAK_TIMEZONES,
  PROVIDER_QUOTA_DEFAULTS,
  PROVIDER_RECORD_KINDS,
  PROVIDER_SKIP_REASONS,
  type ProviderAnnouncementEvidence,
  type ProviderAnnouncementRecord,
  type ProviderChain,
  type ProviderClock,
  type ProviderConditionKind,
  type ProviderConditionResult,
  type ProviderConfiguration,
  type ProviderCostClass,
  type ProviderCredentialDeclaration,
  type ProviderDecision,
  type ProviderDescriptor,
  type ProviderEngineResult,
  type ProviderErrorCode,
  type ProviderParkEvidence,
  type ProviderParkRecord,
  type ProviderParkState,
  type ProviderParkView,
  type ProviderPeakTimezone,
  type ProviderPeakWindow,
  type ProviderQuotaPolicy,
  type ProviderQuotaView,
  type ProviderRecordKind,
  type ProviderResolveResult,
  type ProviderSkippedEntry,
  type ProviderSkipReason,
  type ProviderSleep,
  type QuotaEvaluation,
  type QuotaLimit,
  type QuotaSnapshot,
  type QuotaTransport,
  type QuotaTransportRequest,
  type QuotaTransportResult,
} from "./provider.js";
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

// The `delivery.status.v1` vocabulary (GH-175 F-2, DM-1..DM-15): constants and
// types only; the pure aggregator lives in the core domain tier.
export {
  STATUS_CI_RESULTS,
  STATUS_DEPENDENCY_STATES,
  STATUS_EVIDENCE_OUTCOMES,
  STATUS_EVIDENCE_REASONS,
  STATUS_EVIDENCE_SOURCES,
  STATUS_HYGIENE_FINDINGS,
  STATUS_MAX_DETAIL_CHARS,
  STATUS_MAX_EVIDENCE_SOURCES,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_ITEMS_PER_SECTION,
  STATUS_MAX_MACHINE_BYTES,
  STATUS_MAX_OPEN_PULL_REQUESTS,
  STATUS_MAX_PARKED_CHANGES,
  STATUS_MAX_PIPELINE_RUNS,
  STATUS_MAX_PROVIDER_ENTRIES,
  STATUS_MAX_PROVIDER_PARKS,
  STATUS_MAX_REASONS,
  STATUS_MAX_TITLE_CHARS,
  STATUS_MAX_TRACKER_FAMILY_ITEMS,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_PARKED_ITEM_STATES,
  STATUS_PROVIDER_AVAILABILITY,
  STATUS_PROVIDER_CHAIN_STATES,
  STATUS_SCHEMA_VERSION,
  STATUS_SECTION_ORDER,
  STATUS_SECTION_STATES,
  STATUS_SECTION_TITLES,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  STATUS_STALL_STATES,
  STATUS_STALL_THRESHOLD_DAYS,
  STATUS_TRACKER_FAMILIES,
  STATUS_TRACKER_FAMILY_STATES,
  type StatusActiveChange,
  type StatusCiResult,
  type StatusCounts,
  type StatusDeliveryAvailability,
  type StatusDeliveryRequestRead,
  type StatusDependencyState,
  type StatusDigest,
  type StatusEvidence,
  type StatusEvidenceOutcome,
  type StatusEvidenceReason,
  type StatusEvidenceSource,
  type StatusFacts,
  type StatusHeadFacts,
  type StatusHygieneFinding,
  type StatusItemSignalState,
  type StatusLocalContextRead,
  type StatusParkedItemState,
  type StatusParkedWorkEntry,
  type StatusParkedWorkItem,
  type StatusParkRead,
  type StatusPipelineRunRead,
  type StatusProviderAvailability,
  type StatusProviderChainState,
  type StatusProviderConfigRead,
  type StatusProviderEntry,
  type StatusProviderFacts,
  type StatusProviderPark,
  type StatusPullRequestItem,
  type StatusReadFailure,
  type StatusRepositoryBinding,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  type StatusSection,
  type StatusSectionId,
  type StatusSectionState,
  type StatusSignalAvailability,
  type StatusStallState,
  type StatusSummary,
  type StatusTrackerAvailability,
  type StatusTrackerFamily,
  type StatusTrackerFamilyId,
  type StatusTrackerFamilyState,
  type StatusTrackerItem,
  type StatusWorkItemRead,
} from "./status.js";
