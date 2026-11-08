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
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

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

describe("the one-shot watch routes a corroborated stall through restart admission", () => {
  test("two no-advance readings at the restart bound classify max-restarts", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      livenessOf: () => sourced(5),
      collectAfterPolls: 3,
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

  test("a stall below the bound is recorded and never leaks a second spawn", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      livenessOf: () => sourced(5),
      collectAfterPolls: 3,
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const record = evidenceOf(scenario);
      expect(record.token).toBe("pr-open");
      expect(record.evidenceRefs).toContain("liveness:stalled");
      // Exactly one session was spawned; an admitted restart is deferred to lane
      // supervision rather than a silent second spawn in the same run.
      const spawns = scenario.scripted.calls.filter((call) => call === "spawn");
      expect(spawns).toHaveLength(1);
      expect(scenario.calls.exhaustions).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});
