/**
 * TC-HOLDQUEUE-009 projector half (GH-280) — `ownerHold` is projected only
 * when active, the inactive payloads are byte-identical to the delivered shape,
 * `queue ready` is unchanged and carries no hold, and the lanes payload keeps
 * its delivered shape without a field addition.
 */
import { describe, expect, test } from "bun:test";
import {
  toQueuePlanData,
  toQueueReadData,
} from "../../packages/cli/src/commands/queue";
import {
  type OwnerHoldFact,
  type QueueReadyFacts,
} from "../../packages/core/src/contracts/index";
import { evaluateQueueReady } from "../../packages/core/src/domain/queue-ready";
import { computeQueueSchedule, foldLanes } from "../../packages/core/src/domain/index";
import { canonicalFacts } from "../fixtures/queue-ready/golden/canonical";
import { makeFacts } from "../fixtures/queue/schedule/harness";

const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const specs = [
  { ref: "GH-101", repository: "github.com/owner/repo-alpha" },
  { ref: "GH-102", repository: "github.com/owner/repo-beta" },
] as const;

describe("TC-HOLDQUEUE-009 payload presence only when active", () => {
  test("the active read and plan payloads carry the projected member", () => {
    const schedule = computeQueueSchedule({ ...makeFacts(specs), ownerHold: HOLD });
    const read = toQueueReadData(schedule, []);
    const plan = toQueuePlanData(schedule, []);
    expect(read.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });
    expect(plan.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });
    expect(read.nextActions).toBeUndefined();
    expect(plan.nextActions).toEqual([]);
    expect(read.entries.every((entry) => entry.blocking[0]?.reason === "owner-hold")).toBe(true);
  });

  test("the inactive payloads carry no member and are byte-identical to the delivered shape", () => {
    const schedule = computeQueueSchedule(makeFacts(specs));
    const read = toQueueReadData(schedule, []);
    const plan = toQueuePlanData(schedule, []);
    expect(Object.hasOwn(read, "ownerHold")).toBe(false);
    expect(Object.hasOwn(plan, "ownerHold")).toBe(false);
    const again = toQueueReadData(computeQueueSchedule(makeFacts(specs)), []);
    expect(JSON.stringify(read)).toBe(JSON.stringify(again));
  });

  test("the lanes payload shape is unchanged", () => {
    const schedule = computeQueueSchedule({ ...makeFacts(specs), ownerHold: HOLD });
    const lanes = foldLanes({ schedule, economics: {}, degraded: [] });
    expect(Object.hasOwn(lanes, "ownerHold")).toBe(false);
    expect(lanes.lanes).toHaveLength(specs.length);
  });
});

describe("TC-HOLDQUEUE-009 queue ready is unchanged and carries no hold", () => {
  test("the ready payload is byte-identical with and without the hold", () => {
    const without = evaluateQueueReady(canonicalFacts());
    const withHold: QueueReadyFacts & { readonly ownerHold?: OwnerHoldFact } = {
      ...canonicalFacts(),
      ownerHold: HOLD,
    };
    const held = evaluateQueueReady(withHold);
    expect(JSON.stringify(held)).toBe(JSON.stringify(without));
    expect(Object.hasOwn(held, "ownerHold")).toBe(false);
  });
});
