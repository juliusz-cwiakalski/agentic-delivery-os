/**
 * TC-SCHED-008 / TC-SCHED-009 / TC-SCHED-011 / TC-SCHED-012 (GH-237) — the
 * one-pass schedule is bounded, deterministic, read-only, and explicit about
 * truncation; default `--next` is 3 and above 20 clamps to 20.
 */
import { describe, expect, test } from "bun:test";
import { computeQueueSchedule } from "../../packages/core/src/domain/index";
import { activeLease, type EntrySpec, makeFacts, REPO_A } from "../fixtures/queue/schedule/harness";

const many = (count: number): EntrySpec[] =>
  Array.from({ length: count }, (_, index) => ({
    ref: `GH-${300 + index}`,
    repository: `github.com/owner/repo-${String(index % 40)}`,
    priority: (index * 7) % 100,
  }));

describe("TC-SCHED-008 bounded next actions with reasons", () => {
  test("default next is 3 and a request above 20 clamps to 20 with a truncation marker", () => {
    const facts = makeFacts(many(60));
    const defaulted = computeQueueSchedule(facts);
    expect(defaulted.nextActions).toHaveLength(3);
    const capped = computeQueueSchedule(facts, { next: 500 });
    expect(capped.nextActions).toHaveLength(20);
    expect(capped.truncated).toBe(true);
  });

  test("each action carries the declared fields and a bounded reason", () => {
    const facts = makeFacts([
      { ref: "GH-310", repository: REPO_A, close: "merge-ready" },
      { ref: "GH-311", repository: "github.com/owner/repo-beta" },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 2 });
    for (const action of schedule.nextActions) {
      expect(action.ref).toMatch(/^[A-Z]+-[0-9]+$/);
      expect(action.rankClass).toBeDefined();
      expect(typeof action.reason).toBe("string");
      expect(action.lease.state === "free" || action.lease.state === "held").toBe(true);
      expect(Array.isArray(action.blocking)).toBe(true);
    }
    expect(schedule.nextActions[0]?.reason).toBe("close-first");
  });

  test("two identical runs produce byte-identical data", () => {
    const facts = makeFacts(many(30));
    expect(JSON.stringify(computeQueueSchedule(facts, { next: 5 }))).toBe(
      JSON.stringify(computeQueueSchedule(facts, { next: 5 })),
    );
  });
});

describe("TC-SCHED-009 read projection carries graph, leases, weights, parks, findings", () => {
  test("the schedule exposes every declared read collection", () => {
    const facts = makeFacts(
      [
        { ref: "GH-301", repository: REPO_A },
        {
          ref: "GH-302",
          repository: "github.com/owner/repo-beta",
          park: { state: "stuck", cause: "provider-window", recheckMs: 60000 },
        },
      ],
      {
        leases: [activeLease({ repository: REPO_A, holder: "holder-a", ref: "GH-301" })],
      },
    );
    const schedule = computeQueueSchedule(facts);
    expect(schedule.entries).toHaveLength(2);
    expect(schedule.leases).toHaveLength(1);
    expect(schedule.weights.length).toBeGreaterThan(0);
    expect(schedule.parks).toEqual([]);
    expect(schedule.findings).toHaveLength(1);
    expect(schedule.findings[0]?.code).toBe("queue.park-condition-stuck");
    expect(schedule.findings[0]?.severity).toBe("warning");
    expect(schedule.truncated).toBe(false);
    // The stuck park is never a resume-parked candidate or an action.
    expect(schedule.nextActions.some((action) => action.ref === "GH-302")).toBe(false);
  });

  test("an empty queue is an explicit observed-empty schedule", () => {
    const schedule = computeQueueSchedule(makeFacts([]));
    expect(schedule.entries).toEqual([]);
    expect(schedule.nextActions).toEqual([]);
    expect(schedule.findings).toEqual([]);
    expect(schedule.truncated).toBe(false);
  });
});

describe("TC-SCHED-012 read surfaces perform zero writes", () => {
  test("computeQueueSchedule is pure: it takes facts and returns data", () => {
    const facts = makeFacts(many(10));
    const snapshot = JSON.stringify(facts);
    computeQueueSchedule(facts);
    expect(JSON.stringify(facts)).toBe(snapshot);
  });
});

describe("TC-SCHED-011 structural bounds", () => {
  test("readiness reads are limited to 32 candidates and the remainder is truncated", () => {
    const facts = makeFacts(many(50));
    const schedule = computeQueueSchedule(facts, { next: 20 });
    expect(schedule.evaluatedCandidates).toBe(32);
    expect(schedule.truncated).toBe(true);
    const truncated = schedule.entries.filter((entry) =>
      entry.blocking.some((block) => block.detail === "evaluated-candidates-truncated"),
    );
    expect(truncated.length).toBe(18);
  });

  test("500 entries and 1000 edges complete within the reference bound", () => {
    const specs: EntrySpec[] = Array.from({ length: 500 }, (_, index) => {
      const edges =
        ((index >= 4 && index % 2 === 0) || index === 5 || index === 7) && index < 504
          ? [index - 1, index - 2, index - 3, index - 4].map((previous) => `GH-${1000 + previous}`)
          : [];
      return {
        ref: `GH-${1000 + index}`,
        repository: `github.com/owner/repo-${String(index % 50)}`,
        priority: (index * 3) % 100,
        edges,
      };
    });
    const facts = makeFacts(specs);
    expect(facts.fold.entries).toHaveLength(500);
    expect(facts.fold.edges).toHaveLength(1000);
    const started = performance.now();
    const schedule = computeQueueSchedule(facts, { next: 20 });
    const elapsed = performance.now() - started;
    expect(schedule.entries.length).toBe(500);
    expect(schedule.nextActions.length).toBeLessThanOrEqual(20);
    expect(elapsed).toBeLessThan(250);
  });
});

describe("GH-280 an active owner hold suppresses the pass", () => {
  test("no next action, no preemption, and owner-hold first on every entry", () => {
    const facts = {
      ...makeFacts([
        { ref: "GH-360", repository: REPO_A },
        { ref: "GH-361", repository: "github.com/owner/repo-beta" },
      ]),
      ownerHold: {
        active: true as const,
        source: "marker" as const,
        reason: "peak-hour cost pause",
      },
    };
    const schedule = computeQueueSchedule(facts);
    expect(schedule.nextActions).toEqual([]);
    for (const entry of schedule.entries) {
      expect(entry.blocking[0]?.reason).toBe("owner-hold");
    }
    const control = computeQueueSchedule(
      makeFacts([
        { ref: "GH-360", repository: REPO_A },
        { ref: "GH-361", repository: "github.com/owner/repo-beta" },
      ]),
    );
    expect(control.nextActions.length).toBeGreaterThan(0);
  });
});
