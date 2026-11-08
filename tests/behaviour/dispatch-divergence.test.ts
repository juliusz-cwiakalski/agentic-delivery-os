/**
 * TC-EVID-002 (phase 6) — a comparison mismatch opens a divergence; a match or a
 * not-applicable comparison opens none; resolution appends a resolved record
 * and never rewrites the original open record; the summary reports both totals.
 */
import { describe, expect, test } from "bun:test";
import {
  readDispatchAttempts,
  readDispatchDivergences,
} from "../../packages/core/src/app/dispatch-ledger";
import { summarizeDispatchEvidence } from "../../packages/core/src/app/dispatch-gate";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { artifacts, prNone, readOk } from "../fixtures/dispatch/truth";
import { dayAt } from "../fixtures/dispatch/evidence-windows";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const mismatchReads = () =>
  readsFrom({
    artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })),
    verifyOutcome: "failed",
    phasesComplete: true,
  });

describe("TC-EVID-002 divergence opens on disagreement and resolves append-only", () => {
  test("a verify-change mismatch opens a divergence and records the comparison", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: mismatchReads(),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records[0]?.comparison.outcome).toBe("mismatch");
      const divergenceId = attempts.records[0]?.divergenceRef;
      expect(divergenceId).toBeDefined();
      const divergences = readDispatchDivergences(scenario.state.store);
      expect(divergences.ok).toBe(true);
      if (!divergences.ok) return;
      expect(divergences.records).toHaveLength(1);
      expect(divergences.records[0]?.state).toBe("open");
      expect(divergences.records[0]?.comparisonClass).toBe("verify-change");
    } finally {
      scenario.dispose();
    }
  });

  test("a resolution appends a resolved record, preserves the open one, and the summary counts both", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: mismatchReads(),
      gate: {},
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const divergences = readDispatchDivergences(scenario.state.store);
      if (!divergences.ok) throw new Error("divergence read failed");
      const id = divergences.records[0]?.divergenceId;
      expect(id).toBeDefined();
      const resolved = await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        id as string,
        "--note",
        "tracker was stale; PR reopened",
        "--json",
      ]);
      expect(resolved.exit).toBe(0);
      const read = readDispatchDivergences(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records.map((record) => record.state)).toEqual(["open", "resolved"]);
      expect(read.records[1]?.note).toBe("tracker was stale; PR reopened");
      expect(read.records[1]?.principal).toBe("coder@local");

      const summary = summarizeDispatchEvidence({
        store: scenario.state.store,
        repository: REPOSITORY,
        scope: "production",
        nowIso: dayAt(30),
      });
      expect(summary.ok).toBe(true);
      if (!summary.ok) return;
      expect(summary.data.divergences).toMatchObject({ reported: 1, resolved: 1, unresolved: 0 });
      expect(summary.data.divergences.unresolvedIds).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a match and a not-applicable comparison append no divergence", async () => {
    const matchScenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      await matchScenario.invoke(["dispatch", "GH-301", "--json"]);
      const divergences = readDispatchDivergences(matchScenario.state.store);
      expect(divergences.ok && divergences.records).toEqual([]);
    } finally {
      matchScenario.dispose();
    }

    // A max-restarts admission refusal carries a not-applicable comparison.
    const suppressed = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      restartBudget: 1,
      lane: {
        completedPhases: ["clarify_scope"],
        adapterSupportsResumeInjection: true,
        restartCount: 1,
      },
    });
    try {
      await suppressed.invoke(["dispatch", "GH-301", "--resume-prompt", "x", "--json"]);
      const divergences = readDispatchDivergences(suppressed.state.store);
      expect(divergences.ok && divergences.records).toEqual([]);
    } finally {
      suppressed.dispose();
    }
  });
});
