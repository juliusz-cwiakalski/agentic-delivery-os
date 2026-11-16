/**
 * Explicit golden regeneration for the four-section board (TC-BOARD-060).
 *
 * Run manually from the repository root:
 *   bun run tests/fixtures/board/golden/regenerate.ts
 *
 * The suites only read these files; they never write them.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBoardHarness } from "../harness";
import { FULL_NOW_ISO, FULL_NOW_MS, FULL_RUN_ID, fullBoardRepositories } from "./full";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const run = async (json: boolean): Promise<string> => {
    const board = createBoardHarness({
      repositories: fullBoardRepositories(),
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
  writeFileSync(join(directory, "full-envelope.json"), await run(true), "utf8");
  writeFileSync(join(directory, "full-grid.txt"), await run(false), "utf8");
};

await main();
