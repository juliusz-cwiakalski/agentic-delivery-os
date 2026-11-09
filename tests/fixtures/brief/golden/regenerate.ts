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
import { briefRuntime, capSizedFacts, reservedSlotFacts, runBriefCli } from "../harness";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const human = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
  const machine = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
  writeFileSync(join(directory, "human.txt"), human.stdout, "utf8");
  writeFileSync(join(directory, "envelope.json"), machine.stdout, "utf8");
  // GH-241: the reserved escalation-slot golden is regenerated explicitly here
  // only; the control files above are never touched by the slot case.
  const reservedHuman = await runBriefCli(["brief"], briefRuntime(reservedSlotFacts()));
  const reservedMachine = await runBriefCli(["--json", "brief"], briefRuntime(reservedSlotFacts()));
  writeFileSync(join(directory, "reserved-human.txt"), reservedHuman.stdout, "utf8");
  writeFileSync(join(directory, "reserved-envelope.json"), reservedMachine.stdout, "utf8");
};

await main();
