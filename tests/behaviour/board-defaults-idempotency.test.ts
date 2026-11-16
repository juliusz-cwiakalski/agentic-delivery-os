/**
 * TC-BOARD-021 — default application appends exactly one decision record per
 * repository and is idempotent across runs (AC-F4-2, NFR-6, DM-3).
 */
import { describe, expect, test } from "bun:test";
import { readOwnerGateSlaDecisions } from "../../packages/core/src/state/index";
import { boardGates, createBoardHarness } from "../fixtures/board/harness";
import { HOUR_MS, waiverGate } from "../fixtures/board/matrix";
import { BOARD_REPOSITORY } from "../fixtures/board/sections";

const repository = () => ({
  key: BOARD_REPOSITORY,
  gates: [waiverGate("GH-4501", 73 * HOUR_MS, { waivedBy: "principal-w" })],
  lanes: [],
  asks: [],
  parks: [],
});

describe("TC-BOARD-021 idempotent default application", () => {
  test("the first run appends one record, the second appends nothing", async () => {
    const board = createBoardHarness({ repositories: [repository()] });
    try {
      const first = await board.run([], { json: true });
      expect(first.exitCode).toBe(0);
      expect(boardGates(first)[0]?.slaState).toBe("default-applied");
      const read = readOwnerGateSlaDecisions(board.state.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(1);

      const second = await board.run([], { json: true });
      expect(second.exitCode).toBe(0);
      expect(boardGates(second)[0]).toEqual(boardGates(first)[0]);
      const replay = readOwnerGateSlaDecisions(board.state.store);
      if (replay.ok) expect(replay.value.recordCount).toBe(1);
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        1,
      );
    } finally {
      board.cleanup();
    }
  });

  test("an already-recorded decision performs no append and renders the same row", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          ...repository(),
          decisions: [
            {
              schemaId: "delivery.owner-gate.decision.v1",
              gateId: "GH-4501:waiver",
              gateKind: "waiver",
              workItemRef: "GH-4501",
              appliedDefault: "owner-review-first",
              appliedAt: "2026-11-06T11:00:00Z",
              thresholdCrossedMs: 72 * HOUR_MS,
              clockSource: "activity-timestamp",
            },
          ],
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(boardGates(run)[0]?.slaState).toBe("default-applied");
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        0,
      );
    } finally {
      board.cleanup();
    }
  });
});
