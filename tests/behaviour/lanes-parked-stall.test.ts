/**
 * TC-SUP-041 / TC-SUP-042 — `lanes show` reads the parked state, the classified
 * reason, and the additive active-park `until`; the until is present exactly for
 * an active expiry-carrying park (GH-295 AC-F5-1, DM-2, DM-3, EVT-1, DEC-2).
 */
import { describe, expect, test } from "bun:test";
import { createLanesCommandDefinition } from "../../packages/cli/src/commands/lanes";
import { readQueueParks } from "../../packages/core/src/app/index";
import { runProgram } from "../fixtures/queue-ready/harness";
import {
  createSupervisionHarness,
  LANES_NOW_ISO,
  LANES_RECHECK_MS,
  lanesReadFor,
} from "../fixtures/supervise/harness";
import { LANE_REF, seedHeartbeat, seedLane } from "../fixtures/supervise/records";

describe("TC-SUP-041 lanes show reads the parked state after a battery run", () => {
  test("state, reason, active until, counts, and the snapshot frame follow the park", async () => {
    const harness = createSupervisionHarness({ label: "lanes-parked" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      const park = parks.records[0];
      if (park === undefined) throw new Error("park missing");
      const data = lanesReadFor({ cause: park.cause, until: park.until });
      const lane = data.lanes[0];
      expect(lane?.state).toBe("parked");
      expect(lane?.reason).toBe("parked:liveness-stall");
      expect(lane?.until).toBe(park.until);
      expect(data.counts.parked).toBe(1);
      expect(data.counts.delivering).toBe(0);
      // The machine read through the delivered command.
      const program = {
        commands: {
          lanes: createLanesCommandDefinition({ readLanes: () => ({ ok: true, data }) }),
        },
      };
      const machine = await runProgram(["lanes", "show", LANE_REF, "--json"], program);
      expect(machine.exitCode).toBe(0);
      const payload = JSON.parse(machine.stdout) as { data?: Record<string, unknown> };
      const shownLanes = (payload.data?.lanes ?? []) as readonly Record<string, unknown>[];
      const shown = shownLanes[0];
      expect(shown?.state).toBe("parked");
      expect(shown?.reason).toBe("parked:liveness-stall");
      expect(shown?.until).toBe(park.until);
      const human = await runProgram(["lanes", "show", LANE_REF], program);
      expect(human.stdout).toContain("parked");
      expect(human.stdout).toContain("parked:liveness-stall");
      // The delivered snapshot frame carries the same payload with no taxonomy change.
      const frame = { topic: "lanes", cursor: 1, snapshot: data };
      expect(Object.keys(frame)).toEqual(["topic", "cursor", "snapshot"]);
      expect((frame.snapshot.lanes[0] as Record<string, unknown>).reason).toBe(
        "parked:liveness-stall",
      );
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-042 the additive until is present exactly for an expiry-carrying park", () => {
  test("present for peak-window and liveness-stall, absent for none and owner-hold", () => {
    const until = new Date(Date.parse(LANES_NOW_ISO) + LANES_RECHECK_MS).toISOString();
    const cells = [
      { cause: undefined, expected: undefined },
      { cause: "owner-hold" as const, expected: undefined },
      { cause: "peak-window" as const, expected: until },
      { cause: "liveness-stall" as const, expected: until },
    ];
    for (const cell of cells) {
      const data = lanesReadFor({
        ...(cell.cause === undefined ? {} : { cause: cell.cause, until }),
      });
      const lane = data.lanes[0] as Record<string, unknown>;
      expect(lane.until, String(cell.cause)).toBe(cell.expected);
      if (cell.expected === undefined) expect(Object.hasOwn(lane, "until")).toBe(false);
    }
  });

  test("a pre-change park replays without inventing the new cause", () => {
    const data = lanesReadFor({ cause: "peak-window", until: LANES_NOW_ISO });
    expect(data.lanes[0]?.reason).toBe("parked:peak-window");
    expect(data.lanes[0]?.reason).not.toBe("parked:liveness-stall");
    const committed = lanesReadFor({ cause: "owner-hold" });
    expect(committed.lanes[0]?.reason).toBe("parked:owner-hold");
  });
});
