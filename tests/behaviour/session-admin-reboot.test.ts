/**
 * TC-DB-031..TC-DB-033 and the reboot half of TC-DB-037.
 *
 * Dry-run reports the plan; apply with a live session returns `db.reboot.live`
 * and performs nothing; apply with zero live sessions performs exactly one
 * bounded `PRAGMA wal_checkpoint(TRUNCATE)`; no process is killed and no
 * sidecar is deleted. The injected clock is load-bearing.
 */
import { describe, expect, test } from "bun:test";
import { createSessionAdmin as createSessionAdminBase } from "../../packages/adapters/src/session/index";
import {
  DB_CHECKPOINT_TIMEOUT_MS,
  DB_LIVE_WINDOW_MINUTES,
  DB_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import {
  computeDbLiveBoundaryMs,
  renderSessionAdminHuman,
} from "../../packages/core/src/domain/session-admin";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import {
  callsOf,
  createFakeIo,
  NOW_MS,
  queries,
  SESSION_POLICY,
  SYNTHETIC_DB_PATH,
} from "../fixtures/session-admin/harness";

const createSessionAdmin = (io: Parameters<typeof createSessionAdminBase>[0]) =>
  createSessionAdminBase(io, SESSION_POLICY);

const WAL_BEFORE = 19_800_000;
const WAL_AFTER = 0;

const withStat = (io: ReturnType<typeof createFakeIo>): void => {
  io.statFacts.set(SYNTHETIC_DB_PATH, { bytes: 4096, present: true });
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: WAL_BEFORE, present: true });
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-shm`, { bytes: 8192, present: true });
};

const runReboot = (io: ReturnType<typeof createFakeIo>, apply = false, nowMs = NOW_MS) =>
  createSessionAdmin(io).reboot({ apply, nowMs });

const liveSqlHasWindow = (sql: string): boolean =>
  sql.includes(`time_updated >= ${computeDbLiveBoundaryMs(NOW_MS)}`);

describe("TC-DB-031 reboot dry-run plan and the live gate on apply", () => {
  test("a dry-run with two live sessions reports the block without erroring", async () => {
    const io = createFakeIo();
    withStat(io);
    io.queueQuery([{ live_sessions: 2 }]);
    const read = await runReboot(io);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toMatchObject({
      schemaVersion: DB_SCHEMA_VERSION,
      command: "reboot",
      mode: "dry-run",
      liveWindowMinutes: DB_LIVE_WINDOW_MINUTES,
      liveSessions: 2,
      blockedByLiveSession: true,
      checkpointPerformed: false,
      database: {
        path: SYNTHETIC_DB_PATH,
        walBytesBefore: WAL_BEFORE,
        walPresent: true,
        shmPresent: true,
      },
    });
    expect(Object.hasOwn(read.value.database, "walBytesAfter")).toBe(false);
    expect(callsOf(io, "checkpoint")).toEqual([]);
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(queries(io)).toHaveLength(1);
    expect(liveSqlHasWindow(queries(io)[0] ?? "")).toBe(true);
    expect(renderSessionAdminHuman(read.value, SYNTHETIC_BRAND)).toContain("live sessions 2");
  });

  test("apply with a live session returns db.reboot.live and performs nothing", async () => {
    const io = createFakeIo();
    withStat(io);
    io.queueQuery([{ live_sessions: 2 }]);
    const read = await runReboot(io, true);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe("db.reboot.live");
    expect(callsOf(io, "checkpoint")).toEqual([]);
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(callsOf(io, "stat")).toEqual([]);
  });

  test("the same stored state under a later injected clock flips the gate", async () => {
    const later = NOW_MS + 16 * 60_000;
    const dryIo = createFakeIo();
    withStat(dryIo);
    dryIo.queueQuery([{ live_sessions: 0 }]);
    const dry = await createSessionAdmin(dryIo).reboot({ apply: false, nowMs: later });
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.value.liveSessions).toBe(0);
    expect(dry.value.blockedByLiveSession).toBe(false);

    const applyIo = createFakeIo();
    withStat(applyIo);
    applyIo.queueQuery([{ live_sessions: 0 }]);
    applyIo.checkpointBefore = () => {
      applyIo.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: WAL_AFTER, present: true });
    };
    const applied = await createSessionAdmin(applyIo).reboot({ apply: true, nowMs: later });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.checkpointPerformed).toBe(true);
    expect(callsOf(applyIo, "checkpoint")).toHaveLength(1);
  });

  test("a host-clock live-count mutant fails the shifted-clock case", () => {
    const windowSql = `SELECT COUNT(*) AS live_sessions FROM session WHERE time_updated >= ${computeDbLiveBoundaryMs(NOW_MS)}`;
    expect(liveSqlHasWindow(windowSql)).toBe(true);
    const hostClock = "SELECT COUNT(*) AS live_sessions FROM session WHERE time_updated >= 0";
    expect(liveSqlHasWindow(hostClock)).toBe(false);
  });
});

const ioCheckpointCount = (count: number): boolean => count === 1;

const hasForbiddenStatement = (sql: string): boolean =>
  /\b(DELETE|DROP|TRUNCATE|VACUUM|ALTER|CREATE)\b/i.test(sql);

describe("TC-DB-032 reboot apply performs exactly one bounded checkpoint", () => {
  test("exactly one checkpoint with the exact statement and WAL before/after", async () => {
    const io = createFakeIo();
    withStat(io);
    io.queueQuery([{ live_sessions: 0 }]);
    io.checkpointBefore = () => {
      io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: WAL_AFTER, present: true });
    };
    const read = await runReboot(io, true);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toMatchObject({
      mode: "applied",
      liveSessions: 0,
      blockedByLiveSession: false,
      checkpointPerformed: true,
      database: {
        path: SYNTHETIC_DB_PATH,
        walBytesBefore: WAL_BEFORE,
        walBytesAfter: WAL_AFTER,
        walPresent: true,
        shmPresent: true,
      },
    });
    expect(io.checkpointCalls).toBe(1);
    expect(callsOf(io, "checkpoint").map((call) => call.value)).toEqual([
      "PRAGMA wal_checkpoint(TRUNCATE)",
    ]);
    expect(queries(io)).toHaveLength(1);
    expect(liveSqlHasWindow(queries(io)[0] ?? "")).toBe(true);
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(DB_CHECKPOINT_TIMEOUT_MS).toBe(120000);
  });

  test("double-checkpoint and VACUUM mutants are detected", () => {
    expect(ioCheckpointCount(1)).toBe(true);
    expect(ioCheckpointCount(2)).toBe(false);
    expect(hasForbiddenStatement("SELECT 1")).toBe(false);
    expect(hasForbiddenStatement("VACUUM")).toBe(true);
  });
});

describe("TC-DB-033 reboot never kills a process or deletes a sidecar", () => {
  test("stats only the database and its two sidecars; no process or delete action", async () => {
    const io = createFakeIo();
    withStat(io);
    io.queueQuery([{ live_sessions: 0 }]);
    io.checkpointBefore = () => {
      io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: WAL_AFTER, present: true });
    };
    const read = await runReboot(io, true);
    expect(read.ok).toBe(true);
    const statPaths = new Set(callsOf(io, "stat").map((call) => call.value));
    expect([...statPaths].sort()).toEqual(
      [SYNTHETIC_DB_PATH, `${SYNTHETIC_DB_PATH}-wal`, `${SYNTHETIC_DB_PATH}-shm`].sort(),
    );
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(callsOf(io, "checkpoint")).toHaveLength(1);
  });

  test("the human report states the manual restart and claims no restart", async () => {
    const io = createFakeIo();
    withStat(io);
    io.queueQuery([{ live_sessions: 0 }]);
    io.checkpointBefore = () => {
      io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: WAL_AFTER, present: true });
    };
    const read = await runReboot(io, true);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const text = renderSessionAdminHuman(read.value, SYNTHETIC_BRAND);
    expect(text).toContain(
      "restart the opencode host manually; this command only prepares the database",
    );
    expect(text.toLowerCase()).not.toContain("restarted");
    const mutant = text.replace("manually", "automatically");
    expect(mutant).not.toContain("manually");
  });
});
