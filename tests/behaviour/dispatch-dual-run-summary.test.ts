/**
 * TC-GATE-001 / TC-GATE-002 / TC-GATE-007 (phase 6) — the summary reports the
 * full evidence window, eligibility is the four-condition conjunction, and all
 * eleven classes are coverable as exposure (including state-unverified and a
 * tracker-corroborated pr-open-unverified).
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import { summarizeDispatchEvidence } from "../../packages/core/src/app/dispatch-gate";
import { DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { dayAt } from "../fixtures/dispatch/evidence-windows";
import {
  buildAttempts,
  eligibleSpecs,
  missingClassSpecs,
  uncorroboratedSpecs,
  type AttemptSpec,
} from "../fixtures/dispatch/evidence-windows";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";

const seed = (
  scenario: ReturnType<typeof createCommandScenario>,
  specs: readonly AttemptSpec[],
): void => {
  for (const attempt of buildAttempts(specs)) {
    const appended = appendDispatchAttempt(scenario.state.store, scenario.state.fenceToken, attempt);
    if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
  }
};

const summarize = (scenario: ReturnType<typeof createCommandScenario>, scope: "production" | "controlled" = "production") =>
  summarizeDispatchEvidence({
    store: scenario.state.store,
    repository: REPOSITORY,
    scope,
    nowIso: dayAt(30),
  });

describe("TC-GATE-001 the summary reports the full evidence window", () => {
  test("every DM-6 field is present for a seeded window", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-1", engineToken: "pr-open", comparisonToken: "blocked" }),
      );
      const result = summarize(scenario);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const data = result.data;
      expect(data.repository).toBe(REPOSITORY);
      expect(data.windowStartReason).toBe("first-counted-dispatch");
      expect(data.countedDeliveries).toBeGreaterThanOrEqual(20);
      expect(data.countedEvidenceClass).toBe("pilot");
      expect(data.divergences).toMatchObject({ reported: 1, resolved: 0, unresolved: 1 });
      expect(data.divergences.unresolvedIds).toEqual(["DIV-1"]);
      expect(data.coverage.present).toEqual([...DELIVERY_RESULT_TOKENS]);
      expect(data.coverage.missing).toEqual([]);
      expect(data.floor).toMatchObject({ met: true, onlyFloor: true });
      expect(data.verdict).toBe("ineligible");
      expect(data.unmetConditions.map((entry) => entry.condition)).toContain("truth");
    } finally {
      scenario.dispose();
    }
  });

  test("the command exits 0 even when the verdict is ineligible", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, missingClassSpecs("merged"));
      const run = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data).toMatchObject({ eligibility: false });
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-GATE-002 eligibility is the four-condition conjunction", () => {
  test("the positive fixture is eligible with no unmet condition", () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const result = summarize(scenario);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.eligibility).toBe(true);
      expect(result.data.verdict).toBe("eligible");
      expect(result.data.unmetConditions).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("each single-condition mutant is ineligible and names the broken condition", () => {
    const mutants: readonly { readonly name: string; readonly specs: readonly AttemptSpec[] }[] = [
      { name: "missing-class", specs: missingClassSpecs("merged") },
      { name: "uncorroborated", specs: uncorroboratedSpecs() },
    ];
    for (const mutant of mutants) {
      const scenario = createCommandScenario({ gate: {} });
      try {
        seed(scenario, mutant.specs);
        const result = summarize(scenario);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.data.eligibility, mutant.name).toBe(false);
        expect(result.data.unmetConditions.length, mutant.name).toBeGreaterThan(0);
      } finally {
        scenario.dispose();
      }
    }
  });
});

describe("TC-GATE-007 all eleven classes are coverable", () => {
  test("state-unverified and pr-open-unverified are present, non-blocking, and comparable", () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const result = summarize(scenario);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.coverage.present).toContain("state-unverified");
      expect(result.data.coverage.present).toContain("pr-open-unverified");
      expect(result.data.coverage.missing).toEqual([]);
      expect(result.data.eligibility).toBe(true);
      expect(result.data.unmetConditions).toEqual([]);
      expect(result.data.divergences.unresolved).toBe(0);
    } finally {
      scenario.dispose();
    }
  });

  test("each single-class removal names exactly the removed class", () => {
    for (const token of DELIVERY_RESULT_TOKENS) {
      const scenario = createCommandScenario({ gate: {} });
      try {
        seed(scenario, missingClassSpecs(token));
        const result = summarize(scenario);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(result.data.coverage.missing, token).toEqual([token]);
        const coverage = result.data.unmetConditions.find((entry) => entry.condition === "coverage");
        expect(coverage?.detail, token).toBe(token);
      } finally {
        scenario.dispose();
      }
    }
  });
});
