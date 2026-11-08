/** TC-WATCH-004 / TC-DEGRADE-004 — unreadable state exits 2, never an all-clear. */
import { describe, expect, test } from "bun:test";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { runProgram } from "../fixtures/queue-ready/harness";

const program = () =>
  ({
    commands: {
      lanes: createLanesCommandDefinition({
        readLanes: () => ({ ok: false, code: "status.collector.lanes.unavailable" }),
        watch: async function* () {
          yield "{}";
        },
      }),
    },
  }) as never;

describe("GH-238 unreadable watch", () => {
  test("exits 2 with the delivered state identity", async () => {
    const run = await runProgram(["lanes", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(2);
    expect(run.stdout).toContain("status.collector.lanes.unavailable");
  });
});
