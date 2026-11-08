/**
 * TC-CAP-048 — GH-233 review F-11: orphan/invalid-identity disclosure is
 * delivery-scoped; out-of-port orphans are a bounded store-level warning.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  createBunSqliteStoreOpener,
  createOpencodeTelemetryExtractor,
} from "../../packages/adapters/src/harness/index";
import type { HarnessTelemetryCapture } from "../../packages/core/src/contracts/index";
import { buildOpencodeStore, WORK_ITEM_REF } from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-07T00:00:00Z";
const RUN_ID = "run-orphan-scope";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const capture = (statements: string[] = []): HarnessTelemetryCapture => {
  const store = buildOpencodeStore({ variant: "orphan-scope" });
  roots.push(store.directory);
  const result = createOpencodeTelemetryExtractor({
    opener: (path) => createBunSqliteStoreOpener()(path),
    storePath: store.path,
    now: () => NOW,
    onStatement: (sql) => statements.push(sql),
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
  if (!result.ok) throw new Error(result.error.summary ?? "extraction failed");
  return result.value;
};

const warningFor = (value: HarnessTelemetryCapture, marker: string) =>
  value.warnings.find((warning) => warning.field.includes(marker));

describe("TC-CAP-048 orphan disclosure scope", () => {
  test("out-of-port orphans are a store warning, not the delivery's failed sessions", () => {
    const value = capture();
    expect(value.failedSessions.some((session) => session.sessionId?.startsWith("ses_oop_"))).toBe(
      false,
    );
    expect(warningFor(value, "store:out-of-port-orphans=3")).toBeDefined();
  });

  test("another delivery's session is neither counted nor disclosed as this delivery's failure", () => {
    const value = capture();
    expect(value.records.some((record) => record.sessionId === "ses_other")).toBe(false);
    expect(value.failedSessions.some((session) => session.sessionId === "ses_other")).toBe(false);
    expect(JSON.stringify(value)).not.toContain("ses_other");
  });

  test("a genuinely unattributable session under a capturing root is still a failed session", () => {
    const value = capture();
    expect(
      value.failedSessions.some(
        (session) =>
          session.sessionId === "ses_child_invalid" &&
          session.reason === "invalid-session-identity",
      ),
    ).toBe(true);
  });

  test("the orphan scan is bounded by LIMIT and the disclosure is idempotent", () => {
    const statements: string[] = [];
    const first = capture(statements);
    const orphanQuery = statements.find((sql) => sql.includes("work_item_ref IS NULL"));
    expect(orphanQuery).toBeDefined();
    expect(orphanQuery?.includes("LIMIT ?")).toBe(true);
    const second = capture();
    expect(
      second.warnings.filter((warning) => warning.field.includes("out-of-port-orphans")).length,
    ).toBe(1);
    expect(first.records.length).toBe(second.records.length);
    expect(first.failedSessions.length).toBe(second.failedSessions.length);
  });
});
