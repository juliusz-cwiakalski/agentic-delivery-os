/**
 * TC-LANES-004 (GH-237) — `--watch` is refused through fallback.invocation at
 * exit 1 with a resident-daemon remediation summary and no stream.
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

describe("lanes --watch refusal", () => {
  test("the refusal envelope is byte-identical to the committed golden", async () => {
    const run = await runProgram(["lanes", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "lanes-watch-refusal.json"), "utf8"));
  });

  test("the refusal carries the resident-daemon story and no data", async () => {
    const run = await runProgram(["lanes", "list", "--watch", "--json"], program());
    const envelope = JSON.parse(run.stdout) as {
      error?: { code?: string; summary?: string };
      data?: unknown;
    };
    expect(envelope.error?.code).toBe("fallback.invocation");
    expect(envelope.data).toBeUndefined();
  });
});
