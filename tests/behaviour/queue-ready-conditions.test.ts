/**
 * TC-QREADY-003 / TC-QREADY-004 — six-condition totality, tri-state, ready
 * equivalence, blocking disclosure, and the Appendix A derivation matrix.
 */
import { describe, expect, test } from "bun:test";
import type { QueueReadyCandidate } from "../../packages/core/src/contracts/index";
import {
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_CONDITION_STATES,
} from "../../packages/core/src/contracts/index";
import { evaluate } from "../fixtures/queue-ready/harness";
import { matrixCases } from "../fixtures/queue-ready/matrix/cases";

const SIX = [...QUEUE_READY_CONDITION_ORDER];

/** Production invariants; a mutated candidate must fail by name. */
const invariantViolations = (candidate: QueueReadyCandidate): string[] => {
  const violations: string[] = [];
  const ids = candidate.conditions.map((condition) => condition.id);
  if (ids.length !== SIX.length) {
    violations.push(`${candidate.workItemRef}: condition count ${ids.length} != ${SIX.length}`);
  }
  SIX.forEach((id, index) => {
    if (ids[index] !== id) {
      violations.push(`${candidate.workItemRef}: condition[${index}] ${ids[index]} != ${id}`);
    }
  });
  if (new Set(ids).size !== ids.length) {
    violations.push(`${candidate.workItemRef}: duplicate condition id`);
  }
  for (const [index, condition] of candidate.conditions.entries()) {
    if (!QUEUE_READY_CONDITION_STATES.includes(condition.state)) {
      violations.push(
        `${candidate.workItemRef}: condition[${index}] invalid state ${String(condition.state)}`,
      );
    }
    if (condition.evidence.length < 1 || condition.evidence.length > 2) {
      violations.push(
        `${candidate.workItemRef}: condition ${condition.id} evidence ${condition.evidence.length} outside 1..2`,
      );
    }
    if (condition.id === "provider-available") {
      if (condition.evidence.length !== 2) {
        violations.push(`${candidate.workItemRef}: provider-available must carry 2 records`);
      }
      const [first, second] = condition.evidence;
      if (first === undefined || first.reason === "engine-not-run") {
        violations.push(`${candidate.workItemRef}: provider case record missing`);
      }
      if (
        second === undefined ||
        second.source !== "provider-config" ||
        second.reason !== "engine-not-run" ||
        second.detail !== undefined
      ) {
        violations.push(`${candidate.workItemRef}: engine-not-run companion malformed`);
      }
    } else if (condition.evidence.length !== 1) {
      violations.push(`${candidate.workItemRef}: ${condition.id} must carry 1 record`);
    }
  }
  const allSatisfied = candidate.conditions.every((condition) => condition.state === "satisfied");
  if (candidate.ready !== allSatisfied) {
    violations.push(
      `${candidate.workItemRef}: ready ${candidate.ready} != all-satisfied ${allSatisfied}`,
    );
  }
  const expectedBlocking = candidate.conditions
    .filter((condition) => condition.state !== "satisfied")
    .map((condition) => ({ id: condition.id, state: condition.state }));
  if (JSON.stringify(candidate.blockingConditions) !== JSON.stringify(expectedBlocking)) {
    violations.push(`${candidate.workItemRef}: blockingConditions projection mismatch`);
  }
  return violations;
};

const evaluateCase = (name: string) => {
  const testCase = matrixCases.find((entry) => entry.name === name);
  if (testCase === undefined) throw new Error(`missing matrix case ${name}`);
  const payload = evaluate(testCase.facts);
  const candidate = payload.candidates[0];
  if (candidate === undefined) throw new Error(`no candidate for ${name}`);
  return { testCase, payload, candidate };
};

describe("TC-QREADY-003 six-condition totality and readiness equivalence", () => {
  test("every candidate carries six ordered tri-state conditions with bounded evidence", () => {
    for (const testCase of matrixCases) {
      const payload = evaluate(testCase.facts);
      const candidate = payload.candidates[0];
      expect(candidate, `${testCase.name}: candidate missing`).toBeDefined();
      if (candidate === undefined) continue;
      expect(invariantViolations(candidate), testCase.name).toEqual([]);
      expect(
        candidate.conditions.map((condition) => condition.state),
        testCase.name,
      ).toEqual([...testCase.states]);
      expect(candidate.ready, testCase.name).toBe(testCase.ready);
      if (testCase.closeClass !== undefined) {
        expect(candidate.closeClass, testCase.name).toBe(testCase.closeClass);
      }
      for (const [index, reason] of testCase.reasons.entries()) {
        const condition = candidate.conditions[index];
        expect(condition?.evidence[0]?.reason, `${testCase.name} condition ${index}`).toBe(reason);
      }
      for (const [id, detail] of Object.entries(testCase.details ?? {})) {
        const condition = candidate.conditions.find((entry) => entry.id === id);
        expect(condition?.evidence[0]?.detail, `${testCase.name} ${id}`).toBe(detail);
      }
    }
  });

  test("an all-satisfied candidate has no blocking conditions and summary is derived", () => {
    const { payload, candidate } = evaluateCase("all-satisfied");
    expect(candidate.blockingConditions).toEqual([]);
    expect(payload.summary).toEqual({
      candidates: 1,
      ready: 1,
      notReady: 0,
      mergeReady: 0,
      reviewPending: 0,
      newStart: 1,
      unknownClose: 0,
    });
  });

  test("a not-ready candidate names every non-satisfied condition in fixed order", () => {
    const { candidate } = evaluateCase("candidate-unobserved-first");
    expect(candidate.blockingConditions).toEqual([
      { id: "deps-satisfied", state: "unknown" },
      { id: "tier-known", state: "unknown" },
      { id: "no-owner-gate", state: "unknown" },
    ]);
  });

  test("negative controls fail by name", () => {
    const { candidate } = evaluateCase("all-satisfied");
    type MutableCandidate = Omit<QueueReadyCandidate, "conditions"> & {
      conditions: QueueReadyCandidate["conditions"][number][];
    };
    const copy = (): MutableCandidate => JSON.parse(JSON.stringify(candidate)) as MutableCandidate;

    const missing = copy();
    missing.conditions.pop();
    expect(invariantViolations(missing).join("\n")).toContain("condition count");

    const duplicate = copy();
    const first = duplicate.conditions[0];
    if (first !== undefined) duplicate.conditions[1] = { ...first };
    expect(invariantViolations(duplicate).join("\n")).toContain("duplicate condition id");

    const renamed = copy();
    (renamed.conditions[0] as { state: string }).state = "clear";
    expect(invariantViolations(renamed).join("\n")).toContain("invalid state");

    const falseReady = copy();
    (falseReady.conditions[0] as { state: string }).state = "unknown";
    expect(invariantViolations(falseReady).join("\n")).toContain(
      "ready true != all-satisfied false",
    );
  });
});

describe("TC-QREADY-004 Appendix A derivation matrix", () => {
  test("provider evidence is always the case record then the engine-not-run companion", () => {
    for (const testCase of matrixCases) {
      const candidate = evaluate(testCase.facts).candidates[0];
      expect(candidate, testCase.name).toBeDefined();
      if (candidate === undefined) continue;
      const provider = candidate.conditions.find(
        (condition) => condition.id === "provider-available",
      );
      expect(provider?.evidence.length, testCase.name).toBe(2);
      expect(provider?.evidence[1]?.source, testCase.name).toBe("provider-config");
      expect(provider?.evidence[1]?.reason, testCase.name).toBe("engine-not-run");
      expect(provider?.evidence[1]?.detail, testCase.name).toBeUndefined();
    }
  });

  test("deps target-derived details count observed plus unobserved targets", () => {
    const { candidate } = evaluateCase("deps-open");
    const deps = candidate.conditions.find((condition) => condition.id === "deps-satisfied");
    expect(deps?.evidence).toEqual([
      {
        source: "tracker",
        reason: "dependency-open",
        detail: "done:0; open:1; unknown:0",
      },
    ]);
  });

  test("an unobserved candidate wins before signal availability", () => {
    const { candidate } = evaluateCase("candidate-unobserved-first");
    for (const id of ["deps-satisfied", "tier-known", "no-owner-gate"] as const) {
      const condition = candidate.conditions.find((entry) => entry.id === id);
      expect(condition?.state, id).toBe("unknown");
      expect(condition?.evidence, id).toEqual([
        { source: "tracker", reason: "work-item-unobserved" },
      ]);
    }
  });
});
