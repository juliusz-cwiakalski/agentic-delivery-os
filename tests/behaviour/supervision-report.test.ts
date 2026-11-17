/**
 * TC-SUP-001 / TC-SUP-004 — the seed SC-M2-S2-01 report and the report shape
 * over empty, single, and many-lane scopes (GH-295 AC-F1-1, DM-1, NFR-3,
 * NFR-6).
 */
import { describe, expect, test } from "bun:test";
import { SUPERVISION_REPORT_MEMBERS } from "../../packages/core/src/contracts/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedLiveLease,
} from "../fixtures/supervise/records";

type JsonEnvelope = {
  readonly exitCode: number;
  readonly data?: Record<string, unknown>;
};

describe("TC-SUP-001 the seed reports one lane's ref, heartbeat, and holder", () => {
  test("the machine report carries the scope key and the seeded lane facts", async () => {
    const harness = createSupervisionHarness({ label: "seed-01" });
    try {
      seedLane(harness.seed, LANE_REF);
      // Two deliberately different instants: the lane's own daemon lane record
      // observes at now-120s, the scope heartbeat at now-30s (F-6).
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -30_000 });
      seedLaneRecord(harness.seed, { offsetMs: -120_000, lastCompletedPhase: "4" });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as JsonEnvelope;
      const data = envelope.data;
      expect(data).toBeDefined();
      if (data === undefined) return;
      expect(data.schemaVersion).toBe("delivery.supervision.v1");
      expect(data.repo).toBe(harness.repository);
      const lanes = data.lanes as readonly Record<string, unknown>[];
      expect(lanes).toHaveLength(1);
      const lane = lanes[0] as Record<string, unknown>;
      expect(lane.ref).toBe(LANE_REF);
      expect(lane.heartbeat).toBe(new Date(harness.nowMs - 120_000).toISOString());
      expect(lane.heartbeat).not.toBe(new Date(harness.nowMs - 30_000).toISOString());
      expect(lane.holder).toBe("holder-a");
      expect(lane.classification).toBe("progressing");
      expect(Array.isArray(lane.evidence) && (lane.evidence as unknown[]).length > 0).toBe(true);
      // The lane's own observation is named as its source record kind.
      expect(
        (lane.evidence as readonly { recordKind?: string }[]).some(
          (item) => item.recordKind === "daemon.lane",
        ),
      ).toBe(true);
      const counts = data.counts as Record<string, number>;
      expect(counts.lanes).toBe(1);
      expect(counts.progressing).toBe(1);
      expect(data.actions).toEqual([]);
      expect(data.degraded).toContain("daemon-absent");
      // No fallback marker when the lane owns its observation.
      expect(data.degraded).not.toContain("artifact-source-absent");
      // One read fold per run.
      expect(harness.reads.count).toBe(1);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-004 the report shape is total over every population", () => {
  test("an empty readable scope carries the declared member set and zero counts", async () => {
    const harness = createSupervisionHarness({ label: "shape-empty" });
    try {
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      expect(data).toBeDefined();
      if (data === undefined) return;
      expect(Object.keys(data).sort()).toEqual([...SUPERVISION_REPORT_MEMBERS].sort());
      expect(data.lanes).toEqual([]);
      expect(data.supervisors).toEqual([]);
      expect(data.actions).toEqual([]);
      expect(data.truncated).toBe(false);
      expect(data).not.toHaveProperty("truncationReason");
      expect(data.counts).toEqual({
        lanes: 0,
        progressing: 0,
        stalled: 0,
        unknown: 0,
        supervisors: 0,
        actions: 0,
        parked: 0,
      });
      // The human render states the empty population, never "healthy".
      const human = await harness.runCli(["supervise"]);
      expect(human.stdout).toContain("no lanes and no supervision claims");
      expect(human.stdout.toLowerCase()).not.toContain("healthy");
    } finally {
      harness.remove();
    }
  });

  test("a many-lane scope keeps the member set and derives per-lane heartbeats and counts", async () => {
    const harness = createSupervisionHarness({ label: "shape-many" });
    try {
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      for (let index = 0; index < 12; index += 1) {
        const ref = `GH-${100 + index}`;
        seedLane(harness.seed, ref);
        if (index % 3 === 0) seedCommitEffect(harness.seed, { ref, offsetMs: -60_000 });
      }
      // Two advancing lanes own distinct observations; one stalled lane owns an
      // aged observation; one lane has no lane record at all (the fallback).
      seedLaneRecord(harness.seed, { ref: "GH-100", offsetMs: -60_000 });
      seedLaneRecord(harness.seed, { ref: "GH-103", offsetMs: -90_000 });
      seedLaneRecord(harness.seed, { ref: "GH-101", offsetMs: -(300_000 + 5) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as JsonEnvelope).data;
      if (data === undefined) throw new Error("report data missing");
      expect(Object.keys(data).sort()).toEqual([...SUPERVISION_REPORT_MEMBERS].sort());
      expect(data.lanes).toHaveLength(12);
      const lanes = data.lanes as readonly Record<string, unknown>[];
      const byRef = (ref: string) => lanes.find((lane) => lane.ref === ref);
      const scopeHeartbeat = new Date(harness.nowMs - (300_000 + 1)).toISOString();
      expect(byRef("GH-100")?.heartbeat).toBe(new Date(harness.nowMs - 60_000).toISOString());
      expect(byRef("GH-103")?.heartbeat).toBe(new Date(harness.nowMs - 90_000).toISOString());
      expect(byRef("GH-103")?.heartbeat).not.toBe(byRef("GH-100")?.heartbeat);
      expect(byRef("GH-102")?.heartbeat).toBe(scopeHeartbeat);
      expect(data.degraded).toContain("artifact-source-absent");
      const counts = data.counts as Record<string, number>;
      expect(counts.lanes).toBe(12);
      expect(counts.progressing + counts.stalled + counts.unknown).toBe(12);
      expect(counts.progressing).toBe(4);
      expect(counts.stalled).toBe(8);
      expect(data.truncated).toBe(false);
      expect(data).not.toHaveProperty("truncationReason");
    } finally {
      harness.remove();
    }
  });
});
