/**
 * TC-DB-006..TC-DB-009 and the size/list half of TC-DB-037.
 *
 * The adapter is exercised through the injected fake `OpencodeSessionIo`; the
 * fake never interprets SQL. Every field, ordering rule, cap, boundary, and
 * sidecar distinction is asserted from a scripted fixture, and the recorded SQL
 * is asserted textually for the byte-exact `dataBytes` and current stores.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSessionStore } from "../../packages/adapters/src/session/index";
import {
  DB_MAX_LIST_LIMIT,
  DB_MAX_MACHINE_BYTES,
  DB_MIN_LIMIT,
  DB_SCHEMA_VERSION,
  renderSessionAdminHuman,
} from "../../packages/core/src/contracts/index";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import { BOUNDARY_CASES, BOUNDARY_IDS, cutoffMs } from "../fixtures/session-admin/boundaries";
import {
  callsOf,
  createFakeIo,
  DAY_MS,
  LIVE_BOUNDARY,
  NOW_MS,
  queries,
  SYNTHETIC_DB_PATH,
} from "../fixtures/session-admin/harness";
import { makeSession, sessionRow, sessions } from "../fixtures/session-admin/store";

const ROOT = process.cwd();
const ADAPTER = "packages/adapters/src/session/index.ts";

const dbStat = (bytes: number, present = true) => ({ bytes, present });

const withStat = (
  io: ReturnType<typeof createFakeIo>,
  wal: { bytes: number; present: boolean },
  shm: { bytes: number; present: boolean },
): void => {
  io.statFacts.set(SYNTHETIC_DB_PATH, dbStat(4096));
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, wal);
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-shm`, shm);
};

const queueSize = (
  io: ReturnType<typeof createFakeIo>,
  counts: { sessions: number; messages: number; parts: number },
  oldest: number | null = null,
  newest: number | null = null,
): void => {
  io.queueQuery([{ sessions: counts.sessions, oldest, newest }]);
  io.queueQuery([{ messages: counts.messages }]);
  io.queueQuery([{ parts: counts.parts }]);
};

describe("TC-DB-006 size metadata from a fixture with zero mutations", () => {
  test("reports the runtime path, bytes/presence, counts, and ISO timestamps", async () => {
    const io = createFakeIo();
    withStat(io, dbStat(512), dbStat(0, false));
    queueSize(io, { sessions: 12, messages: 40, parts: 90 }, NOW_MS - DAY_MS, NOW_MS - 1_000);
    const read = await createSessionStore(io).size();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const data = read.value;
    expect(data.schemaVersion).toBe(DB_SCHEMA_VERSION);
    expect(data.command).toBe("size");
    expect(Object.keys(data).sort()).toEqual([
      "command",
      "counts",
      "database",
      "newestSessionUpdatedAt",
      "oldestSessionUpdatedAt",
      "schemaVersion",
    ]);
    expect(Object.keys(data.database).sort()).toEqual([
      "dbBytes",
      "path",
      "shmBytes",
      "shmPresent",
      "walBytes",
      "walPresent",
    ]);
    expect(data.database).toEqual({
      path: SYNTHETIC_DB_PATH,
      dbBytes: 4096,
      walBytes: 512,
      shmBytes: 0,
      walPresent: true,
      shmPresent: false,
    });
    expect(data.counts).toEqual({ sessions: 12, messages: 40, parts: 90 });
    expect(data.oldestSessionUpdatedAt).toBe(new Date(NOW_MS - DAY_MS).toISOString());
    expect(data.newestSessionUpdatedAt).toBe(new Date(NOW_MS - 1_000).toISOString());
    expect(data.oldestSessionUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(callsOf(io, "checkpoint")).toEqual([]);
    const sql = queries(io);
    expect(sql).toHaveLength(3);
    expect(sql[0]).toContain("FROM session");
    expect(sql[1]).toContain("FROM message");
    expect(sql[2]).toContain("FROM part");
    for (const text of sql) {
      expect(text).not.toContain("session_message");
      expect(text).toMatch(/count\(|min\(|max\(/i);
    }
    expect(io.calls.filter((call) => call.kind === "stat").map((call) => call.value)).toEqual([
      SYNTHETIC_DB_PATH,
      `${SYNTHETIC_DB_PATH}-wal`,
      `${SYNTHETIC_DB_PATH}-shm`,
    ]);
  });

  test("a fabricated path or timestamp mutant fails the exact assertions", () => {
    const fabricated = { ...makeSession({ id: "ses_x", timeUpdated: NOW_MS - 5 }) };
    expect(fabricated.timeUpdated).toBe(NOW_MS - 5);
    expect(new Date(fabricated.timeUpdated).toISOString()).not.toBe(
      new Date(NOW_MS - 1_000).toISOString(),
    );
  });
});

describe("TC-DB-007 empty store and absent versus zero-byte sidecars", () => {
  test("an empty store yields null timestamps and zero counts", async () => {
    const io = createFakeIo();
    withStat(io, dbStat(0, false), dbStat(0, false));
    queueSize(io, { sessions: 0, messages: 0, parts: 0 }, null, null);
    const read = await createSessionStore(io).size();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.oldestSessionUpdatedAt).toBeNull();
    expect(read.value.newestSessionUpdatedAt).toBeNull();
    expect(read.value.counts).toEqual({ sessions: 0, messages: 0, parts: 0 });
    expect(read.value.database.walBytes).toBe(0);
    expect(read.value.database.walPresent).toBe(false);
    expect(read.value.database.shmPresent).toBe(false);
  });

  test("a real zero-byte WAL is present while an absent WAL is not", async () => {
    const absentIo = createFakeIo();
    withStat(absentIo, dbStat(0, false), dbStat(0, false));
    queueSize(absentIo, { sessions: 1, messages: 1, parts: 1 }, NOW_MS - 1, NOW_MS - 1);
    const absent = await createSessionStore(absentIo).size();
    expect(absent.ok).toBe(true);
    if (!absent.ok) return;
    expect(absent.value.database.walPresent).toBe(false);
    const absentText = renderSessionAdminHuman(absent.value, SYNTHETIC_BRAND);
    expect(absentText).toContain("wal 0 B (absent)");

    const zeroIo = createFakeIo();
    withStat(zeroIo, dbStat(0), dbStat(0, false));
    queueSize(zeroIo, { sessions: 1, messages: 1, parts: 1 }, NOW_MS - 1, NOW_MS - 1);
    const zero = await createSessionStore(zeroIo).size();
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.value.database.walBytes).toBe(0);
    expect(zero.value.database.walPresent).toBe(true);
    expect(renderSessionAdminHuman(zero.value, SYNTHETIC_BRAND)).toContain("wal 0 B (present)");
  });
});

const distinctSessions = (): ReturnType<typeof makeSession>[] => {
  const base = NOW_MS - 10 * DAY_MS;
  return Array.from({ length: 25 }, (_, index) =>
    makeSession({
      id: `ses_${String(index).padStart(2, "0")}`,
      timeCreated: base - index * 10,
      timeUpdated: base - index,
      messageCount: index % 4,
      partCount: index % 3,
      dataBytes: index,
    }),
  );
};

describe("TC-DB-008 list page ordering, caps, exact item shape, byte-exact dataBytes", () => {
  test("default limit 20, totals, and updatedAt-desc/id-asc ordering", async () => {
    const fixture = distinctSessions();
    const io = createFakeIo();
    io.queueQuery([{ total: fixture.length }]);
    io.queueQuery(fixture.slice(0, 20).reverse().map(sessionRow));
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toMatchObject({ limit: 20, total: 25, omitted: 5, truncated: true });
    expect(read.value.items).toHaveLength(20);
    const updated = read.value.items.map((item) => item.updatedAt);
    expect([...updated].sort().reverse()).toEqual(updated);
    expect(read.value.items[0]?.id).toBe(fixture[0]?.id);
    expect(queries(io)).toHaveLength(2);
    expect(queries(io)[1]).toContain("LIMIT 20");
    expect(queries(io)[1]).toContain("ORDER BY s.time_updated DESC, s.id ASC");
  });

  test("max limit 100 returns the whole 100-session page", async () => {
    const fixture = sessions(100);
    const io = createFakeIo();
    io.queueQuery([{ total: 100 }]);
    io.queueQuery(fixture.map(sessionRow));
    const read = await createSessionStore(io).list({ limit: DB_MAX_LIST_LIMIT, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.items).toHaveLength(100);
    expect(read.value.omitted).toBe(0);
    expect(read.value.truncated).toBe(false);
    expect(queries(io)[1]).toContain("LIMIT 100");
  });

  test("the exact nine-field item shape and optional parentId", async () => {
    const rows = [
      sessionRow(makeSession({ id: "ses_root", timeUpdated: NOW_MS - 1 })),
      sessionRow(makeSession({ id: "ses_child", parentId: "ses_root", timeUpdated: NOW_MS - 2 })),
    ];
    const io = createFakeIo();
    io.queueQuery([{ total: 2 }]);
    io.queueQuery(rows);
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const root = read.value.items.find((item) => item.id === "ses_root");
    const child = read.value.items.find((item) => item.id === "ses_child");
    expect(root).toBeDefined();
    expect(child).toBeDefined();
    if (root === undefined || child === undefined) return;
    expect(Object.keys(root).sort()).toEqual([
      "archived",
      "createdAt",
      "dataBytes",
      "id",
      "live",
      "messageCount",
      "partCount",
      "updatedAt",
    ]);
    expect(Object.hasOwn(root, "parentId")).toBe(false);
    expect(child.parentId).toBe("ses_root");
    const item = read.value.items[0];
    expect(item).not.toHaveProperty("title");
    expect(item).not.toHaveProperty("prompt");
    expect(item).not.toHaveProperty("messageBody");
    expect(item).not.toHaveProperty("partData");
  });

  test("multi-byte bytes are 11, a character count would be 6, and empty rows are 0", async () => {
    const rows = [
      sessionRow(
        makeSession({
          id: "ses_bytes",
          timeUpdated: NOW_MS - 1,
          messageCount: 2,
          partCount: 1,
          dataBytes: 11,
        }),
      ),
      sessionRow(makeSession({ id: "ses_empty", timeUpdated: NOW_MS - 2 })),
    ];
    const io = createFakeIo();
    io.queueQuery([{ total: 2 }]);
    io.queueQuery(rows);
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const bytes = read.value.items.find((item) => item.id === "ses_bytes");
    const empty = read.value.items.find((item) => item.id === "ses_empty");
    expect(bytes).toMatchObject({ messageCount: 2, partCount: 1, dataBytes: 11 });
    expect(bytes?.dataBytes).not.toBe(6);
    expect(empty?.dataBytes).toBe(0);
    const pageSql = queries(io)[1] ?? "";
    expect(pageSql).toContain("LENGTH(CAST(m.data AS BLOB))");
    expect(pageSql).toContain("LENGTH(CAST(p.data AS BLOB))");
    expect(pageSql).toContain("FROM message m");
    expect(pageSql).toContain("FROM part p");
    expect(pageSql).not.toContain("session_message");
    expect(pageSql).not.toMatch(/LENGTH\((?!CAST)/);
  });

  test("archived is time_archived IS NOT NULL and timestamps come from time_created/time_updated", async () => {
    const created = NOW_MS - 3 * DAY_MS;
    const updated = NOW_MS - 2 * DAY_MS;
    const rows = [
      sessionRow(
        makeSession({
          id: "ses_archived",
          timeCreated: created,
          timeUpdated: updated,
          timeArchived: NOW_MS - DAY_MS,
        }),
      ),
      sessionRow(makeSession({ id: "ses_active", timeCreated: created, timeUpdated: updated })),
    ];
    const io = createFakeIo();
    io.queueQuery([{ total: 2 }]);
    io.queueQuery(rows);
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const archived = read.value.items.find((item) => item.id === "ses_archived");
    const active = read.value.items.find((item) => item.id === "ses_active");
    expect(archived).toMatchObject({
      archived: true,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(updated).toISOString(),
    });
    expect(active?.archived).toBe(false);
    const pageSql = queries(io)[1] ?? "";
    expect(pageSql).toContain("s.time_created AS time_created");
    expect(pageSql).toContain("s.time_updated AS time_updated");
    expect(pageSql).toContain("s.time_archived AS time_archived");
    expect(pageSql).not.toContain("s.archived");
  });

  test("the adapter sorts a scrambled response; a pass-through would not", () => {
    const scrambled = [
      makeSession({ id: "ses_b", timeUpdated: NOW_MS - 1 }),
      makeSession({ id: "ses_a", timeUpdated: NOW_MS - 1 }),
      makeSession({ id: "ses_c", timeUpdated: NOW_MS - 2 }),
    ];
    const sorted = [...scrambled].sort((left, right) => {
      if (left.timeUpdated !== right.timeUpdated) return right.timeUpdated - left.timeUpdated;
      return left.id < right.id ? -1 : 1;
    });
    expect(sorted.map((entry) => entry.id)).toEqual(["ses_a", "ses_b", "ses_c"]);
  });
});

describe("TC-DB-009 live classification at the window boundary and the empty page", () => {
  const liveRows = (): Record<string, unknown>[] =>
    BOUNDARY_CASES.filter((entry) =>
      [BOUNDARY_IDS.b05, BOUNDARY_IDS.b06, BOUNDARY_IDS.b07].some((id) => id === entry.id),
    ).map((entry) => sessionRow(entry.session));

  test("exactly 15 minutes and newer are live; one ms older is not", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 3 }]);
    io.queueQuery(liveRows());
    const read = await createSessionStore(io).list({ limit: 100, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const byId = new Map(read.value.items.map((item) => [item.id, item.live]));
    expect(byId.get(BOUNDARY_IDS.b05)).toBe(true);
    expect(byId.get(BOUNDARY_IDS.b06)).toBe(true);
    expect(byId.get(BOUNDARY_IDS.b07)).toBe(false);
    expect(renderSessionAdminHuman(read.value, SYNTHETIC_BRAND)).toContain("live in page 2");
  });

  test("a shifted injected clock changes the classification without changing rows", async () => {
    const io = createFakeIo({ now: NOW_MS + 16 * 60_000 });
    io.queueQuery([{ total: 3 }]);
    io.queueQuery(liveRows());
    const read = await createSessionStore(io).list({ limit: 100, nowMs: NOW_MS + 16 * 60_000 });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const byId = new Map(read.value.items.map((item) => [item.id, item.live]));
    expect(byId.get(BOUNDARY_IDS.b05)).toBe(false);
    expect(byId.get(BOUNDARY_IDS.b06)).toBe(false);
    expect(byId.get(BOUNDARY_IDS.b07)).toBe(false);
  });

  test("an empty page is explicit and fabricates no live value", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 0 }]);
    io.queueQuery([]);
    const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toMatchObject({
      total: 0,
      omitted: 0,
      truncated: false,
      items: [],
    });
  });

  test("the boundary fixture actually spans the live boundary", () => {
    const b05 = BOUNDARY_CASES.find((entry) => entry.id === BOUNDARY_IDS.b05);
    const b07 = BOUNDARY_CASES.find((entry) => entry.id === BOUNDARY_IDS.b07);
    expect(b05?.session.timeUpdated).toBe(LIVE_BOUNDARY);
    expect(b07?.session.timeUpdated).toBe(LIVE_BOUNDARY - 1);
    expect(cutoffMs(30)).toBeLessThan(LIVE_BOUNDARY);
  });
});

describe("TC-DB-037 size/list bounded work and declared timeouts", () => {
  test("size issues the same aggregate query count for 10 and 6,900 sessions", async () => {
    for (const count of [10, 6_900]) {
      const io = createFakeIo();
      withStat(io, dbStat(0, false), dbStat(0, false));
      queueSize(
        io,
        { sessions: count, messages: count * 30, parts: count * 60 },
        NOW_MS - 1,
        NOW_MS - 1,
      );
      const read = await createSessionStore(io).size();
      expect(read.ok).toBe(true);
      expect(queries(io)).toHaveLength(3);
      for (const sql of queries(io)) {
        expect(sql).toMatch(/count\(|min\(|max\(/i);
        expect(sql).not.toContain("WHERE session_id");
      }
    }
  });

  test("list issues exactly two queries and one LIMIT page", async () => {
    const io = createFakeIo();
    io.queueQuery([{ total: 0 }]);
    io.queueQuery([]);
    await createSessionStore(io).list({ limit: DB_MAX_LIST_LIMIT, nowMs: NOW_MS });
    expect(queries(io)).toHaveLength(2);
    expect(queries(io)[1]).toContain("LIMIT 100");
  });

  test("the declared timeouts are present and referenced on the matching I/O class", () => {
    const source = readFileSync(join(ROOT, ADAPTER), "utf8");
    expect(source).toContain("DB_QUERY_TIMEOUT_MS");
    expect(source).toContain("DB_DELETE_TIMEOUT_MS");
    expect(source).toContain("DB_CHECKPOINT_TIMEOUT_MS");
    expect(source).toMatch(/query\(sql[\s\S]*DB_QUERY_TIMEOUT_MS/);
    expect(source).toMatch(/deleteSession\(id[\s\S]*DB_DELETE_TIMEOUT_MS/);
    expect(source).toMatch(/checkpoint\(\)[\s\S]*DB_CHECKPOINT_TIMEOUT_MS/);
  });

  test("the machine cap and floor constants are declared once", () => {
    expect(DB_MIN_LIMIT).toBe(1);
    expect(DB_MAX_LIST_LIMIT).toBe(100);
    expect(DB_MAX_MACHINE_BYTES).toBe(524288);
  });
});
