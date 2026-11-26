/**
 * TC-PEAK-009 — a not-preserved episode routes to the delivered interrupted-
 * lane recovery, and a non-terminal refusal returns one classified result while
 * the lane stays parked (GH-413 F-4, AC-F4-2, AC-F4-3, NFR-4, DEC-18).
 */
import { describe, expect, test } from "bun:test";
import { evaluateDispatchPeakResume } from "../../packages/core/src/app/dispatch-peak-pause";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const notPreserved = (): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-413",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: "2026-11-12T10:00:00.000Z" },
  recheckMs: 60_000,
  evaluatedAt: "2026-11-12T06:30:00.000Z",
  recoveryState: "parked",
  providerProfile: "delivery",
  until: "2026-11-12T10:00:00.000Z",
  graceDeadline: "2026-11-12T06:30:20.000Z",
  windowEnd: "2026-11-12T10:00:00.000Z",
  stoppedAt: "2026-11-12T06:30:20.000Z",
  preservation: "session-state-not-preserved",
  episodeId: "episode-1",
  recordedAt: "2026-11-12T06:30:20.000Z",
});

const evaluate = (input: {
  readonly restartCount: number;
  readonly restartBound?: number;
  readonly reenter?: boolean;
}) => {
  const reentered: number[] = [];
  const escalated: string[] = [];
  return {
    reentered,
    escalated,
    run: evaluateDispatchPeakResume({
      ref: "GH-413",
      parks: () => [notPreserved()],
      rulesFor: () => RULES_BY_PROFILE.delivery,
      nowMs: atUtcHour(10),
      nowIso: () => "2026-11-12T10:00:00.000Z",
      holdActive: () => false,
      branch: "feat/GH-413/test",
      restartCount: input.restartCount,
      restartBound: input.restartBound ?? 3,
      economics: { prefillCost: null, uniqueProgress: null },
      resumeSession: async () => true,
      reenter: async ({ ordinal }) => {
        reentered.push(ordinal);
        return input.reenter ?? true;
      },
      escalate: ({ code }) => {
        escalated.push(code);
      },
    }),
  };
};

describe("TC-PEAK-009 the not-preserved recovery consumes one ordinal and emits no resumed", () => {
  test("an admitted recovery re-enters with one ordinal and appends the delivered recovery record", async () => {
    const { run, reentered } = evaluate({ restartCount: 0 });
    const outcome = await run;
    expect(outcome.outcome).toBe("recovered");
    expect(reentered).toEqual([1]);
    if (outcome.outcome !== "recovered") return;
    expect(outcome.recoveryRecord.recoveryState).toBe("recovered");
    expect(outcome.recoveryRecord.sessionRef).toBeUndefined();
  });

  test("budget exhaustion escalates the delivered terminal refusal", async () => {
    const { run, escalated } = evaluate({ restartCount: 3 });
    const outcome = await run;
    expect(outcome.outcome).toBe("refused");
    if (outcome.outcome !== "refused") return;
    expect(outcome.terminal).toBe(true);
    expect(outcome.code).toBe("dispatch.restart-budget-exceeded");
    expect(escalated).toEqual(["dispatch.restart-budget-exceeded"]);
  });
});

describe("TC-PEAK-009 a zero or absent restart budget refuses like the stall restart", () => {
  test("bound 0 is a terminal dispatch.restart-budget-exceeded refusal", async () => {
    const { run, reentered, escalated } = evaluate({
      restartCount: 0,
      restartBound: 0,
    });
    const outcome = await run;
    expect(outcome.outcome).toBe("refused");
    if (outcome.outcome !== "refused") return;
    expect(outcome.code).toBe("dispatch.restart-budget-exceeded");
    expect(outcome.terminal).toBe(true);
    expect(reentered).toHaveLength(0);
    expect(escalated).toEqual(["dispatch.restart-budget-exceeded"]);
  });
});
