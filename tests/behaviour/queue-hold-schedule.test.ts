/**
 * TC-HOLDQUEUE-001 (GH-280) — a held pass suppresses every next action,
 * prepends `owner-hold` on every gated entry, preserves active/stuck park
 * rendering, degrades a resumable park to `held`, keeps a delivering lane
 * delivering, and masks the specific lane reason while `queue list` keeps the
 * full ordered blocking list.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OwnerHoldFact } from "../../packages/core/src/contracts/index";
import type {
  QueueParkEvaluation,
  QueuePlanFact,
} from "../../packages/core/src/domain/queue-readiness";
import { computeQueueSchedule, foldLanes } from "../../packages/core/src/domain/index";
import {
  activeLease,
  makeFacts,
  observed,
  type EntrySpec,
} from "../fixtures/queue/schedule/harness";

type HoldCase = {
  readonly name: string;
  readonly ref: string;
  readonly repository: string;
  readonly edges?: readonly string[];
  readonly plan?: QueuePlanFact;
  readonly park?: QueueParkEvaluation;
  readonly workItemState?: string;
  readonly lease?: { readonly holder: string; readonly leaseId: string };
  readonly expectedState: string;
  readonly expectedReasons: readonly string[];
  readonly laneState: string;
  readonly laneReason: string | null;
};

type Fixture = {
  readonly hold: OwnerHoldFact;
  readonly cases: readonly HoldCase[];
};

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/queue/hold/cases.json"), "utf8"),
) as Fixture;

const specs = (): EntrySpec[] =>
  fixture.cases.map((item) => ({
    ref: item.ref,
    repository: item.repository,
    ...(item.edges === undefined ? {} : { edges: item.edges }),
    ...(item.plan === undefined ? {} : { plan: item.plan }),
    ...(item.park === undefined ? {} : { park: item.park }),
    ...(item.workItemState === undefined
      ? {}
      : { workItem: observed({ deliveryState: item.workItemState }) }),
  }));

const leases = () =>
  fixture.cases.flatMap((item) =>
    item.lease === undefined
      ? []
      : [
          activeLease({
            repository: item.repository,
            holder: item.lease.holder,
            ref: item.ref,
            leaseId: item.lease.leaseId,
          }),
        ],
  );

const heldFacts = () => ({ ...makeFacts(specs(), { leases: leases() }), ownerHold: fixture.hold });

describe("TC-HOLDQUEUE-001 a held pass suppresses actions and prepends owner-hold", () => {
  test("every entry is gated with owner-hold first and no action is emitted", () => {
    const schedule = computeQueueSchedule(heldFacts());
    expect(schedule.nextActions).toEqual([]);
    expect(schedule.nextActions.some((action) => action.preemption !== undefined)).toBe(false);
    expect(schedule.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });

    for (const item of fixture.cases) {
      const entry = schedule.entries.find((candidate) => candidate.ref === item.ref);
      if (entry === undefined) throw new Error(`entry ${item.ref} is missing`);
      expect(entry.state, item.name).toBe(item.expectedState);
      expect(
        entry.blocking.map((reason) => reason.reason),
        item.name,
      ).toEqual(item.expectedReasons);
    }
  });

  test("the lane fold renders exactly one reason and masks the specific not-ready/dependency reason", () => {
    const schedule = computeQueueSchedule(heldFacts());
    const lanes = foldLanes({ schedule, economics: {}, degraded: [] });
    for (const item of fixture.cases) {
      const lane = lanes.lanes.find((candidate) => candidate.ref === item.ref);
      if (lane === undefined) throw new Error(`lane ${item.ref} is missing`);
      expect(lane.state, item.name).toBe(item.laneState);
      expect(lane.reason ?? null, item.name).toBe(item.laneReason);
    }
    // queue list keeps the full ordered blocking list; the lane keeps one.
    const dependencyEntry = schedule.entries.find((entry) => entry.ref === "GH-102");
    expect(dependencyEntry?.blocking.map((reason) => reason.reason)).toEqual([
      "owner-hold",
      "dependency-open",
    ]);
    const dependencyLane = lanes.lanes.find((lane) => lane.ref === "GH-102");
    expect(dependencyLane?.reason).toBe("owner-hold");
  });

  test("two runs over identical facts are byte-identical and the no-hold control schedules", () => {
    const first = computeQueueSchedule(heldFacts());
    const second = computeQueueSchedule(heldFacts());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));

    const control = computeQueueSchedule(makeFacts(specs(), { leases: leases() }));
    expect(control.ownerHold).toBeUndefined();
    const ready = control.entries.find((entry) => entry.ref === "GH-101");
    expect(ready?.state).toBe("ready");
    expect(control.nextActions.length).toBeGreaterThan(0);
  });
});
