/**
 * State-layer vocabulary — the driver-neutral store contract (GH-174 D1).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The store
 * identity is injected by the calling edge; nothing here derives a name, reads
 * an environment, or imports branding. `STATE_SCHEMA_VERSION` is the single
 * home of the v1 store-format identifier.
 */
import type { Result } from "./index.js";

/** The only home of the v1 state store-format identifier (DM-4). */
export const STATE_SCHEMA_VERSION = "delivery.state.v1" as const;

export type StateSchemaVersion = typeof STATE_SCHEMA_VERSION;

/** Planned store levels: only `local` is implemented at v1 (DEC-4). */
export const STATE_LEVELS = ["local", "project", "global"] as const;

export type StateLevel = (typeof STATE_LEVELS)[number];

/** The declared driver kinds; selects the read/index strategy only (DEC-2). */
export const STATE_DRIVER_KINDS = ["jsonl", "sqlite"] as const;

export type StateDriverKind = (typeof STATE_DRIVER_KINDS)[number];

/** A JSON-compatible record payload value (DM-2). */
export type StateJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly StateJsonValue[]
  | { readonly [key: string]: StateJsonValue };

/**
 * Store identity (DM-1, Appendix C): every field is injected by the calling
 * edge. Identical inputs yield identical identity; the state tier derives no
 * name from branding and reads no configuration.
 */
export type StateStoreIdentity = {
  readonly level: StateLevel;
  readonly workspaceId: string;
  readonly fenceNamespace: string;
  readonly schemaVersion: StateSchemaVersion;
  readonly stateDirectory: string;
};

/** One append-only ledger record envelope (DM-2). */
export type StateRecord = {
  readonly schemaVersion: string;
  readonly kind: string;
  readonly key: string;
  readonly sequence: number;
  readonly checksum: string;
  readonly payload: StateJsonValue;
};

/** An integrity class a read performed (DM-5). */
export type StateVerificationClass =
  | "framing"
  | "terminal"
  | "sequence"
  | "checksum"
  | "index"
  | "permissions";

/** A safe failure/evidence location: paths and positions only (AC-F9-2). */
export type StateSafeLocation = {
  readonly path: string;
  readonly record?: number;
  readonly missingKeys?: readonly string[];
};

/** The nine dedicated state failure codes (GH-174 §8.3; GH-222 DEC-5). */
export type StateFailureCode =
  | "state.store.torn"
  | "state.schema.mismatch"
  | "state.keys.missing"
  | "state.lock.busy"
  | "state.permission.denied"
  | "state.write.failed"
  | "state.level.unsupported"
  | "state.storage.exhausted"
  | "state.store.unknown";

/**
 * The additive salvage record kind (GH-222 EVT-1, DM-1). Additive inside
 * `delivery.state.v1`: no schema-version bump and no migration (NG-6).
 */
export const STATE_SALVAGE_RECORD_KIND = "state.salvage" as const;

/** The self-describing payload schema identifier of a salvage record. */
export const STATE_SALVAGE_PAYLOAD_SCHEMA = "delivery.state.salvage.v1" as const;

/** The store-scoped key that carries salvage records (latest value per key). */
export const STATE_SALVAGE_RECORD_KEY = "state.salvage" as const;

/** The four distinct boundary verdicts (AC-F1-1, DM-4). */
export const STATE_BOUNDARY_VERDICTS = ["valid", "verified-empty", "torn", "unknown"] as const;

export type StateBoundaryVerdict = (typeof STATE_BOUNDARY_VERDICTS)[number];

/** The declared payload field types an artifact-boundary declaration admits. */
export const STATE_ARTIFACT_FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "null",
] as const;

export type StateArtifactFieldType = (typeof STATE_ARTIFACT_FIELD_TYPES)[number];

/**
 * A classified state failure. The classification chain resolves the exact
 * `(kind, code)` through the error table; every state failure is `not_landed`
 * because the ledger is append-only and derived documents are replaced
 * atomically (DEC-8).
 */
export type StateFailure = {
  readonly kind: "state";
  readonly code: StateFailureCode;
  readonly consequence: "not_landed";
  readonly location: StateSafeLocation;
};

export type StateResult<T> = Result<T, StateFailure>;

/** A per-read key-set declaration (Appendix B); the store never invents one. */
export type StateReadRequest = {
  readonly requiredKeys: readonly string[];
};

/** Index divergence evidence, asserted only for the indexed kind (AC-F3-1). */
export type StateIndexRebuildReport = {
  readonly reason: "missing" | "corrupt" | "divergent";
  readonly records: number;
  readonly path: string;
};

/** Terminal torn-tail repair evidence (AC-F4-3). */
export type StateTornTailRepairReport = {
  readonly removedBytes: number;
  readonly removedRecords: number;
  readonly path: string;
};

/** Explicit stale-fence recovery evidence (AC-F7-3). */
export type StateFenceRecoveryReport = {
  readonly token: string;
  readonly staleToken: string;
  readonly recoveredAtMs: number;
  readonly path: string;
};

/** Explicit per-read verdict (DM-5): verified, verified-empty, or torn. */
export type StateReadEvidence = {
  readonly storePath: string;
  readonly verification: readonly StateVerificationClass[];
  readonly verifiedEmpty: boolean;
  readonly recordCount: number;
  readonly rebuild?: StateIndexRebuildReport;
  readonly repair?: StateTornTailRepairReport;
  readonly recovery?: StateFenceRecoveryReport;
  readonly cleanedTemporaries?: readonly string[];
};

/** A verified read: the requested values plus the evidence that produced them. */
export type StateReadOutcome = {
  readonly values: Readonly<Record<string, StateJsonValue>>;
  readonly evidence: StateReadEvidence;
};

/** One appended record's observable outcome. */
export type StateAppendOutcome = {
  readonly sequence: number;
  readonly checksum: string;
  readonly path: string;
};

/** A replaced derived document: ledger-first, then atomically swapped (DEC-8). */
export type StateDocumentReport = {
  readonly name: string;
  readonly path: string;
  readonly sequence: number;
};

/**
 * The single-writer fence handle (DEC-7, AC-F7-1/2).
 *
 * The unique-symbol brand makes a handle unforgeable in consumer code: write
 * operations cannot be invoked without one acquired from a store.
 */
declare const stateFenceHandleBrand: unique symbol;

export type StateFenceHandle = {
  readonly [stateFenceHandleBrand]: "state-fence-handle";
  readonly token: string;
  readonly workspaceId: string;
  readonly fenceNamespace: string;
};

/** An acquired fence: the handle plus its token (no store internals leak). */
export type StateFenceAcquisition = {
  readonly handle: StateFenceHandle;
  readonly token: string;
};

/** A released fence report. */
export type StateFenceReleaseReport = {
  readonly token: string;
  readonly released: boolean;
};

/** A fence snapshot: whether a lock is held and whether it is stale. */
export type StateFenceStatus = {
  readonly held: boolean;
  readonly stale: boolean;
  readonly token?: string;
};

/** An integrity-check verdict without values (reads may still be torn). */
export type StateIntegrityOutcome = {
  readonly evidence: StateReadEvidence;
};

/** A torn-tail repair outcome. */
export type StateRepairOutcome = {
  readonly repaired: boolean;
  readonly report: StateTornTailRepairReport;
  readonly evidence: StateReadEvidence;
};

/**
 * Salvage evidence (DM-3): the truncation position and the quarantined extent,
 * with record counts only — never payload content or checksum bytes.
 */
export type StateSalvageReport = {
  readonly ledgerPath: string;
  /** Byte offset of the last valid frame the ledger was truncated to. */
  readonly truncationOffset: number;
  /** Byte extent of the quarantined post-tear bytes. */
  readonly quarantinedBytes: number;
  readonly quarantinePath: string;
  readonly keptRecords: number;
  readonly discardedFrames: number;
  /** Sequence number of the appended salvage record. */
  readonly sequence: number;
};

/**
 * The explicit guided salvage outcome: a salvaged tear with its evidence
 * report, or a reported no-op when the ledger has no terminal tear.
 */
export type StateSalvageOutcome =
  | {
      readonly salvaged: true;
      readonly report: StateSalvageReport;
      readonly evidence: StateReadEvidence;
    }
  | { readonly salvaged: false; readonly evidence: StateReadEvidence };

/** The self-describing salvage record payload (EVT-1, DM-1). */
export type StateSalvageRecord = {
  readonly schemaId: typeof STATE_SALVAGE_PAYLOAD_SCHEMA;
  readonly tearPosition: number;
  readonly truncationOffset: number;
  readonly quarantinedBytes: number;
  readonly quarantinePath: string;
  readonly keptRecords: number;
  readonly discardedFrames: number;
};

/** One declared payload field of an artifact kind (DM-4). */
export type StateArtifactField = {
  readonly name: string;
  readonly type: StateArtifactFieldType;
  readonly required: boolean;
};

/** A closed value vocabulary for one declared payload field (DM-4). */
export type StateArtifactVocabulary = {
  readonly field: string;
  readonly values: readonly string[];
};

/**
 * One declared artifact kind: its payload schema identifier, the payload field
 * that carries the record identity, and its declared fields. Declarations are
 * data: applying them to another kind requires no code change (DM-4, ASM-4).
 */
export type StateArtifactKindDeclaration = {
  readonly kind: string;
  /** Required `payload.schemaId` value; omitted when the payload carries none. */
  readonly payloadSchema?: string;
  readonly identityField: string;
  readonly fields: readonly StateArtifactField[];
  readonly vocabularies?: readonly StateArtifactVocabulary[];
};

/**
 * A reusable artifact-boundary declaration: the store-scoped key prefix the
 * boundary owns and the kinds it declares under it (DM-4).
 */
export type StateArtifactBoundaryDeclaration = {
  readonly recordKeyPrefix: string;
  readonly kinds: readonly StateArtifactKindDeclaration[];
};

/** One verified artifact record as the boundary serves it. */
export type StateArtifactRecord = {
  readonly kind: string;
  readonly recordKey: string;
  readonly sequence: number;
  readonly payload: StateJsonValue;
};

/** A validated boundary read: only the two value-bearing verdicts succeed. */
export type StateArtifactRead = {
  readonly verdict: "valid" | "verified-empty";
  readonly artifacts: readonly StateArtifactRecord[];
  readonly evidence: StateReadEvidence;
};

/**
 * The driver-neutral store port (DM-3). No operation or type discriminates by
 * driver kind; the kind is consumed by the factory that selects an instance.
 */
export type StateStorePort = {
  readonly identity: StateStoreIdentity;
  read(request: StateReadRequest): StateResult<StateReadOutcome>;
  /**
   * Read every verified ledger record in sequence order. Consumer ledgers that
   * append one event per record fold their history from this view; the
   * latest-value `read` remains the projection for single-value keys.
   */
  readRecords(): StateResult<{
    readonly records: readonly StateRecord[];
    readonly evidence: StateReadEvidence;
  }>;
  append(handle: StateFenceHandle, request: StateAppendRequest): StateResult<StateAppendOutcome>;
  replaceDocument(
    handle: StateFenceHandle,
    request: StateDocumentReplaceRequest,
  ): StateResult<StateDocumentReport>;
  acquireFence(token: string): StateResult<StateFenceAcquisition>;
  releaseFence(handle: StateFenceHandle): StateResult<StateFenceReleaseReport>;
  fenceStatus(): StateFenceStatus;
  recoverFence(token: string): StateResult<StateFenceRecoveryReport>;
  checkIntegrity(): StateResult<StateIntegrityOutcome>;
  repairTornTail(): StateResult<StateRepairOutcome>;
  /**
   * Explicit guided terminal-tail salvage (F-3, DEC-2): truncate to the last
   * valid frame, append the classified salvage record, and quarantine the
   * post-tear bytes. Never triggered by a read; a mid-record tear refuses with
   * zero byte mutation.
   */
  salvage(handle: StateFenceHandle): StateResult<StateSalvageOutcome>;
  /**
   * Read one store-managed artifact (the store-layout family beside the header
   * and fence files). Absent → `state.keys.missing`; unreadable →
   * `state.store.torn`; wrong permission bits → `state.permission.denied`.
   */
  readStoreArtifact(request: StateStoreArtifactReadRequest): StateResult<StateStoreArtifact>;
  /**
   * Read the store-managed artifact, or create it once with runtime-edge random
   * material. An artifact absent while any `guardKinds` record exists is
   * `state.keys.missing` — never silently regenerated.
   */
  ensureStoreArtifact(request: StateStoreArtifactRequest): StateResult<StateStoreArtifact>;
};

/** One append: a consumer record kind, a store-scoped key, a JSON payload. */
export type StateAppendRequest = {
  readonly kind: string;
  readonly recordKey: string;
  readonly payload: StateJsonValue;
};

/** One derived-document replace: a bare file name and its JSON content. */
export type StateDocumentReplaceRequest = {
  readonly name: string;
  readonly content: StateJsonValue;
};

/**
 * One store-managed artifact read (DM-5): a bare file name in the store layout.
 * Absent, unreadable, or permission-mismatched artifacts fail classified.
 */
export type StateStoreArtifactReadRequest = {
  readonly name: string;
};

/**
 * One store-managed artifact get-or-create (DM-5). `create` receives
 * cryptographically random hex generated at the runtime edge and returns the
 * artifact content; `guardKinds` names the record kinds whose presence proves
 * the artifact must already exist (absent on a non-first open →
 * `state.keys.missing`). Nothing is generated when the artifact exists.
 */
export type StateStoreArtifactRequest = {
  readonly name: string;
  readonly randomBytes: number;
  readonly create: (randomHex: string) => string;
  readonly guardKinds: readonly string[];
};

/** One store-managed artifact as the port serves it. */
export type StateStoreArtifact = {
  readonly name: string;
  readonly path: string;
  readonly created: boolean;
  readonly content: string;
};
