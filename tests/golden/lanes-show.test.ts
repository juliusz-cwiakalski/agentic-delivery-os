/**
 * TC-LANES-002 / TC-LANES-005 (GH-237) — `lanes show <ref>` selects one lane and
 * its committed goldens are byte-compared.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { laneData } from "../fixtures/queue/lanes/harness";
import { runProgram } from "../fixtures/queue-ready/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

const program = () => {
  const data = laneData();
  return {
    commands: {
      lanes: createLanesCommandDefinition({ readLanes: () => ({ ok: true, data }) }),
    },
  };
};

describe("lane show golden", () => {
  test("the machine payload is byte-identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "show", "GH-320", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "lanes-show.json"), "utf8")),
    );
  });

  test("the human output is byte-identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "show", "GH-320"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "lanes-show.txt"), "utf8"));
  });
});
