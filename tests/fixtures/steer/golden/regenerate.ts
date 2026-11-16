/**
 * Regenerate the committed `steer list` golden pair from the canonical fixture.
 *
 * Run explicitly: `bun run tests/fixtures/steer/golden/regenerate.ts`.
 * The diff must show only the declared delta; no blanket rewrite exists.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lifecycleMatrix } from "../cases";
import { createSteerHarness } from "../harness";

const run = async (): Promise<void> => {
  const harness = createSteerHarness();
  try {
    const matrix = lifecycleMatrix();
    for (const message of matrix.messages) harness.seedMessage(message);
    for (const outcome of matrix.outcomes) harness.seedOutcome(outcome);
    for (const completion of matrix.completions) harness.seedCompletion(completion);
    const human = await harness.run(["list"], { json: false });
    const machine = await harness.run(["list"]);
    writeFileSync(join(import.meta.dir, "list.txt"), human.stdout);
    writeFileSync(join(import.meta.dir, "list.json"), `${JSON.stringify(machine.data, null, 2)}\n`);
  } finally {
    harness.cleanup();
  }
};

if (import.meta.main) await run();
