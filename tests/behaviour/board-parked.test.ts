/**
 * TC-BOARD-033 and TC-BOARD-034 — parked work carries reason and until with the
 * classified owner-hold absence, excludes provider-quota, and carries the
 * host-wide owner hold once (AC-F6-1, AC-F6-2, DM-6, DM-7, DEC-18).
 */
import { describe, expect, test } from "bun:test";
import { boardData, boardParked, createBoardHarness } from "../fixtures/board/harness";
import {
  activeOwnerHold,
  BOARD_REPOSITORY,
  ownerHoldPark,
  peakPark,
} from "../fixtures/board/sections";

describe("TC-BOARD-033/034 parked work and owner hold", () => {
  test("both lane-park causes render with their honest absences", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          lanes: [],
          asks: [],
          parks: [peakPark(), ownerHoldPark()],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const parked = boardParked(run);
      expect(parked).toHaveLength(2);
      const peak = parked.find((row) => row.reason === "peak-window");
      expect(peak?.until).toBe("2026-11-06T18:00:00Z");
      expect(Object.hasOwn(peak ?? {}, "untilReason")).toBe(false);
      expect(peak?.preservation).toBe("preserved");
      expect(peak?.providerProfile).toBe("primary");
      const hold = parked.find((row) => row.reason === "owner-hold");
      expect(hold?.until).toBeNull();
      expect(hold?.untilReason).toBe("owner-hold-no-expiry");
    } finally {
      board.cleanup();
    }
  });

  test("a provider-quota park is not a parked row", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          lanes: [],
          asks: [],
          parks: [peakPark({ reason: "provider-quota" as never, until: null })],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(boardParked(run)).toEqual([]);
      expect(boardData(run)?.omittedBySection).toEqual({
        repositories: 0,
        lanes: 0,
        gates: 0,
        asks: 0,
        actions: 0,
        parked: 0,
      });
    } finally {
      board.cleanup();
    }
  });

  test("an active owner hold is carried once with its source and reason", async () => {
    const board = createBoardHarness({
      repositories: [{ key: BOARD_REPOSITORY, gates: [], lanes: [], asks: [], parks: [] }],
      ownerHold: activeOwnerHold,
    });
    try {
      const run = await board.run([], { json: true });
      expect(boardData(run)?.ownerHold).toEqual(activeOwnerHold);
      expect(boardParked(run)).toEqual([]);
    } finally {
      board.cleanup();
    }
  });
});
