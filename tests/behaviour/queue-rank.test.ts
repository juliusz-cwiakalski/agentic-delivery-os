/**
 * TC-RANK-001..006 (GH-237) — close-first rank classes, resumable parks, the
 * stuck-park hard exclusion, and the computed preemption proposal.
 */
import { describe, expect, test } from "bun:test";
import {
  computeQueueSchedule,
  resolveRankClass,
} from "../../packages/core/src/domain/index";
import {
  activeLease,
  makeFacts,
  REPO_A,
  REPO_B,
} from "../fixtures/queue/schedule/harness";

describe("TC-RANK-001 close-first ranking is deterministic", () => {
  test("merge-ready ranks before a ready new start and the order is byte-identical", () => {
    const facts = makeFacts([
      { ref: "GH-310", repository: REPO_A, close: "merge-ready", priority: 50 },
      { ref: "GH-311", repository: REPO_B, close: "none", priority: 1 },
    ]);
    const first = computeQueueSchedule(facts, { next: 2 });
    expect(first.nextActions.map((action) => action.ref)).toEqual(["GH-310", "GH-311"]);
    expect(first.nextActions[0]?.reason).toBe("close-first");
    const second = computeQueueSchedule(facts, { next: 2 });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("TC-RANK-002 rank classes are closed, ordered, and derived per pass", () => {
  test("the four classes derive from close association and resumable park state", () => {
    expect(resolveRankClass("merge-ready", undefined)).toBe("merge-ready");
    expect(resolveRankClass("in-review", undefined)).toBe("in-review");
    expect(resolveRankClass("none", { state: "resumable" })).toBe("resume-parked");
    expect(resolveRankClass("none", { state: "none" })).toBe("new-start");
    expect(resolveRankClass("none", { state: "active", cause: "provider-quota" })).toBe(
      "new-start",
    );
    expect(resolveRankClass("none", { state: "stuck" })).toBeUndefined();
  });

  test("an uncleared park is not a rank candidate", () => {
    const facts = makeFacts([
      {
        ref: "GH-301",
        repository: REPO_A,
        park: { state: "active", cause: "provider-window", recheckMs: 60000, expiresAt: "2026-11-07T11:00:00Z" },
      },
    ]);
    const entry = computeQueueSchedule(facts).entries.find((candidate) => candidate.ref === "GH-301");
    expect(entry?.state).toBe("parked");
    expect(entry?.blocking[0]?.reason).toBe("parked:provider-window");
  });

  test("a resumable park is resume-parked and ranks above new starts", () => {
    const facts = makeFacts([
      {
        ref: "GH-301",
        repository: REPO_A,
        park: { state: "resumable", cause: "provider-window", recheckMs: 60000, clearObservedAt: "2026-11-07T10:00:00Z" },
      },
      { ref: "GH-302", repository: REPO_B, close: "none", priority: 1 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 2 });
    expect(schedule.nextActions[0]?.ref).toBe("GH-301");
    expect(schedule.nextActions[0]?.rankClass).toBe("resume-parked");
  });
});

describe("TC-RANK-003 preemption proposal", () => {
  test("a close item blocked by a new start's lease emits a preemption action", () => {
    const facts = makeFacts(
      [
        { ref: "GH-301", repository: REPO_A, close: "none" },
        { ref: "GH-310", repository: REPO_A, close: "merge-ready" },
      ],
      {
        leases: [activeLease({ repository: REPO_A, holder: "holder-a", ref: "GH-301" })],
      },
    );
    const schedule = computeQueueSchedule(facts);
    const preemption = schedule.nextActions.find((action) => action.preemption !== undefined);
    expect(preemption).toBeDefined();
    expect(preemption?.ref).toBe("GH-310");
    expect(preemption?.preemption?.parkCause).toBe("preempted-for-close-item");
    expect(preemption?.preemption?.conditionType).toBe("preemption");
    expect(preemption?.preemption?.holder).toBe("holder-a");
    // The close item is not scheduled as a normal delivery action.
    expect(schedule.entries.find((entry) => entry.ref === "GH-310")?.state).toBe("held");
  });
});

describe("TC-RANK-005 top-ranked selection", () => {
  test("only the top-ranked eligible action is projected per repository", () => {
    const facts = makeFacts([
      { ref: "GH-301", repository: REPO_A, close: "merge-ready", priority: 10 },
      { ref: "GH-302", repository: REPO_A, close: "in-review", priority: 1 },
      { ref: "GH-303", repository: REPO_B, close: "none", priority: 1 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 20 });
    expect(schedule.nextActions.map((action) => action.ref)).toEqual(["GH-301", "GH-303"]);
    expect(schedule.nextActions.every((action) => action.blocking.length === 0)).toBe(true);
  });
});

describe("TC-RANK-006 a hard gate removes a close item", () => {
  test("an owner-gated merge-ready entry is removed, never demoted by ordering", () => {
    const facts = makeFacts([
      {
        ref: "GH-310",
        repository: REPO_A,
        close: "merge-ready",
        workItem: {
          state: "observed",
          deliveryState: "ready",
          labels: ["priority:high", "hand-back"],
          blockedBy: [],
        },
      },
      { ref: "GH-311", repository: REPO_B, close: "none", priority: 100 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 20 });
    expect(schedule.nextActions.map((action) => action.ref)).toEqual(["GH-311"]);
    const held = schedule.entries.find((entry) => entry.ref === "GH-310");
    expect(held?.state).toBe("held");
    expect(held?.blocking[0]?.reason).toBe("owner-gate");
  });
});

describe("TC-RANK-003/004 preemption re-asserted with real park state", () => {
  test("after the explicit release-park the close item schedules and the preempted entry resumes above new starts", () => {
    const preemptionFacts = makeFacts(
      [
        { ref: "GH-301", repository: REPO_A, close: "none" },
        { ref: "GH-310", repository: REPO_A, close: "merge-ready" },
        {
          ref: "GH-311",
          repository: REPO_B,
          close: "none",
          park: { state: "active", cause: "preemption", recheckMs: 60000 },
        },
      ],
      {
        leases: [activeLease({ repository: REPO_A, holder: "holder-a", ref: "GH-301" })],
      },
    );
    const first = computeQueueSchedule(preemptionFacts);
    const action = first.nextActions.find((candidate) => candidate.preemption !== undefined);
    expect(action?.preemption).toEqual({
      targetRef: "GH-310",
      repository: REPO_A,
      holder: "holder-a",
      parkCause: "preempted-for-close-item",
      conditionType: "preemption",
      closeRef: "GH-310",
    });

    const afterRelease = makeFacts([
      { ref: "GH-301", repository: REPO_A, close: "none" },
      { ref: "GH-310", repository: REPO_A, close: "merge-ready" },
      {
        ref: "GH-311",
        repository: REPO_B,
        close: "none",
        park: { state: "resumable", cause: "preemption", recheckMs: 60000 },
      },
    ]);
    const second = computeQueueSchedule(afterRelease, { next: 3 });
    expect(second.nextActions[0]?.ref).toBe("GH-310");
    const resumed = second.nextActions.find((candidate) => candidate.ref === "GH-311");
    expect(resumed?.rankClass).toBe("resume-parked");
  });
});
