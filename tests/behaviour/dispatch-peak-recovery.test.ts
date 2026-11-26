/**
 * TC-PEAK-009 — a not-preserved episode routes to the delivered interrupted-
 * lane recovery, and a non-terminal refusal returns one classified result while
 * the lane stays parked (GH-413 F-4, AC-F4-2, AC-F4-3, NFR-4, DEC-18).
 */
import { describe, expect, test } from "bun:test";
import { readDispatchLanes } from "../../packages/core/src/app/dispatch-ledger";
import { evaluateDispatchPeakResume } from "../../packages/core/src/app/dispatch-peak-pause";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
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
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
  readonly reenter?: boolean;
  readonly admission?: "budget-only" | "budget-and-economics";
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
      admission: input.admission ?? "budget-and-economics",
      economics: {
        prefillCost: input.prefillCost ?? 0,
        uniqueProgress: input.uniqueProgress ?? 1,
      },
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
      admission: "budget-only",
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

describe("TC-PEAK-009 a non-terminal recovery refusal returns one classified result", () => {
  test("the engine returns the delivered token, names the refusal and the park end, and releases the lease", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-recovery-refusal",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      preservation: "session-state-not-preserved",
      restartCount: 0,
      restartBound: 3,
      recoveryAdmission: "budget-and-economics",
      prefillCost: 100,
      uniqueProgress: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("failed");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.resume-uneconomical");
      expect(run.envelope?.data?.lastMessage).toContain("parked until 2026-11-12T10:00:00.000Z");
      expect(peak.reentered()).toHaveLength(0);
      expect(peak.resumed()).toBe(0);
      expect(scenario.calls.releases.length).toBeGreaterThan(0);
      const lanes = readDispatchLanes(scenario.state.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      const terminal = lanes.records.find((record) => record.state === "terminal");
      expect(terminal?.recoveryRefusal).toBe("dispatch.resume-uneconomical");
    } finally {
      scenario.dispose();
    }
  });
});
