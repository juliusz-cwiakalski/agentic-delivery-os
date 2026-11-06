/**
 * Explicit blocker golden regeneration (TC-BLK-028/036/042).
 *
 * Run manually from the repository root:
 *   bun run tests/fixtures/blockers/golden/regenerate.ts
 *
 * The suites only read these files; they never write them.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { goldenAnswerRun, goldenListRun } from "./fixture";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const list = await goldenListRun();
  const answer = await goldenAnswerRun();
  writeFileSync(join(directory, "list-envelope.json"), list.machine, "utf8");
  writeFileSync(join(directory, "list-human.txt"), list.human, "utf8");
  writeFileSync(join(directory, "answer-envelope.json"), answer.machine, "utf8");
  writeFileSync(join(directory, "answer-human.txt"), answer.human, "utf8");
};

await main();
