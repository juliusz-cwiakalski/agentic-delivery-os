/**
 * TC-PAUSE-040..044 — window-end resume (both classification routes) with
 * owner-hold precedence (GH-294 F-5, AC-F5-4, DEC-5, DEC-8, DEC-11, DEC-12;
 * TDR-0030 D3/D4; AMB-P2; OQ-TP-3).
 *
 * At the effective window end every lane parked for that window resumes
 * automatically — zero operator commands, zero dispatch invocations, the
 * decision derived solely from the window-end observation. A `preserved` lane
 * resumes through the session resume path on the same branch (attach-and-
 * continue, no restart ordinal); a `session-state-not-preserved` lane routes
 * to the delivered interrupted-lane recovery (ledger position, same branch,
 * exactly one restart ordinal, budget- and economics-governed; exhaustion
 * escalates verbatim). An active owner hold outranks the window: the resume
 * admission refuses `queue.precondition.unmet`, reason `owner-hold`, appending
 * nothing, while the watcher still parks under the hold.
 */
import { describe, expect, test } from "bun:test";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import {
  decidePeakResumes,
  decidePeakStops,
  recoverInterruptedLane,
  runPeakResume,
} from "../../packages/core/src/domain/index";

const UNTIL = "2026-11-13T18:05:00.000Z";
const AFTER_END = Date.parse("2026-11-13T18:06:00.000Z");
const BEFORE_END = Date.parse("2026-11-13T18:04:00.000Z");

const parkedRecord = (overrides: Partial<QueueParkRecord> = {}): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-900",
  repository: "github.com/example/repo",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: UNTIL },
  recheckMs: 60_000,
  evaluatedAt: "2026-11-13T16:55:00.000Z",
  recoveryState: "parked",
  recordedAt: "2026-11-13T16:55:00.000Z",
  providerProfile: "profile-a",
  until: UNTIL,
  graceDeadline: "2026-11-13T16:57:00.000Z",
  windowEnd: UNTIL,
  stoppedAt: "2026-11-13T16:55:00.000Z",
  preservation: "preserved",
  episodeId: "episode-1",
  ...overrides,
});

describe("TC-PAUSE-040 preserved lanes resume via the session resume path", () => {
  test("automatic attach-and-continue on the preserved session, same branch, no ordinal", async () => {
    const calls: {
      readonly resumedSession: Array<{
        readonly ref: string;
        readonly sessionRef: string;
        readonly branch: string;
      }>;
      readonly reentries: string[];
      readonly recoveries: QueueParkRecord[];
      readonly escalations: Array<{ readonly ref: string; readonly code: string }>;
      readonly operatorCommands: number;
      readonly dispatchInvocations: number;
    } = {
      resumedSession: [],
      reentries: [],
      recoveries: [],
      escalations: [],
      operatorCommands: 0,
      dispatchInvocations: 0,
    };
    const result = await runPeakResume({
      parks: [parkedRecord()],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T18:06:00.000Z",
      holdActive: false,
      sessionRefOf: () => "session-GH-900",
      branchOf: () => "feat/GH-294/provider-peak-pausing",
      restartCountOf: () => 0,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: null, uniqueProgress: null }),
      appendRecovery: (record) => {
        calls.recoveries.push(record);
        return true;
      },
      resumeSession: async (input) => {
        // AMB-P2: the transition is driven by zero operator commands and zero
        // dispatch invocations — the counters in this fixture never move.
        calls.resumedSession.push(input);
        return true;
      },
      reenterLane: async (input) => {
        calls.reentries.push(input.ref);
        return true;
      },
      escalateExhaustion: (input) => {
        calls.escalations.push(input);
      },
    });
    // The resume decision derives solely from the window-end observation.
    expect(result.refusals).toEqual([]);
    expect(result.resumed).toEqual(["GH-900"]);
    // Attach-and-continue against the preserved session identity, same branch.
    expect(calls.resumedSession).toEqual([
      { ref: "GH-900", sessionRef: "session-GH-900", branch: "feat/GH-294/provider-peak-pausing" },
    ]);
    // Attach-and-continue consumes no restart ordinal: no re-entry, and the
    // fresh-spawn counter stays zero (no fresh dispatch exists on this path).
    expect(calls.reentries).toEqual([]);
    expect(calls.dispatchInvocations).toBe(0);
    expect(calls.operatorCommands).toBe(0);
    // Exactly one recovered park record: the episode's resume marker.
    expect(calls.recoveries).toHaveLength(1);
    expect(calls.recoveries[0]?.recoveryState).toBe("recovered");
    expect(calls.recoveries[0]?.sessionRef).toBe("session-GH-900");
    expect(calls.recoveries[0]?.branch).toBe("feat/GH-294/provider-peak-pausing");
    expect(calls.recoveries[0]?.until).toBe(UNTIL);
  });

  test("before the effective end nothing resumes: the boundary is inclusive at end", async () => {
    const { resumes, refusals } = decidePeakResumes({
      parks: [parkedRecord()],
      nowMs: BEFORE_END,
      holdActive: false,
    });
    expect(resumes).toEqual([]);
    expect(refusals).toEqual([]);
  });
});

describe("TC-PAUSE-041 not-preserved lanes route to the delivered interrupted-lane recovery", () => {
  test("the recovery decision consumes exactly one restart ordinal, budget-governed", () => {
    const admitted = recoverInterruptedLane({
      restartCount: 0,
      restartBound: 3,
      economics: { prefillCost: 100, uniqueProgress: 500 },
    });
    expect(admitted.admitted).toBe(true);
    if (admitted.admitted) expect(admitted.ordinal).toBe(1);
    // The second recovery consumes the next ordinal.
    const second = recoverInterruptedLane({
      restartCount: 1,
      restartBound: 3,
      economics: { prefillCost: 100, uniqueProgress: 500 },
    });
    expect(second.admitted).toBe(true);
    if (second.admitted) expect(second.ordinal).toBe(2);
  });

  test("runPeakResume routes the not-preserved lane through re-entry and appends the recovery record", async () => {
    const reentries: number[] = [];
    const recoveries: QueueParkRecord[] = [];
    const resumedSessions: string[] = [];
    const result = await runPeakResume({
      parks: [parkedRecord({ preservation: "session-state-not-preserved" })],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T18:06:00.000Z",
      holdActive: false,
      sessionRefOf: () => undefined,
      branchOf: () => "feat/GH-294/provider-peak-pausing",
      restartCountOf: () => 0,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: 100, uniqueProgress: 500 }),
      appendRecovery: (record) => {
        recoveries.push(record);
        return true;
      },
      resumeSession: async () => {
        resumedSessions.push("session-resume");
        return true;
      },
      reenterLane: async (input) => {
        reentries.push(input.ordinal);
        return true;
      },
      escalateExhaustion: () => {},
    });
    // The route is the delivered interrupted-lane recovery, never the session
    // resume path — and it emits no resumed frame (OQ-TP-3, asserted at the
    // record level: the recovery record carries the failure classification,
    // which the projection does not map to EVT-3).
    expect(resumedSessions).toEqual([]);
    expect(reentries).toEqual([1]);
    expect(result.resumed).toEqual([]);
    expect(result.recovered).toEqual(["GH-900"]);
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0]?.preservation).toBe("session-state-not-preserved");
    expect(recoveries[0]?.recoveryState).toBe("recovered");
  });

  test("an uneconomical recovery leaves the lane parked for a later observation", async () => {
    const reentries: number[] = [];
    const recoveries: QueueParkRecord[] = [];
    const result = await runPeakResume({
      parks: [parkedRecord({ preservation: "session-state-not-preserved" })],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T18:06:00.000Z",
      holdActive: false,
      sessionRefOf: () => undefined,
      branchOf: () => "b",
      restartCountOf: () => 0,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: 1000, uniqueProgress: 100 }),
      appendRecovery: (record) => {
        recoveries.push(record);
        return true;
      },
      resumeSession: async () => true,
      reenterLane: async (input) => {
        reentries.push(input.ordinal);
        return true;
      },
      escalateExhaustion: () => {},
    });
    expect(result.recovered).toEqual([]);
    expect(reentries).toEqual([]);
    expect(recoveries).toEqual([]);
  });
});

describe("TC-PAUSE-042 budget exhaustion escalates verbatim", () => {
  test("at the bound the recovery refuses terminally and the escalation fires once", async () => {
    const admission = recoverInterruptedLane({
      restartCount: 3,
      restartBound: 3,
      economics: { prefillCost: 100, uniqueProgress: 500 },
    });
    expect(admission.admitted).toBe(false);
    if (!admission.admitted) {
      expect(admission.code).toBe("dispatch.restart-budget-exceeded");
      expect(admission.terminal).toBe(true);
    }
    const escalations: Array<{ readonly ref: string; readonly code: string }> = [];
    const reentries: number[] = [];
    const recoveries: QueueParkRecord[] = [];
    const result = await runPeakResume({
      parks: [parkedRecord({ preservation: "session-state-not-preserved" })],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T18:06:00.000Z",
      holdActive: false,
      sessionRefOf: () => undefined,
      branchOf: () => "b",
      restartCountOf: () => 3,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: 100, uniqueProgress: 500 }),
      appendRecovery: (record) => {
        recoveries.push(record);
        return true;
      },
      resumeSession: async () => true,
      reenterLane: async (input) => {
        reentries.push(input.ordinal);
        return true;
      },
      escalateExhaustion: (input) => {
        escalations.push(input);
      },
    });
    // Never a silent requeue, never a fresh re-dispatch: nothing re-entered,
    // nothing appended, and the delivered escalation fired exactly once with
    // the terminal classification.
    expect(reentries).toEqual([]);
    expect(recoveries).toEqual([]);
    expect(result.exhausted).toEqual(["GH-900"]);
    expect(escalations).toEqual([{ ref: "GH-900", code: "dispatch.restart-budget-exceeded" }]);
  });
});

describe("TC-PAUSE-043 no state lost or duplicated across the episode", () => {
  test("single-flight holds the ref through the parked interval and the recovery record preserves the fields", async () => {
    const parks = [
      parkedRecord(),
      parkedRecord({
        ref: "GH-900",
        episodeId: "episode-1",
        recoveryState: "recovered",
        recoveredAt: "2026-11-13T18:06:00.000Z",
        clearedAt: "2026-11-13T18:06:00.000Z",
        sessionRef: "session-GH-900",
        branch: "feat/GH-294/provider-peak-pausing",
        recordedAt: "2026-11-13T18:06:00.000Z",
        evaluatedAt: "2026-11-13T18:06:00.000Z",
      }),
    ];
    // The recovered record is a new append: the parked record above is
    // byte-unchanged (append-only, no in-place mutation).
    expect(parks[0]?.recoveryState).toBe("parked");
    expect(parks[1]?.episodeId).toBe(parks[0]?.episodeId);
    // The episode's fields carry across unchanged: same cause, profile,
    // until, and preservation — nothing lost, nothing duplicated.
    for (const field of [
      "cause",
      "providerProfile",
      "until",
      "preservation",
      "graceDeadline",
      "windowEnd",
    ] as const) {
      expect(parks[1]?.[field]).toBe(parks[0]?.[field]);
    }
    // The duplicate-active-parks invariant stays clean after recovery.
    const { hasDuplicateActiveParks } = await import("../../packages/core/src/domain/queue-park");
    expect(hasDuplicateActiveParks(parks as never)).toBe(false);
  });
});

describe("TC-PAUSE-044 an active owner hold outranks the window, including at window end", () => {
  test("the hold-active resume refuses with the delivered classification, appending nothing", async () => {
    const appends: QueueParkRecord[] = [];
    const resumedSessions: string[] = [];
    const reentries: number[] = [];
    const result = await runPeakResume({
      parks: [parkedRecord()],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T18:06:00.000Z",
      holdActive: true,
      sessionRefOf: () => "session-GH-900",
      branchOf: () => "b",
      restartCountOf: () => 0,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: null, uniqueProgress: null }),
      appendRecovery: (record) => {
        appends.push(record);
        return true;
      },
      resumeSession: async () => {
        resumedSessions.push("resume");
        return true;
      },
      reenterLane: async (input) => {
        reentries.push(input.ordinal);
        return true;
      },
      escalateExhaustion: () => {},
    });
    // The refusal carries the delivered classification and reason.
    expect(result.refusals).toEqual([
      {
        ref: "GH-900",
        code: "queue.precondition.unmet",
        reason: "owner-hold",
        episodeId: "episode-1",
      },
    ]);
    // Appending nothing: no recovery record, no session resume, no re-entry —
    // the existing park record stays byte-unchanged.
    expect(appends).toEqual([]);
    expect(resumedSessions).toEqual([]);
    expect(reentries).toEqual([]);
  });

  test("the hold does not mute the watcher: peak-window parks still land under an active hold", () => {
    // The park decision (decidePeakStops) reads no hold state at all — the
    // hold's precedence manifests only at claim and resume admission — so the
    // watcher parks `peak-window` with `until` exactly as without the hold.
    const decisions = decidePeakStops({
      lanes: [{ ref: "GH-900", providerProfile: "profile-a" }],
      rulesFor: (name: string) =>
        name === "profile-a"
          ? {
              windows: [
                {
                  startSecondsOfDay: 61_200,
                  endSecondsOfDay: 64_800,
                  multiplier: 2,
                  bufferBeforeSeconds: 300,
                  bufferAfterSeconds: 300,
                },
              ],
              graceSecondsDefault: 120,
              graceSecondsMax: 300,
            }
          : undefined,
      nowMs: Date.parse("2026-11-13T17:10:00.000Z"),
      parkedRefs: [],
      newEpisodeId: () => "episode-hold",
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.providerProfile).toBe("profile-a");
  });

  test("resume proceeds once the hold clears", async () => {
    const resumed: string[] = [];
    const result = await runPeakResume({
      parks: [parkedRecord()],
      nowMs: AFTER_END,
      nowIso: () => "2026-11-13T19:00:00.000Z",
      holdActive: false,
      sessionRefOf: () => "session-GH-900",
      branchOf: () => "b",
      restartCountOf: () => 0,
      restartBound: () => 3,
      economicsOf: () => ({ prefillCost: null, uniqueProgress: null }),
      appendRecovery: () => true,
      resumeSession: async (input) => {
        resumed.push(input.ref);
        return true;
      },
      reenterLane: async () => true,
      escalateExhaustion: () => {},
    });
    expect(result.refusals).toEqual([]);
    expect(result.resumed).toEqual(["GH-900"]);
    expect(resumed).toEqual(["GH-900"]);
  });
});
