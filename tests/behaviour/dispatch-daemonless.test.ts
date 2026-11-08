/**
 * TC-DAEMON-003 (phase 9) — with no daemon, a one-shot dispatch completes from
 * state alone, appends its attempt record, and never fails, idles, or claims a
 * daemon dependency; an unavailable planner reports honest supervise-only mode.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { runSupervisionCycle } from "../../packages/core/src/app/daemon-supervision";
import { createLaneExecutor } from "../../packages/adapters/src/daemon/lane-executor";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE, createScriptedHarness } from "../fixtures/dispatch/harness";

describe("TC-DAEMON-003 one-shot dispatch works with no daemon", () => {
  test("the one-shot path completes, records, and needs no daemon", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(1);
      // No daemon lane record was created by the one-shot path.
      const ledger = scenario.state.store.readRecords();
      expect(ledger.ok).toBe(true);
      if (!ledger.ok) return;
      expect(ledger.value.records.some((record) => record.kind === "daemon.lane")).toBe(false);
    } finally {
      scenario.dispose();
    }
  });

  test("the daemon with an unavailable planner reports supervise-only, not a fake lane", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const scripted = createScriptedHarness();
      const executor = createLaneExecutor({ session: scripted.port });
      const result = await runSupervisionCycle({
        store: scenario.state.store,
        fenceToken: "fence",
        ports: {
          executor,
          nextAction: () => ({ ref: "GH-301", repository: "github.com/owner/repo", weightClass: "standard" }),
          claim: () => ({ ok: true, leaseId: "lease-1" }),
          release: () => true,
          nowIso: () => "2026-11-08T10:00:00.000Z",
        },
      });
      expect(result.mode).toBe("supervise-only");
      expect(scripted.calls).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });
});
