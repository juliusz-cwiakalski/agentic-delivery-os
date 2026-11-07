/**
 * TC-WEIGHT-001..004 (GH-237) — weight is a per-runner resource class resolved
 * conservatively from a validated plan, never a lane cap.
 */
import { describe, expect, test } from "bun:test";
import {
  computeQueueSchedule,
  resolveQueueWeight,
  weightLoads,
} from "../../packages/core/src/domain/index";
import {
  activeLease,
  makeFacts,
  REPO_A,
  REPO_B,
  RUNNER,
} from "../fixtures/queue/schedule/harness";

const plan = (weightClass?: string) =>
  weightClass === undefined
    ? ({ state: "valid", tier: "full" } as const)
    : ({ state: "valid", tier: "full", weightClass } as const);

describe("TC-WEIGHT-002 conservative resolution", () => {
  test("a validated plan omitting weight resolves to standard with source absent", () => {
    expect(resolveQueueWeight(plan())).toEqual({ weightClass: "standard", source: "absent" });
  });

  test("a declared recognized class resolves to itself with source declared", () => {
    expect(resolveQueueWeight(plan("heavy"))).toEqual({
      weightClass: "heavy",
      source: "declared",
    });
    expect(resolveQueueWeight(plan("standard"))).toEqual({
      weightClass: "standard",
      source: "declared",
    });
  });

  test("an unrecognized declared value resolves to heavy with source declared", () => {
    expect(resolveQueueWeight(plan("enormous"))).toEqual({
      weightClass: "heavy",
      source: "declared",
    });
  });

  test("an invalid, unreadable, or absent plan resolves to heavy, never standard", () => {
    expect(resolveQueueWeight({ state: "invalid", code: "plan.schema.invalid" })).toEqual({
      weightClass: "heavy",
      source: "plan-unreadable",
      code: "plan.schema.invalid",
    });
    expect(resolveQueueWeight({ state: "absent" })).toEqual({
      weightClass: "heavy",
      source: "plan-absent",
      code: "plan.artifact.missing",
    });
    expect(resolveQueueWeight(undefined)).toEqual({
      weightClass: "heavy",
      source: "plan-absent",
      code: "plan.artifact.missing",
    });
  });
});

describe("TC-WEIGHT-001 / TC-WEIGHT-003 per-runner accounting", () => {
  test("a heavy candidate is held weight-class while another heavy lease is active", () => {
    const facts = makeFacts(
      [
        { ref: "GH-308", repository: REPO_A, plan: plan("heavy") },
        { ref: "GH-309", repository: REPO_B, plan: plan("heavy") },
        { ref: "GH-310", repository: REPO_A, plan: plan("standard") },
      ],
      {
        leases: [
          activeLease({
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-308",
            weightClass: "heavy",
            runner: RUNNER,
          }),
        ],
      },
    );
    const schedule = computeQueueSchedule(facts);
    const heavy = schedule.entries.find((entry) => entry.ref === "GH-309");
    expect(heavy?.state).toBe("held");
    expect(heavy?.blocking[0]?.reason).toBe("weight-class");
    expect(heavy?.blocking[0]?.detail).toContain(RUNNER);
    expect(schedule.nextActions.some((action) => action.ref === "GH-309")).toBe(false);
  });

  test("standard entries continue to schedule and the active repository count is unchanged", () => {
    const facts = makeFacts(
      [
        { ref: "GH-308", repository: REPO_A, plan: plan("heavy") },
        { ref: "GH-309", repository: REPO_B, plan: plan("heavy") },
        { ref: "GH-310", repository: REPO_A, plan: plan("standard") },
        { ref: "GH-311", repository: REPO_B, plan: plan("standard") },
      ],
      {
        leases: [
          activeLease({
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-308",
            weightClass: "heavy",
            runner: RUNNER,
          }),
        ],
      },
    );
    const schedule = computeQueueSchedule(facts);
    // GH-309 is heavy and held; the standard GH-311 in the same free
    // repository still schedules, so the weight rule never reduces the active
    // repository count.
    expect(schedule.nextActions.map((action) => action.ref)).toEqual(["GH-311"]);
    expect(schedule.entries.find((entry) => entry.ref === "GH-309")?.state).toBe("held");
    expect(weightLoads(facts.leases)).toEqual([
      { runner: RUNNER, class: "heavy", active: 1, refs: ["GH-308"] },
    ]);
  });

  test("a heavy entry on a different runner is not held by the first runner's lease", () => {
    const facts = makeFacts(
      [
        { ref: "GH-308", repository: REPO_A, plan: plan("heavy") },
        { ref: "GH-309", repository: REPO_B, plan: plan("heavy") },
      ],
      {
        leases: [
          activeLease({
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-308",
            weightClass: "heavy",
            runner: "runner-a",
          }),
        ],
        runner: "runner-b",
      },
    );
    const schedule = computeQueueSchedule(facts);
    const heavy = schedule.entries.find((entry) => entry.ref === "GH-309");
    expect(heavy?.state).toBe("ready");
  });

  test("standard candidates are never held by the weight rule", () => {
    const facts = makeFacts(
      [
        { ref: "GH-308", repository: REPO_A, plan: plan("heavy") },
        { ref: "GH-309", repository: REPO_B, plan: plan("standard") },
      ],
      {
        leases: [
          activeLease({
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-308",
            weightClass: "heavy",
            runner: RUNNER,
          }),
        ],
      },
    );
    const schedule = computeQueueSchedule(facts);
    expect(schedule.nextActions.some((action) => action.ref === "GH-309")).toBe(true);
  });
});

describe("TC-WEIGHT-004 weight load view", () => {
  test("the weight view reports runner, class, and active state deterministically", () => {
    const facts = makeFacts([{ ref: "GH-301", repository: REPO_A }], {
      leases: [
        activeLease({ repository: REPO_A, holder: "a", ref: "GH-301", weightClass: "standard" }),
        activeLease({ repository: REPO_B, holder: "b", ref: "GH-302", weightClass: "heavy" }),
      ],
    });
    const schedule = computeQueueSchedule(facts);
    expect(schedule.weights).toEqual([
      { runner: RUNNER, class: "heavy", active: 1, refs: ["GH-302"] },
      { runner: RUNNER, class: "standard", active: 1, refs: ["GH-301"] },
    ]);
    // The claim action carries the resolved class and provenance.
    expect(schedule.entries.find((entry) => entry.ref === "GH-301")?.weightClass).toBe("standard");
  });
});
