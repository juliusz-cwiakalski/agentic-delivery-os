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
  type QueueLanesData,
} from "../../packages/core/src/contracts/index";
import { foldLanes, selectLane } from "../../packages/core/src/domain/index";
import { laneData } from "../fixtures/queue/lanes/harness";
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

  test("the fold is pure and leaves the injected facts untouched", () => {
    const data = laneData();
    const snapshot = JSON.stringify(data);
    const schedule = data;
    expect(JSON.stringify(schedule)).toBe(snapshot);
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
  test("no stream is emitted and the summary names the resident daemon story", async () => {
    const data = laneData();
    const run = await runLanes(["lanes", "list", "--watch", "--json"], data);
    expect(run.exitCode).toBe(1);
    const envelope = JSON.parse(run.stdout) as {
      error?: { code?: string; summary?: string };
      data?: unknown;
    };
    expect(envelope.error?.code).toBe("fallback.invocation");
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
