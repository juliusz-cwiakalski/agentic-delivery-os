/**
 * TC-SCHED-006 / TC-SCHED-007 / TC-SCHED-013 (GH-237) — the declared total
 * precedence is one deterministic order independent of input order, and
 * priority only breaks ties inside one rank class.
 */
import { describe, expect, test } from "bun:test";
import {
  computeQueueSchedule,
  isDeclaredBlockingReason,
} from "../../packages/core/src/domain/index";
import { type EntrySpec, makeFacts, REPO_A, REPO_B } from "../fixtures/queue/schedule/harness";

const corpus: readonly EntrySpec[] = [
  { ref: "GH-301", repository: REPO_A, close: "merge-ready", priority: 9 },
  { ref: "GH-302", repository: REPO_B, close: "in-review", priority: 1 },
  { ref: "GH-303", repository: REPO_A, close: "none", priority: 2, edges: ["GH-304"] },
  {
    ref: "GH-304",
    repository: REPO_A,
    close: "none",
    priority: 5,
    workItem: {
      state: "observed",
      deliveryState: "done",
      labels: ["priority:high"],
      blockedBy: [],
    },
  },
  {
    ref: "GH-305",
    repository: "github.com/owner/repo-gamma",
    close: "none",
    priority: 1,
    plan: { state: "valid", tier: "full", weightClass: "heavy" },
  },
  { ref: "GH-306", repository: "github.com/owner/repo-delta", close: "none", priority: 1 },
  {
    ref: "GH-307",
    repository: "github.com/owner/repo-epsilon",
    close: "none",
    priority: 1,
    park: { state: "active", cause: "provider-quota", recheckMs: 300000 },
  },
  {
    ref: "GH-308",
    repository: "github.com/owner/repo-zeta",
    close: "none",
    priority: 1,
    park: { state: "active", cause: "provider-window", recheckMs: 60000 },
  },
  {
    ref: "GH-309",
    repository: "github.com/owner/repo-eta",
    close: "none",
    priority: 1,
    park: { state: "stuck", cause: "preemption", recheckMs: 60000 },
  },
  {
    ref: "GH-310",
    repository: "github.com/owner/repo-theta",
    close: "none",
    priority: 1,
    park: { state: "active", cause: "preemption", recheckMs: 60000 },
  },
  {
    ref: "GH-311",
    repository: "github.com/owner/repo-iota",
    close: "none",
    priority: 1,
    workItem: {
      state: "observed",
      deliveryState: "ready",
      labels: ["priority:high", "hand-back"],
      blockedBy: [],
    },
  },
  {
    ref: "GH-312",
    repository: "github.com/owner/repo-kappa",
    close: "none",
    priority: 1,
    ci: { state: "available", result: "failed" },
  },
  {
    ref: "GH-313",
    repository: "github.com/owner/repo-lambda",
    close: "none",
    priority: 1,
    park: { state: "resumable", cause: "provider-quota", recheckMs: 300000 },
  },
];

const shuffle = <T>(items: readonly T[], seed: number): readonly T[] => {
  const result = [...items];
  let state = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const swap = state % (index + 1);
    const left = result[index];
    const right = result[swap];
    if (left === undefined || right === undefined) continue;
    result[index] = right;
    result[swap] = left;
  }
  return result;
};

describe("TC-SCHED-006 total order is independent of input order", () => {
  test("every shuffled input order yields the identical action list", () => {
    const baseline = computeQueueSchedule(makeFacts(corpus), { next: 20 });
    for (const seed of [1, 2, 3, 17, 99]) {
      const schedule = computeQueueSchedule(makeFacts(shuffle(corpus, seed)), { next: 20 });
      expect(JSON.stringify(schedule.nextActions)).toBe(JSON.stringify(baseline.nextActions));
      expect(JSON.stringify(schedule.entries)).toBe(JSON.stringify(baseline.entries));
    }
  });

  test("the corpus spans both weights, all park types, both dependency roles, and every rank class", () => {
    const schedule = computeQueueSchedule(makeFacts(corpus), { next: 20 });
    const entries = new Map(schedule.entries.map((entry) => [entry.ref, entry]));
    const weights = new Set(schedule.entries.map((entry) => entry.weightClass));
    expect(weights.has("standard")).toBe(true);
    expect(weights.has("heavy")).toBe(true);
    const reasons = new Set(
      schedule.entries.flatMap((entry) => entry.blocking.map((block) => block.reason)),
    );
    expect(reasons.has("parked:provider-window")).toBe(true);
    expect(reasons.has("parked:provider-quota")).toBe(true);
    expect(reasons.has("parked:preemption")).toBe(true);
    expect(reasons.has("park-condition-stuck")).toBe(true);
    // Both dependency roles: GH-303 consumes GH-304, and GH-304 is its producer.
    expect(entries.get("GH-303")?.deps).toContain("GH-304");
    expect(
      entries.get("GH-304")?.blocking.some((block) => block.reason === "repo-claimed-in-pass"),
    ).toBe(true);
    const rankClasses = new Set(schedule.entries.map((entry) => entry.rankClass));
    expect([...rankClasses].sort()).toEqual(
      ["in-review", "merge-ready", "new-start", "resume-parked"].sort(),
    );
  });

  test("hard exclusions remove candidates and never appear in nextActions", () => {
    const schedule = computeQueueSchedule(makeFacts(corpus), { next: 20 });
    const refs = new Set(schedule.nextActions.map((action) => action.ref));
    for (const held of ["GH-307", "GH-308", "GH-309", "GH-310", "GH-311", "GH-312"]) {
      expect(refs.has(held)).toBe(false);
    }
    for (const action of schedule.nextActions) {
      for (const block of action.blocking) {
        expect(isDeclaredBlockingReason(block.reason)).toBe(true);
      }
    }
  });

  test("rank class is applied before producer-before-consumer", () => {
    const facts = makeFacts(
      [
        {
          ref: "GH-300",
          repository: REPO_A,
          close: "none",
          priority: 1,
          workItem: {
            state: "observed",
            deliveryState: "done",
            labels: ["priority:high"],
            blockedBy: [],
          },
        },
        { ref: "GH-301", repository: REPO_A, close: "merge-ready", edges: ["GH-300"] },
      ],
      {
        deploy: {
          expectations: { "GH-300": { state: "not-declared" } },
          verdicts: {},
        },
      },
    );
    const schedule = computeQueueSchedule(facts, { next: 2 });
    expect(schedule.nextActions[0]?.ref).toBe("GH-301");
  });

  test("producer-before-consumer applies only inside one repository", () => {
    const facts = makeFacts([
      {
        ref: "GH-300",
        repository: REPO_A,
        close: "none",
        workItem: {
          state: "observed",
          deliveryState: "done",
          labels: ["priority:high"],
          blockedBy: [],
        },
      },
      { ref: "GH-301", repository: REPO_B, close: "none", edges: ["GH-300"], priority: 1 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 2 });
    expect(schedule.nextActions.map((action) => action.ref).sort()).toEqual(["GH-300", "GH-301"]);
  });
});

describe("TC-SCHED-007 priority only inside a rank class", () => {
  test("lower priority is earlier inside one class; default priority is applied", () => {
    const facts = makeFacts([
      { ref: "GH-301", repository: REPO_A, priority: 5 },
      { ref: "GH-302", repository: REPO_B, priority: 1 },
      { ref: "GH-303", repository: "github.com/owner/repo-gamma" },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 3 });
    expect(schedule.nextActions.map((action) => action.ref)).toEqual([
      "GH-302",
      "GH-301",
      "GH-303",
    ]);
  });

  test("priority cannot lift a new start above a merge-ready entry", () => {
    const facts = makeFacts([
      { ref: "GH-301", repository: REPO_A, close: "merge-ready", priority: 100 },
      { ref: "GH-302", repository: REPO_B, close: "none", priority: 1 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 2 });
    expect(schedule.nextActions.map((action) => action.ref)).toEqual(["GH-301", "GH-302"]);
  });

  test("equal priorities break by numeric suffix then canonical ref text", () => {
    const facts = makeFacts([
      { ref: "GH-10", repository: REPO_A, priority: 5 },
      { ref: "GH-9", repository: REPO_B, priority: 5 },
      { ref: "AB-2", repository: "github.com/owner/repo-gamma", priority: 5 },
      { ref: "GH-2", repository: "github.com/owner/repo-delta", priority: 5 },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 10 });
    expect(schedule.nextActions.map((action) => action.ref)).toEqual([
      "AB-2",
      "GH-2",
      "GH-9",
      "GH-10",
    ]);
    // GH-010 and GH-10 are one canonical identity.
    const duplicate = makeFacts([
      { ref: "GH-010", repository: REPO_A, priority: 5 },
      { ref: "GH-10", repository: REPO_A, priority: 6 },
    ]);
    expect(computeQueueSchedule(duplicate).entries).toHaveLength(1);
  });

  test("a duplicate canonical ref is a superseding entry, not a second identity", () => {
    const facts = makeFacts([
      { ref: "GH-010", repository: REPO_A, priority: 9 },
      { ref: "GH-10", repository: REPO_A, priority: 1 },
    ]);
    const schedule = computeQueueSchedule(facts);
    expect(schedule.entries).toHaveLength(1);
    expect(schedule.entries[0]?.priority).toBe(1);
  });
});

describe("TC-SCHED-013 100-run determinism", () => {
  test("100 identical passes are byte-identical", () => {
    const facts = makeFacts(corpus);
    const baseline = JSON.stringify(computeQueueSchedule(facts, { next: 20 }));
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(computeQueueSchedule(facts, { next: 20 }))).toBe(baseline);
    }
  });

  test("varying insertion order and ambient locale does not change the result", () => {
    const baseline = JSON.stringify(computeQueueSchedule(makeFacts(corpus), { next: 20 }));
    const previousLocale = process.env.LC_ALL;
    try {
      process.env.LC_ALL = "tr_TR.UTF-8";
      expect(
        JSON.stringify(computeQueueSchedule(makeFacts(shuffle(corpus, 7)), { next: 20 })),
      ).toBe(baseline);
    } finally {
      if (previousLocale === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = previousLocale;
    }
  });
});
