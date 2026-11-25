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
    const plan = planDispatchResume({
      adapterSupportsResumeInjection: true,
      completedPhases: ["a"],
    });
    expect(plan.mode).toBe("attach-continue");
    expect(plan.consumesRestartOrdinal).toBe(false);
    expect(evaluateDispatchResumeEconomics({ mode: plan.mode })).toEqual({
      admitted: true,
      mode: "attach-continue",
      consumesRestartOrdinal: false,
    });
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
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "retry",
        "--json",
      ]);
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
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "retry",
        "--json",
      ]);
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
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "continue",
        "--json",
      ]);
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
      const first = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "continue",
        "--json",
      ]);
      const second = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--resume-prompt",
        "continue",
        "--json",
      ]);
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

/**
 * TC-RESUME-001/002/003 (GH-404 F-4, AC-F4-1, NFR-3, DEC-8, DM-1) — the
 * worktree resume rules over the delivered pure policy: reuse with zero
 * second worktrees, missing/branch-mismatched worktrees are lane errors
 * naming the problem, and the pre-change context-less lane resumes exactly as
 * today (never provisioning a worktree).
 */
import { planLaneWorktreeResume } from "../../packages/core/src/domain/dispatch-resume";

describe("TC-RESUME-001 the resume reuses the lane's worktree", () => {
  test("a recorded, present, on-branch worktree is reused — never re-provisioned", () => {
    const plan = planLaneWorktreeResume({
      worktreePath: "/repos/checkout-GH-404",
      ref: "GH-404",
      worktreePresent: true,
      worktreeBranch: "lane/GH-404",
    });
    expect(plan).toEqual({
      kind: "reuse",
      worktreePath: "/repos/checkout-GH-404",
      branch: "lane/GH-404",
    });
  });

  test("repeated resumes reuse the same worktree: zero second worktrees", () => {
    const attempts = [1, 2, 3].map(() =>
      planLaneWorktreeResume({
        worktreePath: "/repos/checkout-GH-404",
        ref: "GH-404",
        worktreePresent: true,
        worktreeBranch: "lane/GH-404",
      }),
    );
    for (const attempt of attempts) {
      expect(attempt).toEqual({
        kind: "reuse",
        worktreePath: "/repos/checkout-GH-404",
        branch: "lane/GH-404",
      });
    }
  });
});

describe("TC-RESUME-002 a missing or branch-mismatched worktree is a lane error", () => {
  test("a missing worktree names the path and never re-provisions", () => {
    const plan = planLaneWorktreeResume({
      worktreePath: "/repos/checkout-GH-404",
      ref: "GH-404",
      worktreePresent: false,
    });
    expect(plan.kind).toBe("lane-error");
    if (plan.kind === "lane-error") {
      expect(plan.reason).toBe("worktree-missing");
      expect(plan.detail).toContain("/repos/checkout-GH-404");
      expect(plan.detail).toContain("resume never re-provisions");
    }
  });

  test("a branch-mismatched worktree names observed vs expected and never moves it", () => {
    const plan = planLaneWorktreeResume({
      worktreePath: "/repos/checkout-GH-404",
      ref: "GH-404",
      worktreePresent: true,
      worktreeBranch: "some-other-branch",
    });
    expect(plan.kind).toBe("lane-error");
    if (plan.kind === "lane-error") {
      expect(plan.reason).toBe("branch-mismatch");
      expect(plan.detail).toContain("some-other-branch");
      expect(plan.detail).toContain("lane/GH-404");
    }
  });
});

describe("TC-RESUME-003 the pre-change context-less lane resumes exactly as today", () => {
  test("a record without worktree context plans the in-checkout shape", () => {
    const plan = planLaneWorktreeResume({
      ref: "GH-183",
      worktreePresent: false,
    });
    expect(plan).toEqual({ kind: "in-checkout" });
  });
});
