/**
 * TC-STEER-023 (golden half) — the `steer list` human form and machine `data`
 * against the committed golden pair created by this change.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lifecycleMatrix } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/steer/golden");

const seed = (harness: ReturnType<typeof createSteerHarness>): void => {
  const matrix = lifecycleMatrix();
  for (const message of matrix.messages) harness.seedMessage(message);
  for (const outcome of matrix.outcomes) harness.seedOutcome(outcome);
  for (const completion of matrix.completions) harness.seedCompletion(completion);
};

describe("TC-STEER-023 the steer list golden pair", () => {
  test("the human form and the machine data are the committed bytes and are stable", async () => {
    expect(existsSync(join(GOLDEN, "list.txt"))).toBe(true);
    expect(existsSync(join(GOLDEN, "list.json"))).toBe(true);
    expect(existsSync(join(GOLDEN, "regenerate.ts"))).toBe(true);
    const harness = createSteerHarness();
    try {
      seed(harness);
      const first = await harness.run(["list"], { json: false });
      const second = await harness.run(["list"], { json: false });
      expect(first.stdout).toBe(second.stdout);
      expect(first.stdout).toBe(readFileSync(join(GOLDEN, "list.txt"), "utf8"));
      const machine = await harness.run(["list"]);
      const machineAgain = await harness.run(["list"]);
      expect(JSON.stringify(machineAgain.data)).toBe(JSON.stringify(machine.data));
      expect(`${JSON.stringify(machine.data, null, 2)}\n`).toBe(
        readFileSync(join(GOLDEN, "list.json"), "utf8"),
      );
    } finally {
      harness.cleanup();
    }
  });
});
