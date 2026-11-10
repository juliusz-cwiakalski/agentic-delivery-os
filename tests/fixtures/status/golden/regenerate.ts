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
import { capSizedFacts, reservedSlotFacts, runStatusCli, statusRuntime } from "../harness";

const directory = import.meta.dir;

const main = async (): Promise<void> => {
  const human = await runStatusCli(["status"], statusRuntime(capSizedFacts()));
  const machine = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
  writeFileSync(join(directory, "human.txt"), human.stdout, "utf8");
  writeFileSync(join(directory, "digest.json"), machine.stdout, "utf8");
  // GH-241: the reserved escalation-slot golden is regenerated explicitly here
  // only; the control files above are never touched by the slot case.
  const reservedHuman = await runStatusCli(["status"], statusRuntime(reservedSlotFacts()));
  const reservedMachine = await runStatusCli(
    ["--json", "status"],
    statusRuntime(reservedSlotFacts()),
  );
  writeFileSync(join(directory, "reserved-human.txt"), reservedHuman.stdout, "utf8");
  writeFileSync(join(directory, "reserved-digest.json"), reservedMachine.stdout, "utf8");
};

await main();
