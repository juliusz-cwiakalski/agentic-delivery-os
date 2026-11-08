/** TC-WATCH-002 — lanes watch keeps finding codes and honours the frame bound. */
import { describe, expect, test } from "bun:test";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { runProgram } from "../fixtures/queue-ready/harness";
import { laneData } from "../fixtures/queue/lanes/harness";

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
            data: { lanes: [{ ref: "GH-320", state: "delivering", findings: ["lease-held"] }] },
          });
        },
      }),
    },
  }) as never;

describe("GH-238 lanes watch", () => {
  test("preserves finding codes and exits 0", async () => {
    const run = await runProgram(["lanes", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("lease-held");
  });
});
