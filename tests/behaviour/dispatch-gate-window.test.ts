/**
 * TC-GATE-009 / TC-EVID-003 (phase-6 window slice) — the incident lower bound is
 * exclusive, a same-instant record is excluded, post-incident recovery reaches
 * eligibility, and a resolved divergence does not reset the window.
 */
import { describe, expect, test } from "bun:test";
import { evaluateSpecs } from "../fixtures/dispatch/evidence-windows";
import { dayAt, incidentSpecs, resolvedDivergenceSet } from "../fixtures/dispatch/evidence-windows";

describe("TC-GATE-009 the incident lower bound is exclusive", () => {
  const fixture = incidentSpecs();

  test("windowStart is the incident timestamp with the reset reason", () => {
    const { window } = evaluateSpecs([...fixture.before, fixture.incident]);
    expect(window.windowStart).toBe(fixture.incidentAt);
    expect(window.windowStartReason).toBe("false-success-incident-reset");
    expect(window.incidents).toBe(1);
    expect(window.countedInWindow).toEqual([]);
  });

  test("pre-incident dispatches are excluded from floor and coverage", () => {
    const { window } = evaluateSpecs([...fixture.before, fixture.incident, ...fixture.recovery]);
    expect(window.countedInWindow).toHaveLength(fixture.recovery.length);
    expect(window.coverage.present).toContain("pr-open");
    expect(window.coverage.present).toContain("state-unverified");
    expect(window.floorMet).toBe(true);
  });

  test("a dispatch recorded exactly at T is excluded (strictly greater)", () => {
    const { window } = evaluateSpecs([
      ...fixture.before,
      fixture.incident,
      fixture.tie,
      ...fixture.recovery,
    ]);
    expect(window.countedInWindow.some((attempt) => attempt.attemptId === "tie")).toBe(false);
    expect(window.countedInWindow).toHaveLength(fixture.recovery.length);
  });

  test("post-incident recovery is eligible with zero in-window incidents", () => {
    const { evaluation } = evaluateSpecs([
      ...fixture.before,
      fixture.incident,
      fixture.tie,
      ...fixture.recovery,
    ]);
    expect(evaluation.verdict).toBe("eligible");
    expect(evaluation.eligibility).toBe(true);
    expect(evaluation.unmetConditions).toEqual([]);
  });

  test("the resetting incident never sits inside the evaluated window", () => {
    const { window } = evaluateSpecs([...fixture.before, fixture.incident, ...fixture.recovery]);
    expect(window.countedInWindow.some((attempt) => attempt.attemptId === "incident")).toBe(false);
    expect(
      window.countedInWindow.every(
        (attempt) => Date.parse(attempt.recordedAt) > Date.parse(fixture.incidentAt),
      ),
    ).toBe(true);
  });
});

describe("a resolved divergence does not reset the window", () => {
  test("the original window start is preserved and the resolution is reported", () => {
    const specs = resolvedDivergenceSet();
    const { window, evaluation } = evaluateSpecs(specs, {
      divergences: [
        {
          schema: "delivery.dispatch.divergence.v1",
          divergenceId: "DIV-1",
          repository: "github.com/owner/repo",
          ref: "GH-239",
          attemptId: "resolved-0",
          state: "open",
          comparisonClass: "tracker-truth",
          engineToken: "pr-open",
          comparisonToken: "blocked",
          evidenceRefs: [],
          recordedAt: "2026-11-02T10:00:00.000Z",
        },
        {
          schema: "delivery.dispatch.divergence.v1",
          divergenceId: "DIV-1",
          repository: "github.com/owner/repo",
          ref: "GH-239",
          attemptId: "resolved-0",
          state: "resolved",
          comparisonClass: "tracker-truth",
          engineToken: "pr-open",
          comparisonToken: "blocked",
          note: "tracker was stale",
          principal: "coder@local",
          resolvedAt: "2026-11-03T10:00:00.000Z",
          evidenceRefs: [],
          recordedAt: "2026-11-03T10:00:00.000Z",
        },
      ],
    });
    expect(window.windowStartReason).toBe("first-counted-dispatch");
    expect(window.windowStart).toBe(dayAt(0));
    expect(window.divergences).toMatchObject({ reported: 1, resolved: 1, unresolved: 0 });
    expect(evaluation.eligibility).toBe(true);
  });
});
