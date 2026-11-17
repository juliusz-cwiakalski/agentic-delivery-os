/**
 * TC-SUP-104 — a lane already parked under another cause gains no second active
 * park and leaves healthy reads (GH-295 DEC-9(e), AC-F5-1, AC-F2-1, AC-F7-1).
 *
 * The occupancy judgement agrees with the delivered duplicate-active-park
 * validator, so an owner-hold, peak-window, or stuck clear-observed park is
 * respected instead of stacked and the append-only ledger stays readable.
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks } from "../../packages/core/src/app/index";
import { createComposedSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedLane,
  seedLaneRecord,
  staleClearObservedPark,
  stalledLaneParkedUnder,
} from "../fixtures/supervise/records";

type Envelope = {
  readonly exitCode: number;
  readonly data?: {
    readonly lanes?: readonly { readonly ref: string; readonly classification: string }[];
    readonly actions?: readonly { readonly kind: string; readonly ref?: string }[];
  };
};

const parkSnapshot = (harness: ReturnType<typeof createComposedSupervisionHarness>) => {
  const read = readQueueParks(harness.store);
  if (!read.ok) throw new Error("park read failed");
  const forRef = read.records.filter((record) => record.ref === LANE_REF);
  return {
    count: read.records.length,
    bytes: JSON.stringify(forRef),
  };
};

const economicsRestarts = (
  harness: ReturnType<typeof createComposedSupervisionHarness>,
): number => {
  const records = harness.store.readRecords();
  if (!records.ok) return -1;
  return records.value.records.filter((record) => record.kind === "economics.restart").length;
};

describe("TC-SUP-104 an existing active park of any cause is respected", () => {
  const cells = [
    {
      id: "owner-hold",
      seed: (h: ReturnType<typeof createComposedSupervisionHarness>) =>
        stalledLaneParkedUnder(h.seed, { cause: "owner-hold" }),
    },
    {
      id: "peak-window",
      seed: (h: ReturnType<typeof createComposedSupervisionHarness>) =>
        stalledLaneParkedUnder(h.seed, { cause: "peak-window" }),
    },
    {
      id: "stale-clear-observed",
      seed: (h: ReturnType<typeof createComposedSupervisionHarness>) =>
        staleClearObservedPark(h.seed),
    },
  ] as const;

  for (const cell of cells) {
    test(`${cell.id}: zero appends, honest report, healthy queue/lanes reads`, async () => {
      const harness = createComposedSupervisionHarness({ label: `park-state-${cell.id}` });
      try {
        cell.seed(harness);
        const before = parkSnapshot(harness);
        expect(before.count).toBeGreaterThanOrEqual(1);
        const run = await harness.run(["supervise", "--json"]);
        expect(run.exitCode).toBe(0);
        const envelope = JSON.parse(run.stdout) as Envelope;
        const data = envelope.data;
        expect(data).toBeDefined();
        if (data === undefined) return;
        // Honest classification: the lane is still stalled by its own evidence.
        expect(data.lanes?.map((lane) => lane.ref)).toEqual([LANE_REF]);
        expect(data.lanes?.[0]?.classification).toBe("stalled");
        // No fabricated park action: an existing occupied park is not stacked.
        expect(data.actions ?? []).toEqual([]);
        const after = parkSnapshot(harness);
        expect(after.count).toBe(before.count);
        expect(after.bytes).toBe(before.bytes);
        // Restart admission stays liveness-stall-only.
        expect(economicsRestarts(harness)).toBe(0);
        // Every delivered read stays healthy after the attempted action.
        const parks = readQueueParks(harness.store);
        expect(parks.ok).toBe(true);
        const queueList = await harness.run(["queue", "list", "--json"]);
        const lanesList = await harness.run(["lanes", "list", "--json"]);
        expect(queueList.exitCode).toBe(0);
        expect(lanesList.exitCode).toBe(0);
      } finally {
        harness.remove();
      }
    });
  }

  test("non-vacuity: the same stalled lane without a pre-existing park appends one", async () => {
    const harness = createComposedSupervisionHarness({ label: "park-state-control" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedLaneRecord(harness.seed, { ref: LANE_REF, offsetMs: -(300_000 + 5) });
      const run = await harness.run(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as Envelope).data;
      if (data === undefined) throw new Error("report data missing");
      expect(data.actions?.map((action) => action.kind)).toEqual(["supervised-stall-park"]);
      const parks = readQueueParks(harness.store);
      expect(parks.ok).toBe(true);
      if (parks.ok)
        expect(parks.records.filter((record) => record.ref === LANE_REF)).toHaveLength(1);
      const queueList = await harness.run(["queue", "list", "--json"]);
      const lanesList = await harness.run(["lanes", "list", "--json"]);
      expect(queueList.exitCode).toBe(0);
      expect(lanesList.exitCode).toBe(0);
    } finally {
      harness.remove();
    }
  });
});
