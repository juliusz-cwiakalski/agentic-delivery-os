/**
 * The production runtime edge (GH-174 D1, TDR-0004 §2/§6).
 *
 * The only module in the state tier that touches runtime APIs: filesystem,
 * permissions (POSIX bits or the Windows ACL branch), the injected clock, and
 * the runtime-provided SQLite binding. Tests inject their own edge.
 */
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { createRequire } from "node:module";
import { RETRO_APPEND_TIMEOUT_MS, RETRO_READ_TIMEOUT_MS, type RetroSidecarIo } from "#contracts";
import type {
  StateEdgeFaultPoint,
  StateIndexRow,
  StatePathKind,
  StatePlatform,
  StateRuntimeEdge,
} from "../edge.js";
import {
  isStorageExhaustion,
  storageExhaustionFailure,
  storageFailureCode,
} from "./../storage-error.js";

const require = createRequire(import.meta.url);

type SqliteStatement = {
  run(...parameters: readonly unknown[]): unknown;
  all(...parameters: readonly unknown[]): readonly unknown[];
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

type SqliteModule = {
  Database?: new (path: string) => SqliteDatabase;
  DatabaseSync?: new (path: string) => SqliteDatabase;
};

const INDEX_TABLE =
  "CREATE TABLE IF NOT EXISTS records (sequence INTEGER PRIMARY KEY, " +
  "key TEXT NOT NULL, kind TEXT NOT NULL, checksum TEXT NOT NULL, payload TEXT NOT NULL)";

const loadSqlite = (): SqliteModule | undefined => {
  // TDR-0004: prefer Bun's built-in, fall back to Node's built-in. A runtime
  // without either is declared unsupported for the `sqlite` kind only.
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
  if (sqlite.Database !== undefined) return new sqlite.Database(path);
  if (sqlite.DatabaseSync !== undefined) return new sqlite.DatabaseSync(path);
  return undefined;
};

const currentWindowsUser = (): string => process.env.USERNAME ?? process.env.USER ?? "";

const platform: StatePlatform = process.platform === "win32" ? "win32" : "posix";

const ensureMode = (path: string, kind: StatePathKind): void => {
  if (platform === "win32") {
    // Documented Windows platform contract (OQ-2): current-user-only ACL,
    // applied at creation and verified on open. Owner-environment verification.
    const user = currentWindowsUser();
    if (user.length === 0) throw new Error("cannot resolve the current Windows user");
    execFileSync("icacls", [path, "/inheritance:r", "/grant:r", `${user}:F`], {
      stdio: "ignore",
    });
    return;
  }
  chmodSync(path, kind === "directory" ? 0o700 : 0o600);
};

/**
 * Whether an `icacls` listing names a principal other than the current user
 * (AC-F8-2 fail-closed verification). Pure so the matcher is testable without
 * a Windows host; the regex needs one literal backslash for `BUILTIN\Users`.
 */
export const hasForeignAclGrant = (output: string): boolean =>
  /Everyone|BUILTIN\\Users|Authenticated Users/i.test(output);

const verifyMode = (path: string, kind: StatePathKind): boolean => {
  if (!existsSync(path)) return true;
  if (platform === "win32") {
    const user = currentWindowsUser();
    if (user.length === 0) return false;
    const output = execFileSync("icacls", [path], { encoding: "utf8" });
    return !hasForeignAclGrant(output) && output.includes(user);
  }
  const expected = kind === "directory" ? 0o700 : 0o600;
  return (statSync(path).mode & 0o777) === expected;
};

/**
 * Run one storage write and re-raise an ENOSPC-family failure in the
 * distinguishable exhaustion form, so the facade can classify it as
 * `state.storage.exhausted` instead of `state.write.failed` (GH-222 F-5).
 */
const writeGuarded = <T>(write: () => T): T => {
  try {
    return write();
  } catch (error) {
    const code = storageFailureCode(error);
    if (code !== undefined && isStorageExhaustion(error)) {
      throw storageExhaustionFailure(code);
    }
    throw error;
  }
};

/** The production edge: real filesystem, real clock, real SQLite binding. */
export const createNodeStateEdge = (): StateRuntimeEdge => ({
  platform,
  now: () => Date.now(),
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  writeFile: (path, text) => {
    writeGuarded(() => writeFileSync(path, text));
    ensureMode(path, "file");
  },
  appendFile: (path, text) => {
    writeGuarded(() => {
      const descriptor = openSync(path, "a");
      try {
        writeSync(descriptor, text);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
    });
    ensureMode(path, "file");
  },
  createExclusiveFile: (path, text) => {
    let descriptor: number;
    try {
      descriptor = openSync(path, "wx", 0o600);
    } catch (error) {
      if ((error as { code?: string }).code === "EEXIST") return false;
      throw error;
    }
    try {
      writeSync(descriptor, text);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    ensureMode(path, "file");
    return true;
  },
  removeFile: (path) => rmSync(path, { force: true }),
  truncateFile: (path, length) => writeGuarded(() => truncateSync(path, length)),
  ensureDirectory: (path) => {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    ensureMode(path, "directory");
  },
  listDirectory: (path) => (existsSync(path) ? readdirSync(path) : []),
  applyPermissions: (path, kind) => ensureMode(path, kind),
  verifyPermissions: (path, kind) => verifyMode(path, kind),
  writeTemporaryFile: (path, content) =>
    writeGuarded(() => {
      writeFileSync(path, content, { mode: 0o600 });
      ensureMode(path, "file");
      const descriptor = openSync(path, "r");
      try {
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
    }),
  renameFile: (from, to) =>
    writeGuarded(() => {
      renameSync(from, to);
      ensureMode(to, "file");
    }),
  raiseFault: (_point: StateEdgeFaultPoint) => {
    // Production never injects faults.
  },
  randomHex: (bytes) => randomBytes(bytes).toString("hex"),
  indexAvailable: () => sqlite !== undefined,
  indexRead: (path) => {
    if (!existsSync(path)) return undefined;
    const database = openDatabase(path);
    if (database === undefined) return undefined;
    try {
      const rows = database
        .prepare("SELECT sequence, key, kind, checksum, payload FROM records ORDER BY sequence")
        .all();
      return rows.map((row) => {
        const candidate = row as Partial<Record<keyof StateIndexRow, unknown>>;
        return {
          sequence: Number(candidate.sequence),
          key: String(candidate.key),
          kind: String(candidate.kind),
          checksum: String(candidate.checksum),
          payload: String(candidate.payload),
        };
      });
    } catch {
      return undefined;
    } finally {
      database.close();
    }
  },
  indexWrite: (path, rows) =>
    writeGuarded(() => {
      const temporary = `${path}.tmp`;
      rmSync(temporary, { force: true });
      const database = openDatabase(temporary);
      if (database === undefined) throw new Error("no sqlite binding");
      try {
        database.exec(INDEX_TABLE);
        database.exec("BEGIN");
        const insert = database.prepare(
          "INSERT INTO records (sequence, key, kind, checksum, payload) VALUES (?, ?, ?, ?, ?)",
        );
        for (const row of rows) {
          insert.run(row.sequence, row.key, row.kind, row.checksum, row.payload);
        }
        database.exec("COMMIT");
      } finally {
        database.close();
      }
      ensureMode(temporary, "file");
      renameSync(temporary, path);
      ensureMode(path, "file");
    }),
  indexRemove: (path) => rmSync(path, { force: true }),
});

/**
 * The retro sidecar's runtime edge (GH-232 PIN-1..PIN-3, TDR-0009 C-7).
 *
 * The only new runtime-API surface of the change: filesystem primitives,
 * permission checks, cryptographic randomness, and the HMAC-SHA-256 keyed hash.
 * It lives beside the state driver edge and is composed by the CLI edge.
 */
export const createNodeRetroSidecarIo = (options: {
  readonly stateDirectory: string;
  readonly workspaceId: string;
  readonly readTimeoutMs?: number;
  readonly appendTimeoutMs?: number;
}): RetroSidecarIo => {
  const edge = createNodeStateEdge();
  return {
    stateDirectory: options.stateDirectory,
    workspaceId: options.workspaceId,
    readTimeoutMs: options.readTimeoutMs ?? RETRO_READ_TIMEOUT_MS,
    appendTimeoutMs: options.appendTimeoutMs ?? RETRO_APPEND_TIMEOUT_MS,
    exists: (path) => edge.exists(path),
    readText: (path) => edge.readText(path),
    createExclusive: (path, text) => edge.createExclusiveFile(path, text),
    writeText: (path, text) => edge.writeFile(path, text),
    appendText: (path, text) => edge.appendFile(path, text),
    removeFile: (path) => edge.removeFile(path),
    ensureDirectory: (path) => edge.ensureDirectory(path),
    verifyPermissions: (path, kind) => edge.verifyPermissions(path, kind),
    applyPermissions: (path, kind) => edge.applyPermissions(path, kind),
    randomHex: (bytes) => edge.randomHex(bytes),
    keyedHash: (keyHex, previousLink, content) =>
      createHmac("sha256", Buffer.from(keyHex, "hex"))
        .update(previousLink)
        .update("\u0000")
        .update(content)
        .digest("hex"),
  };
};
