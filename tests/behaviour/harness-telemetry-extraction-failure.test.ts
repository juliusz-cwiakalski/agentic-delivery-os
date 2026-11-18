/**
 * TC-HARNESS-024 — an unreadable store is the delivered extraction-failure
 * identity, never a re-projected absence, and closeout capture stays non-gating
 * (NFR-11, AC-F6-2).
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeTelemetryExtractor } from "../../packages/adapters/src/harness/telemetry-opencode";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-024 extraction failure", () => {
  test("an opener that refuses yields the failure identity and no fabricated rows", () => {
    const store = buildOpencodeStore();
    const captured = createOpencodeTelemetryExtractor({
      opener: () => ({ ok: false }),
      storePath: store.path,
      now: () => "2026-11-18T00:00:00.000Z",
    }).extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
    if (captured.ok) return;
    expect(captured.error.kind).toBe("harness");
    expect(captured.error.code).toBe("harness.telemetry.extraction-failed");
    if (!captured.ok) expect("records" in captured).toBe(false);
  });

  test("a torn schema is classified, never a zero-valued row", () => {
    const store = buildOpencodeStore();
    const captured = createOpencodeTelemetryExtractor({
      opener: () => ({
        ok: true,
        handle: {
          query: () => {
            throw new Error("torn schema");
          },
          execute: () => {
            throw new Error("torn schema");
          },
          close: () => undefined,
        },
      }),
      storePath: store.path,
      now: () => "2026-11-18T00:00:00.000Z",
    }).extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(false);
    if (captured.ok) return;
    expect(captured.error.code).toBe("harness.telemetry.extraction-failed");
  });
});
