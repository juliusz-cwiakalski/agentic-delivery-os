/**
 * TC-DISP-006 / TC-DISP-010 (phase 4) — the machine envelope carries exactly the
 * declared data keys with a mandatory `outcome` beside `result`, and a failing
 * run still emits a complete, classified envelope with one attempt record.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  COMPLETED_EVIDENCE,
  PREMATURE_END_EVIDENCE,
  TOOL_FAILURE_EVIDENCE,
} from "../fixtures/dispatch/harness";
import { artifacts, ledger, prNone, readOk, readFail } from "../fixtures/dispatch/truth";

const attemptsOf = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error("ledger read failed");
  return read.records;
};

describe("TC-DISP-006 machine envelope shape and mandatory outcome", () => {
  test("a pr-open run emits exactly the declared data keys", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data).toBeDefined();
      expect(Object.keys(run.envelope?.data ?? {}).sort()).toEqual(
        [
          "harness",
          "handoverState",
          "lastMessage",
          "outcome",
          "phaseLedger",
          "prUrl",
          "restarts",
          "result",
          "resumeAmplification",
        ].sort(),
      );
      expect(run.envelope?.data?.phaseLedger).toMatchObject({
        completed: 3,
        total: 9,
        variant: "full",
      });
      expect(run.envelope?.data?.handoverState).toBe("dual-run");
    } finally {
      scenario.dispose();
    }
  });

  test("a partial result always carries its outcome", async () => {
    for (const evidence of [TOOL_FAILURE_EVIDENCE, PREMATURE_END_EVIDENCE]) {
      const scenario = createCommandScenario({
        evidence,
        reads: readsFrom({
          artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })),
          ledger: readOk(ledger()),
        }),
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(run.envelope?.data?.result).toBe("partial");
        expect(run.envelope?.data?.outcome.length).toBeGreaterThan(0);
        expect(run.exit).toBe(1);
      } finally {
        scenario.dispose();
      }
    }
  });
});

describe("TC-DISP-010 a failing run still emits a complete classified envelope", () => {
  test("a spawn failure emits failed/failed with full error fields and one record", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("failed");
      expect(run.envelope?.data?.outcome).toBe("failed");
      expect(run.envelope?.data?.error).toMatchObject({
        code: "dispatch.session.spawn-failed",
        category: "user",
        retryable: false,
        consequence: "not_landed",
      });
      expect(run.envelope?.data?.error?.remediationHint.length).toBeGreaterThan(0);
      expect(run.envelope?.data?.error?.summary?.length).toBeGreaterThan(0);
      const attempts = attemptsOf(scenario);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "comparison-source-unavailable",
      });
    } finally {
      scenario.dispose();
    }
  });

  test("an unreadable truth read emits state-unverified at exit 2 with one record", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({ tracker: readFail("tracker", "tracker.read-unreadable") }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.state-unverified");
      expect(run.envelope?.data?.error?.category).toBe("platform");
      const attempts = attemptsOf(scenario);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.comparison.class).toBe("not-applicable");
      expect(attempts[0]?.comparison.reason).toBe("comparison-source-unavailable");
    } finally {
      scenario.dispose();
    }
  });

  test("no run emits prose in place of an identity or an exit outside 0, 1, 2", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect([0, 1, 2]).toContain(run.exit);
      expect(run.envelope?.exitCode).toBe(run.exit);
    } finally {
      scenario.dispose();
    }
  });
});
