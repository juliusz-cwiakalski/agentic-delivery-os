/**
 * TC-SUP-092 — the failure-envelope and live-claims data goldens: the exit-2
 * evidence-absent envelope, the exit-1 per-action refusal envelope (no data, the
 * live claim and holder named), and the paired exit-0 live-claims data golden on
 * the same claim records (GH-295 AC-F2-1, AC-F6-1, AC-F8-1, DEC-6, DEC-8).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  actingAuthority,
  claimsOnly,
  LANE_REF,
  seedDaemonInstance,
  seedLane,
  stalledAndParked,
} from "../fixtures/supervise/records";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/supervise/golden");
const RUN_ID = "run-supervision-fixture";

type Envelope = {
  readonly runId: string;
  readonly exitCode: number;
  readonly timing: { readonly totalMs: number };
  readonly error?: { readonly code?: string; readonly summary?: string; readonly stack?: unknown };
  readonly data?: unknown;
};

const normalize = (text: string, root: string): Envelope => {
  const envelope = JSON.parse(text.split(root).join("<temp-root>")) as Envelope;
  return { ...envelope, runId: "<run-id>", timing: { totalMs: 0 } };
};

const golden = (name: string): Envelope =>
  JSON.parse(readFileSync(join(GOLDEN, `${name}.json`), "utf8")) as Envelope;

describe("TC-SUP-092 the three envelopes are exact and stable", () => {
  test("the evidence-absent golden is exact and stable at exit 2", async () => {
    const harness = createSupervisionHarness({ label: "golden-absent" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedDaemonInstance(harness.seed);
      const first = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      const second = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      expect(first.exitCode).toBe(2);
      const actual = normalize(first.stdout, harness.directory);
      expect(actual).toEqual(golden("supervision-evidence-absent"));
      expect(actual.data).toBeUndefined();
      expect(actual.error?.code).toBe("supervise.evidence-absent");
      expect(normalize(second.stdout, harness.directory)).toEqual(actual);
      expect(JSON.stringify(actual)).not.toContain(harness.directory);
      expect(JSON.stringify(actual)).not.toContain(" at ");
    } finally {
      harness.remove();
    }
  });

  test("the refusal golden is exact at exit 1 with the live claim and holder named", async () => {
    const harness = createSupervisionHarness({ label: "golden-refusal" });
    try {
      stalledAndParked(harness.seed);
      actingAuthority(harness.seed, { objectRef: LANE_REF });
      const run = await harness.runCli(["supervise", "--json"], {
        runId: RUN_ID,
        admitRestart: () => ({ outcome: "admit", restarts: 0 }),
      });
      expect(run.exitCode).toBe(1);
      const actual = normalize(run.stdout, harness.directory);
      expect(actual).toEqual(golden("supervision-refusal"));
      expect(actual.data).toBeUndefined();
      expect(actual.error?.code).toBe("supervise.duplicate-supervision");
      expect(actual.error?.summary ?? "").toContain("daemon-preemption");
      expect(actual.error?.summary ?? "").toContain("authority-holder");
      expect(actual.error?.stack).toBeUndefined();
    } finally {
      harness.remove();
    }
  });

  test("the paired live-claims golden proves presence refuses nothing at exit 0", async () => {
    const harness = createSupervisionHarness({ label: "golden-live-claims" });
    try {
      seedLane(harness.seed, LANE_REF);
      claimsOnly(harness.seed, { daemonLive: true, coordinatorLive: true });
      const run = await harness.runCli(["supervise", "--json"], { runId: RUN_ID });
      expect(run.exitCode).toBe(0);
      const actual = normalize(run.stdout, harness.directory);
      expect(actual).toEqual(golden("supervision-live-claims"));
      expect(actual.error).toBeUndefined();
      const data = actual.data as {
        supervisors: readonly { claimKind: string; holder?: string }[];
        lanes: readonly unknown[];
        counts: Record<string, number>;
      };
      expect(data.supervisors.map((claim) => claim.claimKind).sort()).toEqual([
        "coordinator-lease",
        "daemon-instance",
      ]);
      expect(data.supervisors.some((claim) => claim.holder === "coordinator-holder")).toBe(true);
      expect(data.counts.supervisors).toBe(data.supervisors.length);
    } finally {
      harness.remove();
    }
  });
});
