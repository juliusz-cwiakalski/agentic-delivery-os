/**
 * TC-BOARD-001 — four sections in declared order from one repository, with at
 * least one row in each array and every label rendered even when a section is
 * legitimately empty (AC-F1-1, F-1, DM-2..DM-6, SC-M2-S4-01).
 */
import { describe, expect, test } from "bun:test";
import {
  boardAsks,
  boardData,
  boardGates,
  boardLanes,
  boardParked,
  createBoardHarness,
} from "../fixtures/board/harness";
import { allFourRepository, BOARD_REPOSITORY } from "../fixtures/board/sections";

describe("TC-BOARD-001 four-section board", () => {
  test("renders LANES, GATES, ASKS, PARKED in order with rows in every array", async () => {
    const board = createBoardHarness({ repositories: [allFourRepository()] });
    try {
      const json = await board.run([], { json: true });
      expect(json.exitCode).toBe(0);
      const data = boardData(json);
      expect(data?.schemaVersion).toBe("delivery.board.v1");
      expect(data?.audience).toBe("owner");
      expect(data?.scope).toBe("repository");
      expect(data?.selection).toBe("current");
      expect(data?.repositories).toEqual([BOARD_REPOSITORY]);
      expect(boardLanes(json).length).toBeGreaterThan(0);
      expect(boardGates(json).length).toBeGreaterThan(0);
      expect(boardAsks(json).length).toBeGreaterThan(0);
      expect(boardParked(json).length).toBeGreaterThan(0);

      const text = await board.run([], { json: false });
      const lines = text.stdout.trimEnd().split("\n");
      expect(lines[0]?.startsWith("example-product board")).toBe(true);
      const labels = lines.filter((line) => /^(LANES|GATES|ASKS|PARKED)/u.test(line));
      expect(labels.map((line) => line.split(" ")[0])).toEqual([
        "LANES",
        "GATES",
        "ASKS",
        "PARKED",
      ]);
      for (const line of lines.slice(1)) {
        if (/^(LANES|GATES|ASKS|PARKED)/u.test(line)) continue;
        expect(line).toContain(BOARD_REPOSITORY);
      }
    } finally {
      board.cleanup();
    }
  });

  test("an empty section still renders its label", async () => {
    const cells = [
      { label: "LANES", repository: allFourRepository({ lanes: [] }) },
      { label: "GATES", repository: allFourRepository({ gates: [] }) },
      { label: "ASKS", repository: allFourRepository({ asks: [] }) },
      { label: "PARKED", repository: allFourRepository({ parks: [] }) },
    ];
    for (const cell of cells) {
      const board = createBoardHarness({ repositories: [cell.repository] });
      try {
        const run = await board.run([], { json: false });
        expect(run.exitCode).toBe(0);
        const labels = run.stdout
          .split("\n")
          .filter((line) => /^(LANES|GATES|ASKS|PARKED)/u.test(line))
          .map((line) => line.split(" ")[0]);
        expect(labels).toEqual(["LANES", "GATES", "ASKS", "PARKED"]);
      } finally {
        board.cleanup();
      }
    }
  });

  test("the read-only empty board is honestly labelled observed-empty", async () => {
    const board = createBoardHarness({
      repositories: [{ key: BOARD_REPOSITORY, lanes: [], gates: [], asks: [], parks: [] }],
    });
    try {
      const run = await board.run([], { json: false });
      expect(run.stdout).toContain("observed-empty");
      expect(
        run.stdout.split("\n").filter((line) => /^(LANES|GATES|ASKS|PARKED)/u.test(line)),
      ).toHaveLength(4);
    } finally {
      board.cleanup();
    }
  });
});
