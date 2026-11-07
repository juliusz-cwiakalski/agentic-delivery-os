/**
 * TC-HARN-019 / TC-HARN-018 (extraction half) — read-only, query-only,
 * bounded, indexed, lock-free opencode extraction.
 */

import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attemptWrite,
  createBunSqliteStoreOpener,
  createOpencodeTelemetryExtractor,
  type HarnessStoreOpener,
  openHarnessStoreReadOnly,
} from "../../packages/adapters/src/harness/index";
import {
  HARNESS_MAX_SESSIONS,
  HARNESS_WARNING_REASONS,
} from "../../packages/core/src/contracts/index";
import {
  type BuiltStore,
  buildCappedStore,
  buildOpencodeStore,
  FULL_FIXTURE_TOTALS,
  PRIVACY_CANARY,
  WORK_ITEM_REF,
} from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-06T00:00:00Z";
const RUN_ID = "run-023";
const tempRoots: string[] = [];

const track = (store: BuiltStore): BuiltStore => {
  tempRoots.push(store.directory);
  return store;
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const extract = (
  store: BuiltStore,
  options: { readonly pinnedVersion?: string; readonly onStatement?: (sql: string) => void } = {},
) => {
  const opener: HarnessStoreOpener = (path) => createBunSqliteStoreOpener()(path);
  return createOpencodeTelemetryExtractor({
    opener,
    storePath: store.path,
    now: () => NOW,
    ...(options.pinnedVersion === undefined ? {} : { pinnedVersion: options.pinnedVersion }),
    ...(options.onStatement === undefined ? {} : { onStatement: options.onStatement }),
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
};

const snapshot = (directory: string): string =>
  readdirSync(directory)
    .sort()
    .map((entry) => {
      const path = join(directory, entry);
      const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
      return `${entry}:${hash}:${statSync(path).mtimeMs}`;
    })
    .join("|");

describe("TC-HARN-019 read-only opencode extraction", () => {
  test("the store is opened read-only and the query-only pragma precedes the first SELECT", () => {
    const store = track(buildOpencodeStore());
    const statements: string[] = [];
    const result = extract(store, { onStatement: (sql) => statements.push(sql) });
    expect(result.ok).toBe(true);
    const pragmaIndex = statements.findIndex((sql) => sql.startsWith("PRAGMA query_only"));
    const firstSelect = statements.findIndex((sql) => sql.startsWith("SELECT"));
    expect(pragmaIndex).toBe(0);
    expect(firstSelect).toBeGreaterThan(pragmaIndex);
  });

  test("INSERT and DELETE through the seam are rejected as data", () => {
    const store = track(buildOpencodeStore());
    const opened = openHarnessStoreReadOnly(createBunSqliteStoreOpener(), store.path);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    try {
      expect(attemptWrite(opened.handle, "INSERT INTO part (id) VALUES ('x')")).toEqual({
        rejected: true,
      });
      expect(attemptWrite(opened.handle, "DELETE FROM part")).toEqual({ rejected: true });
    } finally {
      opened.handle.close();
    }
  });

  test("store files are unchanged and no sidecar or checkpoint appears", () => {
    const store = track(buildOpencodeStore());
    const before = snapshot(store.directory);
    const result = extract(store);
    expect(result.ok).toBe(true);
    expect(snapshot(store.directory)).toBe(before);
    expect(readdirSync(store.directory).sort()).toEqual(["opencode.db"]);
  });

  test("a fresh writer connection acquires BEGIN IMMEDIATE immediately after extraction", () => {
    const store = track(buildOpencodeStore());
    expect(extract(store).ok).toBe(true);
    const writer = new Database(store.path);
    try {
      writer.exec("PRAGMA busy_timeout = 0");
      writer.exec("BEGIN IMMEDIATE");
      writer.exec(
        "INSERT INTO session (id, parent_id, work_item_ref, harness_version) VALUES ('probe', NULL, 'probe', '1.0.0')",
      );
      writer.exec("COMMIT");
    } finally {
      writer.close();
    }
  });

  test("every statement is bounded and filtered; no message or part table is scanned", () => {
    const store = track(buildOpencodeStore());
    const statements: string[] = [];
    expect(extract(store, { onStatement: (sql) => statements.push(sql) }).ok).toBe(true);
    const selects = statements.filter((sql) => sql.startsWith("SELECT"));
    expect(selects.length).toBeGreaterThan(0);
    for (const sql of selects) {
      if (sql.includes("FROM message") || sql.includes("FROM part")) {
        expect(sql).toContain("session_id = ?");
        expect(sql).toContain("LIMIT");
      }
    }
    const reader = new Database(store.path, { readonly: true });
    try {
      const plans: ReadonlyArray<readonly [sql: string, parameters: readonly (string | number)[]]> =
        [
          [
            "SELECT agent, model, COUNT(*) FROM message WHERE session_id = ? GROUP BY agent, model LIMIT 1",
            ["ses_root"],
          ],
          [
            "SELECT part.tool AS tool, COUNT(*) AS calls FROM part JOIN message ON message.id = part.message_id WHERE part.session_id = ? AND message.agent = ? AND message.model = ? GROUP BY part.tool ORDER BY calls DESC, part.tool ASC LIMIT ?",
            ["ses_root", "agent-a", "model-a", 25],
          ],
          ["SELECT id FROM session WHERE parent_id = ? LIMIT 64", ["ses_root"]],
        ];
      for (const [sql, parameters] of plans) {
        const plan = reader.query(`EXPLAIN QUERY PLAN ${sql}`).all(...parameters) as Array<{
          detail?: string;
        }>;
        const detail = plan.map((row) => row.detail ?? "").join(" | ");
        expect(detail).not.toMatch(/SCAN (message|part)/);
      }
    } finally {
      reader.close();
    }
  });

  test("the session cap is enforced with an explicit truncation mark", () => {
    const capped = track(buildCappedStore());
    const statements: string[] = [];
    const result = extract(capped, { onStatement: (sql) => statements.push(sql) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records.length).toBeLessThanOrEqual(HARNESS_MAX_SESSIONS);
    expect(result.value.sessionTruncation).toEqual({
      truncated: true,
      omitted: 3,
      cap: HARNESS_MAX_SESSIONS,
    });
  });

  test("a missing or unreadable store is a classified failure, never a crash", () => {
    const directory = mkdtempSync(join(tmpdir(), "gh233-missing-"));
    tempRoots.push(directory);
    const result = extract({ directory, path: join(directory, "absent.db") });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("harness.telemetry.extraction-failed");
  });

  test("a bind-mount-style location outside the repository extracts successfully", () => {
    const source = track(buildOpencodeStore());
    const bindMount = mkdtempSync(join(tmpdir(), "gh233-bind-mount-"));
    tempRoots.push(bindMount);
    copyFileSync(source.path, join(bindMount, "mounted.db"));
    const result = extract({ directory: bindMount, path: join(bindMount, "mounted.db") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records.map((record) => record.sessionId).sort()).toEqual([
      "ses_child_a",
      "ses_child_b",
      "ses_root",
    ]);
  });

  test("a session spanning two (agent, model) groups emits one record per group", () => {
    const store = track(buildOpencodeStore({ variant: "multi-group" }));
    const result = extract(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rootRecords = result.value.records.filter((record) => record.sessionId === "ses_root");
    expect(rootRecords).toHaveLength(2);
    const byAgent = new Map(rootRecords.map((record) => [record.agent, record]));
    const groupA = byAgent.get("agent-a");
    const groupB = byAgent.get("agent-b");
    expect(groupA?.model).toBe("model-a");
    expect(groupB?.model).toBe("model-b");
    expect(groupA?.calls).toBe(2);
    expect(groupB?.calls).toBe(1);
    expect(groupA?.tokens.input).toBe(15);
    expect(groupB?.tokens.input).toBe(3);
    expect(groupA?.toolCounts).toEqual([{ tool: "edit", calls: 2 }]);
    expect(groupB?.toolCounts).toEqual([{ tool: "bash", calls: 1 }]);
    for (const record of rootRecords) {
      expect(record.treeRoot).toBe("ses_root");
      expect(record.workItemRef).toBe(WORK_ITEM_REF);
    }
    expect(result.value.warnings.filter((warning) => warning.reason === "truncated")).toEqual([]);
    expect(
      new Set(
        result.value.records.map((record) => `${record.sessionId}|${record.agent}|${record.model}`),
      ).size,
    ).toBe(result.value.records.length);
  });

  test("a session over the group cap truncates with an explicit omitted count", () => {
    const groups = 17;
    const store = track(buildOpencodeStore({ rootGroups: groups }));
    const result = extract(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rootRecords = result.value.records.filter((record) => record.sessionId === "ses_root");
    expect(rootRecords.length).toBeGreaterThan(0);
    expect(rootRecords.length).toBeLessThan(groups + 1);
    const truncation = result.value.warnings.find((warning) => warning.reason === "truncated");
    expect(truncation).toBeDefined();
    expect(truncation?.field).toContain("omitted=");
    expect(truncation?.field).toContain("cap=");
  });

  test("the full fixture yields deterministic token totals and no content canary", () => {
    const store = track(buildOpencodeStore());
    const result = extract(store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records).toHaveLength(FULL_FIXTURE_TOTALS.sessions);
    const sum = (key: keyof typeof FULL_FIXTURE_TOTALS): number =>
      result.value.records.reduce((total, record) => {
        const value =
          key === "sessions" ? 1 : (record.tokens[key as keyof typeof record.tokens] ?? 0);
        return total + value;
      }, 0);
    expect(sum("input")).toBe(FULL_FIXTURE_TOTALS.input);
    expect(sum("output")).toBe(FULL_FIXTURE_TOTALS.output);
    expect(sum("reasoning")).toBe(FULL_FIXTURE_TOTALS.reasoning);
    expect(sum("cacheRead")).toBe(FULL_FIXTURE_TOTALS.cacheRead);
    expect(sum("cacheWrite")).toBe(FULL_FIXTURE_TOTALS.cacheWrite);
    expect(JSON.stringify(result.value)).not.toContain(PRIVACY_CANARY);
    for (const warning of result.value.warnings) {
      expect(HARNESS_WARNING_REASONS).toContain(warning.reason);
    }
  });
});
