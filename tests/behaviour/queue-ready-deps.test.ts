/**
 * TC-QREADY-005 — `deps-satisfied` unknown/unobserved/done/open targets and the
 * single state-count evidence record.
 */
import { describe, expect, test } from "bun:test";
import { depsCases } from "../fixtures/queue-ready/deps/cases";
import { evaluate } from "../fixtures/queue-ready/harness";

const depsOf = (facts: Parameters<typeof evaluate>[0]) => {
  const candidate = evaluate(facts).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  const condition = candidate.conditions.find((entry) => entry.id === "deps-satisfied");
  if (condition === undefined) throw new Error("deps-satisfied missing");
  return condition;
};

describe("TC-QREADY-005 deps-satisfied", () => {
  test("every case matches the Appendix A state, reason, and detail", () => {
    for (const testCase of depsCases) {
      const condition = depsOf(testCase.facts);
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source: "tracker",
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
      ]);
    }
  });

  test("a target-derived detail sums to the total blocked-by target count and carries no refs", () => {
    for (const testCase of depsCases) {
      if (testCase.detail === undefined) continue;
      const match = /^done:(\d+); open:(\d+); unknown:(\d+)$/.exec(testCase.detail);
      expect(match, testCase.name).not.toBeNull();
      const total = Number(match?.[1]) + Number(match?.[2]) + Number(match?.[3]);
      expect(total, testCase.name).toBeGreaterThan(0);
      expect(testCase.detail.includes("GH-"), testCase.name).toBe(false);
      expect(testCase.detail.includes("179"), testCase.name).toBe(false);
    }
  });

  test("an unobserved candidate carries exactly one record and no read-failed", () => {
    const condition = depsOf(
      depsCases.find((entry) => entry.name === "tracker-read-failed")?.facts ?? {},
    );
    expect(condition.evidence).toEqual([{ source: "tracker", reason: "work-item-unobserved" }]);
  });

  test("relations unavailable yields unknown even with zero visible relations", () => {
    const condition = depsOf(
      depsCases.find((entry) => entry.name === "relations-unavailable")?.facts ?? {},
    );
    expect(condition.state).toBe("unknown");
    expect(condition.evidence[0]?.reason).toBe("signal-unavailable");
  });

  test("a done target outside the page is unobserved, never assumed done", () => {
    const condition = depsOf(
      depsCases.find((entry) => entry.name === "one-unobserved")?.facts ?? {},
    );
    expect(condition.state).toBe("unknown");
    expect(condition.evidence[0]?.detail).toBe("done:0; open:0; unknown:1");
  });
});
