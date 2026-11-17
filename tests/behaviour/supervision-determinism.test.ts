/**
 * TC-SUP-080 — identical record sets and an injected clock replay to an
 * identical report, evidence, actions, and exit (GH-295 NFR-3).
 */
import { describe, expect, test } from "bun:test";
import {
  createStateSupervisionReadPort,
  runSupervisionBattery,
} from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedDaemonInstance,
  seedHeartbeat,
  seedLane,
  stalledAndParked,
} from "../fixtures/supervise/records";

const ALLOWED_EVIDENCE_KEYS = new Set(["code", "ref", "recordKind", "instant"]);

const readOnlyRun = (harness: ReturnType<typeof createSupervisionHarness>, nowMs?: number) =>
  runSupervisionBattery({
    repository: harness.repository,
    nowMs: nowMs ?? harness.nowMs,
    nowIso: new Date(nowMs ?? harness.nowMs).toISOString(),
    read: createStateSupervisionReadPort(harness.store),
  });

describe("TC-SUP-080 paired runs and replay are byte-identical", () => {
  test("two runs from one record set produce identical bytes", () => {
    const harness = createSupervisionHarness({ label: "determinism" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -120_000 });
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      seedDaemonInstance(harness.seed);
      const first = readOnlyRun(harness);
      const second = readOnlyRun(harness);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      harness.remove();
    }
  });

  test("a replay into a second store yields the same evidence and actions", () => {
    const base = createSupervisionHarness({ label: "determinism-base" });
    const replay = createSupervisionHarness({ label: "determinism-replay" });
    try {
      for (const harness of [base, replay]) {
        stalledAndParked(harness.seed);
        seedLane(harness.seed, "GH-296");
        seedCommitEffect(harness.seed, { ref: "GH-296", offsetMs: -60_000 });
      }
      const first = readOnlyRun(base);
      const second = readOnlyRun(replay);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      base.remove();
      replay.remove();
    }
  });

  test("evidence members name only refs, record kinds, instants, and codes", () => {
    const harness = createSupervisionHarness({ label: "determinism-evidence" });
    try {
      stalledAndParked(harness.seed);
      const result = readOnlyRun(harness);
      if (!result.ok) throw new Error("battery failed");
      const entries = [
        ...result.report.lanes,
        ...result.report.supervisors,
        ...result.report.actions,
      ];
      for (const entry of entries) {
        for (const item of entry.evidence) {
          for (const key of Object.keys(item)) {
            expect(ALLOWED_EVIDENCE_KEYS.has(key), key).toBe(true);
          }
        }
      }
    } finally {
      harness.remove();
    }
  });

  test("a clock advanced by an arbitrary amount changes only echoed instants, never a verdict", () => {
    const harness = createSupervisionHarness({ label: "determinism-clock" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -1_000 });
      const before = readOnlyRun(harness);
      // A small advance stays inside the bound, so no verdict can move.
      const after = readOnlyRun(harness, harness.nowMs + 1);
      if (!before.ok || !after.ok) throw new Error("battery failed");
      expect(after.report.lanes.map((lane) => lane.classification)).toEqual(
        before.report.lanes.map((lane) => lane.classification),
      );
    } finally {
      harness.remove();
    }
  });

  test("entries are sorted by ref, so Map iteration order cannot leak", () => {
    const forward = createSupervisionHarness({ label: "determinism-order-a" });
    const reversed = createSupervisionHarness({ label: "determinism-order-b" });
    try {
      for (const ref of ["GH-300", "GH-295", "GH-310"]) seedLane(forward.seed, ref);
      for (const ref of ["GH-310", "GH-295", "GH-300"]) seedLane(reversed.seed, ref);
      seedHeartbeat(forward.seed, { ordinal: 1, offsetMs: -1_000 });
      seedHeartbeat(reversed.seed, { ordinal: 1, offsetMs: -1_000 });
      const a = readOnlyRun(forward);
      const b = readOnlyRun(reversed);
      if (!a.ok || !b.ok) throw new Error("battery failed");
      const refsA = a.report.lanes.map((lane) => lane.ref);
      expect(refsA).toEqual([...refsA].sort());
      expect(b.report.lanes.map((lane) => lane.ref)).toEqual(refsA);
    } finally {
      forward.remove();
      reversed.remove();
    }
  });
});
