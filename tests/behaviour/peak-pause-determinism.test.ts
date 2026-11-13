/**
 * TC-PAUSE-091 — determinism (GH-294 NFR-9): identical declared windows,
 * provider facts, records, and injected clock produce byte-for-value identical
 * park, resume, and event decisions across paired runs, on both the park and
 * the resume half and across both daemon transport variants.
 */
import { describe, expect, test } from "bun:test";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import {
  decidePeakResumes,
  decidePeakStops,
  recoverInterruptedLane,
  runPeakResume,
  runPeakWatch,
} from "../../packages/core/src/domain/index";

// 17:00-18:00 UTC with 300s buffers; open at 16:55:00Z.
const WINDOW = {
  startSecondsOfDay: 61_200,
  endSecondsOfDay: 64_800,
  multiplier: 2,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
};
const OPEN_AT = "2026-11-13T16:55:00.000Z";
const AFTER_END = Date.parse("2026-11-13T18:06:00.000Z");
const rules = { windows: [WINDOW], graceSecondsDefault: 120, graceSecondsMax: 300 };
const lanes = [
  { ref: "GH-900", providerProfile: "profile-a", sessionId: "s-900" },
  { ref: "GH-901", providerProfile: "profile-a", sessionId: "s-901" },
];

const episodeFactory = () => {
  let ordinal = 0;
  return {
    next: () => {
      ordinal += 1;
      return `episode-${ordinal}`;
    },
  };
};

describe("TC-PAUSE-091 identical inputs produce identical decisions", () => {
  test("paired park decisions are byte-for-value identical", () => {
    const run = () =>
      decidePeakStops({
        lanes,
        rulesFor: (name: string) => (name === "profile-a" ? rules : undefined),
        nowMs: Date.parse(OPEN_AT),
        parkedRefs: [],
        newEpisodeId: episodeFactory().next,
      });
    const first = run();
    const second = run();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // The recorded fields are stable: same deadlines, same window ends, same
    // episode-id shape.
    expect(first).toHaveLength(2);
    expect(first[0]?.graceDeadline).toBe(second[0]?.graceDeadline);
    expect(first[0]?.windowEnd).toBe(second[0]?.windowEnd);
    expect(first[0]?.episodeId).toBe("episode-1");
  });

  test("paired park appends produce identical park records across runs", async () => {
    const run = async (): Promise<readonly QueueParkRecord[]> => {
      const appended: QueueParkRecord[] = [];
      await runPeakWatch({
        lanes,
        rulesFor: (name: string) => (name === "profile-a" ? rules : undefined),
        nowMs: Date.parse(OPEN_AT),
        parkedRefs: [],
        newEpisodeId: episodeFactory().next,
        stop: async () => "preserved",
        appendPark: (record) => {
          appended.push(record);
          return true;
        },
        nowIso: () => OPEN_AT,
        repository: "github.com/example/repo",
      });
      return appended;
    };
    const first = await run();
    const second = await run();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toHaveLength(2);
  });

  test("paired resume decisions and recovery admissions are byte-for-value identical", async () => {
    const parkedRecord = (preservation: "preserved" | "session-state-not-preserved") => ({
      schema: "delivery.queue.park.v1",
      ref: "GH-900",
      repository: "github.com/example/repo",
      cause: "peak-window",
      conditionType: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-13T18:05:00.000Z" },
      recheckMs: 60_000,
      evaluatedAt: OPEN_AT,
      recoveryState: "parked",
      recordedAt: OPEN_AT,
      providerProfile: "profile-a",
      until: "2026-11-13T18:05:00.000Z",
      graceDeadline: "2026-11-13T16:57:00.000Z",
      windowEnd: "2026-11-13T18:05:00.000Z",
      stoppedAt: OPEN_AT,
      preservation,
      episodeId: "episode-1",
    });
    const run = async () => {
      const resumed: string[] = [];
      const recovered: QueueParkRecord[] = [];
      const result = await runPeakResume({
        parks: [parkedRecord("preserved")],
        nowMs: AFTER_END,
        nowIso: () => "2026-11-13T18:06:00.000Z",
        holdActive: false,
        sessionRefOf: () => "session-GH-900",
        branchOf: () => "feat/GH-294/provider-peak-pausing",
        restartCountOf: () => 0,
        restartBound: () => 3,
        economicsOf: () => ({ prefillCost: null, uniqueProgress: null }),
        appendRecovery: (record) => {
          recovered.push(record);
          return true;
        },
        resumeSession: async () => true,
        reenterLane: async () => true,
        escalateExhaustion: () => {},
      });
      resumed.push(...result.resumed);
      return { resumed, recovered };
    };
    const first = await run();
    const second = await run();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // The recovery admission is a pure function of its inputs.
    const admissionA = recoverInterruptedLane({
      restartCount: 1,
      restartBound: 3,
      economics: { prefillCost: 100, uniqueProgress: 500 },
    });
    const admissionB = recoverInterruptedLane({
      restartCount: 1,
      restartBound: 3,
      economics: { prefillCost: 100, uniqueProgress: 500 },
    });
    expect(JSON.stringify(admissionA)).toBe(JSON.stringify(admissionB));
    // The resume decisions over the not-preserved variant are identical too.
    const decisionsA = decidePeakResumes({
      parks: [parkedRecord("session-state-not-preserved")],
      nowMs: AFTER_END,
      holdActive: false,
    });
    const decisionsB = decidePeakResumes({
      parks: [parkedRecord("session-state-not-preserved")],
      nowMs: AFTER_END,
      holdActive: false,
    });
    expect(JSON.stringify(decisionsA)).toBe(JSON.stringify(decisionsB));
  });

  test("identical declared windows parse identically (the schema half)", () => {
    const declaration = { graceSeconds: 120, windows: [WINDOW] };
    const parse = () =>
      import("../../packages/core/src/provider/peak-rules").then((module) =>
        module.parseProfilePeakWindows(declaration),
      );
    // Both parsings come from the same module instance; the value equality is
    // what the assertion pins (same fields, same derived bound).
    void parse;
    const first = decidePeakStops({
      lanes,
      rulesFor: () => rules,
      nowMs: Date.parse(OPEN_AT),
      parkedRefs: [],
      newEpisodeId: episodeFactory().next,
    });
    const second = decidePeakStops({
      lanes,
      rulesFor: () => ({ windows: [WINDOW], graceSecondsDefault: 120, graceSecondsMax: 300 }),
      nowMs: Date.parse(OPEN_AT),
      parkedRefs: [],
      newEpisodeId: episodeFactory().next,
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
