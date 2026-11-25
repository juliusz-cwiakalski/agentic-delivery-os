/**
 * TC-BOARD-006 — the lane section is the active-lane view with the recorded
 * holder and a total phase classification (AC-F1-1, DM-4, DM-9, DEC-7, DEC-15).
 */
import { describe, expect, test } from "bun:test";
import { newestDispatchLaneWorktreePaths } from "../../packages/core/src/app/dispatch-lane-view";
import {
  BOARD_LANE_PHASE_UNKNOWN_REASONS,
  OWNER_GATE_SLA_POLICY,
  type DispatchLaneRecord,
} from "../../packages/core/src/contracts/index";
import { boardLanes, createBoardHarness } from "../fixtures/board/harness";
import { BOARD_REPOSITORY, deliveringLane, failedLane, idleLane } from "../fixtures/board/sections";

describe("TC-BOARD-006 active lanes and phase", () => {
  test("carries repository, ref, laneId and state for the active subset", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          asks: [],
          parks: [],
          lanes: [deliveringLane(), failedLane()],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const lanes = boardLanes(run);
      expect(lanes.map((lane) => lane.state)).toEqual(["delivering", "failed"]);
      for (const lane of lanes) {
        expect(lane.repository).toBe(BOARD_REPOSITORY);
        expect(typeof lane.ref).toBe("string");
        expect(typeof lane.laneId).toBe("string");
      }
    } finally {
      board.cleanup();
    }
  });

  test("the holder and lease id are the recorded values, never inferred", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          asks: [],
          parks: [],
          lanes: [deliveringLane(), failedLane()],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const [delivering, failed] = boardLanes(run);
      expect(delivering?.holder).toBe("principal-a");
      expect(delivering?.leaseId).toBe("lease-GH-3001");
      expect(failed?.holder).toBeNull();
      expect(Object.hasOwn(failed ?? {}, "leaseId")).toBe(false);
    } finally {
      board.cleanup();
    }
  });

  test("the phase classification is total and closed", async () => {
    const cells = [
      { lane: deliveringLane({ phase: "delivery" }), phase: "delivery", reason: undefined },
      {
        lane: failedLane({ phase: null, phaseUnknownReason: "phase-unrecorded" }),
        phase: null,
        reason: "phase-unrecorded",
      },
      {
        lane: idleLane({ phase: null, phaseUnknownReason: "phases-complete" }),
        phase: null,
        reason: "phases-complete",
      },
    ] as const;
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          asks: [],
          parks: [],
          lanes: cells.map((cell) => cell.lane),
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const lanes = boardLanes(run);
      for (const [index, cell] of cells.entries()) {
        const lane = lanes[index];
        expect(lane?.phase).toBe(cell.phase);
        expect(Object.hasOwn(lane ?? {}, "phaseUnknownReason")).toBe(cell.phase === null);
        if (cell.reason !== undefined) expect(lane?.phaseUnknownReason).toBe(cell.reason);
      }
      expect([...BOARD_LANE_PHASE_UNKNOWN_REASONS]).toEqual([
        "phase-unrecorded",
        "phases-complete",
      ]);
    } finally {
      board.cleanup();
    }
  });
});

/**
 * TC-SURFACES-002 (GH-404 F-7, AC-F7-1, DM-1) — the board's lane rows carry
 * the lane's worktree path through the ref-keyed join (the newest
 * dispatch.lane record per ref), contributing to existing rows only; a
 * context-less lane renders exactly as today (DEC-8).
 */
import { projectBoard } from "../../packages/core/src/domain/owner-gate-sla";

const laneRecord = (worktreePath?: string): DispatchLaneRecord => ({
  schema: "delivery.dispatch.lane.v1",
  ref: "GH-3001",
  repository: BOARD_REPOSITORY,
  attemptId: "attempt-404",
  sessionId: "session-404",
  harnessKind: "opencode",
  owner: { processId: 4242, startedAt: "2026-11-25T12:00:00.000Z" },
  iterationOrdinal: 1,
  restartsConsumed: 0,
  state: "active",
  recordedAt: "2026-11-25T12:00:00.000Z",
  ...(worktreePath === undefined ? {} : { worktreePath }),
});

describe("TC-SURFACES-002 the board lane rows carry the worktree path", () => {
  test("the ref-keyed join contributes the path to the existing row", () => {
    const board = projectBoard({
      audience: "owner",
      scope: { kind: "workspace" },
      selection: { repositories: [], refs: [] },
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          decisions: [],
          asks: [],
          actions: [],
          parks: [],
          lanes: [deliveringLane()],
        },
      ],
      omittedRepositories: 0,
      ownerHold: { active: false },
      policy: OWNER_GATE_SLA_POLICY,
      nowMs: 0,
      nowIso: "2026-11-25T12:00:00.000Z",
      dispatchWorktreePaths: newestDispatchLaneWorktreePaths([
        laneRecord("/repos/checkout-GH-3001"),
      ]),
    });
    expect(board.data.lanes[0]?.ref).toBe("GH-3001");
    expect(board.data.lanes[0]?.worktreePath).toBe("/repos/checkout-GH-3001");
  });

  test("a context-less lane renders exactly as today (no path, no new rows)", () => {
    const board = projectBoard({
      audience: "owner",
      scope: { kind: "workspace" },
      selection: { repositories: [], refs: [] },
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          decisions: [],
          asks: [],
          actions: [],
          parks: [],
          lanes: [deliveringLane()],
        },
      ],
      omittedRepositories: 0,
      ownerHold: { active: false },
      policy: OWNER_GATE_SLA_POLICY,
      nowMs: 0,
      nowIso: "2026-11-25T12:00:00.000Z",
      dispatchWorktreePaths: newestDispatchLaneWorktreePaths([laneRecord()]),
    });
    expect(board.data.lanes[0]?.worktreePath).toBeUndefined();
    expect(board.data.lanes).toHaveLength(1);
  });
});
