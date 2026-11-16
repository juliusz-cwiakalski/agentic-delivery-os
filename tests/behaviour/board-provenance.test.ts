/**
 * TC-BOARD-081 — fabricated-value control matrix: age, default, until, holder,
 * phase, and owner are never invented (AC-F5-1, AC-F5-2, AC-F6-1, AC-F1-1,
 * DM-4..DM-6, DM-10, RSK-8).
 */
import { describe, expect, test } from "bun:test";
import { boardAsks, boardLanes, boardParked, createBoardHarness } from "../fixtures/board/harness";
import { ownerReviewGate } from "../fixtures/board/matrix";
import {
  BOARD_REPOSITORY,
  deliveringLane,
  ownerAsk,
  ownerHoldPark,
  peakPark,
} from "../fixtures/board/sections";

describe("TC-BOARD-081 never invent a value", () => {
  test("age, holder, phase, until, and owner are the recorded values or declared nulls", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [ownerReviewGate("GH-7001", 60_000)],
          lanes: [
            deliveringLane({
              holder: null,
              leaseId: undefined,
              phase: null,
              phaseUnknownReason: "phase-unrecorded",
            }),
          ],
          asks: [ownerAsk({ ref: "GH-7002", age: 777 })],
          parks: [ownerHoldPark({ owner: null }), peakPark({ owner: null })],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const [lane] = boardLanes(run);
      expect(lane?.holder).toBeNull();
      expect(lane?.phase).toBeNull();
      expect(lane?.phaseUnknownReason).toBe("phase-unrecorded");
      expect(Object.hasOwn(lane ?? {}, "leaseId")).toBe(false);

      const [ask] = boardAsks(run);
      expect(ask?.age).toBe(777);
      expect(ask?.drawnDefault).toBeNull();
      expect(ask?.defaultState).toBe("none");

      const parked = boardParked(run);
      for (const row of parked) expect(row.owner).toBeNull();
      const hold = parked.find((row) => row.reason === "owner-hold");
      expect(hold?.until).toBeNull();
      expect(hold?.untilReason).toBe("owner-hold-no-expiry");
    } finally {
      board.cleanup();
    }
  });
});
