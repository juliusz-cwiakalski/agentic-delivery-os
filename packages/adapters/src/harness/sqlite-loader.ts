/**
 * The read-only SQLite seam for opencode telemetry extraction (GH-233 F-7,
 * DEC-5, NFR-2, NFR-3).
 *
 * The production opener uses the workspace SQLite loader pattern (Bun's
 * built-in first, Node's built-in fallback) and always opens read-only. The
 * extractor records every statement, issues `PRAGMA query_only = ON` before the
 * first read, and only ever issues bounded, filtered queries.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type SqliteStatement = {
  all(...parameters: readonly unknown[]): readonly unknown[];
  run(...parameters: readonly unknown[]): unknown;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

type SqliteModule = {
  Database?: new (path: string, options?: { readonly?: boolean }) => SqliteDatabase;
  DatabaseSync?: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;
};

const loadSqlite = (): SqliteModule | undefined => {
  try {
    return require("bun:sqlite") as SqliteModule;
  } catch {
    try {
      return require("node:sqlite") as SqliteModule;
    } catch {
      return undefined;
    }
  }
};

const sqlite = loadSqlite();

const openDatabase = (path: string): SqliteDatabase | undefined => {
  if (sqlite === undefined) return undefined;
  if (sqlite.Database !== undefined) return new sqlite.Database(path, { readonly: true });
  if (sqlite.DatabaseSync !== undefined) return new sqlite.DatabaseSync(path, { readOnly: true });
  return undefined;
};

export type HarnessSqliteRow = Readonly<Record<string, unknown>>;

/** One opened read-only handle. */
export type HarnessSqliteHandle = {
  readonly query: (sql: string, parameters?: readonly unknown[]) => readonly HarnessSqliteRow[];
  readonly execute: (sql: string, parameters?: readonly unknown[]) => void;
  readonly close: () => void;
};

/** The injected store opener (production: read-only built-in SQLite). */
export type HarnessStoreOpener = (
  path: string,
) => { readonly ok: true; readonly handle: HarnessSqliteHandle } | { readonly ok: false };

/** Production opener: always read-only. */
export const createBunSqliteStoreOpener = (): HarnessStoreOpener => (path) => {
  try {
    const database = openDatabase(path);
    if (database === undefined) return { ok: false };
    return {
      ok: true,
      handle: {
        query: (sql, parameters = []) => {
          const statement = database.prepare(sql);
          return statement.all(...parameters).map((row) => row as HarnessSqliteRow);
        },
        execute: (sql, parameters = []) => {
          const statement = database.prepare(sql);
          statement.run(...parameters);
        },
        close: () => database.close(),
      },
    };
  } catch {
    return { ok: false };
  }
};

/** One opened read-only store with its statement log. */
export type HarnessOpenedStore = {
  readonly ok: true;
  readonly handle: HarnessSqliteHandle;
  readonly statements: string[];
};

/** Open a store read-only and set the query-only pragma before any read. */
export const openHarnessStoreReadOnly = (
  opener: HarnessStoreOpener,
  path: string,
  onStatement?: (sql: string) => void,
): HarnessOpenedStore | { readonly ok: false } => {
  const opened = opener(path);
  if (!opened.ok) return { ok: false };
  const statements: string[] = [];
  const handle = opened.handle;
  const guarded: HarnessSqliteHandle = {
    query: (sql, parameters = []) => {
      statements.push(sql);
      onStatement?.(sql);
      return handle.query(sql, parameters);
    },
    execute: (sql, parameters = []) => {
      statements.push(sql);
      onStatement?.(sql);
      handle.execute(sql, parameters);
    },
    close: () => handle.close(),
  };
  try {
    guarded.execute("PRAGMA query_only = ON");
  } catch {
    guarded.close();
    return { ok: false };
  }
  return { ok: true, handle: guarded, statements };
};

/** Attempt a write through the read-only seam; the rejection is data. */
export const attemptWrite = (
  handle: HarnessSqliteHandle,
  sql: string,
): { readonly rejected: boolean } => {
  try {
    handle.execute(sql);
    return { rejected: false };
  } catch {
    return { rejected: true };
  }
};
