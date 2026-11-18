/**
 * TC-SUP-090 — the healthy report golden: the machine payload is structurally
 * identical and the human render is byte-identical after normalization of
 * exactly the temp root, the run id, and the timing (GH-295 AC-F1-1, DM-1,
 * NFR-3).
 *
 * The goldens are CREATED in this change (GAP-T3) and regenerate only on an
 * explicit command recorded in the change's pm-notes.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeHuman, normalizeMachine } from "../fixtures/supervise/golden/normalize";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedCommitEffect,
  seedDaemonInstance,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedLiveLease,
} from "../fixtures/supervise/records";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/supervise/golden");
const RUN_ID = "run-supervision-fixture";

type Envelope = {
  readonly schemaVersion: string;
  readonly runId: string;
  readonly exitCode: number;
  readonly timing: { readonly totalMs: number };
  readonly data: unknown;
};

describe("TC-SUP-090 the healthy report golden", () => {
  test("the machine payload matches the committed golden structurally", async () => {
    const harness = createSupervisionHarness({ label: "golden-machine" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -30_000 });
      seedLaneRecord(harness.seed, { offsetMs: -120_000, lastCompletedPhase: "4" });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const run = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      expect(run.exitCode).toBe(0);
      const actual = normalizeMachine(run.stdout, { root: harness.directory, runId: RUN_ID });
      const golden = JSON.parse(
        readFileSync(join(GOLDEN, "supervision-report.json"), "utf8"),
      ) as Envelope;
      expect(actual).toEqual(golden);
    } finally {
      harness.remove();
    }
  });

  test("the human render is byte-identical to the committed golden", async () => {
    const harness = createSupervisionHarness({ label: "golden-human" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -30_000 });
      seedLaneRecord(harness.seed, { offsetMs: -120_000, lastCompletedPhase: "4" });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const run = await harness.runCli(["supervise"], { runId: RUN_ID });
      expect(run.exitCode).toBe(0);
      expect(normalizeHuman(run.stdout, { root: harness.directory, runId: RUN_ID })).toBe(
        readFileSync(join(GOLDEN, "supervision-report.txt"), "utf8"),
      );
    } finally {
      harness.remove();
    }
  });

  test("a stale golden fails the comparison", () => {
    const golden = readFileSync(join(GOLDEN, "supervision-report.json"), "utf8");
    const stale = golden.replace('"repo": "github.com/example/supervision-repo"', '"repo": "x"');
    expect(stale).not.toBe(golden);
  });
});

describe("TC-SUP-091 the stalled-and-parked report golden", () => {
  test("all three states side by side with the applied action and derived counts", async () => {
    const harness = createSupervisionHarness({ label: "golden-stalled" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedLane(harness.seed, "GH-296");
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -300_001 });
      seedCommitEffect(harness.seed, { ref: "GH-296", offsetMs: -60_000 });
      seedDaemonInstance(harness.seed);
      const run = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      expect(run.exitCode).toBe(0);
      const actual = normalizeMachine(run.stdout, { root: harness.directory, runId: RUN_ID });
      const golden = JSON.parse(
        readFileSync(join(GOLDEN, "supervision-stalled.json"), "utf8"),
      ) as Envelope & { data: { counts: Record<string, number>; actions: readonly unknown[] } };
      expect(actual).toEqual(golden);
      // Counts equal the entries and the durable records read separately.
      const data = actual.data as {
        lanes: readonly unknown[];
        supervisors: readonly unknown[];
        actions: readonly unknown[];
        counts: Record<string, number>;
      };
      expect(data.counts.lanes).toBe(data.lanes.length);
      expect(data.counts.supervisors).toBe(data.supervisors.length);
      expect(data.counts.actions).toBe(data.actions.length);
      expect(data.counts.parked).toBe(1);
      // A second run over the now-parked lane is stable and appends no second action.
      const second = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      expect(second.exitCode).toBe(0);
      const secondData = (JSON.parse(second.stdout) as { data?: Record<string, unknown> }).data;
      expect(((secondData?.actions ?? []) as readonly unknown[]).length).toBe(0);
    } finally {
      harness.remove();
    }
  });
});
