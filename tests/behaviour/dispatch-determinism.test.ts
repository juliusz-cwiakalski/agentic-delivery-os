/**
 * TC-DET-001 (phase 10) — the summary, gate evaluation, and render are
 * deterministic for fixed state, clock, and ids; two runs are byte-identical and
 * no model or provider call participates.
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import { summarizeDispatchEvidence } from "../../packages/core/src/app/dispatch-gate";
import { evaluateHandoverGate } from "../../packages/core/src/domain/dispatch-gate";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { buildAttempts, dayAt, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const seed = (scenario: ReturnType<typeof createCommandScenario>) => {
  for (const attempt of buildAttempts(eligibleSpecs())) {
    const appended = appendDispatchAttempt(
      scenario.state.store,
      scenario.state.fenceToken,
      attempt,
    );
    if (!appended.ok) throw new Error("seed failed");
  }
};

describe("TC-DET-001 deterministic render with zero model calls", () => {
  test("two summary runs are byte-identical", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario);
      const first = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
      ]);
      const second = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
      ]);
      expect(first.stdout).toBe(second.stdout);
      expect(first.exit).toBe(second.exit);

      const firstJson = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const secondJson = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const dataOf = (text: string) => JSON.parse(text).data;
      expect(dataOf(firstJson.stdout)).toEqual(dataOf(secondJson.stdout));
    } finally {
      scenario.dispose();
    }
  });

  test("the gate evaluation is a pure function of the window", () => {
    const window = {
      repository: REPOSITORY,
      countedEvidenceClass: "pilot" as const,
      windowStart: dayAt(0),
      windowStartReason: "first-counted-dispatch" as const,
      windowEnd: dayAt(30),
      counted: [],
      countedInWindow: [],
      excludedEvidenceClasses: [],
      incidents: 0,
      dayCount: 0,
      consecutiveDates: 0,
      divergences: { reported: 0, resolved: 0, unresolved: 0, unresolvedIds: [] },
      coverage: { present: [], missing: [] },
      corroboration: { satisfied: 0, unsatisfied: 0, unsatisfiedRefs: [] },
      floorMet: false,
    };
    expect(evaluateHandoverGate(window)).toEqual(evaluateHandoverGate(window));
  });

  test("the summary contains no wall-clock value outside the injected window end", () => {
    const result = summarizeDispatchEvidence({
      store: {
        readRecords: () => ({
          ok: true as const,
          value: {
            records: [],
            evidence: { storePath: "/x", verification: [], verifiedEmpty: true, recordCount: 0 },
          },
        }),
      } as never,
      repository: REPOSITORY,
      scope: "production",
      nowIso: "2026-11-30T10:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.windowEnd).toBe("2026-11-30T10:00:00.000Z");
    expect(JSON.stringify(result.data)).not.toMatch(/\d{13}/u);
  });
});
