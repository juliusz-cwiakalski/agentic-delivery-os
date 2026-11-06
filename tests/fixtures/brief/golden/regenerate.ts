/**
 * Explicit golden regeneration for the brief (TC-BRIEF-014/015, D12).
 *
 * Run manually from the repository root:
 *   bun run tests/fixtures/brief/golden/regenerate.ts
 *
 * The suites only read these files; they never write them.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { briefRuntime, capSizedFacts, runBriefCli } from "../harness";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const human = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
  const machine = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
  writeFileSync(join(directory, "human.txt"), human.stdout, "utf8");
  writeFileSync(join(directory, "envelope.json"), machine.stdout, "utf8");
};

await main();
