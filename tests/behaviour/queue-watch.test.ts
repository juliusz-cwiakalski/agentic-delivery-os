/** TC-WATCH-001/003 — queue watch streams a bounded snapshot and deduped events. */
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
            data: { entries: 1 },
          });
          yield JSON.stringify({
            kind: "event",
            type: "frame",
            topic: "queue",
            cursor: 1,
            data: { entries: 2 },
          });
        },
      }),
    },
  }) as never;

describe("GH-238 queue watch", () => {
  test("exits 0 and prints one bounded event per line", async () => {
    const run = await runProgram(["queue", "list", "--watch", "--json"], program());
    expect(run.exitCode).toBe(0);
    const events = run.stdout
      .split("\n")
      .filter((line) => line.startsWith('{"kind":"event"'))
      .map((line) => JSON.parse(line) as { cursor: number });
    expect(events.map((event) => event.cursor)).toEqual([0, 1]);
  });

  test("human mode drains the same bounded event stream", async () => {
    const run = await runProgram(["queue", "list", "--watch"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('"kind":"event"');
    expect(run.stdout).toContain('"cursor":1');
  });
});

describe("GH-280 queue watch carries the hold", () => {
  test("the streamed frame carries the active owner hold and no action", async () => {
    const event = {
      kind: "event",
      type: "frame",
      topic: "queue",
      cursor: 0,
      data: {
        ownerHold: { source: "marker", reason: "peak-hour cost pause" },
        entries: [{ ref: "GH-320", state: "held", blocking: [{ reason: "owner-hold" }] }],
        nextActions: [],
      },
    };
    const heldProgram = () =>
      ({
        commands: {
          queue: createQueueCommandDefinition({
            watch: async function* () {
              yield JSON.stringify(event);
            },
          }),
        },
      }) as never;
    const run = await runProgram(["queue", "list", "--watch", "--json"], heldProgram());
    expect(run.exitCode).toBe(0);
    const frame = JSON.parse(
      run.stdout.split("\n").find((line) => line.startsWith('{"kind":"event"')) ?? "{}",
    ) as {
      readonly data: {
        readonly ownerHold?: { readonly source: string };
        readonly nextActions?: unknown[];
      };
    };
    expect(frame.data.ownerHold?.source).toBe("marker");
    expect(frame.data.nextActions).toEqual([]);
  });
});
