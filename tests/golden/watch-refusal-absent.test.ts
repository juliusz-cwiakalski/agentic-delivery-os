/** TC-WATCH-003 — an absent daemon is named, never hidden. */
import { describe, expect, test } from "bun:test";
import { createQueueCommandDefinition } from "../../packages/cli/src/commands/queue";
import { runProgram } from "../fixtures/queue-ready/harness";

const program = () =>
  ({
    commands: {
      queue: createQueueCommandDefinition({
        watch: async function* () {
          yield JSON.stringify({
            kind: "event",
            type: "frame",
            topic: "queue",
            cursor: 0,
            degraded: ["daemon-unreachable"],
            data: { entries: 0 },
          });
        },
      }),
    },
  }) as never;

describe("GH-238 watch without a daemon", () => {
  test("names daemon-unreachable and exits 0", async () => {
    const run = await runProgram(["queue", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("daemon-unreachable");
  });
});
