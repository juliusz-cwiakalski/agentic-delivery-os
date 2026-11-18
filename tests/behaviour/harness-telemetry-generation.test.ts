/**
 * TC-HARNESS-028 — store-generation tolerance in both directions (AC-F5-4,
 * NFR-11, DM-10).
 *
 * Each generation lands its rows from its own tables; neither extractor may
 * assume the other generation's names, and an unrecognised store is classified
 * rather than reported as an empty success.
 */
import { describe, expect, test } from "bun:test";
import { createBunSqliteStoreOpener } from "../../packages/adapters/src/harness/index";
import { createOpencodeTelemetryExtractor } from "../../packages/adapters/src/harness/telemetry-opencode";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";

describe("TC-HARNESS-028 both observed generations", () => {
  test("the current generation lands rows from session_v2/session_message", () => {
    const store = buildOpencodeStore({ generation: "current" });
    const captured = extractOpencode({ store, bindings: { [ROOT_SESSION]: ROOT_BINDING } });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records.length).toBeGreaterThan(0);
    expect(captured.value.records.every((row) => row.toolCounts.length === 0)).toBe(true);
  });

  test("the legacy generation lands the same field set from its own tables", () => {
    const store = buildOpencodeStore({ generation: "legacy" });
    const captured = extractOpencode({ store, bindings: { [ROOT_SESSION]: ROOT_BINDING } });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records.length).toBeGreaterThan(0);
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.tokens.input).toBe(15);
    expect(root?.cost).toBe(0.75);
    expect(root?.warnings.some((warning) => warning.reason === "no-tool-source")).toBe(true);
  });

  test("a current-only extractor lands zero rows on the legacy fixture's tables (mutation direction)", () => {
    const store = buildOpencodeStore({ generation: "legacy" });
    const database = new Database(store.path);
    try {
      database.exec("ALTER TABLE session RENAME TO session_retired");
    } finally {
      database.close();
    }
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
  });

  test("an unrecognised store is extraction failure, never an empty success", () => {
    const directory = mkdtempSync(join(tmpdir(), "gh335-unknown-store-"));
    const path = join(directory, "opencode.db");
    const database = new Database(path);
    try {
      database.exec("CREATE TABLE unrelated (id TEXT);");
    } finally {
      database.close();
    }
    const captured = createOpencodeTelemetryExtractor({
      opener: createBunSqliteStoreOpener(),
      storePath: path,
      now: () => "2026-11-18T00:00:00.000Z",
    }).extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
    if (captured.ok) return;
    expect(captured.error.code).toBe("harness.telemetry.extraction-failed");
    writeFileSync(join(directory, "unused.txt"), "");
  });
});
