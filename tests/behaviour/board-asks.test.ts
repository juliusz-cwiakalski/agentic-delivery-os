/**
 * TC-BOARD-030, TC-BOARD-031, TC-BOARD-032 — owner asks carry the delivered
 * fields, computed age, the drawn-default join over the post-append decision set,
 * the declared `none` value, and the bare `ref: null`; coordinator questions are
 * excluded (AC-F5-1..AC-F5-3, DM-5, DEC-4, DEC-16, DEC-19).
 */
import { describe, expect, test } from "bun:test";
import { readOwnerGateSlaDecisions } from "../../packages/core/src/state/index";
import { boardAsks, createBoardHarness } from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";
import { BOARD_REPOSITORY, ownerAsk } from "../fixtures/board/sections";

describe("TC-BOARD-030/031/032 owner asks", () => {
  test("a pending drawn default and a declared none", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [waiverGate("GH-5001", 30 * HOUR_MS), ownerReviewGate("GH-5002", HOUR_MS)],
          lanes: [],
          parks: [],
          asks: [
            ownerAsk({ id: "ask-5001", ref: "GH-5001", age: 1234 }),
            ownerAsk({ id: "ask-5002", ref: "GH-5002", age: 4321 }),
            ownerAsk({ id: "ask-none", ref: "GH-5999", age: 55 }),
          ],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const asks = boardAsks(run);
      const pending = asks.find((ask) => ask.id === "ask-5001");
      expect(pending?.drawnDefault).toBe("owner-review-first");
      expect(pending?.defaultState).toBe("pending");
      expect(pending?.age).toBe(1234);
      const neverMerge = asks.find((ask) => ask.id === "ask-5002");
      expect(neverMerge?.drawnDefault).toBeNull();
      expect(neverMerge?.defaultState).toBe("none");
      const none = asks.find((ask) => ask.id === "ask-none");
      expect(none?.drawnDefault).toBeNull();
      expect(none?.defaultState).toBe("none");
      expect(Object.hasOwn(none ?? {}, "defaultState")).toBe(true);
    } finally {
      board.cleanup();
    }
  });

  test("a default applied in this run renders applied on the same payload", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [waiverGate("GH-5101", 73 * HOUR_MS)],
          lanes: [],
          parks: [],
          asks: [ownerAsk({ id: "ask-5101", ref: "GH-5101" })],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      const asks = boardAsks(run);
      expect(asks[0]?.defaultState).toBe("applied");
      const read = readOwnerGateSlaDecisions(board.state.store);
      if (read.ok) expect(read.value.recordCount).toBe(1);
      const historyReads = board.recorder.calls.filter((call) => call === "readDecisions");
      expect(historyReads).toHaveLength(1);
    } finally {
      board.cleanup();
    }
  });

  test("the ref-less ask keeps the bare null; coordinator questions are excluded", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [],
          lanes: [],
          parks: [],
          asks: [
            ownerAsk({ id: "ask-ref-less", ref: null, lane: "none" }),
            ownerAsk({ id: "ask-coordinator", audience: "coordinator" }),
          ],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const asks = boardAsks(run);
      expect(asks).toHaveLength(1);
      expect(asks[0]?.id).toBe("ask-ref-less");
      expect(asks[0]?.ref).toBeNull();
      expect(Object.hasOwn(asks[0] ?? {}, "refUnknownReason")).toBe(false);
    } finally {
      board.cleanup();
    }
  });
});
