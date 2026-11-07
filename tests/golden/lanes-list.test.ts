/**
 * TC-LANES-001 / TC-LANES-006 (GH-237) — the committed `lanes list` machine
 * golden is structurally compared and its human output is byte-exact; neither
 * carries absolute paths, wall-clock timestamps, or root.
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

describe("lane list golden", () => {
  test("the machine payload is structurally identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "list", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "lanes-list.json"), "utf8")),
    );
  });

  test("the human output is byte-identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "list"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "lanes-list.txt"), "utf8"));
  });

  test("the golden carries no absolute path, wall-clock timestamp, or root field", () => {
    const machine = readFileSync(join(GOLDEN, "lanes-list.json"), "utf8");
    const human = readFileSync(join(GOLDEN, "lanes-list.txt"), "utf8");
    for (const text of [machine, human]) {
      expect(text).not.toMatch(/"root"|repositoryRoot/);
      expect(text).not.toMatch(/\/work\/|\/home\/|\\\\/);
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });
});
