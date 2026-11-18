/**
 * TC-HARNESS-025 / TC-HARNESS-028 (extractor half) — the observed contract and
 * the read discipline: no work-item column, no harness-version column, no
 * per-message token/agent/model column, no `part.tool` query, no full scan.
 */
import { describe, expect, test } from "bun:test";
import {
  createBunSqliteStoreOpener,
  createOpencodeTelemetryExtractor,
} from "../../packages/adapters/src/harness/index";
import { extractOpencode, ROOT_BINDING } from "../fixtures/harness/telemetry-attempts";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";

const FORBIDDEN = [
  "work_item_ref",
  "harness_version",
  "part.tool",
  "part AS",
  "FROM part",
  "input_tokens",
  "output_tokens",
  "reasoning_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
];

describe("TC-HARNESS-025 the extractor's statements", () => {
  test("every statement is scoped, bounded, and free of the shapes the store lacks", () => {
    const store = buildOpencodeStore();
    const statements: string[] = [];
    const captured = createOpencodeTelemetryExtractor({
      opener: createBunSqliteStoreOpener(),
      storePath: store.path,
      now: () => "2026-11-18T00:00:00.000Z",
      onStatement: (sql) => statements.push(sql),
    }).extract({
      workItemRef: "GH-335",
      runId: "run-gh335",
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    expect(statements.length).toBeGreaterThan(0);
    expect(statements[0]).toContain("PRAGMA query_only");
    for (const sql of statements) {
      for (const forbidden of FORBIDDEN) {
        expect(sql.toLowerCase(), `${forbidden} in ${sql}`).not.toContain(forbidden.toLowerCase());
      }
      // A message read is scoped by the session identity and bounded.
      if (sql.includes("session_message") || sql.includes("FROM message")) {
        expect(sql).toContain("session_id = ?");
        expect(sql).toContain("LIMIT");
      }
      // A session read is scoped by identity or by the parent link.
      if (sql.includes("FROM session_v2")) {
        expect(sql.includes("WHERE id = ?") || sql.includes("WHERE parent_id = ?")).toBe(true);
      }
      // No content projection: the JSON document is read, never opened in SQL.
      expect(sql).not.toContain("data.content");
      expect(sql).not.toContain("json_extract");
    }
  });

  test("an unrecognised generation is a classified extraction failure", () => {
    const store = buildOpencodeStore({ variant: "full" });
    const captured = createOpencodeTelemetryExtractor({
      opener: () => ({ ok: false }),
      storePath: store.path,
      now: () => "2026-11-18T00:00:00.000Z",
    }).extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
    if (captured.ok) return;
    expect(captured.error.code).toBe("harness.telemetry.extraction-failed");
  });

  test("the full fixture lands its rows through the production extractor", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, bindings: { [ROOT_SESSION]: ROOT_BINDING } });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records.length).toBeGreaterThanOrEqual(2);
    expect(captured.value.records.every((row) => row.harnessKind === "opencode")).toBe(true);
  });
});
