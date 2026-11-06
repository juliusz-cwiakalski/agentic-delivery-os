/**
 * TC-SLA-029 — the full board output is pinned byte-for-byte in both modes at a
 * fixed clock/run id/brand, within bounds, and the snapshot is proven live by
 * mutation.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { boardData, createBoardHarness } from "../fixtures/board/harness";
import { gateFact, HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/board/golden");
const GOLDEN_ENVELOPE = join(GOLDEN, "envelope.json");
const GOLDEN_GRID = join(GOLDEN, "grid.txt");

const GATES = [
  ownerReviewGate("GH-1701", 10 * HOUR_MS),
  ownerReviewGate("GH-1702", 26 * HOUR_MS),
  waiverGate("GH-1703", 72 * HOUR_MS),
  gateFact({ id: "GH-1704:owner-review", ref: "GH-1704", absent: "missing" }),
  gateFact({ id: "GH-1705:owner-review", ref: "GH-1705", activityAt: "not-a-date" }),
  ownerReviewGate("GH-1706", 100 * HOUR_MS, { waivedBy: "owner" }),
  ownerReviewGate("GH-1707", 73 * HOUR_MS),
  ownerReviewGate("GH-1708", 2 * HOUR_MS),
];

const runGolden = async (
  mode: "json" | "text",
  gates = GATES,
): Promise<{ readonly stdout: string; readonly data: Record<string, unknown> | undefined }> => {
  const board = createBoardHarness({ gates, runId: "run-board-fixture" });
  try {
    const run = await board.run([], { json: mode === "json" });
    return { stdout: run.stdout, data: mode === "json" ? boardData(run) : undefined };
  } finally {
    board.cleanup();
  }
};

describe("TC-SLA-029 golden board snapshot", () => {
  test("the machine envelope matches the committed golden bytes", async () => {
    const run = await runGolden("json");
    expect(run.stdout).toBe(readFileSync(GOLDEN_ENVELOPE, "utf8"));
  });

  test("the human grid matches the committed golden bytes", async () => {
    const run = await runGolden("text");
    expect(run.stdout).toBe(readFileSync(GOLDEN_GRID, "utf8"));
  });

  test("the golden payload is within bounds and carries the mixed states", () => {
    const parsed = JSON.parse(readFileSync(GOLDEN_ENVELOPE, "utf8")) as Record<string, unknown>;
    expect(assertEnvelopeContract(parsed)).toEqual([]);
    const data = parsed.data as { gates: { slaState: string }[] };
    expect(data.gates.map((gate) => gate.slaState)).toEqual([
      "escalated",
      "escalated",
      "escalated",
      "escalated",
      "escalated",
      "default-applied",
      "fresh",
      "fresh",
    ]);
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      BOARD_MAX_MACHINE_BYTES,
    );
    const grid = readFileSync(GOLDEN_GRID, "utf8");
    expect(grid.trimEnd().split("\n").length).toBeLessThanOrEqual(BOARD_MAX_HUMAN_LINES);
    expect(Buffer.byteLength(grid, "utf8")).toBeLessThanOrEqual(BOARD_MAX_HUMAN_BYTES);
  });

  test("mutation controls: changed age, waiver authorizer, or kind breaks the golden", async () => {
    const changedAge = [...GATES];
    changedAge[0] = ownerReviewGate("GH-1701", 24 * HOUR_MS);
    expect((await runGolden("json", changedAge)).stdout).not.toBe(
      readFileSync(GOLDEN_ENVELOPE, "utf8"),
    );

    const changedWaiver = [...GATES];
    changedWaiver[5] = ownerReviewGate("GH-1706", 100 * HOUR_MS, {
      waivedBy: "coordinator",
    });
    expect((await runGolden("json", changedWaiver)).stdout).not.toBe(
      readFileSync(GOLDEN_ENVELOPE, "utf8"),
    );

    const changedKind = [...GATES];
    changedKind[0] = waiverGate("GH-1701", 10 * HOUR_MS);
    expect((await runGolden("json", changedKind)).stdout).not.toBe(
      readFileSync(GOLDEN_ENVELOPE, "utf8"),
    );
  });

  test("the golden files are read-only at test time", () => {
    const before = statSync(GOLDEN_ENVELOPE).mtimeMs + statSync(GOLDEN_GRID).mtimeMs;
    expect(readFileSync(GOLDEN_ENVELOPE, "utf8").length).toBeGreaterThan(0);
    expect(readFileSync(GOLDEN_GRID, "utf8").length).toBeGreaterThan(0);
    const after = statSync(GOLDEN_ENVELOPE).mtimeMs + statSync(GOLDEN_GRID).mtimeMs;
    expect(after).toBe(before);
  });
});
