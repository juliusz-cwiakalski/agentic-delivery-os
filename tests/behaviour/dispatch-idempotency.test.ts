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
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
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

  test("a handover replay under an advancing clock still appends exactly one record", async () => {
    let tick = 0;
    const scenario = createCommandScenario({
      gate: {},
      nowIso: () =>
        new Date(Date.parse("2026-11-08T10:00:00.000Z") + tick++ * 300_000).toISOString(),
    });
    try {
      seed(scenario);
      const first = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(first.exit).toBe(0);
      const firstRecord = readDispatchHandover(scenario.state.store);
      expect(firstRecord.ok && firstRecord.records).toHaveLength(1);
      if (!firstRecord.ok) return;
      const recordedAt = firstRecord.records[0]?.recordedAt;

      // A later instant must not append a second record: the fold is consulted
      // before the append, so an already-authoritative repository is a noop.
      const second = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(second.exit).toBe(0);
      expect(second.envelope?.data).toMatchObject({ recorded: false, noop: true });
      const after = readDispatchHandover(scenario.state.store);
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.records).toHaveLength(1);
      expect(after.records[0]?.recordedAt).toBe(recordedAt);
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
