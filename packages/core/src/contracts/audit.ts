/**
 * Command audit-ledger vocabulary (GH-223 F-1..F-6, DM-1..DM-6).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The audit
 * ledger is additive inside `delivery.state.v1`; these identifiers are the
 * single home of the audit record kinds, payload schemas, store-scoped key,
 * field sets, outcome vocabulary, claimed-identity marker, and the durable
 * chaining-key artifact naming rule. No environment, clock, randomness, or
 * filesystem access lives here.
 */
import type { ProjectionClass, RunTiming } from "./result.js";
import type { StateArtifactBoundaryDeclaration } from "./state.js";

/** The per-invocation audit record kind (EVT-1, DM-1). */
export const AUDIT_INVOCATION_RECORD_KIND = "audit.invocation" as const;

/** The reservation-first ordinal-evidence record kind (EVT-2, DM-6). */
export const AUDIT_RESERVATION_RECORD_KIND = "audit.reservation" as const;

/** The self-describing payload schema of an invocation record (DM-1). */
export const AUDIT_INVOCATION_PAYLOAD_SCHEMA = "delivery.audit.invocation.v1" as const;

/** The self-describing payload schema of a reservation record (DM-6). */
export const AUDIT_RESERVATION_PAYLOAD_SCHEMA = "delivery.audit.reservation.v1" as const;

/** The single store-scoped key that carries both audit record kinds. */
export const AUDIT_RECORD_KEY = "audit.invocations" as const;

/** The artifact-boundary key prefix owned by the audit kinds. */
export const AUDIT_RECORD_KEY_PREFIX = "audit.invocations" as const;

/**
 * The declared suffix of the identity environment variable. The variable name
 * is `BrandIdentity.environmentPrefix` + this suffix — derived, never a
 * hardcoded product token (DEC-3, TC-013).
 */
export const AUDIT_IDENTITY_VARIABLE_SUFFIX = "AGENT_IDENTITY" as const;

/** The only attribution kind: claimed, never verified (DM-3, OQ-10). */
export const AUDIT_ATTRIBUTION_KINDS = ["claimed"] as const;

export type AuditAttributionKind = (typeof AUDIT_ATTRIBUTION_KINDS)[number];

/** The outcome-class vocabulary, aligned with the exit projection taxonomy. */
export const AUDIT_OUTCOME_CLASSES = [
  "success",
  "user-validation",
  "platform-provider",
] as const satisfies readonly ProjectionClass[];

export type AuditOutcomeClass = (typeof AUDIT_OUTCOME_CLASSES)[number];

/** The 13 audited invocation fields (v1.4, DM-1). */
export const AUDIT_INVOCATION_FIELDS = [
  "runId",
  "command",
  "arguments",
  "exitCode",
  "timing",
  "resultSchemaVersion",
  "outcomeClass",
  "scope",
  "repo",
  "startedAt",
  "auditSeq",
  "agentIdentity",
  "chainValue",
] as const;

/** The three audited reservation fields — no invocation metadata (DM-6). */
export const AUDIT_RESERVATION_FIELDS = ["auditSeq", "runId", "chainValue"] as const;

/** The chain anchor a store's first audit-domain record links from (DEC-4). */
export const AUDIT_CHAIN_ANCHOR = "audit.chain.anchor.v1" as const;

/** The payload schema identifier of the durable chaining-key artifact (DM-5). */
export const AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA = "delivery.audit.chain-key.v1" as const;

/** The store-layout artifact name family for the chaining key (DM-5, OQ-19). */
export const AUDIT_CHAIN_KEY_ARTIFACT_PREFIX = "chain-key." as const;
export const AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX = ".json" as const;

/** The key-material width in bytes (64 lowercase hex characters). */
export const AUDIT_CHAIN_KEY_BYTES = 32 as const;

/** The fixed hex width of a chain value (two keyed 64-bit halves). */
export const AUDIT_CHAIN_VALUE_HEX_LENGTH = 32 as const;

/** The derived identity-variable name: seam prefix plus the declared suffix. */
export const auditIdentityVariableName = (environmentPrefix: string): string =>
  `${environmentPrefix}${AUDIT_IDENTITY_VARIABLE_SUFFIX}`;

/** The store-layout artifact name: `chain-key.<workspace>.json` (OQ-19). */
export const auditChainKeyArtifactName = (workspaceId: string): string =>
  `${AUDIT_CHAIN_KEY_ARTIFACT_PREFIX}${encodeURIComponent(workspaceId)}${AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX}`;

/** Whether a record kind belongs to the audit domain (both kinds participate). */
export const isAuditRecordKind = (kind: string): boolean =>
  kind === AUDIT_INVOCATION_RECORD_KIND || kind === AUDIT_RESERVATION_RECORD_KIND;

/**
 * The validated artifact-boundary declaration for both audit kinds (DEC-5).
 * Both kinds share the store-scoped key family and are admitted only through
 * this declaration; the invocation payload carries the 13 audited fields and
 * the reservation payload the three reservation fields, each with the
 * self-describing `schemaId` marker.
 */
export const AUDIT_BOUNDARY_DECLARATION: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: AUDIT_RECORD_KEY_PREFIX,
  kinds: [
    {
      kind: AUDIT_INVOCATION_RECORD_KIND,
      payloadSchema: AUDIT_INVOCATION_PAYLOAD_SCHEMA,
      identityField: "runId",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "runId", type: "string", required: true },
        { name: "command", type: "string", required: true },
        { name: "arguments", type: "array", required: true },
        { name: "exitCode", type: "number", required: true },
        { name: "timing", type: "object", required: true },
        { name: "resultSchemaVersion", type: "string", required: true },
        { name: "outcomeClass", type: "string", required: true },
        { name: "scope", type: "string", required: true },
        { name: "repo", type: "string", required: false },
        { name: "startedAt", type: "number", required: true },
        { name: "auditSeq", type: "number", required: true },
        { name: "agentIdentity", type: "object", required: false },
        { name: "chainValue", type: "string", required: true },
      ],
      vocabularies: [{ field: "outcomeClass", values: AUDIT_OUTCOME_CLASSES }],
    },
    {
      kind: AUDIT_RESERVATION_RECORD_KIND,
      payloadSchema: AUDIT_RESERVATION_PAYLOAD_SCHEMA,
      identityField: "runId",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "auditSeq", type: "number", required: true },
        { name: "runId", type: "string", required: true },
        { name: "chainValue", type: "string", required: true },
      ],
    },
  ],
};

/** A claimed identity: the verbatim value plus the explicit marker (DM-3). */
export type AuditAgentIdentity = {
  readonly kind: AuditAttributionKind;
  readonly value: string;
};

/** One invocation's audited facts as the command surface assembled them. */
export type AuditInvocationFacts = {
  readonly runId: string;
  readonly command: string;
  readonly arguments: readonly string[];
  readonly exitCode: number;
  readonly timing: RunTiming;
  readonly resultSchemaVersion: string;
  readonly outcomeClass: AuditOutcomeClass;
  readonly scope: string;
  readonly repo?: string;
  readonly startedAt: number;
  readonly agentIdentity?: AuditAgentIdentity;
};

/** A stored invocation record payload (schema marker plus the 13 fields). */
export type AuditInvocationRecord = AuditInvocationFacts & {
  readonly schemaId: typeof AUDIT_INVOCATION_PAYLOAD_SCHEMA;
  readonly auditSeq: number;
  readonly chainValue: string;
};

/** A stored reservation record payload (schema marker plus three fields). */
export type AuditReservationRecord = {
  readonly schemaId: typeof AUDIT_RESERVATION_PAYLOAD_SCHEMA;
  readonly auditSeq: number;
  readonly runId: string;
  readonly chainValue: string;
};

/** One chain break: a record position only — never payload or checksum bytes. */
export type AuditChainBreak = {
  readonly position: number;
  readonly auditSeq: number;
};

/** One skipped-ordinal finding: a reservation without its invocation record. */
export type AuditReservationOrphanFinding = {
  readonly auditSeq: number;
  readonly runId: string;
  readonly position: number;
};

/** The chain-verification verdict over the verified audit-domain sequence. */
export type AuditChainVerdict = {
  readonly verified: boolean;
  readonly records: number;
  readonly breaks: readonly AuditChainBreak[];
  readonly orphans: readonly AuditReservationOrphanFinding[];
  readonly storePath: string;
};

/** The bounded, filtered read query. `limit` is mandatory (DEC-6, F-5). */
export type AuditReadQuery = {
  readonly limit: number;
  readonly scope?: string;
  readonly repo?: string;
  readonly command?: string;
  readonly outcomeClass?: AuditOutcomeClass;
  readonly from?: number;
  readonly to?: number;
};

/** One read-surface outcome: verified matches plus in-band findings. */
export type AuditReadOutcome = {
  readonly verifiedEmpty: boolean;
  readonly records: readonly AuditInvocationRecord[];
  readonly matched: number;
  readonly truncated: boolean;
  readonly chain: AuditChainVerdict;
  readonly storePath: string;
};

/** A read-surface refusal reuses the existing input identity (DEC-7, OQ-6). */
export type AuditReadRefusal = {
  readonly kind: "input";
  readonly code: "input.value.rejected";
  readonly consequence: "not_landed";
  readonly location: { readonly path: string };
};

/** A read-surface failure is a state classification or a validation refusal. */
export type AuditReadFailure =
  | {
      readonly kind: "state";
      readonly code: string;
      readonly consequence: "not_landed";
      readonly location: {
        readonly path: string;
        readonly record?: number;
        readonly missingKeys?: readonly string[];
      };
    }
  | AuditReadRefusal;

export type AuditReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AuditReadFailure };
