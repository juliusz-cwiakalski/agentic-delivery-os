/**
 * TC-PEAK-006 / TC-PEAK-007 — one bounded-grace stop, exactly-once park, the
 * first-open-window end, consecutive overlap episodes, and the observation-to-
 * park bound (GH-413 F-3, AC-F3-1, AC-F3-2, AC-F3-4, NFR-1, NFR-2, NFR-6).
 */
import { describe, expect, test } from "bun:test";
import { observeDispatchPeak } from "../../packages/core/src/app/dispatch-peak-pause";
import type { ProviderProfilePeakRules, QueueParkRecord } from "../../packages/core/src/contracts/index";
import {
  atUtcHour,
  GRACE_ABOVE_CADENCE_RULES,
  SINGLE_WINDOW_RULES,
} from "../fixtures/provider/profile/gh413-rules";

const OVERLAP_RULES: ProviderProfilePeakRules = {
  windows: [
    {
      timezone: "UTC",
      startSecondsOfDay: 6 * 3_600,
      endSecondsOfDay: 10 * 3_600,
      multiplier: 2,
      bufferBeforeSeconds: 0,
      bufferAfterSeconds: 0,
    },
    {
      timezone: "UTC",
      startSecondsOfDay: 10 * 3_600 + 300,
      endSecondsOfDay: 11 * 3_600,
      multiplier: 2,
      bufferBeforeSeconds: 280,
      bufferAfterSeconds: 0,
    },
  ],
  graceSecondsDefault: 20,
  graceSecondsMax: 60,
};

const observe = async (input: {
  readonly nowMs: number;
  readonly rules: ProviderProfilePeakRules;
  readonly parks?: QueueParkRecord[];
  readonly stopGraceMs?: number[];
}) => {
  const parks = input.parks ?? [];
  let nowMs = input.nowMs;
  const observed = await observeDispatchPeak({
    ref: "GH-413",
    sessionId: "session-1",
    providerProfile: "delivery",
    rulesFor: () => input.rules,
    nowMs,
    nowIso: () => new Date(nowMs).toISOString(),
    killGraceMs: 20_000,
    parks: () => parks,
    newEpisodeId: () => `episode-${parks.length + 1}`,
    stop: async ({ graceMs }) => {
      input.stopGraceMs?.push(graceMs);
      nowMs += graceMs;
      return "preserved";
    },
    appendPark: (record) => {
      parks.push(record);
      return true;
    },
  });
  return { observed, parks };
};

describe("TC-PEAK-006 one bounded-grace stop and exactly-once park", () => {
  test("the park carries the complete frame and later observations append nothing", async () => {
    const { observed, parks } = await observe({
      nowMs: atUtcHour(6, 30),
      rules: SINGLE_WINDOW_RULES,
    });
    expect(observed.outcome).toBe("parked");
    expect(parks).toHaveLength(1);
    const park = parks[0];
    expect(park?.cause).toBe("peak-window");
    expect(park?.providerProfile).toBe("delivery");
    expect(park?.until).toBe("2026-11-12T10:00:00.000Z");
    expect(park?.windowEnd).toBe("2026-11-12T10:00:00.000Z");
    expect(park?.graceDeadline).toBe("2026-11-12T06:30:20.000Z");
    expect(park?.stoppedAt).toBeDefined();
    expect(park?.preservation).toBe("preserved");
    expect(park?.episodeId).toBe("episode-1");
    const again = await observe({ nowMs: atUtcHour(6, 40), rules: SINGLE_WINDOW_RULES, parks });
    expect(again.observed.outcome).toBe("already-parked");
    expect(parks).toHaveLength(1);
  });

  test("overlapping windows produce consecutive exactly-once episodes with no union", async () => {
    const first = await observe({ nowMs: atUtcHour(6, 30), rules: OVERLAP_RULES });
    expect(first.parks).toHaveLength(1);
    expect(first.parks[0]?.until).toBe("2026-11-12T10:00:00.000Z");
    // The first episode recovers; a short resume lands, and the second window
    // (effective open at 10:00:20) parks again at the next observation.
    const recovered = { ...first.parks[0], recoveryState: "recovered" as const, recoveredAt: new Date(atUtcHour(10)).toISOString() };
    const parks = [recovered as QueueParkRecord];
    const second = await observe({
      nowMs: atUtcHour(10, 0) + 30_000,
      rules: OVERLAP_RULES,
      parks,
    });
    expect(second.observed.outcome).toBe("parked");
    const parked = parks.filter((park) => park.recoveryState === "parked");
    expect(parked).toHaveLength(1);
    expect(parked[0]?.until).toBe("2026-11-12T11:00:00.000Z");
    expect(parked[0]?.episodeId).not.toBe(first.parks[0]?.episodeId);
  });
});

describe("TC-PEAK-007 the observation-to-park bound is derived from the record", () => {
  test("the park instant is the observation plus the applied grace and never later", async () => {
    const observationMs = atUtcHour(6);
    const { parks } = await observe({
      nowMs: observationMs,
      rules: GRACE_ABOVE_CADENCE_RULES,
    });
    const park = parks[0];
    const observationFromRecord =
      Date.parse(park?.graceDeadline ?? "") - GRACE_ABOVE_CADENCE_RULES.graceSecondsDefault * 1_000;
    expect(observationFromRecord).toBe(observationMs);
    const appliedGraceMs = 20_000;
    expect(Date.parse(park?.stoppedAt ?? "")).toBeLessThanOrEqual(
      observationFromRecord + appliedGraceMs,
    );
  });

  test("the applied grace is the time to the effective end when that is smallest", async () => {
    const stopGraceMs: number[] = [];
    await observe({
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
      stopGraceMs,
    });
    expect(stopGraceMs).toEqual([7_000]);
  });
});
