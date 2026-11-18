/**
 * TC-HARNESS-023 / TC-HARNESS-024 — absence, degraded capture, and extraction
 * failure stay three distinct classifications inside the delivered envelopes;
 * no zero-valued row and no store-wide scan is ever produced.
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeTelemetryExtractor } from "../../packages/adapters/src/harness/telemetry-opencode";
import { ROOT_BINDING, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

describe("TC-HARNESS-023 absent versus failed", () => {
  test("a held session the store does not hold is absence, not a failed session", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, heldSessionIds: ["ses_absent"] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records).toHaveLength(0);
    expect(captured.value.failedSessions).toHaveLength(0);
    expect(captured.value.absences?.[0]?.reason).toBe("session-not-in-store");
  });

  test("a held session with no observable usage fact is a failed-session entry", () => {
    const store = buildOpencodeStore({ variant: "empty-session" });
    const captured = extractOpencode({ store, heldSessionIds: ["ses_empty"] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    expect(captured.value.records).toHaveLength(0);
    expect(captured.value.failedSessions).toEqual([
      { sessionId: "ses_empty", reason: "no-usage-fact" },
    ]);
    expect(captured.value.absences).toBeUndefined();
  });

  test("a degraded row carries a closed-vocabulary warning and still lands", () => {
    const store = buildOpencodeStore({ variant: "missing-token-class" });
    const captured = extractOpencode({
      store,
      heldSessionIds: [ROOT_SESSION],
      bindings: { [ROOT_SESSION]: ROOT_BINDING },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.tokens.reasoning).toBeNull();
    expect(root?.warnings.length).toBeGreaterThan(0);
  });
});

describe("TC-HARNESS-024 extraction failure is never absence", () => {
  test("an unreadable store keeps the delivered identity and yields no rows", () => {
    const directory = mkdtempSync(join(tmpdir(), "gh335-unreadable-"));
    const captured = createOpencodeTelemetryExtractor({
      opener: () => ({ ok: false }),
      storePath: join(directory, "opencode.db"),
      now: () => "2026-11-18T00:00:00.000Z",
    }).extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
    if (captured.ok) return;
    expect(captured.error.code).toBe("harness.telemetry.extraction-failed");
  });

  test("the delivered read-side absence meaning is untouched", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/contracts/error-table.ts"),
      "utf8",
    );
    expect(source).toContain("spend.telemetry-absent");
    expect(source).not.toContain("harness.telemetry.absent");
  });
});
