/**
 * TC-RESUME-003 / TC-RESUME-004 (phase 5) — resume economics refuses an
 * uneconomical prefill re-pay and unreadable cost facts, attach-and-continue
 * consumes no restart ordinal, and an identical replay converges without a
 * second spawn or duplicate ordinal.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  admitDispatchRestart,
  evaluateDispatchResumeEconomics,
  planDispatchResume,
} from "../../packages/core/src/domain/dispatch-resume";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

describe("dispatch resume policy", () => {
  test("attach-and-continue is admitted and consumes no ordinal", () => {
    const plan = planDispatchResume({ adapterSupportsResumeInjection: true, completedPhases: ["a"] });
    expect(plan.mode).toBe("attach-continue");
    expect(plan.consumesRestartOrdinal).toBe(false);
    expect(
      evaluateDispatchResumeEconomics({ mode: plan.mode }),
    ).toEqual({ admitted: true, mode: "attach-continue", consumesRestartOrdinal: false });
  });

  test("restart admission refuses at the bound and never below it", () => {
    expect(admitDispatchRestart({ count: 2, bound: 3 }).admitted).toBe(true);
    const refused = admitDispatchRestart({ count: 3, bound: 3 });
    expect(refused.admitted).toBe(false);
    if (!refused.admitted) {
      expect(refused.reason).toBe("dispatch.restart-budget-exceeded");
      expect(refused.terminal).toBe(true);
    }
  });
});

describe("TC-RESUME-003 resume economics refuses uneconomical re-pay", () => {
  test("an uneconomical re-entry refuses at exit 1 with failed/failed and one record", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope"],
        adapterSupportsResumeInjection: false,
        restartCount: 0,
        prefillCost: 300,
        uniqueProgress: 100,
      },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "retry", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("failed");
      expect(run.envelope?.data?.outcome).toBe("failed");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.resume-uneconomical");
      expect(scenario.scripted.calls).not.toContain("resume");
      expect(scenario.scripted.calls).not.toContain("spawn");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(1);
      expect(read.ok && read.records[0]?.token).toBe("failed");
      expect(read.ok && read.records[0]?.comparison.reason).toBe("comparison-source-unavailable");
    } finally {
      scenario.dispose();
    }
  });

  test("unreadable cost facts refuse as state-unverified at exit 2", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope"],
        adapterSupportsResumeInjection: false,
        restartCount: 0,
        prefillCost: null,
        uniqueProgress: 100,
      },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "retry", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.state-unverified");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(1);
      expect(read.ok && read.records[0]?.token).toBe("state-unverified");
    } finally {
      scenario.dispose();
    }
  });

  test("attach-and-continue is admitted with zero ordinal consumption", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope", "specification"],
        adapterSupportsResumeInjection: true,
        restartCount: 2,
      },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "continue", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.restarts).toBe(2);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records[0]?.resumeMode).toBe("attach-continue");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-RESUME-004 an identical replay converges without a second effect", () => {
  test("the replay resumes the same lane, spawns nothing, and consumes no ordinal", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      lane: {
        completedPhases: ["clarify_scope", "specification"],
        adapterSupportsResumeInjection: true,
        restartCount: 0,
      },
    });
    try {
      const first = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "continue", "--json"]);
      const second = await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "continue", "--json"]);
      expect(first.exit).toBe(0);
      expect(second.exit).toBe(0);
      expect(scenario.scripted.calls.filter((call) => call === "resume")).toHaveLength(2);
      expect(scenario.scripted.calls).not.toContain("spawn");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(2);
      for (const record of read.ok ? read.records : []) {
        expect(record.resumeMode).toBe("attach-continue");
      }
      expect(first.envelope?.data?.restarts).toBe(0);
      expect(second.envelope?.data?.restarts).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
