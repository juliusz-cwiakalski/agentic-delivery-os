/**
 * TC-RESUME-002 (phase 5) — restart budget exhaustion refuses loudly at exit 1
 * with `dispatch.restart-budget-exceeded`, records exactly one `max-restarts`/
 * `failed` attempt, carries the delivered terminal exhaustion evidence, and
 * never spawns, resumes, or silently requeues.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

describe("TC-RESUME-002 restart budget exhaustion", () => {
  test("the refusal is classified, recorded once, and spawns nothing", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      restartBudget: 3,
      lane: {
        completedPhases: ["clarify_scope", "specification"],
        adapterSupportsResumeInjection: false,
        restartCount: 3,
        prefillCost: 100,
        uniqueProgress: 200,
      },
    });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "retry",
        "--json",
      ]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("max-restarts");
      expect(run.envelope?.data?.outcome).toBe("failed");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.restart-budget-exceeded");
      expect(run.envelope?.data?.error?.category).toBe("user");
      expect(scenario.scripted.calls).not.toContain("spawn");
      expect(scenario.scripted.calls).not.toContain("resume");

      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      expect(record?.token).toBe("max-restarts");
      expect(record?.outcome).toBe("failed");
      expect(record?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "dispatch-session-family",
      });
      expect(record?.evidenceRefs).toContain("economics:exhaustion");
      // Terminal and never silently requeued: no second record, no spawn.
      expect(read.records).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});
