/**
 * TC-QREADY-036 / TC-QREADY-037 — candidate and blocked-by target identity
 * resolution by the §8.3 rule with role-specific uniqueness domains.
 */
import { describe, expect, test } from "bun:test";
import { blockedBy, evaluate, makeWorkItem, workItemRead } from "../fixtures/queue-ready/harness";
import {
  candidateIdentityCases,
  candidateWithRelation,
  targetIdentityCases,
} from "../fixtures/queue-ready/identity/cases";

const depsOf = (facts: Parameters<typeof evaluate>[0]) => {
  const candidate = evaluate(facts).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  const condition = candidate.conditions.find((entry) => entry.id === "deps-satisfied");
  if (condition === undefined) throw new Error("deps-satisfied missing");
  return { candidate, condition };
};

describe("TC-QREADY-036 candidate identity resolution", () => {
  test("every candidate row observes exactly the intended refs", () => {
    for (const testCase of candidateIdentityCases) {
      const payload = evaluate({
        candidates: testCase.candidates,
        tracker: workItemRead([...testCase.items]),
      });
      for (const candidate of payload.candidates) {
        const observed = testCase.observed.includes(candidate.workItemRef);
        expect(candidate.workItem.state, `${testCase.name} ${candidate.workItemRef}`).toBe(
          observed ? "observed" : "unknown",
        );
        if (!observed) {
          for (const id of ["deps-satisfied", "tier-known", "no-owner-gate"] as const) {
            const condition = candidate.conditions.find((entry) => entry.id === id);
            expect(condition?.evidence, `${testCase.name} ${candidate.workItemRef} ${id}`).toEqual([
              { source: "tracker", reason: "work-item-unobserved" },
            ]);
          }
        }
      }
    }
  });

  test("a shared bare-numeric suffix leaves the item unobserved for every sharing candidate", () => {
    const payload = evaluate({
      candidates: ["GH-7", "PDEV-7"],
      tracker: workItemRead([makeWorkItem({ entityId: "7", labels: ["priority:high"] })]),
    });
    for (const candidate of payload.candidates) {
      expect(candidate.workItem.state).toBe("unknown");
    }
    const reversed = evaluate({
      candidates: ["PDEV-7", "GH-7"],
      tracker: workItemRead([makeWorkItem({ entityId: "7", labels: ["priority:high"] })]),
    });
    expect(reversed.candidates.every((candidate) => candidate.workItem.state === "unknown")).toBe(
      true,
    );
  });

  test("exact match precedes and resolves the bridge ambiguity", () => {
    const payload = evaluate({
      candidates: ["GH-7", "PDEV-7"],
      tracker: workItemRead([makeWorkItem({ entityId: "GH-7", labels: ["priority:high"] })]),
    });
    const observed = payload.candidates.filter(
      (candidate) => candidate.workItem.state === "observed",
    );
    expect(observed.map((candidate) => candidate.workItemRef)).toEqual(["GH-7"]);
  });

  test("controls flip observation by changing the provider id", () => {
    const exact = evaluate({
      candidates: ["GH-176"],
      tracker: workItemRead([makeWorkItem({ entityId: "GH-176", labels: ["priority:high"] })]),
    });
    expect(exact.candidates[0]?.workItem.state).toBe("observed");
    const wrong = evaluate({
      candidates: ["GH-176"],
      tracker: workItemRead([makeWorkItem({ entityId: "177", labels: ["priority:high"] })]),
    });
    expect(wrong.candidates[0]?.workItem.state).toBe("unknown");
  });
});

describe("TC-QREADY-037 blocked-by target resolution against the observed set", () => {
  test("every target row matches the exact state, reason, and state counts", () => {
    for (const testCase of targetIdentityCases) {
      const { condition } = depsOf({
        tracker: workItemRead([candidateWithRelation(testCase.target), ...testCase.observedItems]),
      });
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source: "tracker",
          reason: testCase.reason,
          detail: testCase.detail,
        },
      ]);
    }
  });

  test("a canonical-shaped observed target that is not requested resolves by exact match", () => {
    const { condition } = depsOf({
      candidates: ["GH-176"],
      tracker: workItemRead([
        candidateWithRelation("GH-179"),
        makeWorkItem({ entityId: "GH-179", deliveryState: "done" }),
      ]),
    });
    expect(condition.state).toBe("satisfied");
    expect(condition.evidence[0]?.reason).toBe("dependencies-done");
  });

  test("a canonical-shaped target with no observed item stays unobserved", () => {
    const { condition } = depsOf({
      tracker: workItemRead([candidateWithRelation("GH-179")]),
    });
    expect(condition.state).toBe("unknown");
    expect(condition.evidence[0]?.reason).toBe("dependency-unobserved");
  });

  test("controls flip the condition by changing the target or its state", () => {
    const done = depsOf({
      tracker: workItemRead([
        candidateWithRelation("179"),
        makeWorkItem({ entityId: "179", deliveryState: "done" }),
      ]),
    });
    expect(done.condition.state).toBe("satisfied");
    const open = depsOf({
      tracker: workItemRead([
        candidateWithRelation("179"),
        makeWorkItem({ entityId: "179", deliveryState: "in-progress" }),
      ]),
    });
    expect(open.condition.state).toBe("unsatisfied");
    const leadingZero = depsOf({
      tracker: workItemRead([
        candidateWithRelation("0179"),
        makeWorkItem({ entityId: "179", deliveryState: "done" }),
      ]),
    });
    expect(leadingZero.condition.state).toBe("unknown");
    const ambiguous = depsOf({
      tracker: workItemRead([
        candidateWithRelation("179"),
        makeWorkItem({ entityId: "GH-179", deliveryState: "done" }),
        makeWorkItem({ entityId: "PDEV-179", deliveryState: "done" }),
      ]),
    });
    expect(ambiguous.condition.state).toBe("unknown");
  });

  test("an over-cap target resolves before projection and then clamps its entityId", () => {
    const target = "9".repeat(200);
    const payload = evaluate({
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          labels: ["priority:high"],
          relations: [blockedBy(target)],
        }),
        makeWorkItem({ entityId: target, deliveryState: "done" }),
      ]),
    });
    const candidate = payload.candidates[0];
    const deps = candidate?.conditions.find((entry) => entry.id === "deps-satisfied");
    expect(deps?.state).toBe("satisfied");
    const relation =
      candidate?.workItem.state === "observed" ? candidate.workItem.relations?.[0] : undefined;
    expect(relation?.target.entityId).toHaveLength(128);
    expect(relation?.target).toEqual({ entityId: "9".repeat(128) });
    expect(payload.truncated).toBe(true);
    expect(payload.reasons).toContain("value-clamped");
  });

  test("a mixed open and unobserved target set counts both buckets", () => {
    const { condition } = depsOf({
      tracker: workItemRead([
        makeWorkItem({
          entityId: "176",
          labels: ["priority:high"],
          relations: [blockedBy("180"), blockedBy("999")],
        }),
        makeWorkItem({ entityId: "180", deliveryState: "in-progress" }),
      ]),
    });
    expect(condition.evidence[0]?.detail).toBe("done:0; open:1; unknown:1");
  });
});
