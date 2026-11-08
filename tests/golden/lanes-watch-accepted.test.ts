/**
 * TC-WATCH-002/003 — `lanes --watch` is accepted; with no daemon it streams a
 * bounded snapshot and a declared degraded marker at exit 0.
 */
import { describe, expect, test } from "bun:test";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { laneData } from "../fixtures/queue/lanes/harness";
import { runProgram } from "../fixtures/queue-ready/harness";

const program = () =>
  ({
    commands: {
      lanes: createLanesCommandDefinition({
        readLanes: () => ({ ok: true, data: laneData() }),
        watch: async function* () {
          yield JSON.stringify({
            kind: "event",
            type: "frame",
            topic: "lanes",
            cursor: 0,
            degraded: ["daemon-unreachable"],
            data: { lanes: 1 },
          });
          yield JSON.stringify({
            kind: "event",
            type: "frame",
            topic: "lanes",
            cursor: 1,
            degraded: ["daemon-unreachable"],
            data: { lanes: 2 },
          });
        },
      }),
    },
  }) as const;

describe("lanes --watch acceptance", () => {
  test("the invocation exits 0 and streams bounded degraded lines", async () => {
    const run = await runProgram(["lanes", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('"watch": true');
    const lines = run.stdout.trim().split("\n");
    const events = lines
      .filter((line) => line.startsWith('{"kind":"event"'))
      .map((line) => JSON.parse(line) as { type?: string; degraded?: string[] });
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("frame");
    expect(events[0]?.degraded).toEqual(["daemon-unreachable"]);
  });
});
