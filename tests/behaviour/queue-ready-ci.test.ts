/**
 * TC-QREADY-009 / TC-QREADY-010 — ci-healthy classification, only `succeeded`
 * satisfies, and each `unknown` reason.
 */
import { describe, expect, test } from "bun:test";
import { ciCases } from "../fixtures/queue-ready/ci/cases";
import {
  baseFacts,
  createRecorder,
  evaluate,
  queueRuntime,
  runQueueReadyCli,
} from "../fixtures/queue-ready/harness";

const ciOf = (facts: Parameters<typeof evaluate>[0]) => {
  const candidate = evaluate(facts).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  const condition = candidate.conditions.find((entry) => entry.id === "ci-healthy");
  if (condition === undefined) throw new Error("ci-healthy missing");
  return condition;
};

describe("TC-QREADY-009 ci-healthy classification", () => {
  test("each case matches the state, reason, and result detail", () => {
    for (const testCase of ciCases) {
      const condition = ciOf(testCase.facts);
      expect(condition.state, testCase.name).toBe(testCase.state);
      expect(condition.evidence, testCase.name).toEqual([
        {
          source:
            testCase.reason === "addressing-unresolved" || testCase.reason === "remote-unsupported"
              ? "repository-binding"
              : "ci",
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
      ]);
    }
  });

  test("only succeeded satisfies; none and all-skipped never do", () => {
    for (const testCase of ciCases) {
      if (testCase.state === "satisfied") {
        expect(testCase.reason, testCase.name).toBe("ci-succeeded");
      }
    }
  });

  test("a 20-run page is verdict-neutral but sets the payload marker", () => {
    const at19 = evaluate({ ci: ciCases.find((entry) => entry.name === "at-limit-19")?.facts.ci });
    const at20 = evaluate({ ci: ciCases.find((entry) => entry.name === "at-limit-20")?.facts.ci });
    const candidate19 = at19.candidates[0];
    const candidate20 = at20.candidates[0];
    const ci19 = candidate19?.conditions.find((entry) => entry.id === "ci-healthy");
    const ci20 = candidate20?.conditions.find((entry) => entry.id === "ci-healthy");
    expect(ci20?.state).toBe(ci19?.state);
    expect(ci20?.evidence).toEqual(ci19?.evidence);
    expect(candidate20?.blockingConditions).toEqual(candidate19?.blockingConditions ?? []);
    expect(at19.reasons).not.toContain("source-truncated");
    expect(at20.reasons).toContain("source-truncated");
    expect(at19.truncated).toBe(false);
    expect(at20.truncated).toBe(true);
    expect(candidate19?.truncated).toBe(false);
    expect(candidate20?.truncated).toBe(false);
  });

  test("a changed fact still changes the expected bounded field", () => {
    const succeeded = ciOf({ ci: ciCases.find((entry) => entry.name === "succeeded")?.facts.ci });
    const failed = ciOf({ ci: ciCases.find((entry) => entry.name === "failed")?.facts.ci });
    expect(succeeded.state).not.toBe(failed.state);
    expect(failed.evidence[0]?.detail).toBe("result:failed");
  });
});

describe("TC-QREADY-010 ci-healthy unknown reasons", () => {
  test("each unknown mode carries exactly one named reason", () => {
    const unknowns = ciCases.filter((entry) => entry.state === "unknown");
    expect(unknowns.length).toBeGreaterThanOrEqual(5);
    for (const testCase of unknowns) {
      const condition = ciOf(testCase.facts);
      expect(condition.evidence, testCase.name).toHaveLength(1);
      expect(condition.evidence[0]?.reason, testCase.name).toBe(testCase.reason);
    }
  });

  test("an attempted read is made exactly once with the pipeline limit", async () => {
    const recorder = createRecorder();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(baseFacts(), recorder),
    );
    expect(run.exitCode).toBe(0);
    expect(recorder.calls.filter((call) => call === "readPipelineRuns")).toHaveLength(1);
  });

  test("binding-unavailable reasons are not attempted reads", () => {
    const condition = ciOf(
      ciCases.find((entry) => entry.name === "binding-addressing")?.facts ?? {},
    );
    expect(condition.evidence[0]?.source).toBe("repository-binding");
  });

  test("a defensive not-configured read is signal-unavailable, never read-failed", () => {
    const notConfigured = evaluate({ ci: { ok: false, reason: "not-configured" } });
    const condition = notConfigured.candidates[0]?.conditions.find(
      (entry) => entry.id === "ci-healthy",
    );
    expect(condition?.state).toBe("unknown");
    expect(condition?.evidence).toEqual([{ source: "ci", reason: "signal-unavailable" }]);
    expect(notConfigured.reasons).toContain("signal-unavailable");
    expect(notConfigured.reasons).not.toContain("read-failed");

    const attempted = evaluate({
      ci: { ok: false, reason: "read-failed", failureClass: "provider.payload.invalid" },
    });
    const attemptedCondition = attempted.candidates[0]?.conditions.find(
      (entry) => entry.id === "ci-healthy",
    );
    expect(attemptedCondition?.evidence[0]?.reason).toBe("read-failed");
    expect(attempted.reasons).toContain("read-failed");
  });
});
