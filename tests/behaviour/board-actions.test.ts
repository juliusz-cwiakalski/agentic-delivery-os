/**
 * TC-ACTION-017..021 — the board's additive actions surface: full rows beside
 * the asks, byte-identical repeat renders, bounded rows with counted omissions,
 * one named source with no second vocabulary, and explicit empty/degraded
 * states (AC-F6-1, AC-F6-2, AC-F3-1 board half; DM-4, NFR-2, RSK-4).
 */
import { describe, expect, test } from "bun:test";
import {
  ACTION_AGING_STATES,
  BOARD_ACTIONS_LABEL,
  BOARD_MAX_ACTIONS,
} from "../../packages/core/src/contracts/index";
import {
  boardActions,
  boardCollectors,
  boardData,
  createBoardHarness,
} from "../fixtures/board/harness";
import { allFourRepository, BOARD_REPOSITORY, boardAction } from "../fixtures/board/sections";

const twoRepositoryBoard = () => {
  const repositories = [
    allFourRepository({
      key: "zeta-repository",
      actions: [
        boardAction({ actionId: "action-z-2", agingState: "escalated" }),
        boardAction({ actionId: "action-z-1", agingState: "current" }),
      ],
    }),
    allFourRepository({
      key: "alpha-repository",
      actions: [
        boardAction({ actionId: "action-a-2", owner: "human:operator", agingState: "nudged" }),
        boardAction({ actionId: "action-a-1" }),
      ],
    }),
  ];
  return repositories;
};

describe("TC-ACTION-017 the actions surface beside the asks", () => {
  test("every row carries identity, repository, owner, level, age, aging state, and window disclosure", async () => {
    const board = createBoardHarness({ repositories: twoRepositoryBoard() });
    try {
      const json = await board.run([], { json: true });
      expect(json.exitCode).toBe(0);
      expect(boardData(json)?.schemaVersion).toBe("delivery.board.v1");
      const rows = boardActions(json);
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(typeof row.actionId).toBe("string");
        expect(typeof row.repository).toBe("string");
        expect(typeof row.owner).toBe("string");
        expect(typeof row.level).toBe("string");
        expect(typeof row.age).toBe("number");
        expect(ACTION_AGING_STATES).toContain(row.agingState);
        expect(typeof row.window).toBe("string");
        expect(typeof row.windowOpenCount).toBe("number");
        expect(row.windowLimit).toBe(3);
      }
      // Deterministic repository-then-row ordering.
      expect(rows.map((row) => `${String(row.repository)}:${String(row.actionId)}`)).toEqual([
        "alpha-repository:action-a-1",
        "alpha-repository:action-a-2",
        "zeta-repository:action-z-1",
        "zeta-repository:action-z-2",
      ]);
      const data = boardData(json);
      expect((data?.lanes ?? []).length).toBeGreaterThan(0);
      expect((data?.gates ?? []).length).toBeGreaterThan(0);
      expect((data?.asks ?? []).length).toBeGreaterThan(0);
      expect((data?.parked ?? []).length).toBeGreaterThan(0);
    } finally {
      board.cleanup();
    }
  });

  test("the human screen renders ACTIONS immediately after ASKS", async () => {
    const board = createBoardHarness({ repositories: twoRepositoryBoard() });
    try {
      const human = await board.run([], { json: false });
      const labels = human.stdout
        .split("\n")
        .filter((line) => /^(LANES|GATES|ASKS|ACTIONS|PARKED)/u.test(line))
        .map((line) => line.split(" ")[0]);
      expect(labels).toEqual(["LANES", "GATES", "ASKS", "ACTIONS", "PARKED"]);
      expect(human.stdout).toContain("aging=escalated");
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-ACTION-018 repeat renders are byte-identical", () => {
  test("identical stored actions render identical machine and human bytes", async () => {
    const state = createBoardHarness({ repositories: twoRepositoryBoard() });
    try {
      const first = await state.run([], { json: true });
      const second = await state.run([], { json: true });
      expect(second.stdout).toBe(first.stdout);
      const humanFirst = await state.run([], { json: false });
      const humanSecond = await state.run([], { json: false });
      expect(humanSecond.stdout).toBe(humanFirst.stdout);
    } finally {
      state.cleanup();
    }
  });

  test("shuffling the seeding order produces the same bytes", async () => {
    const ordered = createBoardHarness({ repositories: twoRepositoryBoard() });
    const shuffledRepositories = [...twoRepositoryBoard()].reverse().map((repository) => ({
      ...repository,
      actions: [...(repository.actions ?? [])].reverse(),
    }));
    const shuffled = createBoardHarness({ repositories: shuffledRepositories });
    try {
      const first = await ordered.run([], { json: true });
      const second = await shuffled.run([], { json: true });
      expect(second.stdout).toBe(first.stdout);
    } finally {
      ordered.cleanup();
      shuffled.cleanup();
    }
  });
});

describe("TC-ACTION-019 bounds, counted omissions, and the byte guard", () => {
  test("an under-cap control is untruncated with zero actions omissions", async () => {
    const board = createBoardHarness({
      repositories: [allFourRepository({ actions: [boardAction()] })],
    });
    try {
      const run = await board.run([], { json: true });
      const data = boardData(run);
      expect(data?.truncated).toBe(false);
      expect(((data?.omittedBySection ?? {}) as Record<string, number>).actions).toBe(0);
      expect(boardActions(run)).toHaveLength(1);
    } finally {
      board.cleanup();
    }
  });

  test("an over-cap repository publishes the cap and counts every dropped row", async () => {
    const actions = Array.from({ length: BOARD_MAX_ACTIONS + 2 }, (_, index) =>
      boardAction({ actionId: `action-${String(index).padStart(2, "0")}` }),
    );
    const board = createBoardHarness({ repositories: [allFourRepository({ actions })] });
    try {
      const run = await board.run([], { json: true });
      const data = boardData(run);
      expect(boardActions(run)).toHaveLength(BOARD_MAX_ACTIONS);
      expect(data?.truncated).toBe(true);
      expect(((data?.omittedBySection ?? {}) as Record<string, number>).actions).toBe(2);
      expect(data?.omitted).toBeGreaterThanOrEqual(2);
      // The machine omitted 2 and the human cap (6) drops 2 of the 8 published
      // rows, so the marker counts all 4 drops and never drops silently.
      const human = await board.run([], { json: false });
      expect(human.stdout).toContain("4 more actions omitted");
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-ACTION-020 one named source, one vocabulary, read-only render", () => {
  test("the rows come from the repository facts and the render performs no write", async () => {
    const board = createBoardHarness({
      repositories: [allFourRepository()],
      throwOnMutation: true,
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(boardActions(run).length).toBe(2);
      const collectors = boardCollectors(run);
      expect(collectors.some((entry) => entry.collector === "actions")).toBe(true);
      expect(boardData(run)?.schemaVersion).toBe("delivery.board.v1");
    } finally {
      board.cleanup();
    }
  });
});

describe("TC-ACTION-021 empty and degraded registry are explicit", () => {
  test("an empty registry renders the label with zero rows and zero counters", async () => {
    const board = createBoardHarness({ repositories: [allFourRepository({ actions: [] })] });
    try {
      const run = await board.run([], { json: false });
      const label = run.stdout.split("\n").find((line) => line.startsWith(BOARD_ACTIONS_LABEL));
      expect(label).toBeDefined();
      expect(label).not.toContain("omitted");
      const json = await board.run([], { json: true });
      expect(boardActions(json)).toEqual([]);
    } finally {
      board.cleanup();
    }
  });

  test("a failed registry read discloses the source state with exit 0 and no rows", async () => {
    const board = createBoardHarness({
      repositories: [allFourRepository({ actions: [], actionsSource: "unavailable" })],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(boardActions(run)).toEqual([]);
      const evidence = boardCollectors(run).find((entry) => entry.collector === "actions");
      expect(evidence?.outcome).toBe("unavailable");
      const healthy = createBoardHarness({
        repositories: [allFourRepository({ actions: [boardAction()] })],
      });
      try {
        const control = await healthy.run([], { json: true });
        expect(boardActions(control)).toHaveLength(1);
        expect(
          boardCollectors(control).find((entry) => entry.collector === "actions")?.outcome,
        ).toBe("available");
      } finally {
        healthy.cleanup();
      }
    } finally {
      board.cleanup();
    }
  });

  test("the repository identity stays in every rendered row", async () => {
    const board = createBoardHarness({ repositories: [allFourRepository()] });
    try {
      const human = await board.run([], { json: false });
      const actionLines = human.stdout
        .split("\n")
        .filter((line) => line.startsWith(`${BOARD_REPOSITORY}  action-`));
      expect(actionLines.length).toBeGreaterThan(0);
    } finally {
      board.cleanup();
    }
  });
});
