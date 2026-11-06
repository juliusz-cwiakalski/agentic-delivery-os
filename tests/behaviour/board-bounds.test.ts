/**
 * TC-SLA-020 — the four bounds are enforced and every drop or clamp is marked
 * in both modes; truncation never hides an SLA-urgent gate behind a fresh one.
 */
import { describe, expect, test } from "bun:test";
import {
  BOARD_MAX_GATES,
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { boardData, boardGates, createBoardHarness } from "../fixtures/board/harness";
import { gateFact, HOUR_MS, ownerReviewGate } from "../fixtures/board/matrix";

const gateSet = (count: number): ReturnType<typeof ownerReviewGate>[] =>
  Array.from({ length: count }, (_, index) =>
    ownerReviewGate(`GH-12${index.toString().padStart(3, "0")}`, (index + 1) * HOUR_MS),
  );

describe("TC-SLA-020 bounds and truncation", () => {
  test("7 and 8 gates render unmarked; 9/12/100 mark the dropped count", async () => {
    for (const [count, omitted] of [
      [7, 0],
      [8, 0],
      [9, 1],
      [12, 4],
      [100, 92],
    ] as const) {
      const board = createBoardHarness({ gates: gateSet(count) });
      try {
        const run = await board.run([], { json: true });
        const data = boardData(run);
        expect(boardGates(run), `${count}`).toHaveLength(Math.min(count, BOARD_MAX_GATES));
        expect(data?.omitted, `${count}`).toBe(omitted);
        expect(data?.truncated, `${count}`).toBe(omitted > 0);
      } finally {
        board.cleanup();
      }
    }
  });

  test("an escalated gate in last input position is rendered ahead of eight fresh gates", async () => {
    const gates = [...gateSet(8), ownerReviewGate("GH-1300", 26 * HOUR_MS)];
    const board = createBoardHarness({ gates });
    try {
      const run = await board.run([], { json: true });
      const rendered = boardGates(run);
      expect(rendered.map((gate) => gate.id)).toContain("GH-1300:owner-review");
      expect(rendered[0]?.slaState).toBe("escalated");
      expect(boardData(run)?.omitted).toBe(1);
    } finally {
      board.cleanup();
    }
  });

  test("an unknown-age gate (escalated) renders ahead of a fresh gate", async () => {
    const board = createBoardHarness({
      gates: [ownerReviewGate("GH-1301", HOUR_MS), gateFact({ id: "GH-1302", absent: "missing" })],
    });
    try {
      const run = await board.run([], { json: true });
      expect(boardGates(run)[0]?.id).toBe("GH-1302");
      expect(boardGates(run)[0]?.slaState).toBe("escalated");
    } finally {
      board.cleanup();
    }
  });

  test("the machine payload stays within 65 536 bytes for legal and hostile fixtures", async () => {
    const hostile = Array.from({ length: 8 }, (_, index) =>
      gateFact({
        id: `${"ż".repeat(500)}-${index}`,
        ref: `${"ó".repeat(500)}-${index}`,
        ageMs: (index + 1) * HOUR_MS,
        waivedBy: "ł".repeat(500),
      }),
    );
    for (const gates of [gateSet(8), hostile]) {
      const board = createBoardHarness({ gates });
      try {
        const run = await board.run([], { json: true });
        const data = boardData(run);
        expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
          BOARD_MAX_MACHINE_BYTES,
        );
        expect(data?.truncated).toBe(gates === hostile);
      } finally {
        board.cleanup();
      }
    }
  });

  test("the human grid stays within 24 lines / 4 096 bytes for legal and hostile fixtures", async () => {
    const hostile = Array.from({ length: 8 }, (_, index) =>
      gateFact({
        id: `${"ż".repeat(500)}-${index}`,
        ref: `${"ó".repeat(500)}-${index}`,
        ageMs: (index + 1) * HOUR_MS,
      }),
    );
    for (const gates of [gateSet(8), hostile]) {
      const board = createBoardHarness({ gates });
      try {
        const run = await board.run([], { json: false });
        const lines = run.stdout.trimEnd().split("\n");
        expect(lines.length).toBeLessThanOrEqual(BOARD_MAX_HUMAN_LINES);
        expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(BOARD_MAX_HUMAN_BYTES);
        if (gates === hostile) expect(run.stdout).toContain("+");
      } finally {
        board.cleanup();
      }
    }
  });

  test("every drop is marked in both modes and under-cap controls carry no mark", async () => {
    const under = createBoardHarness({ gates: gateSet(8) });
    const over = createBoardHarness({ gates: gateSet(9) });
    try {
      const underJson = await under.run([], { json: true });
      const underText = await under.run([], { json: false });
      expect(boardData(underJson)?.truncated).toBe(false);
      expect(underText.stdout).not.toContain("more gates omitted");

      const overJson = await over.run([], { json: true });
      const overText = await over.run([], { json: false });
      expect(boardData(overJson)?.omitted).toBe(1);
      expect(overText.stdout).toContain("+1 more gates omitted");
    } finally {
      under.cleanup();
      over.cleanup();
    }
  });

  test("truncation is deterministic: the same 8 gates and marker across repeats", async () => {
    const first = createBoardHarness({ gates: gateSet(100) });
    const second = createBoardHarness({ gates: gateSet(100) });
    try {
      const one = await first.run([], { json: true });
      const two = await second.run([], { json: true });
      expect(boardGates(one).map((gate) => gate.id)).toEqual(
        boardGates(two).map((gate) => gate.id),
      );
      expect(boardData(one)?.omitted).toBe(92);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
