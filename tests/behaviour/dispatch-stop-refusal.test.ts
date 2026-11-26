/**
 * TC-PEAK-020 — a stop for a terminal, absent, session-less active, any-open-
 * park, or unconfirmed-terminate lane is the delivered unmet-precondition
 * refusal and writes nothing (GH-413 F-10, AC-F10-1, NFR-8, RSK-7, RSK-14).
 */
import { describe, expect, test } from "bun:test";
import { executeDispatchStop } from "../../packages/core/src/app/dispatch-stop";
import type {
  DispatchLaneRecord,
  QueueParkRecord,
} from "../../packages/core/src/contracts/index";

const NOW = Date.parse("2026-11-12T06:30:00.000Z");
const UNTIL = "2026-11-12T10:00:00.000Z";
const REPOSITORY = "github.com/owner/repo";

const lane = (overrides: Partial<DispatchLaneRecord> = {}): DispatchLaneRecord => ({
  schema: "delivery.dispatch.lane.v1",
  ref: "GH-413",
  repository: REPOSITORY,
  attemptId: "attempt-1",
  sessionId: "ses-1",
  harnessKind: "opencode",
  owner: { processId: 4242, startedAt: "2026-11-12T06:00:00.000Z" },
  iterationOrdinal: 1,
  restartsConsumed: 0,
  state: "active",
  providerProfile: "delivery",
  recordedAt: "2026-11-12T06:00:00.000Z",
  ...overrides,
});

const openPark = (cause: QueueParkRecord["cause"]): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-413",
  repository: REPOSITORY,
  cause,
  conditionType: cause === "owner-hold" ? "preemption" : "provider-window",
  condition:
    cause === "owner-hold"
      ? { type: "preemption" }
      : { type: "provider-window", expiresAt: UNTIL },
  recheckMs: 60_000,
  evaluatedAt: "2026-11-12T06:00:00.000Z",
  recoveryState: "parked",
  ...(cause === "owner-hold" ? {} : { until: UNTIL }),
  recordedAt: "2026-11-12T06:00:00.000Z",
});

const runStop = async (input: {
  readonly lanes: readonly DispatchLaneRecord[];
  readonly parks?: readonly QueueParkRecord[];
  readonly terminated?: boolean;
}) => {
  const appended: QueueParkRecord[] = [];
  const terminations: number[] = [];
  const outcome = await executeDispatchStop(
    {
      resolveRepository: () => REPOSITORY,
      lanes: () => input.lanes,
      parks: () => input.parks ?? [],
      terminate: async ({ graceMs }) => {
        terminations.push(graceMs);
        return { ok: true, terminated: input.terminated ?? true };
      },
      appendPark: (record) => {
        appended.push(record);
        return true;
      },
      newEpisodeId: () => "episode-1",
      profileGraceMsFor: () => 20_000,
      killGraceMs: 20_000,
      mainCheckout: "/work/repo",
    },
    { ref: "GH-413", cause: "peak-window", until: UNTIL, nowIso: new Date(NOW).toISOString(), nowMs: NOW },
  );
  return { outcome, appended, terminations };
};

describe("TC-PEAK-020 the not-running refusal names the observed state and writes nothing", () => {
  test("an absent lane is refused queue.precondition.unmet with state=absent", async () => {
    const { outcome, appended, terminations } = await runStop({ lanes: [] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("queue.precondition.unmet");
    expect(outcome.summary).toContain("state=absent");
    expect(appended).toHaveLength(0);
    expect(terminations).toHaveLength(0);
  });

  test("a terminal lane is refused with state=terminal", async () => {
    const { outcome, appended } = await runStop({
      lanes: [lane({ state: "terminal", lastToken: "pr-open", lastOutcome: "completed" })],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.summary).toContain("state=terminal");
    expect(appended).toHaveLength(0);
  });

  test("an active lane without a session identity is refused", async () => {
    const { outcome, appended } = await runStop({ lanes: [lane({ sessionId: "" })] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.summary).toContain("state=active-without-session");
    expect(appended).toHaveLength(0);
  });

  test("an already-parked lane of any cause is refused and never parked twice", async () => {
    for (const cause of ["peak-window", "owner-hold", "liveness-stall"] as const) {
      const existing = openPark(cause);
      const { outcome, appended } = await runStop({ lanes: [lane()], parks: [existing] });
      expect(outcome.ok, cause).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.summary).toContain("state=already-parked");
      expect(appended, cause).toHaveLength(0);
    }
  });

  test("an unconfirmed terminate is the same refusal and writes nothing", async () => {
    const { outcome, appended } = await runStop({ lanes: [lane()], terminated: false });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.summary).toContain("state=unconfirmed-terminate");
    expect(appended).toHaveLength(0);
  });
});
