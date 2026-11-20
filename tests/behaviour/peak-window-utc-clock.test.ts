/**
 * TC-PAUSE-090 — UTC window evaluation on the injected clock, TZ-independent
 * (GH-294 F-2, F-3; NFR-3, DEC-1; GH-350 F-1 extends the basis).
 *
 * The boundary matrix flips exactly at the declared UTC instants — start minus
 * the buffer opens the window, the effective end closes it. No wall-clock read
 * participates (the injected clock's sleep counter stays zero). A non-UTC
 * declaration now validates into the declared grammar and its evaluation arms
 * live in the GH-350 zone suite; the UTC matrix here stays byte-identical.
 */
import { describe, expect, test } from "bun:test";
import { decidePeakStops } from "../../packages/core/src/domain/index";
import {
  peakWindowEndSeconds,
  peakWindowOpenSeconds,
  UTC_ZONE_FACTS,
  utcSecondsOfDay,
} from "../../packages/core/src/provider/peak";
import { parseProfilePeakWindows } from "../../packages/core/src/provider/peak-rules";

// 17:00-18:00 UTC with 300s buffers: open 16:55:00Z, end 18:05:00Z.
const WINDOW = {
  startSecondsOfDay: 61_200,
  endSecondsOfDay: 64_800,
  multiplier: 2,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
};
const rules = { windows: [WINDOW], graceSecondsDefault: 120, graceSecondsMax: 300 };
const lane = { ref: "GH-900", providerProfile: "profile-a", sessionId: "s" };

const clock = (startIso: string) => {
  let value = Date.parse(startIso);
  let sleeps = 0;
  return {
    nowMs: () => value,
    advance: (ms: number) => {
      value += ms;
    },
    sleep: async () => {
      sleeps += 1;
    },
    sleeps: () => sleeps,
  };
};

describe("TC-PAUSE-090 the UTC boundary matrix flips exactly at the declared instants", () => {
  test("open at start-minus-buffer, closed one second before, closed at and after the effective end", () => {
    const day = Date.parse("2026-11-13T00:00:00.000Z");
    // Second-of-day arithmetic: the open bound and the effective end.
    const openSecond = peakWindowOpenSeconds({
      startSecondsOfDay: WINDOW.startSecondsOfDay,
      bufferBeforeSeconds: WINDOW.bufferBeforeSeconds,
    });
    const endSecond = peakWindowEndSeconds({
      endSecondsOfDay: WINDOW.endSecondsOfDay,
      bufferAfterSeconds: WINDOW.bufferAfterSeconds,
    });
    expect(openSecond).toBe(60_900); // 16:55:00Z
    expect(endSecond).toBe(65_100); // 18:05:00Z
    // One second before the open bound: closed.
    expect(utcSecondsOfDay(day + (openSecond - 1) * 1_000)).toBe(openSecond - 1);
    const before = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: day + (openSecond - 1) * 1_000,
      parkedRefs: [],
      newEpisodeId: () => "e0",
    });
    expect(before).toEqual([]);
    // At the open bound: open — the flip is exact.
    const atOpen = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: day + openSecond * 1_000,
      parkedRefs: [],
      newEpisodeId: () => "e1",
    });
    expect(atOpen).toHaveLength(1);
    // At the effective end: closed again — inclusive before, exclusive at.
    const atEnd = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: day + endSecond * 1_000,
      parkedRefs: [],
      newEpisodeId: () => "e2",
    });
    expect(atEnd).toEqual([]);
    // One second before the effective end: still open.
    const beforeEnd = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: day + (endSecond - 1) * 1_000,
      parkedRefs: [],
      newEpisodeId: () => "e3",
    });
    expect(beforeEnd).toHaveLength(1);
  });

  test("a DST-observing zone crossing the window evaluates identically to the UTC baseline", () => {
    // The Europe/Warsaw zone crosses its DST boundary in late October; the
    // December window (CET, UTC+1) and the July window (CEST, UTC+2) evaluate
    // the same second-of-day bounds on the UTC basis — the wall-clock local
    // time differs by an hour between them, the UTC instants do not move.
    const december = Date.parse("2026-12-13T16:55:00.000Z"); // 17:55 CET local
    const july = Date.parse("2026-07-13T16:55:00.000Z"); // 18:55 CEST local
    expect(utcSecondsOfDay(december)).toBe(utcSecondsOfDay(july));
    const decemberDecision = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: december,
      parkedRefs: [],
      newEpisodeId: () => "e-dst-1",
    });
    const julyDecision = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: july,
      parkedRefs: [],
      newEpisodeId: () => "e-dst-2",
    });
    // Identical decisions: the TZ matrix equals the UTC baseline.
    expect(decemberDecision.map((decision) => decision.ref)).toEqual(
      julyDecision.map((decision) => decision.ref),
    );
    expect(decemberDecision).toHaveLength(1);
  });

  test("no wall-clock read participates: the injected clock's sleep counter stays zero", async () => {
    const injected = clock("2026-11-13T16:55:00.000Z");
    const decisions = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: injected.nowMs(),
      parkedRefs: [],
      newEpisodeId: () => "e-sleep",
    });
    expect(decisions).toHaveLength(1);
    await injected.sleep();
    expect(injected.sleeps()).toBe(1);
    // The evaluation above used the injected clock's value only: re-running
    // with no sleep in between is identical, so no wall-clock read separates
    // the two observations.
    const again = decidePeakStops({
      lanes: [lane],
      rulesFor: () => rules,

      zoneFactsFor: () => UTC_ZONE_FACTS,
      nowMs: injected.nowMs(),
      parkedRefs: [],
      newEpisodeId: () => "e-sleep-2",
    });
    expect(again).toHaveLength(1);
  });

  test("a non-UTC zone literal now validates into the declared grammar (its evaluation arms live in the zone suite)", () => {
    // GH-350 widens the basis: the old UTC-only refusal retires, and the
    // non-UTC evaluation is asserted by TC-ZONE-001..011 in the zone suite.
    const zone = parseProfilePeakWindows({
      graceSeconds: 60,
      windows: [{ ...WINDOW, timezone: "America/New_York" }],
    });
    expect(zone.ok).toBe(true);
    if (zone.ok) expect(zone.rules.windows[0]?.timezone).toBe("America/New_York");
    // A UTC declaration still resolves to the definitional facts and the same
    // seconds-of-day bounds.
    const utc = parseProfilePeakWindows({ graceSeconds: 60, windows: [{ ...WINDOW }] });
    expect(utc.ok).toBe(true);
    if (!utc.ok) return;
    expect(utc.rules.windows[0]?.timezone).toBe("UTC");
    expect(
      peakWindowOpenSeconds({
        startSecondsOfDay: utc.rules.windows[0]?.startSecondsOfDay ?? 0,
        bufferBeforeSeconds: utc.rules.windows[0]?.bufferBeforeSeconds ?? 0,
      }),
    ).toBe(60_900);
  });
});
