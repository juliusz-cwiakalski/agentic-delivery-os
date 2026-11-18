/**
 * TC-HARNESS-022 / TC-HARNESS-019 (duration half) — durations come from the
 * store's own timestamp pair, or are explicitly absent with a warning; a
 * duration is never estimated and never derived from the capture timestamp.
 */
import { describe, expect, test } from "bun:test";
import { extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { ROOT_SESSION, buildOpencodeStore } from "../fixtures/harness/opencode-store/build";

describe("TC-HARNESS-022 durations", () => {
  test("the sourced pair yields the store's literal start, end, and difference", () => {
    const store = buildOpencodeStore();
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.durations).toEqual({
      status: "sourced",
      start: new Date(1_700_000_000_000).toISOString(),
      end: new Date(1_700_000_002_000).toISOString(),
      elapsedMs: 2_000,
    });
  });

  test("an inverted pair is an explicit absence with the same-axis warning", () => {
    const store = buildOpencodeStore({ variant: "inverted-timestamps" });
    const captured = extractOpencode({ store, heldSessionIds: [ROOT_SESSION] });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.durations).toEqual({ status: "absent", reason: "duration-absent" });
    expect(
      root?.warnings.some(
        (warning) => warning.reason === "duration-absent" && warning.field === "durations",
      ),
    ).toBe(true);
    // Never derived from the capture timestamp.
    expect(root?.capturedAt).toBe("2026-11-18T00:00:00.000Z");
  });
});
