/**
 * TC-SUP-081 — one whole-store read fold per run independent of lane count, and
 * no per-lane re-read or second fold for the human projection (GH-295 NFR-4).
 */
import { describe, expect, test } from "bun:test";
import { runSupervisionBattery } from "../../packages/core/src/app/index";
import {
  createSupervisionHarness,
  syntheticLaneSnapshot,
  syntheticReadPort,
} from "../fixtures/supervise/harness";
import { LANE_REF, seedCommitEffect, seedHeartbeat, seedLane } from "../fixtures/supervise/records";

describe("TC-SUP-081 one read pass per run", () => {
  test("50 and 200 lanes both take exactly one read pass", () => {
    for (const laneCount of [50, 200]) {
      const reads = { count: 0 };
      const result = runSupervisionBattery({
        repository: "github.com/example/supervision-repo",
        nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
        nowIso: "2026-11-17T00:00:00.000Z",
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
      read: mutant,
    });
    expect(result.ok).toBe(true);
    expect(reads.count).toBeGreaterThan(1);
  });
});
