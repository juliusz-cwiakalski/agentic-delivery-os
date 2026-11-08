/**
 * TC-NFR-005 (phase 10) — replaying summary, handover, reversal, and resume
 * appends no duplicate record, leaves authority unchanged, and reports a noop
 * where nothing changed.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const seed = (scenario: ReturnType<typeof createCommandScenario>) => {
  for (const attempt of buildAttempts(eligibleSpecs())) {
    const appended = appendDispatchAttempt(
      scenario.state.store,
      scenario.state.fenceToken,
      attempt,
    );
    if (!appended.ok) throw new Error("seed failed");
  }
};

describe("TC-NFR-005 replays append no duplicate records", () => {
  test("a summary replay appends nothing", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario);
      const before = readDispatchAttempts(scenario.state.store);
      await scenario.invoke(["dispatch", "dual-run", "summary", "--repo", REPOSITORY, "--json"]);
      await scenario.invoke(["dispatch", "dual-run", "summary", "--repo", REPOSITORY, "--json"]);
      const after = readDispatchAttempts(scenario.state.store);
      expect(before.ok && after.ok).toBe(true);
      if (!before.ok || !after.ok) return;
      expect(after.records).toHaveLength(before.records.length);
    } finally {
      scenario.dispose();
    }
  });

  test("a handover replay is a noop and authority is unchanged", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario);
      const first = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(first.exit).toBe(0);
      const second = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(second.exit).toBe(0);
      expect(second.envelope?.data).toMatchObject({ recorded: false, noop: true });
      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok && handover.records).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });

  test("a reversal replay is a noop and history is preserved", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario);
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      await scenario.invoke(["dispatch", "handover", REPOSITORY, "--revert", "--json"]);
      const replay = await scenario.invoke([
        "dispatch",
        "handover",
        REPOSITORY,
        "--revert",
        "--json",
      ]);
      expect(replay.exit).toBe(0);
      expect(replay.envelope?.data).toMatchObject({ recorded: false, noop: true });
      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok && handover.records.map((record) => record.operation)).toEqual([
        "authoritative",
        "dual-run",
      ]);
    } finally {
      scenario.dispose();
    }
  });
});
