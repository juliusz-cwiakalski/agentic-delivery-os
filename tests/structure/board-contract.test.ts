/**
 * TC-BOARD-002 (structure), TC-BOARD-050 (envelope half), and TC-BOARD-064
 * (constant half) — the closed board vocabularies, the payload key set, the
 * five-field envelope, and the repository cap distinct from the host index
 * (DM-2, DM-7, DM-11, NFR-1, DEC-13).
 */
import { describe, expect, test } from "bun:test";
import {
  BOARD_ASK_DEFAULT_STATES,
  BOARD_COLLECTOR_IDS,
  BOARD_LANE_STATES,
  BOARD_MAX_REPOSITORIES,
  BOARD_OWNER_SOURCES,
  BOARD_PARKED_REASONS,
  BOARD_SCHEMA_VERSION,
  BOARD_SCOPES,
  BOARD_SELECTIONS,
  HOST_INDEX_MAX_ENTRIES,
} from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { boardData, createBoardHarness } from "../fixtures/board/harness";
import { allFourRepository } from "../fixtures/board/sections";

const DATA_KEYS = [
  "asks",
  "audience",
  "collectors",
  "gates",
  "lanes",
  "omitted",
  "omittedBySection",
  "ownerHold",
  "parked",
  "repositories",
  "schemaVersion",
  "scope",
  "selection",
  "stateSource",
  "truncated",
];

describe("TC-BOARD-002/050/064 board contract", () => {
  test("the closed vocabularies are exact and exported", () => {
    expect([...BOARD_SCOPES]).toEqual(["repository", "unbound"]);
    expect([...BOARD_SELECTIONS]).toEqual(["current", "project", "all"]);
    expect([...BOARD_LANE_STATES]).toEqual(["delivering", "failed"]);
    expect([...BOARD_OWNER_SOURCES]).toEqual([
      "lane-lease-holder",
      "gate-waiver-authorizer",
      "gate-audience",
      "ask-audience",
      "park-control",
    ]);
    expect([...BOARD_ASK_DEFAULT_STATES]).toEqual(["none", "pending", "applied"]);
    expect([...BOARD_PARKED_REASONS]).toEqual(["peak-window", "owner-hold"]);
    expect([...BOARD_COLLECTOR_IDS]).toEqual(["tracker", "lanes"]);
  });

  test("the repository cap is 128 and distinct from the host-index bound", () => {
    expect(BOARD_MAX_REPOSITORIES).toBe(128);
    expect(HOST_INDEX_MAX_ENTRIES).toBe(2_000);
    expect(BOARD_MAX_REPOSITORIES).not.toBe(HOST_INDEX_MAX_ENTRIES);
  });

  test("the payload is the declared key set inside the five-field envelope", async () => {
    const board = createBoardHarness({ repositories: [allFourRepository()] });
    try {
      const run = await board.run([], { json: true });
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      expect(Object.keys(run.envelope ?? {}).sort()).toEqual([
        "data",
        "exitCode",
        "runId",
        "schemaVersion",
        "timing",
      ]);
      const data = boardData(run);
      expect(Object.keys(data ?? {}).sort()).toEqual(DATA_KEYS);
      expect(data?.schemaVersion).toBe(BOARD_SCHEMA_VERSION);
      expect(data).not.toHaveProperty("ok");
      expect(data).not.toHaveProperty("command");
      expect(Object.keys((data?.omittedBySection ?? {}) as object).sort()).toEqual([
        "asks",
        "gates",
        "lanes",
        "parked",
        "repositories",
      ]);
    } finally {
      board.cleanup();
    }
  });
});
