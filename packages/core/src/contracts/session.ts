/**
 * The `delivery.session-admin.v1` vocabulary (GH-180 PIN-1, DM-D1..DM-D8).
 *
 * Runtime-neutral by construction: types, interfaces, and `as const` data only.
 * No clock, randomness, environment, filesystem, network, or executable
 * statement exists in this module. The pure policy lives in
 * `core ./domain/session-admin`; production I/O lives in
 * `@delivery-os/adapters/session`.
 */

/** Machine data schema version (spec §3.10). */
export const DB_SCHEMA_VERSION = "delivery.session-admin.v1" as const;

/** The closed command set (spec §3.1). */
export const DB_COMMANDS = ["size", "list", "prune", "reboot"] as const;

/** The closed mode set (spec §3.4, §3.5). */
export const DB_MODES = ["dry-run", "applied"] as const;

/** The live-session window in minutes; the lower boundary is inclusive. */
export const DB_LIVE_WINDOW_MINUTES = 15 as const;

/** `db prune` default age threshold in days. */
export const DB_DEFAULT_OLDER_THAN_DAYS = 30 as const;

/** `db prune` age-threshold floor. */
export const DB_MIN_OLDER_THAN_DAYS = 1 as const;

/** `db prune` age-threshold ceiling. */
export const DB_MAX_OLDER_THAN_DAYS = 3650 as const;

/** `db list` default page size. */
export const DB_DEFAULT_LIST_LIMIT = 20 as const;

/** `db list` page ceiling. */
export const DB_MAX_LIST_LIMIT = 100 as const;

/** `db prune` default batch size. */
export const DB_DEFAULT_PRUNE_LIMIT = 50 as const;

/** `db prune` batch ceiling. */
export const DB_MAX_PRUNE_LIMIT = 500 as const;

/** Shared flag floor. */
export const DB_MIN_LIMIT = 1 as const;

/** Session-id output and interpolation cap. */
export const DB_MAX_ID_CHARS = 128 as const;

/** ISO-8601 UTC output cap. */
export const DB_MAX_TIMESTAMP_CHARS = 32 as const;

/** Runtime database-path output cap. */
export const DB_MAX_PATH_CHARS = 1024 as const;

/** Rendered item lines per human report. */
export const DB_MAX_HUMAN_ITEMS = 32 as const;

/** Human report line cap. */
export const DB_MAX_HUMAN_LINES = 40 as const;

/** Human report byte cap. */
export const DB_MAX_HUMAN_BYTES = 8192 as const;

/** Serialized `data` byte cap. */
export const DB_MAX_MACHINE_BYTES = 524288 as const;

/** The only session-id shape admitted for interpolation or command use. */
export const DB_SESSION_ID_PATTERN = "^[A-Za-z0-9_-]+$" as const;

/** One read-query ceiling. */
export const DB_QUERY_TIMEOUT_MS = 30000 as const;

/** One delete-invocation ceiling. */
export const DB_DELETE_TIMEOUT_MS = 30000 as const;

/** The single checkpoint ceiling. */
export const DB_CHECKPOINT_TIMEOUT_MS = 120000 as const;

/** One of the four declared subcommands. */
export type DbCommand = (typeof DB_COMMANDS)[number];

/** One of the two declared modes. */
export type DbMode = (typeof DB_MODES)[number];

/** The database and sidecar facts reported by `size` (DM-D1). */
export type DbDatabaseFacts = {
  readonly path: string;
  readonly dbBytes: number;
  readonly walBytes: number;
  readonly shmBytes: number;
  readonly walPresent: boolean;
  readonly shmPresent: boolean;
};

/** Store-wide counts reported by `size` (DM-D1). */
export type DbCounts = {
  readonly sessions: number;
  readonly messages: number;
  readonly parts: number;
};

/**
 * The closed per-session item shape (DM-D2).
 *
 * `parentId` is optional and absent for roots: it is never `undefined` and
 * never `null`. `archived` is `session.time_archived IS NOT NULL`.
 */
export type SessionSummary = {
  readonly id: string;
  readonly parentId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly messageCount: number;
  readonly partCount: number;
  readonly dataBytes: number;
  readonly archived: boolean;
  readonly live: boolean;
};

/** `db size` payload (DM-D1). */
export type SizeData = {
  readonly schemaVersion: typeof DB_SCHEMA_VERSION;
  readonly command: "size";
  readonly database: DbDatabaseFacts;
  readonly counts: DbCounts;
  readonly oldestSessionUpdatedAt: string | null;
  readonly newestSessionUpdatedAt: string | null;
};

/** `db list` payload (DM-D2). */
export type ListData = {
  readonly schemaVersion: typeof DB_SCHEMA_VERSION;
  readonly command: "list";
  readonly limit: number;
  readonly total: number;
  readonly omitted: number;
  readonly truncated: boolean;
  readonly items: readonly SessionSummary[];
};

/** `db prune` counts (DM-D3). */
export type PruneData = {
  readonly schemaVersion: typeof DB_SCHEMA_VERSION;
  readonly command: "prune";
  readonly mode: DbMode;
  readonly olderThanDays: number;
  readonly limit: number;
  readonly liveWindowMinutes: typeof DB_LIVE_WINDOW_MINUTES;
  readonly cutoff: string;
  readonly counts: {
    readonly selected: number;
    readonly deleted: number;
    readonly failed: number;
    readonly skipped: number;
    readonly liveExcluded: number;
  };
  readonly candidates: readonly SessionSummary[];
};

/** `db reboot` database facts (DM-D4). */
export type RebootData = {
  readonly schemaVersion: typeof DB_SCHEMA_VERSION;
  readonly command: "reboot";
  readonly mode: DbMode;
  readonly liveWindowMinutes: typeof DB_LIVE_WINDOW_MINUTES;
  readonly liveSessions: number;
  readonly blockedByLiveSession: boolean;
  readonly checkpointPerformed: boolean;
  readonly database: {
    readonly path: string;
    readonly walBytesBefore: number;
    readonly walBytesAfter?: number;
    readonly walPresent: boolean;
    readonly shmPresent: boolean;
  };
};

/**
 * The classified session-admin failure.
 *
 * The code is one of the four declared `db.*` identities; `summary` carries the
 * bounded, normative partial-failure text when one exists; `field` names an
 * over-cap or invalid field without carrying its raw value.
 */
export type SessionAdminError = {
  readonly kind: "db";
  readonly code:
    | "db.opencode.unavailable"
    | "db.query.failed"
    | "db.delete.failed"
    | "db.reboot.live";
  readonly summary?: string;
  readonly field?: string;
};

/** The internal result shape shared by the two ports (spec §4.2). */
export type SessionAdminResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SessionAdminError };

/** One `size` read. */
export type SessionSizeRead = SessionAdminResult<SizeData>;

/** One `list` read. */
export type SessionListRead = SessionAdminResult<ListData>;

/** One `prune` read. */
export type SessionPruneRead = SessionAdminResult<PruneData>;

/** One `reboot` read. */
export type SessionRebootRead = SessionAdminResult<RebootData>;

/** The read-only session-store port (ADR-0003 `SessionStore` semantics). */
export interface SessionStorePort {
  size(): Promise<SessionSizeRead>;
  list(input: { readonly limit: number; readonly nowMs: number }): Promise<SessionListRead>;
}

/** The admin port: the read surface plus the two mutating operations. */
export interface SessionAdminPort extends SessionStorePort {
  prune(input: {
    readonly olderThanDays: number;
    readonly limit: number;
    readonly apply: boolean;
    readonly nowMs: number;
  }): Promise<SessionPruneRead>;
  reboot(input: { readonly apply: boolean; readonly nowMs: number }): Promise<SessionRebootRead>;
}
