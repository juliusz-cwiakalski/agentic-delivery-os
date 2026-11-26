/**
 * TC-PEAK-001 — the dispatch-owned watch and the daemon watch take the same
 * decision over the same profile and instant through the delivered decision
 * functions (GH-413 F-1, AC-F1-1, NFR-5, RSK-8).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { observeDispatchPeak } from "../../packages/core/src/app/dispatch-peak-pause";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { decidePeakStops } from "../../packages/core/src/domain/daemon-peak-pause";
import { atUtcHour, SINGLE_WINDOW_RULES } from "../fixtures/provider/profile/gh413-rules";

const rulesFor = (profile: string) => (profile === "delivery" ? SINGLE_WINDOW_RULES : undefined);

const observe = async (nowMs: number) => {
  const parks: QueueParkRecord[] = [];
  const observed = await observeDispatchPeak({
    ref: "GH-413",
    sessionId: "session-1",
    providerProfile: "delivery",
    rulesFor,
    nowMs,
    nowIso: () => new Date(nowMs).toISOString(),
    killGraceMs: 20_000,
    parks: () => parks,
    newEpisodeId: () => "episode-parity",
    stop: async () => "preserved",
    appendPark: (record) => {
      parks.push(record);
      return true;
    },
  });
  return { observed, parks };
};

describe("TC-PEAK-001 dispatch and daemon decisions agree", () => {
  test("inside the window both decide the same stop, grace deadline, and effective end", async () => {
    const nowMs = atUtcHour(7);
    const daemon = decidePeakStops({
      lanes: [{ ref: "GH-413", sessionId: "session-1", providerProfile: "delivery" }],
      rulesFor,
      nowMs,
      parkedRefs: [],
      newEpisodeId: () => "episode-daemon",
    });
    expect(daemon).toHaveLength(1);
    const { observed, parks } = await observe(nowMs);
    expect(observed.outcome).toBe("parked");
    const park = parks[0];
    expect(park?.providerProfile).toBe(daemon[0]?.providerProfile);
    expect(park?.graceDeadline).toBe(daemon[0]?.graceDeadline);
    expect(park?.windowEnd).toBe(daemon[0]?.windowEnd);
    expect(park?.until).toBe(daemon[0]?.windowEnd);
  });

  test("outside the window both decide no stop", async () => {
    const nowMs = atUtcHour(11);
    const daemon = decidePeakStops({
      lanes: [{ ref: "GH-413", sessionId: "session-1", providerProfile: "delivery" }],
      rulesFor,
      nowMs,
      parkedRefs: [],
      newEpisodeId: () => "episode-daemon",
    });
    expect(daemon).toHaveLength(0);
    const { observed } = await observe(nowMs);
    expect(observed.outcome).toBe("none");
  });

  test("the dispatch watch composes the delivered decision layer and derives no window rule", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/app/dispatch-peak-pause.ts"),
      "utf8",
    );
    expect(source).toContain("decidePeakStops");
    expect(source).toContain("runPeakWatch");
    expect(source).not.toContain("startSecondsOfDay");
    expect(source).not.toContain("3_600");
  });
});
