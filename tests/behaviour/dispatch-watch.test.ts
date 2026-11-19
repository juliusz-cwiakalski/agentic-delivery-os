/**
 * TC-DISP-005 (phase 4 command watch slice) — the one-shot path watches the
 * session with the phase-2 progress verdict at the `lane.liveness-interval`
 * cadence while `collect` is pending: an advancing session stays `progressing`
 * and records the verdict trail, a stalled session is routed through restart
 * admission and classifies `max-restarts` (Appendix G) with the terminal
 * exhaustion record, and a stall below the bound never leaks a silent second
 * spawn.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import type { HarnessLivenessReport } from "../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { artifacts, readOk } from "../fixtures/dispatch/truth";

const OBSERVED_AT = "2026-11-08T10:00:00.000Z";

/** A sourced observation pair; only a rising value is progress. */
const sourced = (value: number): HarnessLivenessReport => ({
  readings: [
    { kind: "session-traffic", status: "sourced", value, observedAt: OBSERVED_AT },
    { kind: "process", status: "sourced", value, observedAt: OBSERVED_AT },
  ],
});

const evidenceOf = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok || read.records.length === 0) throw new Error("attempt read failed");
  return read.records[0];
};

describe("the one-shot watch keeps an advancing session progressing", () => {
  test("advancing readings record progressing and never stall", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      livenessOf: (poll) => sourced(poll),
      collectAfterPolls: 3,
      restartBudget: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      // The watcher polled more than once while `collect` was pending.
      expect(scenario.scripted.livenessPolls()).toBeGreaterThanOrEqual(2);
      const record = evidenceOf(scenario);
      expect(record.token).toBe("pr-open");
      expect(record.evidenceRefs).toContain("liveness:unknown");
      expect(record.evidenceRefs).toContain("liveness:progressing");
      expect(record.evidenceRefs).not.toContain("liveness:stalled");
    } finally {
      scenario.dispose();
    }
  });
});

describe("the one-shot watch clears a transient stall on later progress", () => {
  test("a stall followed by progress and completed evidence classifies finished", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      // Completed evidence with no PR/tracker truth yet: classification falls
      // through to the harness token, so a cleared stall must yield `finished`.
      reads: readsFrom({
        artifacts: {
          ok: true,
          value: {
            branchCommits: 2,
            pr: { state: "none", url: null, mergeReady: false },
            pmNotes: "complete",
          },
        },
        ledger: {
          ok: true,
          value: {
            completed: 3,
            total: 9,
            lastCompletedPhase: "delivery_planning",
            progressed: true,
            workRemaining: true,
          },
        },
      }),
      livenessIntervalMs: 30_000,
      // Poll 2 stalls (no advance); polls 3 and 4 advance, clearing the stall
      // before collection resolves. The restart budget is already exhausted, so
      // a latched stall would still refuse at the budget.
      livenessOf: (poll) => sourced(poll >= 3 ? 5 + poll : 5),
      collectAfterPolls: 4,
      restartBudget: 3,
      restartCount: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("finished");
      expect(run.envelope?.data?.outcome).toBe("completed");
      const record = evidenceOf(scenario);
      expect(record.token).toBe("finished");
      // The transient stall stays recorded as liveness evidence, and no restart
      // refusal or terminal exhaustion record was produced.
      expect(record.evidenceRefs).toContain("liveness:stalled");
      expect(record.evidenceRefs).toContain("liveness:progressing");
      expect(record.evidenceRefs).not.toContain("economics:exhaustion");
      expect(scenario.calls.exhaustions).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("the one-shot watch routes a corroborated stall through restart admission", () => {
  test("a persistent no-advance stall at the restart bound classifies max-restarts", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      livenessOf: () => sourced(5),
      collectAfterPolls: 3,
      // A decisive artifact OUTSIDE the terminal pre-restart set, so the stall
      // reaches the bound instead of short-circuiting (GH-347 DM-4).
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
      }),
      restartBudget: 3,
      restartCount: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("max-restarts");
      expect(run.envelope?.data?.outcome).toBe("failed");
      const record = evidenceOf(scenario);
      expect(record.token).toBe("max-restarts");
      // Two consecutive sourced observations with no advance is a stall.
      expect(record.evidenceRefs).toContain("liveness:stalled");
      // The delivered terminal exhaustion record is present.
      expect(record.evidenceRefs).toContain("economics:exhaustion");
      expect(scenario.calls.exhaustions).toEqual([{ ref: "GH-301", restarts: 3 }]);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok && attempts.records).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });

  test("a stall below the bound terminates the session and resumes it in-process", async () => {
    // DELIVERED EXPECTATION UPDATE (GH-347 §8.5, AC-F6-1, DEC-4, DEC-5): a
    // below-bound stall no longer defers to lane supervision. The loop consumes
    // exactly one ordinal, appends one `economics.restart`, terminates the
    // stalled session, resumes the recorded one, and runs a second iteration.
    // The spawn count stays 1 (the restart is a RESUME, never a second spawn).
    let resolved = false;
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      livenessOf: () => {
        // The second iteration advances, so it is not a stall.
        if (resolved) return sourced(9);
        resolved = scenario.scripted.livenessPolls() >= 3;
        return sourced(5);
      },
      collectAfterPolls: 3,
      readsSequence: [
        readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
        readsFrom(),
      ],
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const record = evidenceOf(scenario);
      expect(record.token).toBe("pr-open");
      // The stall is recorded on the restart, not on the terminal attempt (the
      // restarted iteration appends no attempt of its own).
      const spawns = scenario.scripted.calls.filter((call) => call === "spawn");
      const resumes = scenario.scripted.calls.filter((call) => call === "resume");
      expect(spawns).toHaveLength(1);
      expect(resumes).toHaveLength(1);
      expect(scenario.calls.restarts).toEqual([
        { ordinal: 1, reason: "watchdog.liveness-stalled" },
      ]);
      expect(run.envelope?.data?.restarts).toBe(1);
      expect(scenario.calls.exhaustions).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});
