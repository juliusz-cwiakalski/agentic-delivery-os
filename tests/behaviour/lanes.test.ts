/**
 * TC-LANES-001..006 (GH-237) — the lane view is a pure, bounded fold with a
 * closed state, bounded idle reasons, lease evidence, economics, and truthful
 * degradation; `--watch` is refused and an unreadable store is exit 2.
 */
import { describe, expect, test } from "bun:test";
import {
  createLanesCommandDefinition,
  type LanesCommandRuntime,
} from "../../packages/cli/src/commands/lanes";
import {
  QUEUE_LANES_SCHEMA_VERSION,
  type DaemonLaneRecord,
  type QueueLanesData,
} from "../../packages/core/src/contracts/index";
import { foldLanes, selectLane } from "../../packages/core/src/domain/index";
import { computeQueueSchedule } from "../../packages/core/src/domain/queue-precedence";
import { createQueueEdgeHarness, trackingStore } from "../fixtures/queue/cli/harness";
import { laneData, laneFacts } from "../fixtures/queue/lanes/harness";
import { runProgram } from "../fixtures/queue-ready/harness";

const runtime = (
  read: () => ReturnType<LanesCommandRuntime["readLanes"]>,
): LanesCommandRuntime => ({
  readLanes: read,
});

const runLanes = async (
  argv: readonly string[],
  data: QueueLanesData,
): Promise<{ exitCode: number; stdout: string }> =>
  runProgram(argv, {
    commands: { lanes: createLanesCommandDefinition(runtime(() => ({ ok: true, data }))) },
  });

describe("TC-LANES-001 the full lane contract with no fabricated values", () => {
  test("a delivering, a quota-parked, and a failed lane report identity, state, reason, lease, economics, and weight", () => {
    const data = laneData();
    expect(data.schemaVersion).toBe(QUEUE_LANES_SCHEMA_VERSION);
    const delivering = data.lanes.find((lane) => lane.ref === "GH-320");
    expect(delivering).toMatchObject({
      id: "GH-320",
      state: "delivering",
      weightClass: "standard",
      restarts: 1,
      amplification: 2,
    });
    expect(delivering?.lease).toBeDefined();
    expect(delivering?.leaseScope).toBe("repo-exclusive");

    const parked = data.lanes.find((lane) => lane.ref === "GH-321");
    expect(parked?.state).toBe("parked");
    expect(parked?.reason).toBe("parked:provider-quota");
    expect(parked?.amplificationWarning).toBe("economics-underivable");

    const failed = data.lanes.find((lane) => lane.ref === "GH-322");
    expect(failed?.state).toBe("failed");
    expect(failed?.reason).toBe("restart-budget-exhausted");

    for (const lane of data.lanes) {
      expect([
        "delivering",
        "idle-with-reason",
        "parked",
        "merge-ready",
        "in-review",
        "failed",
      ]).toContain(lane.state);
      if (lane.reason !== undefined) {
        expect(lane.reason).toMatch(/^[a-z][a-z0-9:-]*$/);
      }
    }
  });

  test("an underivable restart count and amplification are null with a warning, never zero", () => {
    const data = laneData({
      economics: { "GH-320": { restarts: null, amplification: null } },
    });
    const lane = data.lanes.find((candidate) => candidate.ref === "GH-320");
    expect(lane?.restarts).toBeNull();
    expect(lane?.amplification).toBeNull();
    expect(lane?.amplificationWarning).toBe("economics-underivable");
  });

  test("the fold is pure and leaves the real injected facts and schedule untouched", () => {
    const input = laneFacts();
    const schedule = computeQueueSchedule(input.facts, { next: 20 });
    const snapshot = JSON.stringify({ facts: input.facts, schedule, economics: input.economics });
    const data = foldLanes({ schedule, economics: input.economics, degraded: input.degraded });
    expect(data.lanes.length).toBeGreaterThan(0);
    expect(JSON.stringify({ facts: input.facts, schedule, economics: input.economics })).toBe(
      snapshot,
    );
  });
});

describe("TC-LANES-002 show returns one lane and classifies an unobserved ref", () => {
  test("show selects the named lane", async () => {
    const data = laneData();
    const run = await runLanes(["lanes", "show", "GH-320", "--json"], data);
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { data: QueueLanesData };
    expect(envelope.data.lanes.map((lane) => lane.ref)).toEqual(["GH-320"]);
    expect(selectLane(envelope.data, "GH-320")?.state).toBe("delivering");
  });

  test("an unobserved ref is queue.entry.unobserved at exit 1", async () => {
    const data = laneData();
    const run = await runLanes(["lanes", "show", "GH-999", "--json"], data);
    expect(run.exitCode).toBe(1);
    const envelope = JSON.parse(run.stdout) as { error?: { code?: string }; data?: unknown };
    expect(envelope.error?.code).toBe("queue.entry.unobserved");
    expect(envelope.data).toBeUndefined();
  });
});

describe("TC-LANES-003 restart count and amplification come from economics", () => {
  test("values ride through unchanged and null carries the warning", () => {
    const data = laneData();
    expect(data.lanes.find((lane) => lane.ref === "GH-320")).toMatchObject({
      restarts: 1,
      amplification: 2,
    });
    expect(data.lanes.find((lane) => lane.ref === "GH-321")?.restarts).toBeNull();
  });
});

describe("TC-LANES-004 --watch is refused through fallback.invocation", () => {
  test("no stream is emitted and the remediation hint names the resident daemon story", async () => {
    const data = laneData();
    const run = await runLanes(["lanes", "list", "--watch", "--json"], data);
    expect(run.exitCode).toBe(1);
    const envelope = JSON.parse(run.stdout) as {
      error?: { code?: string; remediationHint?: string; summary?: string };
      data?: unknown;
    };
    expect(envelope.error?.code).toBe("fallback.invocation");
    expect(envelope.error?.remediationHint).toContain("resident daemon (M1-S18)");
    expect(envelope.data).toBeUndefined();
  });
});

describe("TC-LANES-005 unreadable store returns status.collector.lanes.unavailable", () => {
  test("the handler projects exit 2 and never a zero-lane view", async () => {
    const output = await runProgram(["lanes", "list", "--json"], {
      commands: {
        lanes: createLanesCommandDefinition(
          runtime(() => ({
            ok: false,
            code: "status.collector.lanes.unavailable",
            summary: "queue store is unreadable",
          })),
        ),
      },
    });
    expect(output.exitCode).toBe(2);
    const envelope = JSON.parse(output.stdout) as { error?: { code?: string }; data?: unknown };
    expect(envelope.error?.code).toBe("status.collector.lanes.unavailable");
    expect(envelope.data).toBeUndefined();
  });
});

describe("TC-LANES-006 lanes reads are bounded and truthfully empty", () => {
  test("an empty queue is an explicit observed-empty with counts", async () => {
    const data = foldLanes({
      schedule: {
        entries: [],
        nextActions: [],
        findings: [],
        leases: [],
        weights: [],
        parks: [],
        truncated: false,
        evaluatedCandidates: 0,
        deployReads: 0,
      },
      economics: {},
      degraded: ["daemon-unreachable"],
    });
    const run = await runLanes(["lanes", "list", "--json"], data);
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { data: QueueLanesData };
    expect(envelope.data.counts).toEqual({
      lanes: 0,
      delivering: 0,
      idle: 0,
      parked: 0,
      failed: 0,
    });
    expect(envelope.data.lanes).toEqual([]);
    expect(envelope.data.degraded).toEqual(["daemon-unreachable"]);
  });
});

describe("TC-SCHED-012 lanes command-level zero-write reads", () => {
  test("lanes list|show perform zero appends, fences, or replacements", async () => {
    let log: { appends: number; replaces: number; fences: number; releases: number } | undefined;
    const harness = createQueueEdgeHarness("lanes-zero-write", {
      wrapStore: (store) => {
        const tracked = trackingStore(store);
        log = tracked.log;
        return tracked.store;
      },
    });
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(log).toBeDefined();
    if (log === undefined) return;
    log.appends = 0;
    log.replaces = 0;
    log.fences = 0;
    log.releases = 0;
    expect((await harness.run(["lanes", "list", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["lanes", "show", "GH-320", "--json"])).exitCode).toBe(0);
    expect(log).toEqual({ appends: 0, replaces: 0, fences: 0, releases: 0 });
  });
});

describe("GH-238 daemon evidence folded into the unchanged lanes payload", () => {
  test("daemon failed/delivering evidence changes the state without a payload-shape change", () => {
    const input = laneFacts();
    const schedule = computeQueueSchedule(input.facts, { next: 20 });
    const baseline = foldLanes({ schedule, economics: input.economics, degraded: input.degraded });
    const daemonLane: DaemonLaneRecord = {
      schema: "delivery.daemon.lane.v1",
      ref: "GH-320",
      state: "failed",
      spawnOrdinal: 1,
      recordedAt: "2026-11-08T10:00:00Z",
    };
    const folded = foldLanes({
      schedule,
      economics: input.economics,
      degraded: input.degraded,
      daemonLanes: [daemonLane],
    });
    expect(Object.keys(folded).sort()).toEqual(Object.keys(baseline).sort());
    const lane = folded.lanes.find((candidate) => candidate.ref === "GH-320");
    expect(lane?.state).toBe("failed");
  });
});
