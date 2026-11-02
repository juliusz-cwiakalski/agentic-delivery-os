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

/** The seven dedicated state failure codes (GH-174 §8.3). */
export type StateFailureCode =
  | "state.store.torn"
  | "state.schema.mismatch"
  | "state.keys.missing"
  | "state.lock.busy"
  | "state.permission.denied"
  | "state.write.failed"
  | "state.level.unsupported";

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
