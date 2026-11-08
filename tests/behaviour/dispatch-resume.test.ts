/**
 * TC-RESUME-001 (phase 5) — a resume prompt resumes the existing lane, records
 * the resume mode and prefill acknowledgement, and skips completed phases
 * without a fresh spawn.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

describe("TC-RESUME-001 resume records re-entry mode and skips completed phases", () => {
  test("an adapter without resume injection records resume-prompt-reentry", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope", "specification", "test_planning", "delivery_planning"],
        adapterSupportsResumeInjection: false,
        restartCount: 0,
        prefillCost: 100,
        uniqueProgress: 200,
      },
    });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "plan tier: full",
        "--json",
      ]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      expect(scenario.scripted.calls).toContain("resume");
      expect(scenario.scripted.calls).not.toContain("spawn");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      expect(read.records[0]?.resumeMode).toBe("resume-prompt-reentry");
      expect(read.records[0]?.prefillCostAcknowledged).toBe(true);
    } finally {
      scenario.dispose();
    }
  });

  test("an adapter with resume injection attaches and continues without re-entry cost", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope"],
        adapterSupportsResumeInjection: true,
        restartCount: 0,
      },
    });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "continue",
        "--json",
      ]);
      expect(run.exit).toBe(0);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records[0]?.resumeMode).toBe("attach-continue");
      expect(read.ok && read.records[0]?.prefillCostAcknowledged).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});
