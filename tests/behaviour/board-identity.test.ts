/**
 * TC-BOARD-083 — duplicate-row and state-mixing control: identities survive a
 * collision matrix and every row stays under its own repository key
 * (AC-F3-2, AC-F9-1, NFR-3, SC-M2-S4-02).
 */
import { describe, expect, test } from "bun:test";
import { createBoardHarness } from "../fixtures/board/harness";
import { ownerReviewGate } from "../fixtures/board/matrix";
import { deliveringLane, ownerAsk } from "../fixtures/board/sections";

const sameRefRepository = (key: string, holder: string) => ({
  key,
  gates: [ownerReviewGate("GH-244", 2 * 3_600_000)],
  lanes: [deliveringLane({ ref: "GH-244", laneId: "GH-244", holder })],
  asks: [ownerAsk({ id: `ask-${key}`, ref: "GH-244" })],
  parks: [],
});

describe("TC-BOARD-083 collision matrix", () => {
  test("two repositories holding one ref keep distinct rows with their own evidence", async () => {
    const board = createBoardHarness({
      repositories: [
        sameRefRepository("repository-a", "holder-a"),
        sameRefRepository("repository-b", "holder-b"),
      ],
      selection: "all",
    });
    try {
      const run = await board.run([], { json: true });
      const data = run.envelope?.data as Record<string, unknown> | undefined;
      const lanes = data?.lanes as readonly Record<string, unknown>[];
      const gates = data?.gates as readonly Record<string, unknown>[];
      const asks = data?.asks as readonly Record<string, unknown>[];
      expect(lanes.map((row) => row.repository)).toEqual(["repository-a", "repository-b"]);
      expect(lanes.map((row) => row.holder)).toEqual(["holder-a", "holder-b"]);
      expect(gates.map((row) => row.repository)).toEqual(["repository-a", "repository-b"]);
      expect(asks.map((row) => row.repository)).toEqual(["repository-a", "repository-b"]);
      const identities = [
        ...lanes.map((row) => `${String(row.repository)}|${String(row.ref)}`),
        ...gates.map((row) => `${String(row.repository)}|${String(row.id)}`),
        ...asks.map((row) => `${String(row.repository)}|${String(row.id)}`),
      ];
      expect(new Set(identities).size).toBe(identities.length);
    } finally {
      board.cleanup();
    }
  });
});
