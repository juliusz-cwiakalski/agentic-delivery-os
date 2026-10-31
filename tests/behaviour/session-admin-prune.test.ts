/**
 * TC-DB-011..TC-DB-022 and the prune half of TC-DB-037.
 *
 * Selection and the pre-delete re-check use the same pure predicate; dry-run
 * mutates nothing; apply deletes one candidate at a time through the official
 * seam; gained children, vanished rows, absent rows, and partial failures are
 * counted truthfully. Every negative has a live control in the same test.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSessionAdmin } from "../../packages/adapters/src/session/index";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import {
  classifyPruneCandidate,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  DB_DEFAULT_PRUNE_LIMIT,
  DB_LIVE_WINDOW_MINUTES,
  DB_MAX_OLDER_THAN_DAYS,
  DB_MAX_PRUNE_LIMIT,
  DB_SCHEMA_VERSION,
  renderSessionAdminHuman,
  type PruneCandidateFact,
  selectPruneCandidates,
} from "../../packages/core/src/contracts/index";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import {
  BOUNDARY_CASES,
  BOUNDARY_IDS,
  cutoffMs,
  ORDER_SESSIONS,
} from "../fixtures/session-admin/boundaries";
import {
  callsOf,
  createFakeIo,
  fakeFailDelete,
  fakeRemoveRow,
  fakeSetChildren,
  LIVE_BOUNDARY,
  NOW_MS,
  queries,
} from "../fixtures/session-admin/harness";
import { malformedQueryError, unavailableError } from "../fixtures/session-admin/malformed";
import { makeSession, sessionRow, type SessionFixture } from "../fixtures/session-admin/store";

const ROOT = process.cwd();
const ADAPTER = "packages/adapters/src/session/index.ts";

const runPrune = (
  io: ReturnType<typeof createFakeIo>,
  input: Partial<{
    olderThanDays: number;
    limit: number;
    apply: boolean;
  }> = {},
) =>
  createSessionAdmin(io).prune({
    olderThanDays: input.olderThanDays ?? 30,
    limit: input.limit ?? DB_DEFAULT_PRUNE_LIMIT,
    apply: input.apply ?? false,
    nowMs: NOW_MS,
  });

const queueSelection = (
  io: ReturnType<typeof createFakeIo>,
  sessions: readonly SessionFixture[],
): void => {
  io.queueQuery(sessions.map(sessionRow));
};

const queueReRead = (
  io: ReturnType<typeof createFakeIo>,
  session: SessionFixture,
  hasChildren?: boolean,
  before?: () => void,
): void => {
  const row = sessionRow(
    hasChildren === undefined ? session : makeSession({ ...session, hasChildren }),
  );
  io.queueQuery([row], before);
};

const queueZeroRows = (io: ReturnType<typeof createFakeIo>, before?: () => void): void => {
  io.queueQuery([], before);
};

const queueExists = (io: ReturnType<typeof createFakeIo>, session: SessionFixture): void => {
  io.queueQuery([{ id: session.id }]);
};

const selectionMissingPredicates = (
  sql: string,
  cutoff: number,
  liveBoundary: number,
): string[] => {
  const missing: string[] = [];
  if (!sql.includes(`s.time_updated < ${cutoff}`)) missing.push("cold");
  if (!sql.includes(`s.time_updated < ${liveBoundary}`)) missing.push("not-live");
  if (!/NOT EXISTS\s*\(\s*SELECT 1 FROM session c WHERE c\.parent_id = s\.id\s*\)/i.test(sql)) {
    missing.push("leaf");
  }
  if (!/ORDER BY s\.time_updated ASC/i.test(sql)) missing.push("order");
  if (!/LIMIT \d+/i.test(sql)) missing.push("limit");
  return missing;
};

const factOf = (session: SessionFixture): PruneCandidateFact => ({
  id: session.id,
  updatedAtMs: session.timeUpdated,
  hasChildren: session.hasChildren === true,
  summary: {
    id: session.id,
    ...(session.parentId === undefined ? {} : { parentId: session.parentId }),
    createdAt: new Date(session.timeCreated).toISOString(),
    updatedAt: new Date(session.timeUpdated).toISOString(),
    messageCount: session.messageCount,
    partCount: session.partCount,
    dataBytes: session.dataBytes,
    archived: session.timeArchived !== undefined,
    live: false,
  },
});

// Returned oldest-first so scripted re-reads line up with selection order.
const coldLeaves = (count = 3): SessionFixture[] =>
  Array.from({ length: count }, (_, index) =>
    makeSession({
      id: `ses_cold_${index}`,
      timeUpdated: cutoffMs(30) - (count - index) * 1_000,
      messageCount: index,
      partCount: index,
      dataBytes: index * 10,
    }),
  );

describe("TC-DB-011 prune dry-run mutates nothing and repeats identically", () => {
  test("five cold leaves are reported with all five selection predicates", async () => {
    const fixture = coldLeaves(5);
    const io = createFakeIo();
    queueSelection(io, fixture);
    const read = await runPrune(io);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toMatchObject({
      schemaVersion: DB_SCHEMA_VERSION,
      command: "prune",
      mode: "dry-run",
      olderThanDays: 30,
      limit: 50,
      liveWindowMinutes: DB_LIVE_WINDOW_MINUTES,
      counts: { selected: 5, deleted: 0, failed: 0, skipped: 0, liveExcluded: 0 },
    });
    expect(read.value.candidates).toHaveLength(5);
    expect(read.value.cutoff).toBe(new Date(computeDbCutoffMs(NOW_MS, 30)).toISOString());
    const sql = queries(io)[0] ?? "";
    expect(selectionMissingPredicates(sql, computeDbCutoffMs(NOW_MS, 30), LIVE_BOUNDARY)).toEqual(
      [],
    );
    expect(callsOf(io, "deleteSession")).toEqual([]);
    expect(callsOf(io, "checkpoint")).toEqual([]);
    expect(callsOf(io, "stat")).toEqual([]);
  });

  test("two identical dry-runs are byte-identical and a dropped predicate is caught", async () => {
    const fixture = coldLeaves(5);
    const first = createFakeIo();
    queueSelection(first, fixture);
    const second = createFakeIo();
    queueSelection(second, fixture);
    const a = await runPrune(first);
    const b = await runPrune(second);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
    expect(renderSessionAdminHuman(a.value, SYNTHETIC_BRAND)).toBe(
      renderSessionAdminHuman(b.value, SYNTHETIC_BRAND),
    );
    const cutoff = computeDbCutoffMs(NOW_MS, 30);
    const dropped = (queries(first)[0] ?? "").replace(` AND s.time_updated < ${LIVE_BOUNDARY}`, "");
    expect(selectionMissingPredicates(dropped, cutoff, LIVE_BOUNDARY)).toContain("not-live");
    expect(callsOf(first, "deleteSession")).toEqual([]);
  });
});

describe("TC-DB-012 cold boundary selection", () => {
  test("strict cutoff: the boundary is warm, the neighbouring millisecond is cold", async () => {
    const fixture = BOUNDARY_CASES.filter((entry) =>
      [BOUNDARY_IDS.b01, BOUNDARY_IDS.b02, BOUNDARY_IDS.b03, BOUNDARY_IDS.b04].some(
        (id) => id === entry.id,
      ),
    ).map((entry) => entry.session);
    const io = createFakeIo();
    queueSelection(io, fixture);
    const read = await runPrune(io, { olderThanDays: 30 });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.candidates.map((candidate) => candidate.id)).toEqual([BOUNDARY_IDS.b02]);
    expect(read.value.cutoff).toBe(new Date(computeDbCutoffMs(NOW_MS, 30)).toISOString());
    const sql = queries(io)[0] ?? "";
    expect(sql).toContain(`s.time_updated < ${computeDbCutoffMs(NOW_MS, 30)}`);
    const nonStrict = sql.replace(
      `s.time_updated < ${computeDbCutoffMs(NOW_MS, 30)}`,
      `s.time_updated <= ${computeDbCutoffMs(NOW_MS, 30)}`,
    );
    expect(
      selectionMissingPredicates(nonStrict, computeDbCutoffMs(NOW_MS, 30), LIVE_BOUNDARY),
    ).toContain("cold");
  });

  test("the one-day floor selects 24 h + 1 ms and excludes exactly 24 h", async () => {
    const io = createFakeIo();
    queueSelection(io, [
      makeSession({ id: "ses_24h_plus_1", timeUpdated: cutoffMs(1) - 1 }),
      makeSession({ id: "ses_24h_exact", timeUpdated: cutoffMs(1) }),
    ]);
    const read = await runPrune(io, { olderThanDays: 1 });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.cutoff).toBe(new Date(computeDbCutoffMs(NOW_MS, 1)).toISOString());
    expect(read.value.candidates.map((candidate) => candidate.id)).toEqual(["ses_24h_plus_1"]);
    expect(queries(io)[0]).toContain(`s.time_updated < ${computeDbCutoffMs(NOW_MS, 1)}`);
  });
});

describe("TC-DB-013 live window and leaf-only selection", () => {
  test("live rows are excluded, parents are excluded, and a child leaf is eligible", async () => {
    const fixture: SessionFixture[] = [
      ...BOUNDARY_CASES.filter((entry) =>
        [
          BOUNDARY_IDS.b05,
          BOUNDARY_IDS.b06,
          BOUNDARY_IDS.b07,
          BOUNDARY_IDS.b08,
          BOUNDARY_IDS.b09,
        ].some((id) => id === entry.id),
      ).map((entry) => entry.session),
      makeSession({ id: BOUNDARY_IDS.b10, timeUpdated: cutoffMs(30) - 100_000 }),
      makeSession({ id: BOUNDARY_IDS.b11, timeUpdated: cutoffMs(30) - 200_000, hasChildren: true }),
      makeSession({
        id: "ses_cold_child_leaf",
        parentId: BOUNDARY_IDS.b11,
        timeUpdated: cutoffMs(30) - 100_000,
      }),
      makeSession({
        id: BOUNDARY_IDS.b12,
        timeUpdated: cutoffMs(30) - 300_000,
        hasChildren: true,
      }),
      makeSession({
        id: "ses_live_child",
        parentId: BOUNDARY_IDS.b12,
        timeUpdated: NOW_MS - 1_000,
      }),
    ];
    const io = createFakeIo();
    queueSelection(io, fixture);
    const read = await runPrune(io);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const selected = read.value.candidates.map((candidate) => candidate.id).sort();
    expect(selected).toEqual([BOUNDARY_IDS.b10, "ses_cold_child_leaf"].sort());
    expect(read.value.counts.liveExcluded).toBe(4);
    expect(read.value.counts.selected).toBe(2);
    const sql = queries(io)[0] ?? "";
    expect(sql).toContain(`s.time_updated < ${computeDbLiveBoundaryMs(NOW_MS)}`);
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("c.parent_id = s.id");
  });

  test("the pure predicate reports live first even when the fact is also warm", () => {
    const fact = factOf(makeSession({ id: "ses_live_cold", timeUpdated: LIVE_BOUNDARY }));
    expect(classifyPruneCandidate(fact, { nowMs: NOW_MS, olderThanDays: 30 })).toEqual({
      eligible: false,
      reason: "live",
    });
    expect(selectPruneCandidates([fact], { nowMs: NOW_MS, olderThanDays: 30, limit: 50 })).toEqual(
      [],
    );
  });

  test("the adapter imports the shared predicate and has no inline parent comparison", () => {
    const source = readFileSync(join(ROOT, ADAPTER), "utf8");
    expect(source).toContain("classifyPruneCandidate");
    expect(source).not.toContain("parent_id ===");
    expect(source).not.toContain("parent_id !==");
  });
});

describe("TC-DB-014 oldest-first ordering, id tiebreak, and the cap", () => {
  test("scrambled candidates sort oldest-first with an id tiebreak", async () => {
    const io = createFakeIo();
    queueSelection(io, ORDER_SESSIONS);
    const read = await runPrune(io, { limit: 50 });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.candidates.map((candidate) => candidate.id)).toEqual([
      "ses_t1",
      "ses_t2_a",
      "ses_t2_b",
      "ses_t4",
      "ses_t5",
    ]);
    expect(read.value.counts.selected).toBe(5);
  });

  test("limit 2 caps the selection and the SQL carries ORDER BY and LIMIT 2", async () => {
    const io = createFakeIo();
    queueSelection(io, ORDER_SESSIONS);
    const read = await runPrune(io, { limit: 2 });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.candidates.map((candidate) => candidate.id)).toEqual(["ses_t1", "ses_t2_a"]);
    expect(read.value.counts.selected).toBe(2);
    const sql = queries(io)[0] ?? "";
    expect(sql).toContain("ORDER BY s.time_updated ASC, s.id ASC");
    expect(sql).toContain("LIMIT 2");
    expect(sql).not.toContain("LIMIT 50");
  });
});

describe("TC-DB-015 apply deletes only through the official command", () => {
  test("one delete per selected id, in order, with no raw SQL delete", async () => {
    const fixture = coldLeaves(3);
    const io = createFakeIo();
    queueSelection(io, fixture);
    for (const session of fixture) queueReRead(io, session);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.mode).toBe("applied");
    expect(read.value.counts).toMatchObject({ selected: 3, deleted: 3, failed: 0, skipped: 0 });
    expect(callsOf(io, "deleteSession").map((call) => call.value)).toEqual(
      fixture.map((session) => session.id),
    );
    for (const sql of queries(io)) {
      expect(sql.toUpperCase()).not.toMatch(/\b(DELETE|DROP|TRUNCATE|VACUUM)\b/);
    }
    const bulkMutant = "DELETE FROM session";
    expect(bulkMutant.toUpperCase()).toMatch(/\bDELETE\b/);
  });
});

describe("TC-DB-016 no database, WAL, or SHM file is touched", () => {
  test("prune records no stat and no destructive operation", async () => {
    const io = createFakeIo();
    queueSelection(io, coldLeaves(1));
    const read = await runPrune(io);
    expect(read.ok).toBe(true);
    expect(callsOf(io, "stat")).toEqual([]);
  });
});

describe("TC-DB-017 idempotent re-run and post-apply dry-run", () => {
  test("a second apply and a post-apply dry-run select zero candidates", async () => {
    const fixture = coldLeaves(3);
    const first = createFakeIo();
    queueSelection(first, fixture);
    for (const session of fixture) queueReRead(first, session);
    const applied = await runPrune(first, { apply: true });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.counts.deleted).toBe(3);

    const second = createFakeIo();
    queueSelection(second, []);
    const reapply = await runPrune(second, { apply: true });
    expect(reapply.ok).toBe(true);
    if (!reapply.ok) return;
    expect(reapply.value.counts).toMatchObject({ selected: 0, deleted: 0, failed: 0 });
    expect(callsOf(second, "deleteSession")).toEqual([]);

    const third = createFakeIo();
    queueSelection(third, []);
    const dry = await runPrune(third);
    expect(dry.ok).toBe(true);
    if (!dry.ok) return;
    expect(dry.value.counts.selected).toBe(0);
    expect(dry.value.mode).toBe("dry-run");

    // Mutant control: a store that keeps the rows would still select them.
    const retained = createFakeIo();
    queueSelection(retained, fixture);
    const kept = await runPrune(retained);
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(kept.value.counts.selected).toBe(3);
  });
});

describe("TC-DB-018 a candidate that gains a child is skipped", () => {
  test("X is skipped, Y is deleted, and the re-read SQL carries all predicates", async () => {
    const x = makeSession({ id: "ses_x", timeUpdated: cutoffMs(30) - 2_000 });
    const y = makeSession({ id: "ses_y", timeUpdated: cutoffMs(30) - 1_000 });
    const io = createFakeIo();
    queueSelection(io, [x, y]);
    queueReRead(io, x, true, () => fakeSetChildren(io, x.id));
    queueReRead(io, y);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.counts.skipped).toBeGreaterThanOrEqual(1);
    expect(callsOf(io, "deleteSession").map((call) => call.value)).toEqual([y.id]);
    const reReadSql = queries(io)[1] ?? "";
    expect(reReadSql).toContain(`s.time_updated < ${computeDbCutoffMs(NOW_MS, 30)}`);
    expect(reReadSql).toContain(`s.time_updated < ${computeDbLiveBoundaryMs(NOW_MS)}`);
    expect(reReadSql).toContain("NOT EXISTS");
    expect(reReadSql).toContain(`s.id = '${x.id}'`);
    const childOnly = reReadSql
      .replace(` AND s.time_updated < ${computeDbCutoffMs(NOW_MS, 30)}`, "")
      .replace(` AND s.time_updated < ${computeDbLiveBoundaryMs(NOW_MS)}`, "");
    expect(childOnly).not.toContain(`s.time_updated <`);
  });
});

describe("TC-DB-019 a row that vanishes before the re-read is skipped", () => {
  test("X is skipped without a delete and Y is still deleted", async () => {
    const x = makeSession({ id: "ses_x", timeUpdated: cutoffMs(30) - 2_000 });
    const y = makeSession({ id: "ses_y", timeUpdated: cutoffMs(30) - 1_000 });
    const io = createFakeIo();
    queueSelection(io, [x, y]);
    queueZeroRows(io, () => fakeRemoveRow(io, x.id));
    queueReRead(io, y);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.counts.skipped).toBeGreaterThanOrEqual(1);
    expect(callsOf(io, "deleteSession").map((call) => call.value)).toEqual([y.id]);
    expect(read.value.counts.deleted).toBe(1);
  });
});

describe("TC-DB-020 partial failure is reported and a retry converges", () => {
  test("a failed delete returns the normative summary and the retry deletes only Y", async () => {
    const [x, y, z] = coldLeaves(3) as [SessionFixture, SessionFixture, SessionFixture];
    const io = createFakeIo();
    queueSelection(io, [x, y, z]);
    queueReRead(io, x);
    queueReRead(io, y);
    fakeFailDelete(io, y.id);
    queueExists(io, y);
    queueReRead(io, z);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe("db.delete.failed");
    expect(read.error.summary).toBe(
      "1 of 3 session deletes did not land (first: ses_cold_1); 2 landed",
    );
    const row = classifyDomainKind("db", "db.delete.failed");
    expect(row).toMatchObject({
      category: "transient",
      retryable: true,
      consequence: "not_landed",
      projectionClass: "platform-provider",
    });
    expect(io.deleted).toEqual([x.id, z.id]);
    expect(io.deleted).not.toContain(y.id);

    const retry = createFakeIo();
    queueSelection(retry, [y]);
    queueReRead(retry, y);
    const converged = await runPrune(retry, { apply: true });
    expect(converged.ok).toBe(true);
    if (!converged.ok) return;
    expect(converged.value.counts).toMatchObject({ selected: 1, deleted: 1, failed: 0 });
    expect(retry.deleted).toEqual([y.id]);
  });

  test("a summary without the failed id or the landed count is caught", () => {
    const good = "1 of 3 session deletes did not land (first: ses_cold_1); 2 landed";
    const noId = "1 of 3 session deletes did not land; 2 landed";
    const noLanded = "1 of 3 session deletes did not land (first: ses_cold_1); landed";
    expect(good).toMatch(
      /^\d+ of \d+ session deletes did not land \(first: [A-Za-z0-9_-]+\); \d+ landed$/,
    );
    expect(noId).not.toMatch(/first:/);
    expect(noLanded).not.toMatch(/; \d+ landed$/);
  });
});

describe("TC-DB-021 an already-absent row at delete is a skip", () => {
  test("X is skipped, Y is deleted in the same run, and no failure is fabricated", async () => {
    const x = makeSession({ id: "ses_x", timeUpdated: cutoffMs(30) - 2_000 });
    const y = makeSession({ id: "ses_y", timeUpdated: cutoffMs(30) - 1_000 });
    const io = createFakeIo();
    queueSelection(io, [x, y]);
    queueReRead(io, x);
    fakeFailDelete(io, x.id);
    queueZeroRows(io, () => fakeRemoveRow(io, x.id));
    queueReRead(io, y);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.counts.skipped).toBeGreaterThanOrEqual(1);
    expect(read.value.counts.failed).toBe(0);
    expect(callsOf(io, "deleteSession").map((call) => call.value)).toEqual([x.id, y.id]);
    expect(io.deleted).toEqual([y.id]);
  });
});

describe("TC-DB-022 pre-land abort identities and post-land partial-abort truth", () => {
  test("databasePath and query failures before any delete keep their own identity", async () => {
    const unavailableIo = createFakeIo({ databasePathError: unavailableError });
    queueSelection(unavailableIo, coldLeaves(1));
    const unavailable = await runPrune(unavailableIo, { apply: true });
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable.error.code).toBe("db.opencode.unavailable");
    expect(callsOf(unavailableIo, "deleteSession")).toEqual([]);
    expect(queries(unavailableIo)).toEqual([]);

    const queryIo = createFakeIo();
    queryIo.queueError(malformedQueryError);
    const queryFailed = await runPrune(queryIo, { apply: true });
    expect(queryFailed.ok).toBe(false);
    if (!queryFailed.ok) expect(queryFailed.error.code).toBe("db.query.failed");
    expect(callsOf(queryIo, "deleteSession")).toEqual([]);
  });

  test("a re-read failure after one delete returns db.delete.failed with landed truth", async () => {
    const [x, y, z] = coldLeaves(3) as [SessionFixture, SessionFixture, SessionFixture];
    const io = createFakeIo();
    queueSelection(io, [x, y, z]);
    queueReRead(io, x);
    io.queueError(malformedQueryError);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe("db.delete.failed");
    expect(read.error.summary).toBe(
      "1 of 2 session deletes did not land (first: ses_cold_1); 1 landed",
    );
    expect(io.deleted).toEqual([x.id]);
    expect(callsOf(io, "deleteSession").map((call) => call.value)).toEqual([x.id]);
    const zRead = queries(io).some((sql) => sql.includes(`s.id = '${z.id}'`));
    expect(zRead).toBe(false);
  });

  test("a post-delete existence-read failure after one landed delete aborts truthfully", async () => {
    const x = makeSession({ id: "ses_x", timeUpdated: cutoffMs(30) - 2_000 });
    const y = makeSession({ id: "ses_y", timeUpdated: cutoffMs(30) - 1_000 });
    const io = createFakeIo();
    queueSelection(io, [x, y]);
    queueReRead(io, x);
    queueReRead(io, y);
    fakeFailDelete(io, y.id);
    io.queueError(unavailableError);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe("db.delete.failed");
    expect(read.error.summary).toMatch(
      /^1 of 2 session deletes did not land \(first: ses_y\); 1 landed$/,
    );
    expect(io.deleted).toEqual([x.id]);
  });

  test("an empty selection remains a success control", async () => {
    const io = createFakeIo();
    queueSelection(io, []);
    const read = await runPrune(io, { apply: true });
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.counts.selected).toBe(0);
  });
});

describe("TC-DB-037 prune bounded work", () => {
  test("one selection query, one re-read per candidate, and one delete per candidate", async () => {
    const fixture = coldLeaves(3);
    const io = createFakeIo();
    queueSelection(io, fixture);
    for (const session of fixture) queueReRead(io, session);
    await runPrune(io, { apply: true });
    expect(queries(io)).toHaveLength(1 + fixture.length);
    expect(callsOf(io, "deleteSession")).toHaveLength(fixture.length);
    expect(DB_MAX_PRUNE_LIMIT).toBe(500);
    expect(DB_MAX_OLDER_THAN_DAYS).toBe(3650);
  });
});
