/**
 * TC-SUP-002 — the report names no repository other than its own scope key
 * (GH-295 AC-F1-1, NG-5). The control run with the foreign scope key proves the
 * scope predicate is what excludes the foreign records.
 */
import { describe, expect, test } from "bun:test";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedForeignLane,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedLiveLease,
} from "../fixtures/supervise/records";

const FOREIGN_KEY = "github.com/other/repo";
const FOREIGN_REF = "OTHER-777";
const FOREIGN_HOLDER = "foreign-holder";

describe("TC-SUP-002 scope purity", () => {
  test("the foreign repository key, refs, and holders appear in neither projection", async () => {
    const harness = createSupervisionHarness({ label: "scope" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      seedLaneRecord(harness.seed, { offsetMs: -60_000, lastCompletedPhase: "4" });
      seedForeignLane(harness.seed, { ref: FOREIGN_REF, repository: FOREIGN_KEY });
      seedLiveLease(harness.seed, { ref: FOREIGN_REF, holder: FOREIGN_HOLDER });
      const machine = await harness.runCli(["supervise", "--json"]);
      const human = await harness.runCli(["supervise"]);
      expect(machine.exitCode).toBe(0);
      expect(human.exitCode).toBe(0);
      const data = (JSON.parse(machine.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      expect(data.repo).toBe(harness.repository);
      const lanes = data.lanes as readonly Record<string, unknown>[];
      expect(lanes).toHaveLength(1);
      expect(lanes[0]?.ref).toBe(LANE_REF);
      for (const text of [machine.stdout, human.stdout]) {
        expect(text).not.toContain(FOREIGN_KEY);
        expect(text).not.toContain(FOREIGN_REF);
        expect(text).not.toContain(FOREIGN_HOLDER);
      }
      // The scope's own records only: counts equal the scoped population.
      expect((data.counts as Record<string, number>).lanes).toBe(1);
    } finally {
      harness.remove();
    }
  });

  test("the control run for the foreign key selects the foreign records only", async () => {
    // The same fold with the foreign scope key proves the predicate is active:
    // without it, the invoking run would have named the foreign key.
    const harness = createSupervisionHarness({ label: "scope-control" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      seedLaneRecord(harness.seed, { offsetMs: -60_000, lastCompletedPhase: "4" });
      seedForeignLane(harness.seed, { ref: FOREIGN_REF, repository: FOREIGN_KEY });
      const run = await harness.runCli(["supervise", "--json"], { repository: FOREIGN_KEY });
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      expect(data.repo).toBe(FOREIGN_KEY);
      const lanes = data.lanes as readonly Record<string, unknown>[];
      expect(lanes.map((lane) => lane.ref)).toEqual([FOREIGN_REF]);
    } finally {
      harness.remove();
    }
  });
});
