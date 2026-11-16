/**
 * TC-BOARD-006 — the lane section is the active-lane view with the recorded
 * holder and a total phase classification (AC-F1-1, DM-4, DM-9, DEC-7, DEC-15).
 */
import { describe, expect, test } from "bun:test";
import { BOARD_LANE_PHASE_UNKNOWN_REASONS } from "../../packages/core/src/contracts/index";
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
