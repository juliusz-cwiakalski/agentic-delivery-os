/**
 * TC-LANES-002 / TC-LANES-005 (GH-237) — `lanes show <ref>` selects one lane and
 * its machine golden is structurally compared and its human output is byte-exact.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { laneData } from "../fixtures/queue/lanes/harness";
import { runProgram } from "../fixtures/queue-ready/harness";
import { LANES_NOW_ISO, LANES_RECHECK_MS, lanesReadFor } from "../fixtures/supervise/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");
const SUPERVISE_GOLDEN = join(ROOT, "tests/fixtures/supervise/golden");

const program = () => {
  const data = laneData();
  return {
    commands: {
      lanes: createLanesCommandDefinition({ readLanes: () => ({ ok: true, data }) }),
    },
  };
};

describe("lane show golden", () => {
  test("the machine payload is structurally identical to the committed golden", async () => {
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

/**
 * TC-SUP-093 (GH-295) — the parked lanes-show cell: the supervised-stall cause,
 * the classified reason, and the additive active-park `until`, byte-exact in the
 * delivered rendering. The delivered non-parked cells above are untouched.
 */
describe("lanes show parked golden (GH-295)", () => {
  const parkedProgram = () => {
    const data = lanesReadFor({
      cause: "liveness-stall",
      until: new Date(Date.parse(LANES_NOW_ISO) + LANES_RECHECK_MS).toISOString(),
    });
    return {
      commands: {
        lanes: createLanesCommandDefinition({ readLanes: () => ({ ok: true, data }) }),
      },
    };
  };

  test("the parked machine payload is structurally identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "show", "GH-295", "--json"], parkedProgram());
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      runId: string;
      timing: { totalMs: number };
    };
    const normalized = { ...envelope, runId: "<run-id>", timing: { totalMs: 0 } };
    expect(normalized).toEqual(
      JSON.parse(readFileSync(join(SUPERVISE_GOLDEN, "lanes-show-parked.json"), "utf8")),
    );
  });

  test("the parked human output is byte-identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "show", "GH-295"], parkedProgram());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(SUPERVISE_GOLDEN, "lanes-show-parked.txt"), "utf8"));
  });
});
