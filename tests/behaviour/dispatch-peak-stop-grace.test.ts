/**
 * TC-PEAK-032 — one terminate call carries the composed grace, the smallest of
 * the remaining profile grace, the delivered kill grace, and the time to the
 * effective end (GH-413 F-3, AC-F3-3, NFR-1).
 */
import { describe, expect, test } from "bun:test";
import { observeDispatchPeak } from "../../packages/core/src/app/dispatch-peak-pause";
import type { ProviderProfilePeakRules } from "../../packages/core/src/contracts/index";
import { atUtcHour, SINGLE_WINDOW_RULES } from "../fixtures/provider/profile/gh413-rules";

const graceOf = async (input: {
  readonly nowMs: number;
  readonly rules: ProviderProfilePeakRules;
  readonly killGraceMs: number;
}) => {
  const stopped: number[] = [];
  await observeDispatchPeak({
    ref: "GH-413",
    sessionId: "session-1",
    providerProfile: "delivery",
    rulesFor: () => input.rules,
    nowMs: input.nowMs,
    nowIso: () => new Date(input.nowMs).toISOString(),
    killGraceMs: input.killGraceMs,
    parks: () => [],
    newEpisodeId: () => "episode-grace",
    stop: async ({ graceMs }) => {
      stopped.push(graceMs);
      return "preserved";
    },
    appendPark: () => true,
  });
  return stopped;
};

describe("TC-PEAK-032 the composed grace is the smallest of the three bounds", () => {
  test("the remaining profile grace is the smallest bound", async () => {
    const stopped = await graceOf({
      nowMs: atUtcHour(6),
      rules: SINGLE_WINDOW_RULES,
      killGraceMs: 60_000,
    });
    expect(stopped).toEqual([20_000]);
  });

  test("the delivered kill grace is the smallest bound", async () => {
    const stopped = await graceOf({
      nowMs: atUtcHour(6),
      rules: SINGLE_WINDOW_RULES,
      killGraceMs: 5_000,
    });
    expect(stopped).toEqual([5_000]);
  });

  test("the time to the effective end is the smallest bound", async () => {
    const stopped = await graceOf({
      nowMs: Date.parse("2026-11-12T06:59:58.000Z"),
      rules: {
        windows: [
          {
            timezone: "UTC",
            startSecondsOfDay: 6 * 3_600,
            endSecondsOfDay: 7 * 3_600,
            multiplier: 2,
            bufferBeforeSeconds: 0,
            bufferAfterSeconds: 5,
          },
        ],
        graceSecondsDefault: 20,
        graceSecondsMax: 60,
      },
      killGraceMs: 60_000,
    });
    expect(stopped).toEqual([7_000]);
  });

  test("exactly one terminate call is issued per stop", async () => {
    const stopped = await graceOf({
      nowMs: atUtcHour(6, 30),
      rules: SINGLE_WINDOW_RULES,
      killGraceMs: 20_000,
    });
    expect(stopped).toHaveLength(1);
  });
});
