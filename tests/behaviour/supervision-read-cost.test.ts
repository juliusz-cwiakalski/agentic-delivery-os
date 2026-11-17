/**
 * TC-SUP-081 — one whole-store read fold per run independent of lane count, and
 * no per-lane re-read or second fold for the human projection (GH-295 NFR-4).
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks, runSupervisionBattery } from "../../packages/core/src/app/index";
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

/** NFR-5 wall-clock bound; measured on the battery call only, never on fixture setup. */
const NFR5_BATTERY_BOUND_MS = 5_000;

describe("TC-SUP-103 the decision path is one fold over the composed closures", () => {
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

  // The 90 s timeout is a hang guard sized to the composed 200-lane fixture, not a
  // latency target; NFR-5 is measured on the battery call below.
  test("50 and 200 acting lanes: one decision fold, no per-lane re-read, bounded append read-backs", () => {
    const totals: number[] = [];
    for (const laneCount of [50, 200]) {
      const harness = createSupervisionHarness({ label: `acting-read-cost-${laneCount}` });
      try {
        const { parkedRestart, parkedExhausted } = seedActingScope(harness, laneCount);
        let admissionRestarts = -1;
        // No store-free fake here: the composed production closure factory runs.
        // The NFR-5 clock wraps the battery call only; harness creation and
        // fixture seeding are excluded because they are not the measured work.
        const batteryStarted = performance.now();
        const result = harness.battery({
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
        const batteryElapsedMs = performance.now() - batteryStarted;
        expect(result.ok, `lanes ${laneCount}`).toBe(true);
        if (!result.ok) continue;
        if (laneCount === 200) {
          expect(
            batteryElapsedMs,
            `battery 200 lanes measured ${batteryElapsedMs.toFixed(1)} ms`,
          ).toBeLessThan(NFR5_BATTERY_BOUND_MS);
        }
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
        expect(admissionRestarts).toBe(1);
        const parks = readQueueParks(harness.store);
        expect(parks.ok).toBe(true);
        if (parks.ok) expect(parks.records).toHaveLength(4);

        // (1) Exactly one decision-path fold read.
        const decisionReads = readCalls.filter((call) => {
          const first = call.site.split(" | ")[0] ?? "";
          return first.startsWith("at read (") && first.includes("/app/supervise.");
        });
        expect(decisionReads, JSON.stringify(readCalls, null, 2)).toHaveLength(1);
        // (2) No per-lane whole-store re-read: the removed per-lane closures never
        // appear, and the blocker ledger is read at most once per run.
        expect(readCalls.some((call) => call.site.includes("claimSingleFlightRefusal"))).toBe(
          false,
        );
        const economicsReads = readCalls.filter((call) =>
          call.site.includes("readEconomicsRecords"),
        );
        // The delivered append helpers (restart/exhaustion) keep their own
        // read-then-verify; no decision closure re-reads the ledger.
        expect(economicsReads).toHaveLength(4);
        expect(
          economicsReads.every(
            (call) => call.site.includes("appendRestart") || call.site.includes("ensureExhaustion"),
          ),
        ).toBe(true);
        const blockerReads = readCalls.filter((call) => call.site.includes("readBlockerLedger"));
        expect(blockerReads.length).toBeLessThanOrEqual(1);
        // (3) Every remaining read is a delivered append-helper read-back.
        const appendBacks = readCalls.filter(
          (call) =>
            call.site.includes("/state/economics.") || call.site.includes("/state/blockers."),
        );
        expect(appendBacks.length).toBe(readCount - 1);
        // The measured total is declared, not a bare 1 (DEC-9(d)).
        expect(readCount).toBe(1 + appendBacks.length);
        expect(readCount).toBeLessThanOrEqual(8);
        totals.push(readCount);
      } finally {
        harness.remove();
      }
    }
    // The decision and append-read-back budget is flat against lane count.
    expect(new Set(totals).size).toBe(1);
  }, 90_000);
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
