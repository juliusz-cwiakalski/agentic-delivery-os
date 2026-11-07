/**
 * TC-SCHED-003 / TC-SCHED-004 / TC-SCHED-005 (GH-237) — readiness reuses the
 * delivered six-condition contract verbatim and strengthens only the three
 * scheduler-owned sources; every failed source is evidence, never green.
 */
import { describe, expect, test } from "bun:test";
import {
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_CONDITION_STATES,
  QUEUE_READY_EVIDENCE_REASONS,
  QUEUE_READY_EVIDENCE_SOURCES,
} from "../../packages/core/src/contracts/index";
import { computeQueueSchedule, evaluateQueueReadiness } from "../../packages/core/src/domain/index";
import {
  activeLease,
  ciSucceeded,
  ciUnreadable,
  makeFacts,
  observed,
  REPO_A,
  REPO_B,
  unobserved,
} from "../fixtures/queue/schedule/harness";

const condition = (readiness: ReturnType<typeof evaluateQueueReadiness>, id: string) => {
  const found = readiness.conditions.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`condition ${id} is missing`);
  return found;
};

describe("TC-SCHED-003 six conditions, fixed order, closed tri-state", () => {
  test("exactly six conditions in the delivered order with valid states", () => {
    const facts = makeFacts([{ ref: "GH-301" }]);
    const readiness = evaluateQueueReadiness(facts, "GH-301");
    expect(readiness.conditions.map((candidate) => candidate.id)).toEqual([
      ...QUEUE_READY_CONDITION_ORDER,
    ]);
    for (const candidate of readiness.conditions) {
      expect(QUEUE_READY_CONDITION_STATES as readonly string[]).toContain(candidate.state);
      for (const record of candidate.evidence) {
        expect(QUEUE_READY_EVIDENCE_SOURCES as readonly string[]).toContain(record.source);
        expect(QUEUE_READY_EVIDENCE_REASONS as readonly string[]).toContain(record.reason);
      }
    }
  });

  test("AC-F2-1: open dependency, owner label, unreadable CI are named and blocking", () => {
    const facts = makeFacts([
      {
        ref: "GH-301",
        repository: REPO_A,
        workItem: observed({ blockedBy: ["GH-300"], labels: ["priority:high", "hand-back"] }),
        ci: ciUnreadable(),
      },
      {
        ref: "GH-300",
        repository: REPO_B,
        workItem: observed({ deliveryState: "ready" }),
      },
    ]);
    const readiness = evaluateQueueReadiness(facts, "GH-301");
    const deps = condition(readiness, "deps-satisfied");
    expect(deps.state).toBe("unsatisfied");
    expect(deps.evidence[0]?.reason).toBe("dependency-open");
    expect(deps.evidence[0]?.detail).toContain("open:1");

    const owner = condition(readiness, "no-owner-gate");
    expect(owner.state).toBe("unsatisfied");
    expect(owner.evidence[0]?.reason).toBe("owner-labels");
    expect(owner.evidence[0]?.detail).toContain("hand-back");

    const ci = condition(readiness, "ci-healthy");
    expect(ci.state).toBe("unknown");
    expect(ci.evidence[0]?.reason).toBe("read-failed");

    expect(readiness.blockingConditions.map((entry) => entry.id)).toEqual([
      "deps-satisfied",
      "no-owner-gate",
      "ci-healthy",
    ]);
    expect(readiness.ready).toBe(false);
  });
});

describe("TC-SCHED-004 scheduler truth for deps, repo-free, and tier", () => {
  test("deps is the union of tracker relations and declared edges and can only tighten", () => {
    const trackerOnly = makeFacts([
      { ref: "GH-301", workItem: observed({ blockedBy: ["GH-300"] }) },
      { ref: "GH-300", workItem: observed({ deliveryState: "done" }) },
    ]);
    expect(condition(evaluateQueueReadiness(trackerOnly, "GH-301"), "deps-satisfied").state).toBe(
      "satisfied",
    );

    const declaredOnly = makeFacts([
      { ref: "GH-301", edges: ["GH-300"] },
      { ref: "GH-300", workItem: observed({ deliveryState: "done" }) },
    ]);
    expect(condition(evaluateQueueReadiness(declaredOnly, "GH-301"), "deps-satisfied").state).toBe(
      "satisfied",
    );

    // The declared edge is stricter: the tracker says done, the edge is open.
    const stricter = makeFacts([
      { ref: "GH-301", edges: ["GH-302"], workItem: observed({ blockedBy: ["GH-300"] }) },
      { ref: "GH-300", workItem: observed({ deliveryState: "done" }) },
      { ref: "GH-302", workItem: observed({ deliveryState: "ready" }) },
    ]);
    const stricterDeps = condition(evaluateQueueReadiness(stricter, "GH-301"), "deps-satisfied");
    expect(stricterDeps.state).toBe("unsatisfied");
    expect(stricterDeps.evidence[0]?.reason).toBe("dependency-open");
  });

  test("a declared edge to a producer with no entry is retained and unknown", () => {
    const facts = makeFacts([{ ref: "GH-301", edges: ["GH-999"] }]);
    const deps = condition(evaluateQueueReadiness(facts, "GH-301"), "deps-satisfied");
    expect(deps.state).toBe("unknown");
    expect(deps.evidence[0]?.reason).toBe("dependency-unobserved");
    expect(facts.fold.edges).toContainEqual({ consumer: "GH-301", producer: "GH-999" });
  });

  test("repo-free consumes lease truth and names the holder and lease identity", () => {
    const withLease = makeFacts([{ ref: "GH-301", repository: REPO_A }], {
      leases: [
        activeLease({ repository: REPO_A, holder: "holder-a", ref: "GH-300", leaseId: "lease-7" }),
      ],
    });
    const repoFree = condition(evaluateQueueReadiness(withLease, "GH-301"), "repo-free");
    expect(repoFree.state).toBe("unsatisfied");
    expect(repoFree.evidence[0]?.detail).toContain("holder-a");
    expect(repoFree.evidence[0]?.detail).toContain("lease-7");

    const free = makeFacts([{ ref: "GH-301", repository: REPO_A }]);
    expect(condition(evaluateQueueReadiness(free, "GH-301"), "repo-free").state).toBe("satisfied");
  });

  test("tier-known prefers a validated plan tier and falls back to triage labels only when no plan exists", () => {
    const planWins = makeFacts([
      {
        ref: "GH-301",
        plan: { state: "valid", tier: "lite" },
        workItem: observed({ labels: ["priority:high"] }),
      },
    ]);
    const tier = condition(evaluateQueueReadiness(planWins, "GH-301"), "tier-known");
    expect(tier.state).toBe("satisfied");
    expect(tier.evidence[0]?.detail).toContain("tier:plan");

    const fallback = makeFacts([
      {
        ref: "GH-301",
        plan: { state: "absent" },
        workItem: observed({ labels: ["priority:high"] }),
      },
    ]);
    const fallbackTier = condition(evaluateQueueReadiness(fallback, "GH-301"), "tier-known");
    expect(fallbackTier.state).toBe("satisfied");
    expect(fallbackTier.evidence[0]?.detail).toContain("tier:priority-label");
  });

  test("the read projection shows one action per repository and repo-claimed-in-pass or lease-held", () => {
    const facts = makeFacts([
      { ref: "GH-301", repository: REPO_A, priority: 5 },
      { ref: "GH-302", repository: REPO_A, priority: 6 },
    ]);
    const schedule = computeQueueSchedule(facts);
    expect(schedule.nextActions).toHaveLength(1);
    expect(schedule.nextActions[0]?.ref).toBe("GH-301");
    const other = schedule.entries.find((entry) => entry.ref === "GH-302");
    expect(other?.state).toBe("held");
    expect(other?.blocking[0]?.reason).toBe("repo-claimed-in-pass");

    const leasedFacts = makeFacts(
      [
        { ref: "GH-301", repository: REPO_A, priority: 5 },
        { ref: "GH-302", repository: REPO_A, priority: 6 },
      ],
      {
        leases: [
          activeLease({
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-300",
            leaseId: "lease-7",
          }),
        ],
      },
    );
    const leased = computeQueueSchedule(leasedFacts);
    expect(leased.nextActions).toHaveLength(0);
    for (const entry of leased.entries) {
      expect(entry.state).toBe("held");
      expect(entry.blocking[0]?.reason).toBe("lease-held");
      expect(entry.blocking[0]?.detail).toContain("holder-a");
    }
  });

  test("two repositories never contend", () => {
    const facts = makeFacts([
      { ref: "GH-301", repository: REPO_A },
      { ref: "GH-302", repository: REPO_B },
    ]);
    const schedule = computeQueueSchedule(facts);
    expect(schedule.nextActions.map((action) => action.repository).sort()).toEqual([
      REPO_A,
      REPO_B,
    ]);
  });
});

describe("TC-SCHED-005 failed sources are unknown, never satisfied", () => {
  test("every failed/unavailable/unresolved source maps to unknown and blocks readiness", () => {
    const facts = makeFacts(
      [
        {
          ref: "GH-301",
          workItem: unobserved(),
          ci: ciUnreadable(),
          plan: { state: "invalid", code: "plan.schema.invalid" },
        },
      ],
      {
        provider: { state: "unavailable", reason: "not-configured" },
      },
    );
    const readiness = evaluateQueueReadiness(facts, "GH-301");
    for (const id of [
      "deps-satisfied",
      "tier-known",
      "no-owner-gate",
      "ci-healthy",
      "provider-available",
    ]) {
      expect(condition(readiness, id).state).toBe("unknown");
    }
    expect(readiness.ready).toBe(false);
    const blocked = readiness.blockingConditions.map((entry) => entry.id);
    expect(blocked).toContain("ci-healthy");
    expect(blocked).toContain("tier-known");
  });

  test("an absent plan uses the triage fallback; a clean control is ready", () => {
    const control = makeFacts([{ ref: "GH-301", repository: REPO_A }]);
    expect(evaluateQueueReadiness(control, "GH-301").ready).toBe(true);

    const absentPlan = makeFacts([
      { ref: "GH-301", repository: REPO_A, plan: { state: "absent" } },
    ]);
    expect(condition(evaluateQueueReadiness(absentPlan, "GH-301"), "tier-known").state).toBe(
      "satisfied",
    );
  });

  test("an unresolved repository binding cannot satisfy repo-free", () => {
    const facts = makeFacts([{ ref: "GH-301" }]);
    const repoFree = condition(evaluateQueueReadiness(facts, "GH-301"), "repo-free");
    expect(repoFree.state).toBe("unknown");
    expect(repoFree.evidence[0]?.reason).toBe("addressing-unresolved");
  });

  test("a healthy control case produces ci-succeeded and no fails", () => {
    const facts = makeFacts([{ ref: "GH-301", repository: REPO_A, ci: ciSucceeded() }]);
    const readiness = evaluateQueueReadiness(facts, "GH-301");
    expect(condition(readiness, "ci-healthy").state).toBe("satisfied");
    expect(readiness.ready).toBe(true);
  });
});
