/**
 * TC-PEAK-012 — `lanes` and `board` render a dispatch-owned peak-window park
 * and the live lease holder through the delivered projections (GH-413 F-6,
 * AC-F6-2, NFR-9).
 */
import { describe, expect, test } from "bun:test";
import { boardParked, createBoardHarness } from "../fixtures/board/harness";
import { BOARD_REPOSITORY, peakPark } from "../fixtures/board/sections";
import { lanesReadFor } from "../fixtures/supervise/harness";

const UNTIL = "2026-11-12T10:00:00.000Z";

describe("TC-PEAK-012 lanes renders the dispatch-owned park and the lease holder", () => {
  test("parked:peak-window, the recorded until, and the live leaseHolder", () => {
    const data = lanesReadFor({ cause: "peak-window", until: UNTIL, leased: true });
    const lane = data.lanes[0];
    expect(lane?.state).toBe("parked");
    expect(lane?.reason).toBe("parked:peak-window");
    expect(lane?.until).toBe(UNTIL);
    expect(lane?.leaseHolder).toBe("holder-a");
  });
});

describe("TC-PEAK-012 board renders the dispatch-owned park in PARKED", () => {
  test("the row's reason, end, preservation, and profile are the record's", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          lanes: [],
          asks: [],
          parks: [peakPark({ until: UNTIL })],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const parked = boardParked(run);
      expect(parked).toHaveLength(1);
      expect(parked[0]?.reason).toBe("peak-window");
      expect(parked[0]?.until).toBe(UNTIL);
      expect(parked[0]?.preservation).toBe("preserved");
    } finally {
      board.cleanup();
    }
  });
});
