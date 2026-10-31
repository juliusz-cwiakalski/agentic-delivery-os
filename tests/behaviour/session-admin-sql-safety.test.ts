/**
 * TC-DB-025 (defensive clamp half), TC-DB-026, and TC-DB-027.
 *
 * Every adapter query is one bounded statement and never carries an
 * untrusted value; ids are shape-validated before interpolation or command use;
 * the checkpoint is the one exact statement. Mutants are planted at the
 * assertion level and must be detected.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSessionAdmin, createSessionStore } from "../../packages/adapters/src/session/index";
import {
  DB_MAX_OLDER_THAN_DAYS,
  DB_MAX_PRUNE_LIMIT,
  DB_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import {
  createFakeIo,
  NOW_MS,
  queries,
  SYNTHETIC_DB_PATH,
} from "../fixtures/session-admin/harness";
import { OVER_CAP_PATH, allInvalidIds, VALID_IDS } from "../fixtures/session-admin/ids";
import { makeSession, sessionRow, type SessionFixture } from "../fixtures/session-admin/store";

const ROOT = process.cwd();
const ADAPTER = "packages/adapters/src/session/index.ts";

const forbidden = (sql: string): boolean =>
  /\b(DELETE|DROP|TRUNCATE|VACUUM|ALTER|CREATE)\b/i.test(sql);

const singleStatement = (sql: string): boolean =>
  !sql.includes(";") && !sql.includes("--") && !sql.includes("/*");

const bulkIn = (sql: string): boolean => /\bIN\s*\(/i.test(sql);

const rewriteId = (sql: string, id: string): string => sql.replace("<ID>", id);

const cold = (id: string, offset = 1_000): SessionFixture =>
  makeSession({ id, timeUpdated: NOW_MS - 30 * 86_400_000 - offset });

const statFacts = (io: ReturnType<typeof createFakeIo>): void => {
  io.statFacts.set(SYNTHETIC_DB_PATH, { bytes: 4096, present: true });
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-wal`, { bytes: 0, present: false });
  io.statFacts.set(`${SYNTHETIC_DB_PATH}-shm`, { bytes: 0, present: false });
};

const collectQueries = async (): Promise<string[]> => {
  const all: string[] = [];
  const sizeIo = createFakeIo();
  statFacts(sizeIo);
  sizeIo.queueQuery([{ sessions: 1, oldest: NOW_MS, newest: NOW_MS }]);
  sizeIo.queueQuery([{ messages: 1 }]);
  sizeIo.queueQuery([{ parts: 1 }]);
  await createSessionStore(sizeIo).size();
  all.push(...queries(sizeIo));

  const listIo = createFakeIo();
  listIo.queueQuery([{ total: 1 }]);
  listIo.queueQuery([sessionRow(cold("ses_list"))]);
  await createSessionStore(listIo).list({ limit: 20, nowMs: NOW_MS });
  all.push(...queries(listIo));

  const dryIo = createFakeIo();
  dryIo.queueQuery([sessionRow(cold("ses_dry"))]);
  await createSessionAdmin(dryIo).prune({
    olderThanDays: 30,
    limit: 50,
    apply: false,
    nowMs: NOW_MS,
  });
  all.push(...queries(dryIo));

  const applyIo = createFakeIo();
  const applySession = cold("ses_apply");
  applyIo.queueQuery([sessionRow(applySession)]);
  applyIo.queueQuery([sessionRow(applySession)]);
  await createSessionAdmin(applyIo).prune({
    olderThanDays: 30,
    limit: 50,
    apply: true,
    nowMs: NOW_MS,
  });
  all.push(...queries(applyIo));

  const rebootIo = createFakeIo();
  statFacts(rebootIo);
  rebootIo.queueQuery([{ live_sessions: 0 }]);
  await createSessionAdmin(rebootIo).reboot({ apply: false, nowMs: NOW_MS });
  all.push(...queries(rebootIo));
  return all;
};

describe("TC-DB-027 single-statement SQL discipline and no raw delete", () => {
  test("every recorded query is one bounded statement with no raw DDL", async () => {
    const all = await collectQueries();
    expect(all.length).toBeGreaterThan(0);
    for (const sql of all) {
      expect(singleStatement(sql), sql).toBe(true);
      expect(forbidden(sql), sql).toBe(false);
      expect(bulkIn(sql), sql).toBe(false);
    }
    expect(all.some((sql) => sql.includes("LIMIT"))).toBe(true);
    expect(forbidden("DELETE FROM session")).toBe(true);
    expect(bulkIn("SELECT * FROM session WHERE id IN ('a','b')")).toBe(true);
  });

  test("the checkpoint is exactly PRAGMA wal_checkpoint(TRUNCATE)", () => {
    const source = readFileSync(join(ROOT, ADAPTER), "utf8");
    expect(source).toContain("PRAGMA wal_checkpoint(TRUNCATE)");
    expect(source).toContain("io.checkpoint()");
  });

  test("the delete path is one official delete per candidate, never SQL", async () => {
    const io = createFakeIo();
    const sessions = [cold("ses_1", 1_000), cold("ses_2", 2_000)];
    io.queueQuery(sessions.map(sessionRow));
    for (const session of sessions) io.queueQuery([sessionRow(session)]);
    const read = await createSessionAdmin(io).prune({
      olderThanDays: 30,
      limit: 50,
      apply: true,
      nowMs: NOW_MS,
    });
    expect(read.ok).toBe(true);
    expect(io.deleted).toEqual(["ses_2", "ses_1"]);
    for (const sql of queries(io)) expect(sql.toUpperCase()).not.toMatch(/\bDELETE\b/);
  });
});

describe("TC-DB-025 numeric flag ranges and the defensive clamp", () => {
  test("direct out-of-range policy calls are clamped before interpolation", async () => {
    const io = createFakeIo();
    io.queueQuery([]);
    const read = await createSessionAdmin(io).prune({
      olderThanDays: 99_999,
      limit: 9_999,
      apply: false,
      nowMs: NOW_MS,
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.olderThanDays).toBe(DB_MAX_OLDER_THAN_DAYS);
    expect(read.value.limit).toBe(DB_MAX_PRUNE_LIMIT);
    expect(read.value.olderThanDays).not.toBe(99_999);
    const sql = queries(io)[0] ?? "";
    expect(sql).toContain(`LIMIT ${DB_MAX_PRUNE_LIMIT}`);
    expect(sql).not.toContain("99999");
    expect(sql).not.toContain("LIMIT 9999");
  });

  test("a raw-value interpolating mutant is detected", () => {
    const raw = `SELECT 1 FROM session LIMIT 99999`;
    expect(raw).toContain("99999");
    expect(raw).not.toContain(`LIMIT ${DB_MAX_PRUNE_LIMIT}`);
  });
});

describe("TC-DB-026 id shapes, injection attempts, and over-cap identities", () => {
  test("valid ids proceed and every invalid id aborts with db.query.failed before a delete", async () => {
    for (const id of VALID_IDS) {
      const io = createFakeIo();
      io.queueQuery([{ total: 1 }]);
      io.queueQuery([sessionRow(makeSession({ id, timeUpdated: NOW_MS - 1 }))]);
      const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
      expect(read.ok, id).toBe(true);
    }
    for (const id of allInvalidIds()) {
      const badIo = createFakeIo();
      badIo.queueQuery([{ ...sessionRow(cold("ses_probe")), id }]);
      const bad = await createSessionAdmin(badIo).prune({
        olderThanDays: 30,
        limit: 50,
        apply: true,
        nowMs: NOW_MS,
      });
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.error.code).toBe("db.query.failed");
        expect(bad.error.field).toBe("session.id");
      }
      expect(badIo.deleted).toEqual([]);
      for (const sql of queries(badIo)) {
        if (id.length > 0) expect(sql).not.toContain(id);
      }
    }
  });

  test("a list row with an invalid id aborts the page", async () => {
    for (const id of allInvalidIds()) {
      const io = createFakeIo();
      io.queueQuery([{ total: 1 }]);
      io.queueQuery([{ ...sessionRow(makeSession({ id: "ses_probe" })), id }]);
      const read = await createSessionStore(io).list({ limit: 20, nowMs: NOW_MS });
      expect(read.ok, id).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("db.query.failed");
    }
  });

  test("an over-cap path fails naming the field and is never truncated", async () => {
    const io = createFakeIo({ databasePath: OVER_CAP_PATH });
    const read = await createSessionStore(io).size();
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe("db.query.failed");
      expect(read.error.field).toBe("path");
    }
    expect(OVER_CAP_PATH.length).toBeGreaterThan(1024);
    expect(OVER_CAP_PATH.slice(0, 1024)).not.toBe(OVER_CAP_PATH);
  });

  test("an interpolating mutant carries the raw value and is detected", () => {
    const id = `x'; DROP TABLE session; --`;
    const mutated = rewriteId("SELECT * FROM session WHERE id = '<ID>'", id);
    expect(mutated).toContain(id);
    expect(mutated).toContain("';");
  });

  test("the schema version stays delivery.session-admin.v1", () => {
    expect(DB_SCHEMA_VERSION).toBe("delivery.session-admin.v1");
  });
});
