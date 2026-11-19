/**
 * TC-LOG-001/003/004 (GH-348 F-7; DM-7, NFR-3, NFR-10) over the D2 cycle surface.
 *
 * The stuck-episode lines (`stuck-verdict`, `kill`, `restart`) are phase-4
 * observations (Option B / R-36); this suite asserts the renderer, the rotation
 * arithmetic, and the error-swallowing property over the cycle surface only.
 */
import { describe, expect, test } from "bun:test";
import {
  LOOP_LOG_EVENTS,
  LOOP_MAX_LOG_ACTIVE_BYTES,
  LOOP_MAX_LOG_LINE_BYTES,
  LOOP_MAX_LOG_TOTAL_BYTES,
} from "../../packages/core/src/contracts/index";
import { logByteLength, renderLogLine } from "../../packages/core/src/domain/index";
import { createLoopHarness } from "../fixtures/loop/harness";
import { createLogFs } from "../fixtures/loop/log-fs";

const STAMP = "2026-11-19T10:00:00.000Z";

describe("TC-LOG-001 every event renders one bounded, ANSI-free, identifier-only line", () => {
  test("all eleven events render a single line under the byte bound", () => {
    for (const event of LOOP_LOG_EVENTS) {
      const line = renderLogLine({ recordedAt: STAMP, event, pairs: { session: "session-1" } });
      expect(line, event).not.toBeNull();
      expect(line?.includes("\n")).toBe(false);
      expect(logByteLength(line ?? "")).toBeLessThanOrEqual(LOOP_MAX_LOG_LINE_BYTES);
      expect(line?.startsWith(`${STAMP} event=${event}`)).toBe(true);
    }
  });

  test("an oversized pair list drops whole pairs instead of cutting one", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 60 }, (_unused, index) => [`field-${String(index)}`, "x".repeat(20)]),
    );
    const line = renderLogLine({ recordedAt: STAMP, event: "cycle", pairs: wide });
    expect(line).not.toBeNull();
    const text = line ?? "";
    expect(logByteLength(text)).toBeLessThanOrEqual(LOOP_MAX_LOG_LINE_BYTES);
    // Every surviving pair is whole: a truncated value would not end its key=value.
    for (const match of text.matchAll(/field-\d+=([^ ]*)/gu)) {
      expect(match[1]).toBe("x".repeat(20));
    }
  });

  test("an ANSI escape and a control character never survive the renderer", () => {
    const line = renderLogLine({
      recordedAt: STAMP,
      event: "error",
      pairs: { reason: "bad\u001b[31mnews\u0007now" },
    });
    expect(line).not.toContain("\u001b");
    expect(line).not.toContain("\u0007");
    expect(line).toContain("reason=bad");
  });
});

describe("TC-LOG-003 rotation keeps the newest data and drops the oldest generation", () => {
  test("crossing the active bound twice retains one generation and the newest lines", () => {
    const logFs = createLogFs();
    const line = `${"x".repeat(500)}\n`;
    const perWrite = logByteLength(line);
    const writes = Math.ceil((LOOP_MAX_LOG_ACTIVE_BYTES * 2.2) / perWrite);
    for (let index = 0; index < writes; index += 1)
      logFs.append(`row-${String(index)}-${"x".repeat(480)}`);

    expect(logFs.rotations.length).toBeGreaterThanOrEqual(1);
    expect(logFs.generation()).not.toBeNull();
    const total = logFs.activeBytes() + logByteLength(logFs.generation() ?? "");
    expect(total).toBeLessThanOrEqual(LOOP_MAX_LOG_TOTAL_BYTES);
    // The newest row is in the active file; the very first row is gone.
    const newest = logFs.lines().at(-1) ?? "";
    expect(newest).toContain(`row-${String(writes - 1)}-`);
    expect(`${logFs.active()}${logFs.generation() ?? ""}`).not.toContain("row-0-");
  });
});

describe("TC-LOG-004 a failing append leaves the exit, the records, and the disclosure unchanged", () => {
  test("a start with a permanently failing sink still exits 0 with one session record", async () => {
    const harness = createLoopHarness({ label: "log-004", logFails: true });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.loopRecords().sessions.map((entry) => entry.state)).toEqual(["active", "ended"]);
    expect((harness.coordinatorRecords() as { ok: boolean }).ok).toBe(true);

    const status = await harness.run(["loop", "status", "--json"]);
    expect(status.code).toBe(0);
    const data = harness.dataOf(status);
    expect(data["degraded"]).toEqual(["log-unavailable"]);
  });

  test("a healthy sink records the cycle-surface lines and discloses nothing", async () => {
    const harness = createLoopHarness({ label: "log-004-healthy" });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const events = harness.lines.map((line) => /event=([a-z-]+)/u.exec(line)?.[1]);
    expect(events).toContain("start");
    expect(events).toContain("session");
    expect(events).toContain("release");
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).degraded).toEqual([]);
  });
});
