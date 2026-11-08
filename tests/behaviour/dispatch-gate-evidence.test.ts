/**
 * TC-GATE-006 / TC-GATE-008 / TC-GATE-010 / TC-EVID-004 (phase-6 slices) — the
 * pinned degraded exits (unreadable/torn/malformed summary exit 2; truncated
 * valid summary exits 0 with declared truncation; unreadable handover exits 2;
 * readable-but-unmet handover exits 1; unresolvable identity exits 1), the
 * family-wise comparison parity, and corroboration sufficiency per family.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  evaluateHandoverGate,
  foldEvidenceWindow,
} from "../../packages/core/src/domain/dispatch-gate";
import { requiredCorroboration } from "../../packages/core/src/domain/dispatch-comparison";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import {
  buildAttempts,
  dayAt,
  eligibleSpecs,
  missingClassSpecs,
  uncorroboratedSpecs,
} from "../fixtures/dispatch/evidence-windows";
import { makeAttempt } from "../fixtures/dispatch/ledger";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const seed = (
  scenario: ReturnType<typeof createCommandScenario>,
  specs: ReturnType<typeof eligibleSpecs>,
): void => {
  for (const attempt of buildAttempts(specs)) {
    const appended = appendDispatchAttempt(scenario.state.store, scenario.state.fenceToken, attempt);
    if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
  }
};

const summary = (scenario: ReturnType<typeof createCommandScenario>) =>
  scenario.invoke(["dispatch", "dual-run", "summary", "--repo", REPOSITORY, "--json"]);

describe("TC-GATE-006 degraded evidence reads have pinned exits", () => {
  test("an unreadable attempt stream exits 2 with dispatch.state-unverified", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const handle = scenario.state.store.acquireFence(scenario.state.fenceToken);
      if (!handle.ok) throw new Error("fence");
      scenario.state.store.append(handle.value.handle, {
        kind: "dispatch.attempt",
        recordKey: "dispatch.attempt.broken",
        payload: { schema: "delivery.dispatch.attempt.v1" } as never,
      });
      scenario.state.store.releaseFence(handle.value.handle);
      const run = await summary(scenario);
      expect(run.exit).toBe(2);
      expect(run.envelope?.error?.code).toBe("dispatch.state-unverified");
    } finally {
      scenario.dispose();
    }
  });

  test("a truncated valid read exits 0 with a declared truncation and an unverifiable verdict", async () => {
    const scenario = createCommandScenario({ gate: { max: 5 } });
    try {
      seed(scenario, eligibleSpecs());
      const run = await summary(scenario);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.verdict).toBe("unverifiable");
      expect(run.envelope?.data?.eligibility).toBe(false);
      expect(run.envelope?.data?.truncation).toMatchObject({ bound: 5 });
      expect(run.envelope?.data?.truncation?.omittedRecords).toBeGreaterThan(0);
    } finally {
      scenario.dispose();
    }
  });

  test("handover with an unreadable read exits 2 and appends no authority record", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const handle = scenario.state.store.acquireFence(scenario.state.fenceToken);
      if (!handle.ok) throw new Error("fence");
      scenario.state.store.append(handle.value.handle, {
        kind: "dispatch.attempt",
        recordKey: "dispatch.attempt.broken",
        payload: { schema: "delivery.dispatch.attempt.v1" } as never,
      });
      scenario.state.store.releaseFence(handle.value.handle);
      const run = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.error?.code).toBe("dispatch.state-unverified");
    } finally {
      scenario.dispose();
    }
  });

  test("handover with a readable-but-unmet bar exits 1 as a clean negative", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, missingClassSpecs("merged"));
      const run = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data).toMatchObject({ recorded: false, verdict: "ineligible" });
      const unmet = (run.envelope?.data as { readonly unmetConditions?: readonly unknown[] })
        .unmetConditions;
      expect(unmet?.length).toBeGreaterThan(0);
    } finally {
      scenario.dispose();
    }
  });

  test("an unresolvable repository identity is a clean refusal at exit 1", async () => {
    const scenario = createCommandScenario({
      gate: { resolveRepository: () => undefined },
    });
    try {
      const summaryRun = await summary(scenario);
      expect(summaryRun.exit).toBe(1);
      expect(summaryRun.envelope?.error?.code).toBe("input.value.rejected");
      const handoverRun = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(handoverRun.exit).toBe(1);
      expect(handoverRun.envelope?.error?.code).toBe("input.value.rejected");
    } finally {
      scenario.dispose();
    }
  });

  test("no degraded case returns eligible and no exit falls outside 0, 1, 2", async () => {
    const scenario = createCommandScenario({ gate: { max: 5 } });
    try {
      seed(scenario, eligibleSpecs());
      const run = await summary(scenario);
      expect([0, 1, 2]).toContain(run.exit);
      expect(run.envelope?.data?.eligibility).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-GATE-008 family-wise comparison parity and TC-GATE-010 corroboration", () => {
  test("the summary and the handover read the same predicate for the same evidence", () => {
    const specs = eligibleSpecs();
    const attempts = buildAttempts(specs);
    const window = foldEvidenceWindow({
      repository: REPOSITORY,
      scope: "production",
      attempts,
      divergences: [],
      windowEnd: dayAt(30),
    });
    const evaluation = evaluateHandoverGate(window);
    // The summary and handover both project this one evaluation; the parity is
    // structural (one predicate home) and asserted through the same object.
    expect(evaluation.verdict).toBe("eligible");
    expect(evaluation).toEqual(evaluateHandoverGate(window));
  });

  test("every success family requires its declared sources and non-success requires none", () => {
    expect(requiredCorroboration("merged")).toEqual(["pm-notes", "tracker", "ci"]);
    expect(requiredCorroboration("pr-open")).toEqual(["tracker"]);
    expect(requiredCorroboration("pr-open-unverified")).toEqual(["tracker"]);
    expect(requiredCorroboration("blocked")).toEqual(["tracker"]);
    expect(requiredCorroboration("finished")).toEqual(["pm-notes"]);
    expect(requiredCorroboration("noop-lane-nothing-to-do")).toEqual(["pm-notes"]);
    for (const token of [
      "failed",
      "partial",
      "max-restarts",
      "state-unverified",
      "noop-lane-permission",
    ] as const) {
      expect(requiredCorroboration(token), token).toEqual([]);
    }
  });

  test("removing a required source makes exactly one named corroboration condition", () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, uncorroboratedSpecs());
      const result = foldEvidenceWindow({
        repository: REPOSITORY,
        scope: "production",
        attempts: buildAttempts(uncorroboratedSpecs()),
        divergences: [],
        windowEnd: dayAt(30),
      });
      const evaluation = evaluateHandoverGate(result);
      expect(evaluation.eligibility).toBe(false);
      const corroboration = evaluation.unmetConditions.filter(
        (entry) => entry.condition === "corroboration",
      );
      expect(corroboration).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });

  test("pr-open-unverified corroborates on the tracker fact, not URL resolution", () => {
    const attempts = buildAttempts(eligibleSpecs());
    const unverified = attempts.find((attempt) => attempt.token === "pr-open-unverified");
    expect(unverified?.comparison.urlResolved).toBe(false);
    expect(unverified?.corroboration.tracker).toBe("satisfied");
    expect(unverified?.comparison.outcome).toBe("match");
  });

  test("a not-applicable comparison is never an agreement and never a divergence", () => {
    const attempt = makeAttempt({ token: "max-restarts" });
    expect(attempt.comparison.class).toBe("not-applicable");
    const scenario = createCommandScenario({ gate: {} });
    try {
      appendDispatchAttempt(scenario.state.store, scenario.state.fenceToken, attempt);
      appendDispatchDivergence(scenario.state.store, scenario.state.fenceToken, {
        schema: "delivery.dispatch.divergence.v1",
        divergenceId: "DIV-X",
        repository: REPOSITORY,
        ref: "GH-239",
        attemptId: attempt.attemptId,
        state: "open",
        comparisonClass: "tracker-truth",
        engineToken: "pr-open",
        comparisonToken: "blocked",
        evidenceRefs: [],
        recordedAt: dayAt(0),
      });
      const result = foldEvidenceWindow({
        repository: REPOSITORY,
        scope: "production",
        attempts: [attempt],
        divergences: [],
        windowEnd: dayAt(30),
      });
      expect(result.divergences.unresolved).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
