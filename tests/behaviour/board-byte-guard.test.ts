/**
 * TC-BOARD-065 and TC-BOARD-085 — the byte guard drops rows tail-first in the
 * declared order and never the repository list or the collector evidence, with
 * every drop counted (AC-F9-4, AC-F4-3, DM-11, DEC-13, NFR-4).
 */
import { describe, expect, test } from "bun:test";
import { BOARD_MAX_MACHINE_BYTES } from "../../packages/core/src/contracts/index";
import {
  type BoardRepositoryFixture,
  boardData,
  createBoardHarness,
} from "../fixtures/board/harness";
import { ownerReviewGate } from "../fixtures/board/matrix";
import { ownerAsk, peakPark } from "../fixtures/board/sections";

const LONG = "x".repeat(160);

const overFullRepository = (index: number): BoardRepositoryFixture => ({
  key: `repository-${String(index).padStart(3, "0")}`,
  gates: Array.from({ length: 8 }, (_, gate) =>
    ownerReviewGate(`GH-${String(index)}${String(gate)}`, 60_000 * (gate + 1)),
  ),
  lanes: Array.from({ length: 20 }, (_, lane) => ({
    ref: `${LONG}-${String(lane)}`,
    laneId: `${LONG}-${String(lane)}`,
    state: "delivering" as const,
    holder: LONG,
    phase: "delivery",
  })),
  asks: Array.from({ length: 8 }, (_, ask) =>
    ownerAsk({ id: `ask-${String(index)}-${String(ask)}`, ref: `${LONG}-${String(ask)}` }),
  ),
  parks: Array.from({ length: 8 }, (_, park) => peakPark({ ref: `${LONG}-${String(park)}` })),
});

describe("TC-BOARD-065/085 byte guard", () => {
  test("a fitting payload carries no drop and truncated stays false", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: "repository-a",
          gates: [ownerReviewGate("GH-6001", 60_000)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const data = boardData(run);
      expect(data?.truncated).toBe(false);
      expect(data?.omitted).toBe(0);
      expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
        BOARD_MAX_MACHINE_BYTES,
      );
    } finally {
      board.cleanup();
    }
  });

  test("over-full payload drops parked first, then asks, lanes, and gates", async () => {
    const repositories = Array.from({ length: 40 }, (_, index) => overFullRepository(index));
    const board = createBoardHarness({
      repositories,
      selection: "all",
    });
    try {
      const run = await board.run([], { json: true });
      const data = boardData(run);
      expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
        BOARD_MAX_MACHINE_BYTES,
      );
      expect(data?.truncated).toBe(true);
      const counters = data?.omittedBySection as Record<string, number>;
      const total =
        Number(counters.repositories) +
        Number(counters.lanes) +
        Number(counters.gates) +
        Number(counters.asks) +
        Number(counters.parked);
      expect(data?.omitted).toBe(total);
      // The repository list and collector evidence are never dropped.
      expect(data?.repositories).toHaveLength(40);
      expect((data?.collectors ?? []) as readonly unknown[]).toHaveLength(80);
      // Tail-first order: parked is fully dropped before asks.
      const parked = ((data?.parked ?? []) as readonly unknown[]).length;
      const asks = ((data?.asks ?? []) as readonly unknown[]).length;
      const lanes = (data?.lanes ?? []) as readonly Record<string, unknown>[];
      expect(Number(counters.parked)).toBeGreaterThan(0);
      if (parked > 0) expect(asks).toBe(40 * 8);
      if (asks < 40 * 8) expect(parked).toBe(0);
      if (lanes.length < 40 * 20) expect(asks).toBe(0);
      // The rows that remain are a prefix of the declared order.
      for (let index = 1; index < lanes.length; index += 1) {
        const previous = String(lanes[index - 1]?.repository);
        const current = String(lanes[index]?.repository);
        expect(previous <= current).toBe(true);
      }
    } finally {
      board.cleanup();
    }
  }, 30_000);
});
