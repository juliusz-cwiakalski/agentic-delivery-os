/**
 * TC-BOARD-002 — every row names its repository key, ref or declared absence,
 * and owner with a closed `ownerSource` (AC-F1-1, AC-F2-2, DM-3..DM-6, DM-10).
 */
import { describe, expect, test } from "bun:test";
import { BOARD_OWNER_SOURCES } from "../../packages/core/src/contracts/index";
import {
  boardAsks,
  boardData,
  boardGates,
  boardLanes,
  boardParked,
  createBoardHarness,
} from "../fixtures/board/harness";
import {
  allFourRepository,
  BOARD_REPOSITORY,
  ownerAsk,
  ownerHoldPark,
} from "../fixtures/board/sections";

const sourcesOf = (rows: readonly Record<string, unknown>[]): string[] =>
  rows.map((row) => String(row.ownerSource));

describe("TC-BOARD-002 row provenance", () => {
  test("each family carries its declared ownerSource token", async () => {
    const board = createBoardHarness({
      repositories: [
        allFourRepository({
          asks: [
            ownerAsk(),
            ownerAsk({ id: "ask-ref-less", ref: null, lane: "none", question: "Which ref?" }),
          ],
          parks: [ownerHoldPark()],
        }),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(sourcesOf(boardLanes(run))).toEqual(["lane-lease-holder", "lane-lease-holder"]);
      const gateSources = sourcesOf(boardGates(run));
      expect(gateSources).toContain("gate-audience");
      expect(gateSources).toContain("gate-waiver-authorizer");
      expect(sourcesOf(boardAsks(run))).toEqual(["ask-audience", "ask-audience"]);
      expect(sourcesOf(boardParked(run))).toEqual(["park-control"]);
      for (const source of [
        ...sourcesOf(boardLanes(run)),
        ...gateSources,
        ...sourcesOf(boardAsks(run)),
        ...sourcesOf(boardParked(run)),
      ]) {
        expect(BOARD_OWNER_SOURCES).toContain(source as (typeof BOARD_OWNER_SOURCES)[number]);
      }
    } finally {
      board.cleanup();
    }
  });

  test("a waived gate names its authorizer, an unwaived gate the audience token", async () => {
    const board = createBoardHarness({
      repositories: [allFourRepository()],
    });
    try {
      const run = await board.run([], { json: true });
      const gates = boardGates(run);
      const waived = gates.find((gate) => gate.kind === "waiver");
      const reviewed = gates.find((gate) => gate.kind === "owner-review");
      expect(waived?.owner).toBe("principal-w");
      expect(waived?.ownerSource).toBe("gate-waiver-authorizer");
      expect(reviewed?.owner).toBe("owner");
      expect(reviewed?.ownerSource).toBe("gate-audience");
    } finally {
      board.cleanup();
    }
  });

  test("a ref-less ask carries the delivered bare null with no absence reason", async () => {
    const board = createBoardHarness({
      repositories: [
        allFourRepository({
          asks: [ownerAsk({ id: "ask-ref-less", ref: null, lane: "none" })],
        }),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      const [ask] = boardAsks(run);
      expect(ask?.ref).toBeNull();
      expect(Object.keys(ask ?? {}).sort()).toEqual([
        "age",
        "askedAt",
        "defaultState",
        "drawnDefault",
        "id",
        "lane",
        "owner",
        "ownerSource",
        "question",
        "ref",
        "repository",
        "status",
        "type",
      ]);
      expect(Object.hasOwn(ask ?? {}, "refUnknownReason")).toBe(false);
    } finally {
      board.cleanup();
    }
  });

  test("a row whose source records no principal carries owner null", async () => {
    const board = createBoardHarness({
      repositories: [allFourRepository()],
    });
    try {
      const run = await board.run([], { json: true });
      const [park] = boardParked(run);
      expect(park?.owner).toBeNull();
      const data = boardData(run);
      expect(data?.repositories).toEqual([BOARD_REPOSITORY]);
      for (const row of [
        ...boardLanes(run),
        ...boardGates(run),
        ...boardAsks(run),
        ...boardParked(run),
      ]) {
        expect(row.repository).toBe(BOARD_REPOSITORY);
      }
    } finally {
      board.cleanup();
    }
  });
});
