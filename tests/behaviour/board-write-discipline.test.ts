/**
 * TC-BOARD-061 — the only write is the idempotent decision record, plus the two
 * delivered store-opening side effects; no index maintenance, no prune, no edit
 * or delete (AC-F9-2, NFR-6, DEC-6).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createBoardHarness } from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";
import { BOARD_REPOSITORY } from "../fixtures/board/sections";

type Snapshot = Readonly<Record<string, string>>;

const snapshot = (root: string): Snapshot => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else {
        const path = join(root, next);
        const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
        files.push(`${next}:${String(statSync(path).size)}:${digest}`);
      }
    }
  };
  walk("");
  return Object.fromEntries(files.map((entry) => [entry.split(":")[0] ?? entry, entry]));
};

const changed = (before: Snapshot, after: Snapshot): string[] => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => before[key] !== after[key]).sort();
};

describe("TC-BOARD-061 write discipline", () => {
  test("a read-only run leaves the store byte-identical", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [ownerReviewGate("GH-8001", 2 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
    });
    try {
      const before = snapshot(board.state.root);
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(changed(before, snapshot(board.state.root))).toEqual([]);
    } finally {
      board.cleanup();
    }
  });

  test("a default application writes exactly one record; the replay writes nothing", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [waiverGate("GH-8002", 73 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
    });
    try {
      const before = snapshot(board.state.root);
      const first = await board.run([], { json: true });
      expect(first.exitCode).toBe(0);
      const afterFirst = snapshot(board.state.root);
      const written = changed(before, afterFirst);
      // Exactly the repository's decision ledger and the store's create-once
      // header artifact are created; no index, prune, edit, or delete occurs.
      expect(written).toHaveLength(2);
      expect(written.some((entry) => entry.endsWith(".jsonl"))).toBe(true);
      expect(written.some((entry) => entry.endsWith(".json"))).toBe(true);
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        1,
      );

      const second = await board.run([], { json: true });
      expect(second.exitCode).toBe(0);
      expect(changed(afterFirst, snapshot(board.state.root))).toEqual([]);
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        1,
      );
    } finally {
      board.cleanup();
    }
  });
});
