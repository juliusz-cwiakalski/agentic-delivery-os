/**
 * TC-PEAK-016 / TC-PEAK-018 — `dispatch stop --cause peak-window --until`
 * equals a window-open stop payload for payload and is identical with automatic
 * pausing disabled (GH-413 F-9, F-10, AC-F8-2, AC-F9-1, DM-1, DM-2, DM-8).
 */
import { describe, expect, test } from "bun:test";
import { executeDispatchStop } from "../../packages/core/src/app/dispatch-stop";
import { observeDispatchPeak } from "../../packages/core/src/app/dispatch-peak-pause";
import type {
  DispatchLaneRecord,
  HarnessSessionHandle,
  QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const NOW = atUtcHour(6, 30);
const UNTIL = atUtcHour(10);
const REPOSITORY = "github.com/owner/repo";

const lane = (): DispatchLaneRecord => ({
  schema: "delivery.dispatch.lane.v1",
  ref: "GH-413",
  repository: REPOSITORY,
  attemptId: "attempt-1",
  sessionId: "ses-1",
  harnessKind: "opencode",
  owner: { processId: 4242, startedAt: new Date(NOW).toISOString() },
  iterationOrdinal: 1,
  restartsConsumed: 0,
  state: "active",
  providerProfile: "delivery",
  recordedAt: new Date(NOW).toISOString(),
});

const stopWith = async () => {
  const appended: QueueParkRecord[] = [];
  const outcome = await executeDispatchStop(
    {
      resolveRepository: () => REPOSITORY,
      lanes: () => [lane()],
      parks: () => [],
      terminate: async () => ({ ok: true, terminated: true }),
      appendPark: (record) => {
        appended.push(record);
        return true;
      },
      newEpisodeId: () => "episode-1",
      profileGraceMsFor: () => 20_000,
      killGraceMs: 20_000,
      mainCheckout: "/work/repo",
    },
    {
      ref: "GH-413",
      cause: "peak-window",
      until: new Date(UNTIL).toISOString(),
      nowIso: new Date(NOW).toISOString(),
      nowMs: NOW,
    },
  );
  return { outcome, appended };
};

describe("TC-PEAK-018 the operator stop equals a window-open stop payload", () => {
  test("cause, profile, until, grace deadline, window end, stop instant, and preservation agree", async () => {
    const { outcome, appended } = await stopWith();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.data).toEqual({
      query: "stop",
      ref: "GH-413",
      cause: "peak-window",
      until: new Date(UNTIL).toISOString(),
      episodeId: "episode-1",
      preservation: "preserved",
    });
    const operatorPark = appended[0];
    const watchParks: QueueParkRecord[] = [];
    await observeDispatchPeak({
      ref: "GH-413",
      handle: {
        harnessKind: "opencode",
        sessionId: "ses-1",
        treeRoot: "/work/repo",
        workItemRef: "GH-413",
      } as HarnessSessionHandle,
      sessionId: "ses-1",
      providerProfile: "delivery",
      rulesFor: () => RULES_BY_PROFILE.delivery,
      nowMs: NOW,
      nowIso: () => new Date(NOW).toISOString(),
      killGraceMs: 20_000,
      parks: () => watchParks,
      newEpisodeId: () => "episode-1",
      stop: async () => "preserved",
      appendPark: (record) => {
        watchParks.push(record);
        return true;
      },
    });
    const watchPark = watchParks[0];
    for (const key of [
      "cause",
      "conditionType",
      "condition",
      "providerProfile",
      "until",
      "graceDeadline",
      "windowEnd",
      "stoppedAt",
      "preservation",
      "episodeId",
    ] as const) {
      expect(operatorPark?.[key], key).toEqual(watchPark?.[key]);
    }
  });
});

describe("TC-PEAK-016 the stop is identical when automatic pausing is disabled", () => {
  test("the command definition invokes the stop runtime with no composed watch", async () => {
    const calls: string[] = [];
    const scenario = createCommandScenario({
      label: "gh413-stop-disabled",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom(),
      nowIso: () => new Date(NOW).toISOString(),
      stop: {
        stop: async ({ ref, cause, until }) => {
          calls.push(`${ref}:${cause}:${until}`);
          return {
            ok: true,
            data: {
              query: "stop",
              ref,
              cause,
              until,
              episodeId: "episode-1",
              preservation: "preserved",
            },
          };
        },
      },
    });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "stop",
        "GH-413",
        "--cause",
        "peak-window",
        "--until",
        new Date(UNTIL).toISOString(),
        "--json",
      ]);
      expect(run.exit).toBe(0);
      expect(calls).toEqual([`GH-413:peak-window:${new Date(UNTIL).toISOString()}`]);
    } finally {
      scenario.dispose();
    }
  });
});
