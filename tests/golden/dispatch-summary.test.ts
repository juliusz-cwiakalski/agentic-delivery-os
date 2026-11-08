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
      expect(run.stdout).toContain("never substitutes for coverage, incident truth, or corroboration");
      expect(run.stdout.split("\n").length).toBeLessThanOrEqual(40);
    } finally {
      scenario.dispose();
    }
  });
});
