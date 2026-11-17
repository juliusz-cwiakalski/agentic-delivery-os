/**
 * TC-SUP-081 — one whole-store read fold per run independent of lane count, and
 * no per-lane re-read or second fold for the human projection (GH-295 NFR-4).
 */
import { describe, expect, test } from "bun:test";
import {
  type SupervisionEconomicsWritePort,
  readQueueParks,
  runSupervisionBattery,
} from "../../packages/core/src/app/index";
import {
  createSupervisionHarness,
  syntheticLaneSnapshot,
  syntheticReadPort,
} from "../fixtures/supervise/harness";
import {
  coordinatorClaim,
  daemonClaim,
  LANE_REF,
  seedCommitEffect,
  seedHeartbeat,
  seedLane,
  seedLaneBatch,
  seedLaneRecord,
  seedLivenessPark,
  seedRestart,
} from "../fixtures/supervise/records";

describe("TC-SUP-103 the action path consumes the one fold snapshot", () => {
  const fakeEconomics = (appends: string[]): SupervisionEconomicsWritePort => ({
    appendRestart: ({ ref }) => {
      appends.push(`restart:${ref}`);
      return { ok: true, appended: true };
    },
    ensureExhaustion: ({ ref }) => {
      appends.push(`exhaustion:${ref}`);
      return { ok: true, appended: true };
    },
    raiseQuestion: ({ ref }) => {
      appends.push(`question:${ref}`);
      return { ok: true, appended: true };
    },
  });

  const seedActingScope = (
    harness: ReturnType<typeof createSupervisionHarness>,
    laneCount: number,
  ): { parkedRestart: string; parkedExhausted: string } => {
    const refs = Array.from({ length: laneCount }, (_, index) => `GH-${1000 + index}`);
    seedLaneBatch(harness.seed, refs);
    const parkedRestart = refs[laneCount - 2] as string;
    const parkedExhausted = refs[laneCount - 1] as string;
    const stalls = new Set([
      refs[laneCount - 3],
      refs[laneCount - 4],
      parkedRestart,
      parkedExhausted,
    ]);
    for (const ref of refs) {
      seedLaneRecord(harness.seed, {
        ref,
        offsetMs: stalls.has(ref) ? -(300_000 + 5) : -60_000,
        ...(stalls.has(ref) ? {} : { lastCompletedPhase: "4" }),
      });
    }
    seedLivenessPark(harness.seed, {
      ref: parkedRestart,
      holder: `holder-${parkedRestart}`,
      untilOffsetMs: -1_000,
    });
    seedLivenessPark(harness.seed, {
      ref: parkedExhausted,
      holder: `holder-${parkedExhausted}`,
      untilOffsetMs: -1_000,
    });
    seedRestart(harness.seed, { ref: parkedRestart, ordinal: 1, offsetMs: -400_000 });
    daemonClaim(harness.seed, { live: true });
    coordinatorClaim(harness.seed, { live: true });
    return { parkedRestart, parkedExhausted };
  };

  test("50 and 200 acting lanes take exactly one whole-store read and act for real", () => {
    const counts: number[] = [];
    for (const laneCount of [50, 200]) {
      const harness = createSupervisionHarness({ label: `acting-read-cost-${laneCount}` });
      try {
        const { parkedRestart, parkedExhausted } = seedActingScope(harness, laneCount);
        const appends: string[] = [];
        let admissionRestarts = -1;
        const result = harness.battery({
          economicsWrite: fakeEconomics(appends),
          admitRestart: ({ ref, restarts }) => {
            if (ref === parkedRestart) {
              admissionRestarts = restarts.length;
              return { outcome: "admit", restarts: restarts.length };
            }
            if (ref === parkedExhausted) {
              return { outcome: "exhausted", restarts: 3 };
            }
            return undefined;
          },
        });
        expect(result.ok, `lanes ${laneCount}`).toBe(true);
        if (!result.ok) continue;
        const readCount = harness.storeReads.count;
        const readCalls = [...harness.storeReads.calls];
        // Non-vacuity: the run parked, restarted, exhausted, and classified claims.
        const kinds = result.report.actions.map((action) => action.kind);
        expect(kinds.filter((kind) => kind === "supervised-stall-park")).toHaveLength(2);
        expect(kinds).toContain("restart-admission");
        expect(kinds).toContain("exhaustion-record");
        expect(
          result.report.supervisors.some((claim) => claim.claimKind === "daemon-instance"),
        ).toBe(true);
        expect(appends).toContain(`restart:${parkedRestart}`);
        expect(appends).toContain(`exhaustion:${parkedExhausted}`);
        expect(admissionRestarts).toBe(1);
        const parks = readQueueParks(harness.store);
        expect(parks.ok).toBe(true);
        if (parks.ok) expect(parks.records).toHaveLength(4);
        // One whole-store read for a run that acts, independent of lane count.
        expect(readCount, JSON.stringify(readCalls, null, 2)).toBe(1);
        expect(readCalls.every((call) => call.scope === "whole-store")).toBe(true);
        expect(
          readCalls.some(
            (call) =>
              call.site.includes("readEconomicsRecords") ||
              call.site.includes("claimSingleFlightRefusal"),
          ),
        ).toBe(false);
        counts.push(readCount);
      } finally {
        harness.remove();
      }
    }
    // The count does not scale with the lane population.
    expect(new Set(counts)).toEqual(new Set([1]));
  }, 30_000);
});

describe("TC-SUP-081 one read pass per run", () => {
  test("50 and 200 lanes both take exactly one read pass", () => {
    for (const laneCount of [50, 200]) {
      const reads = { count: 0 };
      const result = runSupervisionBattery({
        repository: "github.com/example/supervision-repo",
        nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
        nowIso: "2026-11-17T00:00:00.000Z",
        runId: "run-supervision-fixture",
        read: syntheticReadPort(
          syntheticLaneSnapshot("github.com/example/supervision-repo", laneCount),
          reads,
        ),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.report.lanes).toHaveLength(laneCount);
      expect(reads.count).toBe(1);
    }
  });

  test("the human projection adds no fold", async () => {
    const harness = createSupervisionHarness({ label: "read-cost-human" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      const run = await harness.runCli(["supervise"]);
      expect(run.exitCode).toBe(0);
      expect(harness.reads.count).toBe(1);
    } finally {
      harness.remove();
    }
  });

  test("a per-lane read mutant scales with the lane count, so the counter is sensitive", () => {
    const reads = { count: 0 };
    const inner = syntheticReadPort(
      syntheticLaneSnapshot("github.com/example/supervision-repo", 10),
      reads,
    );
    const mutant = {
      read: (request: { readonly repository: string; readonly nowMs: number }) => {
        const snapshot = inner.read(request);
        for (let index = 0; index < 10; index += 1) inner.read(request);
        return snapshot;
      },
    };
    const result = runSupervisionBattery({
      repository: "github.com/example/supervision-repo",
      nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
      nowIso: "2026-11-17T00:00:00.000Z",
      runId: "run-supervision-fixture",
      read: mutant,
    });
    expect(result.ok).toBe(true);
    expect(reads.count).toBeGreaterThan(1);
  });
});
