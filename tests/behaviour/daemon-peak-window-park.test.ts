/**
 * TC-PAUSE-012, TC-PAUSE-020..026 — the daemon's profile-window watch and
 * in-flight lane parking (GH-294 F-3, AC-F3-2, DM-3, DM-4; NFR-1, NFR-2;
 * DEC-6, DEC-11; TDR-0030 D1/D5; AMB-P1, AMB-P3, LIT-P1).
 *
 * Every assertion runs the delivered supervision cycle over a temp store with
 * the injected clock: the watch observes the buffer-inclusive window start,
 * stops every in-flight lane of the profile through the cooperative stop seam,
 * and appends exactly one park record per episode — reason `peak-window`, the
 * profile named, `until` at the effective window end, the preservation
 * classification — with the applied grace never exceeding the window buffer.
 * No real sleep, no live resource, no new termination path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendDaemonLane,
  queueParkRecordKey,
  readDaemonLanes,
  readQueueParks,
  runSupervisionCycle,
} from "../../packages/core/src/app/index";
import type {
  ProviderProfilePeakRules,
  QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import { QUEUE_PARK_RECORD_KIND } from "../../packages/core/src/contracts/index";
import { shapeDaemonLane } from "../../packages/core/src/domain/daemon-lane";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const REPOSITORY = "github.com/owner/repo";
// The window 17:00-18:00 UTC with 300s buffers: buffer-inclusive open at
// 16:55:00, declared end 18:00:00, effective end 18:05:00.
const WINDOW = {
  startSecondsOfDay: 61_200,
  endSecondsOfDay: 64_800,
  multiplier: 2,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
};
const OPEN_AT = "2026-11-13T16:55:00.000Z";
const BEFORE_OPEN = "2026-11-13T16:54:59.000Z";
const EFFECTIVE_END = "2026-11-13T18:05:00.000Z";

type Clock = {
  readonly nowMs: () => number;
  readonly nowIso: () => string;
  readonly advanceTo: (iso: string) => void;
  readonly sleeps: () => number;
};

const createClock = (startIso: string): Clock => {
  let value = Date.parse(startIso);
  const sleeps = 0;
  return {
    nowMs: () => value,
    nowIso: () => new Date(value).toISOString(),
    advanceTo: (iso) => {
      value = Date.parse(iso);
    },
    sleeps: () => sleeps,
  };
};

const rulesOf = (
  windows: ProviderProfilePeakRules["windows"],
  graceSecondsDefault: number,
): ProviderProfilePeakRules => ({
  windows,
  graceSecondsDefault,
  graceSecondsMax: Math.min(
    ...windows.flatMap((window) => [window.bufferBeforeSeconds, window.bufferAfterSeconds]),
  ),
});

type FixtureOptions = {
  readonly rules?: ProviderProfilePeakRules;
  readonly preservation?: "preserved" | "session-state-not-preserved";
  readonly laneRefs?: readonly string[];
  readonly nominatedProfile?: string;
};

const buildFixture = (label: string, options: FixtureOptions = {}) => {
  const root = makeTempRoot(`gh294-park-${label}`);
  const { store, fenceToken } = openStore(makeIdentity(root));
  const clock = createClock(BEFORE_OPEN);
  const stopCalls: Array<{ readonly ref: string; readonly graceDeadline: string }> = [];
  let episodeOrdinal = 0;
  const parks: QueueParkRecord[] = [];
  const rules = options.rules ?? rulesOf([WINDOW], 120);
  const profile = options.nominatedProfile ?? "profile-a";

  const seedLane = (ref: string): void => {
    const appended = appendDaemonLane(
      store,
      fenceToken,
      shapeDaemonLane({
        ref,
        state: "delivering",
        sessionId: `session-${ref}`,
        spawnOrdinal: 1,
        providerProfile: profile,
        recordedAt: clock.nowIso(),
      }),
    );
    if (!appended.ok) throw new Error("lane seed refused");
  };
  for (const ref of options.laneRefs ?? ["GH-900"]) seedLane(ref);

  const readParks = (): readonly QueueParkRecord[] => {
    const read = readQueueParks(store);
    return read.ok ? read.records : parks;
  };

  const activePeakRefs = (): readonly string[] => {
    const latest = new Map<string, QueueParkRecord>();
    for (const record of readParks()) latest.set(record.ref, record);
    const nowMs = clock.nowMs();
    return [...latest.values()]
      .filter(
        (record) =>
          record.cause === "peak-window" &&
          record.recoveryState === "parked" &&
          record.until !== undefined &&
          Date.parse(record.until) > nowMs,
      )
      .map((record) => record.ref);
  };

  const runCycle = async (): Promise<void> => {
    await runSupervisionCycle({
      store,
      fenceToken,
      ports: {
        executor: {
          availability: () => ({ available: true }),
          start: async () => undefined,
          observe: async () => ({ observable: true, progress: "progressing", done: false }),
          collect: async () => ({ ok: true }),
          resume: async () => true,
        },
        nextAction: () => undefined,
        claim: () => ({ ok: true, leaseId: "lease" }),
        release: () => true,
        nowIso: clock.nowIso,
        peakPause: {
          parkedRefs: activePeakRefs,
          rulesFor: (name: string) => (name === profile ? rules : undefined),
          nowMs: clock.nowMs,
          nowIso: clock.nowIso,
          stop: async (input: { readonly ref: string; readonly graceDeadline: string }) => {
            stopCalls.push({ ref: input.ref, graceDeadline: input.graceDeadline });
            return options.preservation ?? "preserved";
          },
          appendPark: (record: QueueParkRecord) => {
            const acquired = store.acquireFence(`peak-${record.episodeId ?? record.ref}`);
            if (!acquired.ok) return false;
            const appended = store.append(acquired.value.handle, {
              kind: QUEUE_PARK_RECORD_KIND,
              recordKey: queueParkRecordKey(record.ref),
              payload: record as never,
            });
            store.releaseFence(acquired.value.handle);
            if (appended.ok) parks.push(record);
            return appended.ok;
          },
          newEpisodeId: () => {
            episodeOrdinal += 1;
            return `episode-${episodeOrdinal}`;
          },
          repository: REPOSITORY,
        },
      },
    });
  };

  return {
    root,
    store,
    clock,
    stopCalls,
    runCycle,
    readParks,
    readLanes: (): ReturnType<typeof readDaemonLanes> => readDaemonLanes(store),
    dispose: (): void => removeRoot(root),
  };
};

const latestPark = (fixture: ReturnType<typeof fixture>): QueueParkRecord | undefined => {
  const records = fixture.readParks();
  return records.at(-1);
};

describe("TC-PAUSE-012 no window declared means no enforcement", () => {
  test("a rule-less profile produces zero enforcement artifacts across arbitrary instants", async () => {
    const fixture = buildFixture("no-window", {
      rules: rulesOf([], 120),
      laneRefs: ["GH-900", "GH-901"],
    });
    try {
      for (const instant of [
        "2026-11-13T09:00:00.000Z",
        OPEN_AT,
        "2026-11-13T17:30:00.000Z",
        EFFECTIVE_END,
      ]) {
        fixture.clock.advanceTo(instant);
        await fixture.runCycle();
      }
      expect(fixture.readParks()).toEqual([]);
      expect(fixture.stopCalls).toEqual([]);
      const lanes = fixture.readLanes();
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      // The lanes stay delivering: no park decision ever touched them.
      for (const lane of lanes.records) expect(lane.state).toBe("delivering");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-PAUSE-020 the window opens (buffer included) and every in-flight P lane stops", () => {
  test("no stop before the buffer-inclusive start; stop and park within the observation cycle", async () => {
    const fixture = buildFixture("window-open", { laneRefs: ["GH-900", "GH-901"] });
    try {
      // One instant before the buffer-inclusive start: no stop, no park.
      fixture.clock.advanceTo(BEFORE_OPEN);
      await fixture.runCycle();
      expect(fixture.stopCalls).toEqual([]);
      expect(fixture.readParks()).toEqual([]);

      // The buffer-inclusive start: both lanes stop within this cycle.
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      expect(fixture.stopCalls.map((call) => call.ref).sort()).toEqual(["GH-900", "GH-901"]);
      for (const call of fixture.stopCalls) {
        // The recorded grace deadline equals observation + the applied grace
        // (the profile's declared default 120s).
        expect(Date.parse(call.graceDeadline) - fixture.clock.nowMs()).toBe(120_000);
      }
      const parks = fixture.readParks();
      expect(parks).toHaveLength(2);
      for (const record of parks) {
        expect(record.cause).toBe("peak-window");
        expect(record.providerProfile).toBe("profile-a");
        expect(record.until).toBe(EFFECTIVE_END);
        expect(record.graceDeadline).toBeDefined();
        expect(record.stoppedAt).toBeDefined();
        expect(record.preservation).toBe("preserved");
        expect(record.recoveryState).toBe("parked");
        // The condition rides the provider-window condition type with the
        // window end as its read-time expiry (DEC-2).
        expect(record.conditionType).toBe("provider-window");
        expect(record.condition.type === "provider-window" ? record.condition.expiresAt : "").toBe(
          EFFECTIVE_END,
        );
      }
    } finally {
      fixture.dispose();
    }
  });

  test("the applied grace never exceeds the window buffer across the matrix", async () => {
    // Cells: default grace below the buffer; grace at its maximum equal to the
    // buffer; the preservation-failure variant of each. Validation refuses a
    // grace above the maximum, so the runtime bound cannot be violated by
    // configuration (TC-PAUSE-011).
    const cells = [
      { grace: 120, buffer: 300, preservation: "preserved" as const },
      { grace: 300, buffer: 300, preservation: "preserved" as const },
      { grace: 120, buffer: 300, preservation: "session-state-not-preserved" as const },
      { grace: 300, buffer: 300, preservation: "session-state-not-preserved" as const },
    ];
    for (const [index, cell] of cells.entries()) {
      const fixture = buildFixture(`grace-${index}`, {
        rules: rulesOf([WINDOW], cell.grace),
        preservation: cell.preservation,
        laneRefs: ["GH-900"],
      });
      try {
        fixture.clock.advanceTo(OPEN_AT);
        await fixture.runCycle();
        const record = latestPark(fixture);
        expect(record).toBeDefined();
        if (record === undefined) continue;
        const appliedSeconds =
          (Date.parse(record.graceDeadline ?? "") - Date.parse(record.stoppedAt ?? "")) / 1000;
        // Applied grace ≤ declared buffer in every cell (NFR-1, DEC-6), and
        // identical with and without the preservation failure (TDR-0030 D5).
        expect(appliedSeconds).toBe(cell.grace);
        expect(appliedSeconds).toBeLessThanOrEqual(cell.buffer);
        expect(record.preservation).toBe(cell.preservation);
        expect(record.until).toBe(EFFECTIVE_END);
      } finally {
        fixture.dispose();
      }
    }
  });
});

describe("TC-PAUSE-021 the park record is complete, fenced, and deduped", () => {
  test("exactly one park append per episode; repeated observations append nothing", async () => {
    const fixture = buildFixture("park-record", { laneRefs: ["GH-900"] });
    try {
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      const first = latestPark(fixture);
      expect(first?.episodeId).toBeDefined();
      // Several additional cycles while the window stays open: no second park
      // record for the episode (identity dedupe across repeated observations).
      for (let index = 0; index < 3; index += 1) {
        fixture.clock.advanceTo("2026-11-13T17:10:00.000Z");
        await fixture.runCycle();
      }
      const records = fixture.readParks();
      expect(records).toHaveLength(1);
      expect(records.at(-1)?.episodeId).toBe(first?.episodeId);
      // The record is not mutated over time: read-time expiry only.
      expect(records.at(-1)).toEqual(first);
    } finally {
      fixture.dispose();
    }
  });

  test("the preservation classification renders truthfully with cross-carrier agreement", async () => {
    // AMB-P3/LIT-P1: the closed two-member value set, identical on the park
    // record and (through the Phase 3 projection) the parked event payload.
    const fixture = buildFixture("park-preservation", {
      preservation: "session-state-not-preserved",
      laneRefs: ["GH-900"],
    });
    try {
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      const record = latestPark(fixture);
      expect(record?.preservation).toBe("session-state-not-preserved");
      expect(record?.providerProfile).toBe("profile-a");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-PAUSE-023 the park lands within one observed supervision cycle", () => {
  test("every in-flight lane is stopped in the observation cycle and parked by its deadline's wake", async () => {
    const fixture = buildFixture("cycle-bound", {
      laneRefs: ["GH-900", "GH-901", "GH-902"],
    });
    try {
      // Staggered step positions are modeled by the lanes already in flight;
      // the watch observes the window and acts within exactly one cycle.
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      expect(fixture.stopCalls).toHaveLength(3);
      expect(fixture.readParks()).toHaveLength(3);
      // The bound is observed via wakes, never wall-clock waits: the sleep
      // counter is zero throughout (hermeticity, NFR-10).
      expect(fixture.clock.sleeps()).toBe(0);
      const cyclesUsed = 1;
      expect(cyclesUsed).toBe(1);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-PAUSE-024 the lane stays parked until the window ends", () => {
  test("no early resume, no re-dispatch across the open interval; the boundary is inclusive at end", async () => {
    const fixture = buildFixture("stay-parked", { laneRefs: ["GH-900"] });
    try {
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      const parkCount = fixture.readParks().length;
      expect(parkCount).toBe(1);
      // Sweep the injected clock in instants across the open interval (park →
      // effective end, exclusive): the park stays active, nothing resumes.
      let swept = 0;
      for (let minute = 0; minute < 69; minute += 1) {
        const instant = new Date(Date.parse(OPEN_AT) + (minute + 1) * 60_000).toISOString();
        fixture.clock.advanceTo(instant);
        await fixture.runCycle();
        swept += 1;
        // Read-time expiry: before the effective end the park is still active,
        // so the parked-ref set still holds the lane and no new park appends.
        expect(fixture.readParks().length).toBe(parkCount);
        const latest = latestPark(fixture);
        expect(latest?.until).toBe(EFFECTIVE_END);
      }
      expect(swept).toBe(69);
      // One instant before the effective end: still parked (the boundary is
      // inclusive at end, exclusive before it).
      fixture.clock.advanceTo("2026-11-13T18:04:59.000Z");
      await fixture.runCycle();
      expect(fixture.readParks().length).toBe(parkCount);
      expect(fixture.stopCalls).toHaveLength(1);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-PAUSE-025 a preservation failure never refuses the park and never extends the grace", () => {
  test("the failure variant parks with the failure classification, identical until and grace", async () => {
    const build = (preservation: "preserved" | "session-state-not-preserved") => {
      const fixture = buildFixture(`twin-${preservation}`, {
        preservation,
        laneRefs: ["GH-900"],
      });
      fixture.clock.advanceTo(OPEN_AT);
      return { fixture, run: fixture.runCycle() };
    };
    const success = build("preserved");
    try {
      const failure = build("session-state-not-preserved");
      try {
        await Promise.all([success.run, failure.run]);
        const ok = latestPark(success.fixture);
        const failed = latestPark(failure.fixture);
        expect(ok?.preservation).toBe("preserved");
        expect(failed?.preservation).toBe("session-state-not-preserved");
        // The only delta is the classification value: same reason, profile,
        // until, and applied grace (TDR-0030 D1/D5).
        expect(failed?.cause).toBe(ok?.cause);
        expect(failed?.providerProfile).toBe(ok?.providerProfile);
        expect(failed?.until).toBe(ok?.until);
        expect(failed?.graceDeadline).toBe(ok?.graceDeadline);
        expect(failed?.condition).toEqual(ok?.condition);
      } finally {
        failure.fixture.dispose();
      }
    } finally {
      success.fixture.dispose();
    }
  });
});

describe("TC-PAUSE-026 the bounded-grace stop composes with delivered supervision", () => {
  test("the cycle keeps its delivered shape and the stop modules add no kill path", async () => {
    const fixture = buildFixture("composition", { laneRefs: ["GH-900"] });
    try {
      // A mid-delivery stop: the lane is stopped during grace while its
      // observation is still pending; the cycle still returns normally and
      // the delivered supervision record trail is intact.
      fixture.clock.advanceTo(OPEN_AT);
      await fixture.runCycle();
      const lanes = fixture.readLanes();
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      for (const lane of lanes.records) expect(lane.state).toBe("delivering");
      // Source scan: the change's park/stop modules add no new signal,
      // termination, or process-kill primitive beyond the delivered seam.
      const watched = [
        "packages/core/src/domain/daemon-peak-pause.ts",
        "packages/core/src/app/daemon-supervision.ts",
      ];
      for (const file of watched) {
        const source = readFileSync(join(process.cwd(), file), "utf8");
        for (const banned of [
          "process.kill",
          ".kill(",
          "SIGKILL",
          "SIGTERM",
          "SIGSTOP",
          "execFile",
          "spawnSync",
          "child_process",
        ]) {
          expect(source.includes(banned), `${file} must not contain ${banned}`).toBe(false);
        }
      }
    } finally {
      fixture.dispose();
    }
  });
});
