/**
 * TC-SUP-020 / TC-SUP-022 — lying liveness: advancing heartbeats over a flat
 * artifact trail reads `stalled` and is parked; advancing artifacts keep the
 * lane `progressing` regardless of any out-of-shape fixture (GH-295 AC-F3-1,
 * DEC-4, NFR-1, NFR-2).
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks } from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
} from "../fixtures/supervise/records";

const parkCount = (harness: ReturnType<typeof createSupervisionHarness>): number => {
  const parks = readQueueParks(harness.store);
  return parks.ok ? parks.records.length : -1;
};

describe("TC-SUP-020 a lying lane reads stalled by artifact evidence alone", () => {
  test("advancing heartbeats over a flat trail classify stalled and the lane is parked", async () => {
    const harness = createSupervisionHarness({ label: "lying-lane" });
    try {
      seedLane(harness.seed, LANE_REF);
      // The heartbeat trail advances to now, but the only artifact is older
      // than the observation span: the artifact trail is flat.
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -400_000 });
      seedHeartbeat(harness.seed, { ordinal: 2, offsetMs: -200_000 });
      seedHeartbeat(harness.seed, { ordinal: 3, offsetMs: -1_000 });
      seedLaneRecord(harness.seed, { offsetMs: -400_000, state: "delivering" });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const lane = (data.lanes as readonly Record<string, unknown>[])[0];
      expect(lane?.classification).toBe("stalled");
      const codes = ((lane?.evidence ?? []) as readonly { code: string }[]).map(
        (item) => item.code,
      );
      expect(codes).toContain("artifact-flat");
      expect(parkCount(harness)).toBe(1);
      expect((data.actions as readonly unknown[]).length).toBe(1);
    } finally {
      harness.remove();
    }
  });

  test("heartbeat freshness alone never decides the verdict", async () => {
    // The control: a fresh heartbeat with no spanning trail reads progressing.
    const harness = createSupervisionHarness({ label: "lying-control" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -1_000 });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      expect((data.lanes as readonly Record<string, unknown>[])[0]?.classification).toBe(
        "progressing",
      );
      expect(parkCount(harness)).toBe(0);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-022 advancing artifacts defeat any out-of-shape reading", () => {
  test("paired runs over advancing lanes are byte-identical and park nothing", async () => {
    const base = createSupervisionHarness({ label: "advancing-base" });
    const control = createSupervisionHarness({ label: "advancing-control" });
    try {
      for (const harness of [base, control]) {
        seedLane(harness.seed, LANE_REF);
        seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
        seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      }
      // The control adds an out-of-shape fixture (a record kind the
      // classification shape does not declare); the verdict cannot move.
      const fenced = control.store.acquireFence("noise-fixture");
      if (!fenced.ok) throw new Error("noise fixture fence failed");
      control.store.append(fenced.value.handle, {
        kind: "queue.incident",
        recordKey: "queue.incidents:noise",
        payload: { noise: true },
      });
      control.store.releaseFence(fenced.value.handle);
      const baseRun = await base.runCli(["supervise", "--json"]);
      const controlRun = await control.runCli(["supervise", "--json"]);
      expect(baseRun.exitCode).toBe(0);
      expect(controlRun.exitCode).toBe(0);
      const parse = (text: string) =>
        JSON.parse(
          text.replaceAll(base.directory, "<root>").replaceAll(control.directory, "<root>"),
        ) as {
          data?: Record<string, unknown>;
        };
      const baseData = parse(baseRun.stdout).data;
      const controlData = parse(controlRun.stdout).data;
      expect(baseData?.lanes).toEqual(controlData?.lanes);
      const baseLanes = (baseData?.lanes ?? []) as readonly Record<string, unknown>[];
      expect(baseLanes[0]?.classification).toBe("progressing");
      expect(parkCount(base)).toBe(0);
      expect(parkCount(control)).toBe(0);
    } finally {
      base.remove();
      control.remove();
    }
  });
});
