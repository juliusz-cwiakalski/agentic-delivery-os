/**
 * TC-PEAK-036 — a stop racing a session end resolves exactly one classified
 * outcome, never a partial episode, duplicate park, or losing-side write
 * (GH-413 F-10, F-9, AC-F10-2, NFR-2, RSK-7).
 */
import { describe, expect, test } from "bun:test";
import { executeDispatchStop } from "../../packages/core/src/app/dispatch-stop";
import type { DispatchLaneRecord, QueueParkRecord } from "../../packages/core/src/contracts/index";

const NOW = Date.parse("2026-11-12T06:30:00.000Z");
const UNTIL = "2026-11-12T10:00:00.000Z";
const REPOSITORY = "github.com/owner/repo";

const lane = (state: "active" | "terminal"): DispatchLaneRecord => ({
  schema: "delivery.dispatch.lane.v1",
  ref: "GH-413",
  repository: REPOSITORY,
  attemptId: "attempt-1",
  sessionId: "ses-1",
  harnessKind: "opencode",
  owner: { processId: 4242, startedAt: "2026-11-12T06:00:00.000Z" },
  iterationOrdinal: 1,
  restartsConsumed: 0,
  state,
  ...(state === "terminal"
    ? { lastToken: "pr-open" as const, lastOutcome: "completed" as const }
    : {}),
  providerProfile: "delivery",
  recordedAt: "2026-11-12T06:00:00.000Z",
});

const runStop = async (input: {
  readonly state: "active" | "terminal";
  readonly terminated: boolean;
  readonly parks?: readonly QueueParkRecord[];
}) => {
  const appended: QueueParkRecord[] = [];
  const outcome = await executeDispatchStop(
    {
      resolveRepository: () => REPOSITORY,
      lanes: () => [lane(input.state)],
      parks: () => input.parks ?? [],
      terminate: async () => ({ ok: true, terminated: input.terminated }),
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
      until: UNTIL,
      nowIso: new Date(NOW).toISOString(),
      nowMs: NOW,
    },
  );
  return { outcome, appended };
};

describe("TC-PEAK-036 a stop racing a session end resolves exactly one outcome", () => {
  test("the session ends first: the request is the not-running refusal and writes nothing", async () => {
    const { outcome, appended } = await runStop({ state: "terminal", terminated: true });
    expect(outcome.ok).toBe(false);
    expect(appended).toHaveLength(0);
  });

  test("the stop loses its terminate: the same refusal, no partial episode", async () => {
    const { outcome, appended } = await runStop({ state: "active", terminated: false });
    expect(outcome.ok).toBe(false);
    expect(appended).toHaveLength(0);
  });

  test("the confirmed stop is exactly one episode and one park record", async () => {
    const { outcome, appended } = await runStop({ state: "active", terminated: true });
    expect(outcome.ok).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.recoveryState).toBe("parked");
    expect(appended[0]?.cause).toBe("peak-window");
  });
});
