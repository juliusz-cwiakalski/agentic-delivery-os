/**
 * `@delivery-os/adapters/session` — the opencode-CLI-backed session I/O seam.
 *
 * GH-180 PIN-3: this is the only file this change admits for
 * `node:child_process` and `node:fs`. The adapter resolves the database path at
 * runtime, issues one single-statement query per call, deletes only through
 * `opencode session delete`, and performs at most one bounded checkpoint. The
 * executable and environment are injected data; no ambient environment is read.
 */
import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import {
  DB_CHECKPOINT_TIMEOUT_MS,
  DB_DELETE_TIMEOUT_MS,
  DB_LIVE_WINDOW_MINUTES,
  DB_MAX_ID_CHARS,
  DB_MAX_LIST_LIMIT,
  DB_MAX_OLDER_THAN_DAYS,
  DB_MAX_PATH_CHARS,
  DB_MAX_PRUNE_LIMIT,
  DB_MIN_LIMIT,
  DB_MIN_OLDER_THAN_DAYS,
  DB_QUERY_TIMEOUT_MS,
  DB_SCHEMA_VERSION,
  DB_SESSION_ID_PATTERN,
  type ListData,
  type SessionAdminError,
  type SessionAdminPort,
  type SessionListRead,
  type SessionPruneRead,
  type SessionRebootRead,
  type SessionSizeRead,
  type SessionStorePort,
  type SessionSummary,
  type SizeData,
} from "@delivery-os/core/contracts";

/** One bounded file-metadata read result. */
export type SessionFileFacts = { readonly bytes: number; readonly present: boolean };

/** One candidate fact carried by selection and the pre-delete re-check. */
type PruneFact = {
  readonly id: string;
  readonly updatedAtMs: number;
  readonly hasChildren: boolean;
  readonly summary: SessionSummary;
};

/** The closed cold/live/leaf decision returned by the injected policy. */
type PruneDecision =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: "live" | "warm" | "parent" };

/**
 * The pure session-admin policy, supplied by the composition root.
 *
 * The adapter may import only `@delivery-os/core/contracts` (ADR-0003 DEC-2),
 * so the domain functions are injected rather than imported here. The single
 * home of the predicate stays `@delivery-os/core`; the adapter never duplicates
 * it or compares `parent_id` inline.
 */
type SessionAdminPolicy = {
  readonly isLive: (updatedAtMs: number, nowMs: number) => boolean;
  readonly cutoff: (nowMs: number, olderThanDays: number) => number;
  readonly liveBoundary: (nowMs: number) => number;
  readonly classify: (
    fact: PruneFact,
    input: { readonly nowMs: number; readonly olderThanDays: number },
  ) => PruneDecision;
  readonly select: (
    facts: readonly PruneFact[],
    input: { readonly nowMs: number; readonly olderThanDays: number; readonly limit: number },
  ) => readonly PruneFact[];
};

/**
 * The single injected session-I/O seam. Adapter-local by contract: it is never
 * a core port and never carries a destructive file or process member.
 */
export type OpencodeSessionIo = {
  readonly command: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  databasePath(): Promise<string>;
  query(sql: string): Promise<readonly Record<string, unknown>[]>;
  deleteSession(id: string): Promise<void>;
  checkpoint(): Promise<void>;
  now(): number;
  stat(path: string): Promise<SessionFileFacts>;
};

const DB_CODE_FORMAT = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;
const ID_PATTERN = new RegExp(DB_SESSION_ID_PATTERN);

const sessionError = (
  code: SessionAdminError["code"],
  summary?: string,
  field?: string,
): SessionAdminError => ({
  kind: "db",
  code,
  ...(summary === undefined ? {} : { summary }),
  ...(field === undefined ? {} : { field }),
});

const isSessionAdminError = (value: unknown): value is SessionAdminError => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { readonly kind?: unknown; readonly code?: unknown };
  return (
    candidate.kind === "db" &&
    typeof candidate.code === "string" &&
    DB_CODE_FORMAT.test(candidate.code)
  );
};

const codeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null && "code" in error
    ? (error as { readonly code?: unknown }).code
    : undefined;

const isEnoent = (error: unknown): boolean =>
  codeOf(error) === "ENOENT" || (error instanceof Error && error.message.includes("ENOENT"));

const failure = (thrown: unknown, fallback: SessionAdminError["code"]): SessionAdminError => {
  if (isSessionAdminError(thrown)) return thrown;
  if (isEnoent(thrown)) return sessionError("db.opencode.unavailable");
  return sessionError(fallback);
};

type ExecResult = { readonly stdout: string };

const runCommand = (
  command: string,
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  timeout: number,
): Promise<ExecResult> =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      [...args],
      {
        env: { ...environment },
        timeout,
        shell: false,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve({ stdout });
      },
    );
  });

/** Production `OpencodeSessionIo` over the injected executable and environment. */
export const createOpencodeSessionIo = (input: {
  readonly command: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly now: () => number;
}): OpencodeSessionIo => {
  const run = (args: readonly string[], timeout: number): Promise<ExecResult> =>
    runCommand(input.command, args, input.environment, timeout);

  return {
    command: input.command,
    environment: input.environment,
    now: input.now,
    async databasePath(): Promise<string> {
      try {
        const { stdout } = await run(["db", "path"], DB_QUERY_TIMEOUT_MS);
        const path = stdout.replace(/\r?\n$/, "").trim();
        if (path.length === 0) throw sessionError("db.opencode.unavailable");
        return path;
      } catch (thrown) {
        throw isSessionAdminError(thrown) ? thrown : sessionError("db.opencode.unavailable");
      }
    },
    async query(sql: string): Promise<readonly Record<string, unknown>[]> {
      try {
        const { stdout } = await run(["db", sql, "--format", "json"], DB_QUERY_TIMEOUT_MS);
        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          throw sessionError("db.query.failed");
        }
        if (!Array.isArray(parsed)) throw sessionError("db.query.failed");
        return parsed.map((row) => {
          if (typeof row !== "object" || row === null || Array.isArray(row)) {
            throw sessionError("db.query.failed");
          }
          return row as Record<string, unknown>;
        });
      } catch (thrown) {
        if (isSessionAdminError(thrown)) throw thrown;
        throw isEnoent(thrown)
          ? sessionError("db.opencode.unavailable")
          : sessionError("db.query.failed");
      }
    },
    async deleteSession(id: string): Promise<void> {
      try {
        await run(["session", "delete", id], DB_DELETE_TIMEOUT_MS);
      } catch (thrown) {
        throw isEnoent(thrown)
          ? sessionError("db.opencode.unavailable")
          : sessionError("db.delete.failed");
      }
    },
    async checkpoint(): Promise<void> {
      try {
        await run(["db", "PRAGMA wal_checkpoint(TRUNCATE)"], DB_CHECKPOINT_TIMEOUT_MS);
      } catch (thrown) {
        throw isEnoent(thrown)
          ? sessionError("db.opencode.unavailable")
          : sessionError("db.query.failed");
      }
    },
    async stat(path: string): Promise<SessionFileFacts> {
      try {
        return { bytes: statSync(path).size, present: true };
      } catch (thrown) {
        if (isEnoent(thrown)) return { bytes: 0, present: false };
        throw thrown;
      }
    },
  };
};

const fieldFailure = (field: string): SessionAdminError =>
  sessionError("db.query.failed", undefined, field);

const asNumber = (value: unknown, field: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw fieldFailure(field);
};

const asNullableNumber = (value: unknown, field: string): number | null =>
  value === null || value === undefined ? null : asNumber(value, field);

const asString = (value: unknown, field: string): string => {
  if (typeof value === "string") return value;
  throw fieldFailure(field);
};

const asNullableString = (value: unknown, field: string): string | null =>
  value === null || value === undefined ? null : asString(value, field);

const asBoolean = (value: unknown, field: string): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  throw fieldFailure(field);
};

const validateSessionId = (id: string, field: string): string => {
  if (id.length === 0 || id.length > DB_MAX_ID_CHARS || !ID_PATTERN.test(id)) {
    throw fieldFailure(field);
  }
  return id;
};

const validatePath = (path: string): string => {
  if (path.length === 0) throw sessionError("db.opencode.unavailable");
  if (path.length > DB_MAX_PATH_CHARS) throw fieldFailure("path");
  return path;
};

const isoFromMs = (value: number, field: string): string => {
  try {
    return new Date(value).toISOString();
  } catch {
    throw fieldFailure(field);
  }
};

const clamp = (value: number, min: number, max: number, field: string): number => {
  if (!Number.isFinite(value)) throw fieldFailure(field);
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) throw fieldFailure(field);
  return value;
};

type ReadRow = {
  readonly summary: SessionSummary;
  readonly updatedAtMs: number;
  readonly hasChildren: boolean;
};

const readSessionRow = (
  row: Record<string, unknown>,
  nowMs: number,
  policy: SessionAdminPolicy,
): ReadRow => {
  const id = validateSessionId(asString(row.id, "session.id"), "session.id");
  const parentId = asNullableString(row.parent_id, "session.parent_id");
  const createdAtMs = asNumber(row.time_created, "session.time_created");
  const updatedAtMs = asNumber(row.time_updated, "session.time_updated");
  const archivedAtMs = asNullableNumber(row.time_archived, "session.time_archived");
  const messageCount = asNumber(row.message_count, "session.message_count");
  const partCount = asNumber(row.part_count, "session.part_count");
  const dataBytes = asNumber(row.data_bytes, "session.data_bytes");
  const hasChildren =
    row.has_children === undefined ? false : asBoolean(row.has_children, "session.has_children");
  return {
    updatedAtMs,
    hasChildren,
    summary: {
      id,
      ...(parentId === null ? {} : { parentId }),
      createdAt: isoFromMs(createdAtMs, "session.time_created"),
      updatedAt: isoFromMs(updatedAtMs, "session.time_updated"),
      messageCount,
      partCount,
      dataBytes,
      archived: archivedAtMs !== null,
      live: policy.isLive(updatedAtMs, nowMs),
    },
  };
};

const LIST_SQL = (limit: number): string =>
  [
    "SELECT s.id AS id, s.parent_id AS parent_id, s.time_created AS time_created,",
    "s.time_updated AS time_updated, s.time_archived AS time_archived,",
    "(SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) AS message_count,",
    "(SELECT COUNT(*) FROM part p WHERE p.session_id = s.id) AS part_count,",
    "(SELECT COALESCE(SUM(LENGTH(CAST(m.data AS BLOB))),0) FROM message m WHERE m.session_id = s.id)",
    " + (SELECT COALESCE(SUM(LENGTH(CAST(p.data AS BLOB))),0) FROM part p WHERE p.session_id = s.id) AS data_bytes",
    "FROM session s ORDER BY s.time_updated DESC, s.id ASC LIMIT",
    `${limit}`,
  ].join(" ");

const readSize = async (io: OpencodeSessionIo): Promise<SessionSizeRead> => {
  try {
    const path = validatePath(await io.databasePath());
    let database: SessionFileFacts;
    try {
      database = await io.stat(path);
    } catch {
      return { ok: false, error: sessionError("db.opencode.unavailable") };
    }
    if (!database.present) {
      return { ok: false, error: sessionError("db.opencode.unavailable") };
    }
    const wal = await io.stat(`${path}-wal`).catch(() => ({ bytes: 0, present: false }));
    const shm = await io.stat(`${path}-shm`).catch(() => ({ bytes: 0, present: false }));
    const sessionRows = await io.query(
      "SELECT COUNT(*) AS sessions, MIN(time_updated) AS oldest, MAX(time_updated) AS newest FROM session",
    );
    const messageRows = await io.query("SELECT COUNT(*) AS messages FROM message");
    const partRows = await io.query("SELECT COUNT(*) AS parts FROM part");
    const sessionRow = sessionRows[0] ?? {};
    const oldest = asNullableNumber(sessionRow.oldest, "session.oldest");
    const newest = asNullableNumber(sessionRow.newest, "session.newest");
    const value: SizeData = {
      schemaVersion: DB_SCHEMA_VERSION,
      command: "size",
      database: {
        path,
        dbBytes: database.bytes,
        walBytes: wal.bytes,
        shmBytes: shm.bytes,
        walPresent: wal.present,
        shmPresent: shm.present,
      },
      counts: {
        sessions: asNumber(sessionRow.sessions, "session.sessions"),
        messages: asNumber(messageRows[0]?.messages, "message.messages"),
        parts: asNumber(partRows[0]?.parts, "part.parts"),
      },
      oldestSessionUpdatedAt: oldest === null ? null : isoFromMs(oldest, "session.oldest"),
      newestSessionUpdatedAt: newest === null ? null : isoFromMs(newest, "session.newest"),
    };
    return { ok: true, value };
  } catch (thrown) {
    return { ok: false, error: failure(thrown, "db.query.failed") };
  }
};

const readList = async (
  io: OpencodeSessionIo,
  input: { readonly limit: number; readonly nowMs: number },
  policy: SessionAdminPolicy,
): Promise<SessionListRead> => {
  try {
    const limit = clamp(input.limit, DB_MIN_LIMIT, DB_MAX_LIST_LIMIT, "limit");
    const nowMs = finite(input.nowMs, "nowMs");
    const totalRows = await io.query("SELECT COUNT(*) AS total FROM session");
    const total = asNumber(totalRows[0]?.total, "session.total");
    const pageRows = await io.query(LIST_SQL(limit));
    const items = pageRows
      .map((row) => {
        const read = readSessionRow(row, nowMs, policy);
        return { summary: read.summary, updatedAtMs: read.updatedAtMs };
      })
      .sort((left, right) => {
        if (left.updatedAtMs !== right.updatedAtMs) return right.updatedAtMs - left.updatedAtMs;
        return left.summary.id < right.summary.id ? -1 : left.summary.id > right.summary.id ? 1 : 0;
      })
      .map((entry) => entry.summary);
    const omitted = Math.max(0, total - items.length);
    const value: ListData = {
      schemaVersion: DB_SCHEMA_VERSION,
      command: "list",
      limit,
      total,
      omitted,
      truncated: omitted > 0,
      items,
    };
    return { ok: true, value };
  } catch (thrown) {
    return { ok: false, error: failure(thrown, "db.query.failed") };
  }
};

/** The read-only store port over one injected seam and the injected policy. */
export const createSessionStore = (
  io: OpencodeSessionIo,
  policy: SessionAdminPolicy,
): SessionStorePort => ({
  size: () => readSize(io),
  list: (input) => readList(io, input, policy),
});

const candidateSummarySql = [
  "s.id AS id, s.parent_id AS parent_id, s.time_created AS time_created,",
  "s.time_updated AS time_updated, s.time_archived AS time_archived,",
  "EXISTS(SELECT 1 FROM session c WHERE c.parent_id = s.id) AS has_children,",
  "(SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) AS message_count,",
  "(SELECT COUNT(*) FROM part p WHERE p.session_id = s.id) AS part_count,",
  "(SELECT COALESCE(SUM(LENGTH(CAST(m.data AS BLOB))),0) FROM message m WHERE m.session_id = s.id)",
  " + (SELECT COALESCE(SUM(LENGTH(CAST(p.data AS BLOB))),0) FROM part p WHERE p.session_id = s.id) AS data_bytes",
].join(" ");

const SELECTION_SQL = (cutoff: number, liveBoundary: number, limit: number): string =>
  [
    `SELECT ${candidateSummarySql} FROM session s`,
    `WHERE s.time_updated < ${cutoff}`,
    `AND s.time_updated < ${liveBoundary}`,
    "AND NOT EXISTS (SELECT 1 FROM session c WHERE c.parent_id = s.id)",
    "ORDER BY s.time_updated ASC, s.id ASC",
    `LIMIT ${limit}`,
  ].join(" ");

const RE_READ_SQL = (id: string, cutoff: number, liveBoundary: number): string =>
  [
    `SELECT ${candidateSummarySql} FROM session s`,
    `WHERE s.id = '${id}'`,
    `AND s.time_updated < ${cutoff}`,
    `AND s.time_updated < ${liveBoundary}`,
    "AND NOT EXISTS (SELECT 1 FROM session c WHERE c.parent_id = s.id)",
    "LIMIT 1",
  ].join(" ");

const EXISTS_SQL = (id: string): string =>
  `SELECT s.id AS id FROM session s WHERE s.id = '${id}' LIMIT 1`;

const readCandidate = (
  row: Record<string, unknown>,
  nowMs: number,
  policy: SessionAdminPolicy,
): PruneFact => {
  const read = readSessionRow(row, nowMs, policy);
  return {
    id: read.summary.id,
    updatedAtMs: read.updatedAtMs,
    hasChildren: read.hasChildren,
    summary: read.summary,
  };
};

const fileFacts = async (io: OpencodeSessionIo, path: string): Promise<SessionFileFacts> =>
  io.stat(path).catch(() => ({ bytes: 0, present: false }));

const readPrune = async (
  io: OpencodeSessionIo,
  input: {
    readonly olderThanDays: number;
    readonly limit: number;
    readonly apply: boolean;
    readonly nowMs: number;
  },
  policy: SessionAdminPolicy,
): Promise<SessionPruneRead> => {
  try {
    const olderThanDays = clamp(
      input.olderThanDays,
      DB_MIN_OLDER_THAN_DAYS,
      DB_MAX_OLDER_THAN_DAYS,
      "olderThanDays",
    );
    const limit = clamp(input.limit, DB_MIN_LIMIT, DB_MAX_PRUNE_LIMIT, "limit");
    const nowMs = finite(input.nowMs, "nowMs");
    validatePath(await io.databasePath());
    const cutoff = policy.cutoff(nowMs, olderThanDays);
    const liveBoundary = policy.liveBoundary(nowMs);
    const rows = await io.query(SELECTION_SQL(cutoff, liveBoundary, limit));
    // Defensive invariant: SELECTION_SQL already filters live rows, so a real
    // store yields 0 here. The counter only observes a row the SQL predicate
    // would have excluded (the test fake does not interpret SQL).
    let liveExcluded = 0;
    const eligible: PruneFact[] = [];
    for (const row of rows) {
      const fact = readCandidate(row, nowMs, policy);
      const decision = policy.classify(fact, { nowMs, olderThanDays });
      if (decision.eligible) eligible.push(fact);
      else if (decision.reason === "live") liveExcluded += 1;
    }
    const selected = policy.select(eligible, { nowMs, olderThanDays, limit });
    const base = {
      schemaVersion: DB_SCHEMA_VERSION,
      command: "prune" as const,
      olderThanDays,
      limit,
      liveWindowMinutes: DB_LIVE_WINDOW_MINUTES,
      cutoff: isoFromMs(cutoff, "cutoff"),
      candidates: selected.map((fact) => fact.summary),
    };
    if (!input.apply) {
      return {
        ok: true,
        value: {
          ...base,
          mode: "dry-run",
          counts: {
            selected: selected.length,
            deleted: 0,
            failed: 0,
            skipped: 0,
            liveExcluded,
          },
        },
      };
    }

    let deleted = 0;
    let failed = 0;
    let skipped = 0;
    let firstFailed: string | undefined;
    const abortAfterLand = (id: string): SessionAdminError => {
      const attempted = deleted + failed + 1;
      return sessionError(
        "db.delete.failed",
        `${failed + 1} of ${attempted} session deletes did not land (first: ${firstFailed ?? id}); ${deleted} landed`,
      );
    };
    for (const candidate of selected) {
      // The re-read query *and* its projection parse are one guarded step: a
      // malformed row after a landed delete is a delete-run failure, not an
      // unlanded query failure.
      let eligibleNow = false;
      try {
        const reReadRows = await io.query(RE_READ_SQL(candidate.id, cutoff, liveBoundary));
        if (reReadRows.length > 0) {
          const reFact = readCandidate(reReadRows[0] ?? {}, nowMs, policy);
          eligibleNow = policy.classify(reFact, { nowMs, olderThanDays }).eligible;
        }
      } catch (thrown) {
        const error = failure(thrown, "db.query.failed");
        if (deleted === 0 && failed === 0) return { ok: false, error };
        return { ok: false, error: abortAfterLand(candidate.id) };
      }
      if (!eligibleNow) {
        skipped += 1;
        continue;
      }
      try {
        await io.deleteSession(candidate.id);
        deleted += 1;
      } catch (thrown) {
        const error = failure(thrown, "db.delete.failed");
        if (error.code === "db.opencode.unavailable" || error.code === "db.query.failed") {
          if (deleted === 0 && failed === 0) return { ok: false, error };
          return { ok: false, error: abortAfterLand(candidate.id) };
        }
        let existsRows: readonly Record<string, unknown>[];
        try {
          existsRows = await io.query(EXISTS_SQL(candidate.id));
        } catch (existThrown) {
          const existError = failure(existThrown, "db.query.failed");
          if (deleted === 0 && failed === 0) return { ok: false, error: existError };
          return { ok: false, error: abortAfterLand(candidate.id) };
        }
        if (existsRows.length === 0) {
          skipped += 1;
          continue;
        }
        failed += 1;
        firstFailed ??= candidate.id;
      }
    }
    if (failed > 0) {
      const attempted = deleted + failed;
      return {
        ok: false,
        error: sessionError(
          "db.delete.failed",
          `${failed} of ${attempted} session deletes did not land (first: ${firstFailed ?? ""}); ${deleted} landed`,
        ),
      };
    }
    return {
      ok: true,
      value: {
        ...base,
        mode: "applied",
        counts: {
          selected: selected.length,
          deleted,
          failed,
          skipped,
          liveExcluded,
        },
      },
    };
  } catch (thrown) {
    return { ok: false, error: failure(thrown, "db.query.failed") };
  }
};

const readReboot = async (
  io: OpencodeSessionIo,
  input: { readonly apply: boolean; readonly nowMs: number },
  policy: SessionAdminPolicy,
): Promise<SessionRebootRead> => {
  try {
    const nowMs = finite(input.nowMs, "nowMs");
    const liveBoundary = policy.liveBoundary(nowMs);
    const liveRows = await io.query(
      `SELECT COUNT(*) AS live_sessions FROM session WHERE time_updated >= ${liveBoundary}`,
    );
    const liveSessions = asNumber(liveRows[0]?.live_sessions, "session.live_sessions");
    if (input.apply && liveSessions > 0) {
      return { ok: false, error: sessionError("db.reboot.live") };
    }
    const path = validatePath(await io.databasePath());
    const database = await io.stat(path).catch(() => ({ bytes: 0, present: false }));
    if (!database.present) {
      return { ok: false, error: sessionError("db.opencode.unavailable") };
    }
    const wal = await fileFacts(io, `${path}-wal`);
    const shm = await fileFacts(io, `${path}-shm`);
    if (!input.apply) {
      return {
        ok: true,
        value: {
          schemaVersion: DB_SCHEMA_VERSION,
          command: "reboot",
          mode: "dry-run",
          liveWindowMinutes: DB_LIVE_WINDOW_MINUTES,
          liveSessions,
          blockedByLiveSession: liveSessions > 0,
          checkpointPerformed: false,
          database: {
            path,
            walBytesBefore: wal.bytes,
            walPresent: wal.present,
            shmPresent: shm.present,
          },
        },
      };
    }
    await io.checkpoint();
    const after = await fileFacts(io, `${path}-wal`);
    return {
      ok: true,
      value: {
        schemaVersion: DB_SCHEMA_VERSION,
        command: "reboot",
        mode: "applied",
        liveWindowMinutes: DB_LIVE_WINDOW_MINUTES,
        liveSessions,
        blockedByLiveSession: false,
        checkpointPerformed: true,
        database: {
          path,
          walBytesBefore: wal.bytes,
          walBytesAfter: after.bytes,
          walPresent: after.present,
          shmPresent: shm.present,
        },
      },
    };
  } catch (thrown) {
    return { ok: false, error: failure(thrown, "db.query.failed") };
  }
};

/** The admin port over one injected seam and the injected policy. */
export const createSessionAdmin = (
  io: OpencodeSessionIo,
  policy: SessionAdminPolicy,
): SessionAdminPort => {
  const store = createSessionStore(io, policy);
  return {
    size: () => store.size(),
    list: (input) => store.list(input),
    prune: (input) => readPrune(io, input, policy),
    reboot: (input) => readReboot(io, input, policy),
  };
};
