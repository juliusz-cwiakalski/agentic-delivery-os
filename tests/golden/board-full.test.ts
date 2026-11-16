/**
 * TC-BOARD-060 — two runs are byte-identical in both modes, the committed
 * four-section golden pair pins the output, and every array follows the
 * declared repository-then-section order with unique identities (AC-F9-1,
 * NFR-2, NFR-3).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  FULL_NOW_ISO,
  FULL_NOW_MS,
  FULL_RUN_ID,
  fullBoardRepositories,
} from "../fixtures/board/golden/full";
import { createBoardHarness } from "../fixtures/board/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/board/golden");

const run = async (json: boolean, repositories = fullBoardRepositories()): Promise<string> => {
  const board = createBoardHarness({
    repositories,
    selection: "all",
    runId: FULL_RUN_ID,
    nowIso: FULL_NOW_ISO,
    nowMs: FULL_NOW_MS,
  });
  try {
    return (await board.run([], { json })).stdout;
  } finally {
    board.cleanup();
  }
};

describe("TC-BOARD-060 determinism and the four-section golden", () => {
  test("two runs are byte-identical in both modes", async () => {
    for (const json of [true, false]) {
      const first = await run(json);
      const second = await run(json);
      expect(first, json ? "json" : "text").toBe(second);
    }
  });

  test("the machine envelope and the human grid match the committed goldens", async () => {
    const machine = await run(true);
    expect(machine).toBe(readFileSync(join(GOLDEN, "full-envelope.json"), "utf8"));
    const human = await run(false);
    expect(human).toBe(readFileSync(join(GOLDEN, "full-grid.txt"), "utf8"));
    const parsed = JSON.parse(machine) as Record<string, unknown>;
    expect(assertEnvelopeContract(parsed)).toEqual([]);
  });

  test("every array follows the declared order with unique identities", async () => {
    const parsed = JSON.parse(await run(true)) as {
      readonly data: Record<string, readonly Record<string, unknown>[]>;
    };
    const repositories = parsed.data.repositories as unknown as readonly string[];
    expect([...repositories]).toEqual([...repositories].sort());
    const lanes = parsed.data.lanes ?? [];
    const gates = parsed.data.gates ?? [];
    const asks = parsed.data.asks ?? [];
    const parked = parsed.data.parked ?? [];
    for (const rows of [lanes, gates, asks, parked]) {
      for (let index = 1; index < rows.length; index += 1) {
        const previous = String(rows[index - 1]?.repository);
        const current = String(rows[index]?.repository);
        expect(previous <= current).toBe(true);
      }
    }
    const identities = [
      ...lanes.map((row) => `lane:${String(row.repository)}|${String(row.ref)}`),
      ...gates.map((row) => `gate:${String(row.repository)}|${String(row.id)}`),
      ...asks.map((row) => `ask:${String(row.repository)}|${String(row.id)}`),
      ...parked.map((row) => `park:${String(row.repository)}|${String(row.ref)}`),
    ];
    expect(new Set(identities).size).toBe(identities.length);
  });

  test("a reordered repository input produces identical bytes (permutation independence)", async () => {
    const forward = await run(true, fullBoardRepositories());
    const reversed = await run(true, [...fullBoardRepositories()].reverse());
    expect(reversed).toBe(forward);
  });

  test("the golden is live: a changed fact changes the bytes", async () => {
    const mutated = fullBoardRepositories().map((repository, index) =>
      index === 0
        ? { ...repository, gates: [...(repository.gates ?? []), ...(repository.gates ?? [])] }
        : repository,
    );
    expect(await run(true, mutated)).not.toBe(await run(true));
  });
});
