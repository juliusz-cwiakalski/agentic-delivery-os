/**
 * TC-SUP-105 — one composed-production acting run parks, restarts, and exhausts
 * through the shared closure factory with the declared read discipline
 * (GH-295 AC-F5-1, AC-F6-1, AC-F7-1, NFR-4, NFR-7, §22).
 */
import { describe, expect, test } from "bun:test";
import {
  SUPERVISION_EXHAUSTION_QUESTION_OPTIONS,
  supervisionExhaustionQuestionId,
} from "../../packages/cli/src/production";
import { readQueueParks } from "../../packages/core/src/app/index";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { createComposedSupervisionHarness } from "../fixtures/supervise/harness";
import {
  coordinatorClaim,
  daemonClaim,
  seedLane,
  seedLaneRecord,
  seedLivenessPark,
  seedRestart,
} from "../fixtures/supervise/records";

type Envelope = {
  readonly runId: string;
  readonly exitCode: number;
  readonly data?: {
    readonly repo?: string;
    readonly actions?: readonly { readonly kind: string; readonly ref?: string }[];
  };
};

describe("TC-SUP-105 the composed production acting run", () => {
  test("park, restart, and exhaustion land through the production wiring", async () => {
    const harness = createComposedSupervisionHarness({ label: "composed-acting" });
    try {
      const parkRef = "GH-2010";
      const restartRef = "GH-2011";
      const exhaustedRef = "GH-2012";
      for (const ref of [parkRef, restartRef, exhaustedRef]) seedLane(harness.seed, ref);
      // All three are corroborated stalls by their own observation.
      for (const ref of [parkRef, restartRef, exhaustedRef]) {
        seedLaneRecord(harness.seed, { ref, offsetMs: -(300_000 + 5) });
      }
      seedLivenessPark(harness.seed, {
        ref: restartRef,
        holder: `holder-${restartRef}`,
        untilOffsetMs: -1_000,
      });
      seedLivenessPark(harness.seed, {
        ref: exhaustedRef,
        holder: `holder-${exhaustedRef}`,
        untilOffsetMs: -1_000,
      });
      seedRestart(harness.seed, { ref: restartRef, ordinal: 1, offsetMs: -400_000 });
      for (const ordinal of [1, 2, 3]) {
        seedRestart(harness.seed, {
          ref: exhaustedRef,
          ordinal,
          offsetMs: -400_000 - ordinal * 1_000,
        });
      }
      daemonClaim(harness.seed, { live: true });
      coordinatorClaim(harness.seed, { live: true });

      const run = await harness.run(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as Envelope;
      const data = envelope.data;
      expect(data).toBeDefined();
      if (data === undefined) return;
      expect(data.repo).toBe(harness.seed.repository);
      const kinds = (data.actions ?? []).map((action) => action.kind);
      expect(kinds).toContain("supervised-stall-park");
      expect(kinds).toContain("restart-admission");
      expect(kinds).toContain("exhaustion-record");

      // Durable outcomes: one new liveness-stall park, one new restart for the
      // restart lane, one terminal exhaustion record, one ref-stable question.
      const parks = readQueueParks(harness.store);
      expect(parks.ok).toBe(true);
      if (parks.ok) {
        expect(parks.records.filter((record) => record.ref === parkRef)).toHaveLength(1);
        expect(parks.records.filter((record) => record.ref === restartRef)).toHaveLength(1);
        expect(parks.records.filter((record) => record.ref === exhaustedRef)).toHaveLength(1);
      }
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      const restarts = records.value.records.filter(
        (record) => record.kind === "economics.restart",
      );
      const restartPayloads = restarts.map((record) => JSON.stringify(record.payload));
      expect(restartPayloads.some((payload) => payload.includes('"runId":"run-gh288-1"'))).toBe(
        true,
      );
      const exhaustion = records.value.records.filter(
        (record) => record.kind === "economics.budget-exhaustion",
      );
      expect(exhaustion).toHaveLength(1);
      expect(JSON.stringify(exhaustion[0]?.payload)).toContain('"runId":"run-gh288-1"');
      const ledger = readBlockerLedger(harness.store);
      if (!ledger.ok) throw new Error("blocker ledger read failed");
      expect(ledger.value.questions).toHaveLength(1);
      expect(ledger.value.questions[0]?.id).toBe(supervisionExhaustionQuestionId(exhaustedRef));
      expect(ledger.value.questions[0]?.options).toEqual([
        ...SUPERVISION_EXHAUSTION_QUESTION_OPTIONS,
      ]);

      // The same precise read discipline as TC-SUP-103, over the production run.
      const readCalls = [...harness.reads.calls];
      const decisionReads = readCalls.filter((call) => {
        const first = call.site.split(" | ")[0] ?? "";
        return first.startsWith("at read (") && first.includes("/app/supervise.");
      });
      expect(decisionReads, JSON.stringify(readCalls, null, 2)).toHaveLength(1);
      expect(readCalls.some((call) => call.site.includes("claimSingleFlightRefusal"))).toBe(false);
      const economicsReads = readCalls.filter((call) => call.site.includes("readEconomicsRecords"));
      // The delivered append helpers (restart/exhaustion) keep their own
      // read-then-verify; no decision closure re-reads the ledger.
      expect(economicsReads).toHaveLength(4);
      expect(
        economicsReads.every(
          (call) => call.site.includes("appendRestart") || call.site.includes("ensureExhaustion"),
        ),
      ).toBe(true);
      expect(
        readCalls.filter((call) => call.site.includes("readBlockerLedger")).length,
      ).toBeLessThanOrEqual(1);
      const appendBacks = readCalls.filter(
        (call) => call.site.includes("/state/economics.") || call.site.includes("/state/blockers."),
      );
      expect(readCalls.length).toBe(1 + appendBacks.length);

      // Post-run health: delivered park, queue, and lanes reads all succeed.
      const parkRead = readQueueParks(harness.store);
      expect(parkRead.ok).toBe(true);
      const queueList = await harness.run(["queue", "list", "--json"]);
      const lanesList = await harness.run(["lanes", "list", "--json"]);
      expect(queueList.exitCode).toBe(0);
      expect(lanesList.exitCode).toBe(0);
    } finally {
      harness.remove();
    }
  }, 30_000);
});
