/**
 * TC-PEAK-008 / TC-PEAK-025 — a preserved episode resumes the same session on
 * the same branch with no ordinal, and resume admission re-checks the window
 * and never resumes into an open window (GH-413 F-4, AC-F4-1, NFR-4, RSK-6).
 */
import { describe, expect, test } from "bun:test";
import { evaluateDispatchPeakResume } from "../../packages/core/src/app/dispatch-peak-pause";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import {
  atUtcHour,
  RULES_BY_PROFILE,
  SINGLE_WINDOW_RULES,
} from "../fixtures/provider/profile/gh413-rules";

const parkAt = (until: string): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-413",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: until },
  recheckMs: 60_000,
  evaluatedAt: "2026-11-12T06:30:00.000Z",
  recoveryState: "parked",
  providerProfile: "delivery",
  until,
  graceDeadline: "2026-11-12T06:30:20.000Z",
  windowEnd: until,
  stoppedAt: "2026-11-12T06:30:20.000Z",
  preservation: "preserved",
  episodeId: "episode-1",
  recordedAt: "2026-11-12T06:30:20.000Z",
});

describe("TC-PEAK-008 a preserved episode resumes the same session with no ordinal", () => {
  test("the engine resumes once, spawns once, and consumes no restart ordinal", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-resume-preserved",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
      expect(scenario.scripted.calls.filter((call) => call === "resume")).toHaveLength(1);
      expect(scenario.calls.restarts).toHaveLength(0);
      expect(peak.resumed()).toBe(1);
      const recovered = peak.parks.find((park) => park.recoveryState === "recovered");
      expect(recovered?.preservation).toBe("preserved");
      const until = Date.parse(recovered?.until ?? "");
      const resumedAt = Date.parse(recovered?.recoveredAt ?? "");
      expect(resumedAt - until).toBeLessThanOrEqual(30_000);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-025 resume admission re-checks the window", () => {
  test("an observed open window defers the resume and the lane stays parked", async () => {
    const park = parkAt("2026-11-12T10:00:00.000Z");
    const waiting = await evaluateDispatchPeakResume({
      ref: "GH-413",
      parks: () => [park],
      // A widened rule keeps the profile's window open at the recorded end.
      rulesFor: () => ({
        windows: [
          {
            timezone: "UTC",
            startSecondsOfDay: 6 * 3_600,
            endSecondsOfDay: 12 * 3_600,
            multiplier: 2,
            bufferBeforeSeconds: 0,
            bufferAfterSeconds: 0,
          },
        ],
        graceSecondsDefault: 20,
        graceSecondsMax: 60,
      }),
      nowMs: atUtcHour(10),
      nowIso: () => "2026-11-12T10:00:00.000Z",
      holdActive: () => false,
      sessionRef: "session-1",
      branch: "feat/GH-413/test",
      restartCount: 0,
      restartBound: 3,
      economics: { prefillCost: null, uniqueProgress: null },
      appendRecovery: () => true,
      resumeSession: async () => true,
      reenter: async () => true,
      escalate: () => {},
    });
    expect(waiting.outcome).toBe("waiting");
    // Once the window is observed closed the preserved lane resumes.
    const resumed = await evaluateDispatchPeakResume({
      ref: "GH-413",
      parks: () => [park],
      rulesFor: () => SINGLE_WINDOW_RULES,
      nowMs: atUtcHour(10) + 60_000,
      nowIso: () => "2026-11-12T10:01:00.000Z",
      holdActive: () => false,
      sessionRef: "session-1",
      branch: "feat/GH-413/test",
      restartCount: 0,
      restartBound: 3,
      economics: { prefillCost: null, uniqueProgress: null },
      appendRecovery: () => true,
      resumeSession: async () => true,
      reenter: async () => true,
      escalate: () => {},
    });
    expect(resumed.outcome).toBe("resumed");
  });
});

describe("TC-PEAK-008 a failed resume reports the pause and the failure, never resumed at", () => {
  test("the episode fact omits resumedAt when the post-park resume cannot acquire a session", async () => {
    const { scenario } = createPeakScenario({
      label: "gh413-resume-failed",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    try {
      scenario.scripted.port.resume = async () => ({
        ok: false,
        error: { kind: "harness", code: "harness.session.unknown" },
      });
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.episode?.resumedAt).toBeUndefined();
      expect(run.envelope?.data?.lastMessage).not.toContain("resumed at");
      expect(run.envelope?.data?.lastMessage).toContain("paused until");
    } finally {
      scenario.dispose();
    }
  });
});
