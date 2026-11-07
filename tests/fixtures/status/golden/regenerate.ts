/**
 * Explicit golden regeneration for the status digest (TC-STATUS-031).
 *
 * Run manually from the repository root:
 *   bun run tests/fixtures/status/golden/regenerate.ts
 *
 * The suites only read these files; they never write them.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { capSizedFacts, runStatusCli, statusRuntime } from "../harness";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const human = await runStatusCli(["status"], statusRuntime(capSizedFacts()));
  const machine = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
  writeFileSync(join(directory, "human.txt"), human.stdout, "utf8");
  writeFileSync(join(directory, "digest.json"), machine.stdout, "utf8");
};

await main();
