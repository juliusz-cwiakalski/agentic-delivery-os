/**
 * TC-LOOP-006 — a persisted restart count at or above `lane.restart-budget`
 * never refuses admission (GH-347 AC-F6-6, AC-F3-2, DEC-5, R5; supersedes
 * TC-RESUME-002).
 *
 * DELIVERED EXPECTATION UPDATE (§8.5 "Operator resume at the persisted bound is
 * admitted"; Appendix F(D)): the delivered case asserted that such a run was
 * REFUSED before any spawn. That expectation is superseded — the dispatch now
 * runs exactly one iteration, a clean exit keeps its own classification, and
 * only a stall in that iteration produces `max-restarts`. The suite keeps its
 * file and its subject; the old expectation is replaced, not forgotten.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { artifacts, readOk } from "../fixtures/dispatch/truth";

const stallLiveness = (value: number) => ({
  readings: [
    {
      kind: "session-traffic" as const,
      status: "sourced" as const,
      value,
      observedAt: "2026-11-08T10:00:00.000Z",
    },
    {
      kind: "process" as const,
      status: "sourced" as const,
      value,
      observedAt: "2026-11-08T10:00:00.000Z",
    },
  ],
});

describe("TC-LOOP-006 a persisted count at or above the bound admits one iteration", () => {
  for (const count of [3, 4]) {
    test(`a clean exit at persisted count ${count} keeps its classification`, async () => {
      const scenario = createCommandScenario({
        evidence: COMPLETED_EVIDENCE,
        restartBudget: 3,
        restartCount: count,
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(run.exit).toBe(0);
        expect(run.envelope?.data?.result).toBe("pr-open");
        expect(run.envelope?.data?.restarts).toBe(count);
        expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
        const read = readDispatchAttempts(scenario.state.store);
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.records).toHaveLength(1);
        expect(read.records[0]?.token).toBe("pr-open");
      } finally {
        scenario.dispose();
      }
    });

    test(`a stall at persisted count ${count} produces max-restarts`, async () => {
      const scenario = createCommandScenario({
        evidence: COMPLETED_EVIDENCE,
        livenessIntervalMs: 30_000,
        livenessOf: () => stallLiveness(5),
        collectAfterPolls: 3,
        reads: readsFrom({
          artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })),
        }),
        restartBudget: 3,
        restartCount: count,
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(run.exit).toBe(1);
        expect(run.envelope?.data?.result).toBe("max-restarts");
        expect(run.envelope?.data?.outcome).toBe("failed");
        expect(run.envelope?.data?.error?.code).toBe("dispatch.restart-budget-exceeded");
        expect(run.envelope?.data?.restarts).toBe(count);
        // One iteration: one session acquisition, one attempt, one exhaustion.
        expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
        expect(scenario.calls.exhaustions).toEqual([{ ref: "GH-301", restarts: count }]);
        const read = readDispatchAttempts(scenario.state.store);
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.records).toHaveLength(1);
        const record = read.records[0];
        expect(record?.token).toBe("max-restarts");
        expect(record?.evidenceRefs).toContain("economics:exhaustion");
        expect(record?.comparison).toEqual({
          class: "not-applicable",
          token: null,
          outcome: "not-applicable",
          reason: "dispatch-session-family",
        });
      } finally {
        scenario.dispose();
      }
    });
  }
});
