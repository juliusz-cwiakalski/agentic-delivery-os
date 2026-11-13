/**
 * TC-PAUSE-030 / TC-PAUSE-031 — cross-profile isolation (GH-294 F-4, AC-F4-3,
 * RSK-3; SC-M2-S17-02).
 *
 * The park decision is a pure function of the lane's recorded nomination and
 * that profile's window state: a window on profile P parks P's lanes and
 * nothing else — lanes on other providers keep running for the whole window,
 * and the park set is exactly the lanes whose recorded nomination is the
 * in-window profile (set equality, not subset), with no model-string,
 * harness-kind, or config-proximity inference ever parking a lane.
 */
import { describe, expect, test } from "bun:test";
import type { ProviderProfilePeakRules } from "../../packages/core/src/contracts/index";
import { decidePeakStops, type PeakWatchLane } from "../../packages/core/src/domain/index";

// Two disjoint windows: profile-a 17:00-18:00 UTC, profile-b 04:00-05:00 UTC.
const WINDOW_A = {
  startSecondsOfDay: 61_200,
  endSecondsOfDay: 64_800,
  multiplier: 2,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
};
const WINDOW_B = {
  startSecondsOfDay: 14_400,
  endSecondsOfDay: 18_000,
  multiplier: 3,
  bufferBeforeSeconds: 120,
  bufferAfterSeconds: 120,
};
const NOW_IN_A = Date.parse("2026-11-13T17:10:00.000Z");
const NOW_IN_B = Date.parse("2026-11-13T04:30:00.000Z");

const rules = (windows: ProviderProfilePeakRules["windows"]): ProviderProfilePeakRules => ({
  windows,
  graceSecondsDefault: 120,
  graceSecondsMax: Math.min(
    ...windows.flatMap((window) => [window.bufferBeforeSeconds, window.bufferAfterSeconds]),
  ),
});

const lane = (ref: string, profile: string, model?: string): PeakWatchLane => ({
  ref,
  providerProfile: profile,
  sessionId: `session-${ref}`,
});

const episodeIds = (): { next: () => string; readonly seen: string[] } => {
  const seen: string[] = [];
  let ordinal = 0;
  return {
    next: () => {
      ordinal += 1;
      const id = `episode-${ordinal}`;
      seen.push(id);
      return id;
    },
    seen,
  };
};

describe("TC-PAUSE-030 other-provider lanes keep running through P's window", () => {
  test("a window on profile-a parks only profile-a's lanes for the whole window", () => {
    const episodes = episodeIds();
    const decisions = decidePeakStops({
      lanes: [lane("GH-900", "profile-a"), lane("GH-901", "profile-b")],
      rulesFor: (name: string) =>
        name === "profile-a"
          ? rules([WINDOW_A])
          : name === "profile-b"
            ? rules([WINDOW_B])
            : undefined,
      nowMs: NOW_IN_A,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    // Set equality: the park set is exactly the lanes nominated to the
    // in-window profile.
    expect(decisions.map((decision) => decision.ref)).toEqual(["GH-900"]);
    expect(decisions.every((decision) => decision.providerProfile === "profile-a")).toBe(true);
    // profile-b's window is a different, closed interval: the same lanes are
    // untouched while B's window is the open one and A's is closed.
    const inB = decidePeakStops({
      lanes: [lane("GH-900", "profile-a"), lane("GH-901", "profile-b")],
      rulesFor: (name: string) =>
        name === "profile-a"
          ? rules([WINDOW_A])
          : name === "profile-b"
            ? rules([WINDOW_B])
            : undefined,
      nowMs: NOW_IN_B,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    expect(inB.map((decision) => decision.ref)).toEqual(["GH-901"]);
    // Zero stop decisions name a lane on the other provider across both
    // passes: the target-0-misattribution reading of the metric.
    const allRefs = [...decisions, ...inB].map((decision) => decision.ref);
    expect(allRefs).toEqual(["GH-900", "GH-901"]);
  });
});

describe("TC-PAUSE-031 the park decision reads only the nomination and that profile's window state", () => {
  test("fixture matrix: unused-profile window, independent windows, and the model-string borrow bait", () => {
    const episodes = episodeIds();
    // Fixture (b): a window on an unused profile R parks nothing.
    const unused = decidePeakStops({
      lanes: [lane("GH-900", "profile-a"), lane("GH-901", "profile-b")],
      rulesFor: (name: string) => (name === "profile-r" ? rules([WINDOW_A]) : undefined),
      nowMs: NOW_IN_A,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    expect(unused).toEqual([]);

    // Fixture (c): windows on P and S, only P's opening — S's window is a
    // different, closed interval; independent windows, independent decisions.
    const independent = decidePeakStops({
      lanes: [lane("GH-900", "profile-a"), lane("GH-902", "profile-s")],
      rulesFor: (name: string) =>
        name === "profile-a"
          ? rules([WINDOW_A])
          : name === "profile-s"
            ? rules([WINDOW_B])
            : undefined,
      nowMs: NOW_IN_A,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    expect(independent.map((decision) => decision.ref)).toEqual(["GH-900"]);

    // Fixture (d): the P-nominated lane whose harness model string resembles
    // another provider's naming still parks — and the decision names P from
    // the recorded nomination, never from the model string.
    const bait = decidePeakStops({
      lanes: [{ ref: "GH-903", providerProfile: "profile-a", sessionId: "session-model-b-like" }],
      rulesFor: (name: string) => (name === "profile-a" ? rules([WINDOW_A]) : undefined),
      nowMs: NOW_IN_A,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    expect(bait).toHaveLength(1);
    expect(bait[0]?.ref).toBe("GH-903");
    expect(bait[0]?.providerProfile).toBe("profile-a");
  });

  test("an already-parked ref is skipped: the park set never duplicates an episode", () => {
    const episodes = episodeIds();
    const decisions = decidePeakStops({
      lanes: [lane("GH-900", "profile-a"), lane("GH-901", "profile-a")],
      rulesFor: () => rules([WINDOW_A]),
      nowMs: NOW_IN_A,
      parkedRefs: ["GH-900"],
      newEpisodeId: episodes.next,
    });
    expect(decisions.map((decision) => decision.ref)).toEqual(["GH-901"]);
  });

  test("a lane without a recorded nomination is never parked and never borrows one", () => {
    const episodes = episodeIds();
    const decisions = decidePeakStops({
      lanes: [{ ref: "GH-904", sessionId: "session-pre" }, lane("GH-900", "profile-a")],
      rulesFor: (name: string) => (name === "profile-a" ? rules([WINDOW_A]) : undefined),
      nowMs: NOW_IN_A,
      parkedRefs: [],
      newEpisodeId: episodes.next,
    });
    expect(decisions.map((decision) => decision.ref)).toEqual(["GH-900"]);
  });
});
