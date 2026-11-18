/**
 * TC-GATE-001 (phase 6 golden) — the summary text is byte-identical to its
 * committed golden, reports every DM-6 field, and states the floor-only rule.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";

const GOLDEN = join(process.cwd(), "tests/fixtures/dispatch/golden/summary.txt");

describe("dispatch summary golden", () => {
  test("text mode is byte-identical and states the floor-only rule", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-1", attemptId: "all11-0" }),
      );
      const run = await scenario.invoke(["dispatch", "dual-run", "summary", "--repo", REPOSITORY]);
      expect(run.exit).toBe(0);
      const golden = readFileSync(GOLDEN, "utf8");
      expect(run.stdout).toBe(golden);
      expect(run.stdout).toContain("floor_only=true");
      expect(run.stdout).toContain(
        "never substitutes for coverage, incident truth, or corroboration",
      );
      // The three additive lines sit between `unmet_conditions=` and any
      // truncation line, in the declared order, with no intervening line.
      const lines = run.stdout.trimEnd().split("\n");
      const unmetIndex = lines.findIndex((line) => line.startsWith("unmet_conditions="));
      expect(unmetIndex).toBeGreaterThanOrEqual(0);
      expect(lines[unmetIndex + 1]).toBe("clean_dispatches=15");
      expect(lines[unmetIndex + 2]).toBe("consecutive_clean_dispatches=10");
      expect(lines[unmetIndex + 3]).toBe(
        "conditions=truth:open,coverage:met,floor:met,corroboration:met",
      );
      expect(lines[unmetIndex + 4]).toBeUndefined();
      expect(run.stdout.split("\n").length).toBeLessThanOrEqual(40);
    } finally {
      scenario.dispose();
    }
  });

  test("the truncated read keeps the truncation line last after the three additions", async () => {
    const scenario = createCommandScenario({ gate: { max: 5 } });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      const run = await scenario.invoke(["dispatch", "dual-run", "summary", "--repo", REPOSITORY]);
      expect(run.exit).toBe(0);
      const lines = run.stdout.trimEnd().split("\n");
      const last = lines[lines.length - 1];
      expect(last).toStartWith("truncation=bound:");
      const conditionsIndex = lines.findIndex((line) => line.startsWith("conditions="));
      expect(conditionsIndex).toBeGreaterThan(0);
      expect(conditionsIndex).toBe(lines.length - 2);
      expect(lines[conditionsIndex]).toMatch(
        /^conditions=(?:truth|coverage|floor|corroboration):(?:met|open)(?:,(?:truth|coverage|floor|corroboration):(?:met|open)){3}$/,
      );
      // The delivered lines are unchanged in content and order.
      for (const line of ["floor_only=true", "eligibility=false", "verdict=unverifiable"]) {
        expect(lines).toContain(line);
      }
    } finally {
      scenario.dispose();
    }
  });
});
