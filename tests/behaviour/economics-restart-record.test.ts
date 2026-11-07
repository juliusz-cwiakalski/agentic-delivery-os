/**
 * TC-ECON-050 — a restart within budget is admitted and recorded durably. One
 * verified record per admission with work item, run, session identity, ordinal,
 * classified reason, re-pay delta, and timestamp; refusals append nothing; the
 * fold is a pure read.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const runtimes: EconomicsRuntime[] = [];

const runtime = (): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: 3 });
  runtimes.push(created);
  return created;
};

afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const input = (evidence = runtimeEvidence()) => ({
  workItemRef: "GH-235",
  runId: "run-restart-record",
  reason: "session-interrupted" as const,
  evidence,
});

describe("TC-ECON-050 a restart within budget is admitted and recorded durably", () => {
  test("each admission appends exactly one verified record with the declared facts", () => {
    const created = runtime();
    for (const ordinal of [1, 2, 3]) {
      const decision = created.supervised.attempt(input());
      expect(decision.outcome).toBe("admit-restart");
      if (decision.outcome !== "admit-restart") return;
      expect(decision.record.ordinal).toBe(ordinal);
      expect(decision.record.workItemRef).toBe("GH-235");
      expect(decision.record.runId).toBe("run-economics-fixture");
      expect(decision.record.sessionId).toBe("ses_fixture_1");
      expect(decision.record.reason).toBe("session-interrupted");
      expect(decision.record.repayTokens).toEqual({ inputTokens: 100, outputTokens: 0 });
      expect(decision.record.recordedAt.length).toBeGreaterThan(0);
      const read = created.read("GH-235");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.restarts).toHaveLength(ordinal);
      expect(read.restarts.at(-1)).toEqual(decision.record);
    }
    const read = created.read("GH-235");
    if (!read.ok) return;
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
    expect(created.view("GH-235").restarts).toBe(3);
    expect(created.view("GH-235").restartHistory.map((entry) => entry.ordinal)).toEqual([1, 2, 3]);
  });

  test("a refused attempt appends nothing and does not advance the ordinal", () => {
    const created = runtime();
    for (let index = 0; index < 3; index += 1) created.supervised.attempt(input());
    const before = created.read("GH-235");
    const refused = created.supervised.attempt(input());
    expect(refused.outcome).toBe("refuse");
    const after = created.read("GH-235");
    expect(after.ok && before.ok).toBe(true);
    if (!after.ok || !before.ok) return;
    expect(after.restarts).toHaveLength(3);
    expect(after.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
  });

  test("reading the fold never appends and the schema version is unchanged", () => {
    const created = runtime();
    created.supervised.attempt(input());
    const before = created.store.readRecords();
    created.read("GH-235");
    created.view("GH-235");
    created.read("GH-235");
    const after = created.store.readRecords();
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.value.records).toHaveLength(before.value.records.length);
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    expect(created.store.identity.schemaVersion).toBe(STATE_SCHEMA_VERSION);
  });

  test("existing record kinds still read alongside the economics records", () => {
    const created = runtime();
    created.supervised.attempt(input());
    const acquired = created.store.acquireFence("existing-kind-fence");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const appended = created.store.append(acquired.value.handle, {
      kind: "commit.telemetry",
      recordKey: "commit.telemetry/GH-235",
      payload: {
        schemaId: "delivery.commit.telemetry.v1",
        changeRef: "GH-235",
        commitSha: "deadbeef",
        messageSource: "template",
        transport: "cli",
        tokenSpend: { inputTokens: 1, outputTokens: 1 },
        landedAt: "2026-11-07T00:00:00Z",
      },
    });
    created.store.releaseFence(acquired.value.handle);
    expect(appended.ok).toBe(true);
    const records = created.store.readRecords();
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    expect(records.value.records.some((record) => record.kind === "commit.telemetry")).toBe(true);
    const economics = created.read("GH-235");
    expect(economics.ok).toBe(true);
    if (!economics.ok) return;
    expect(economics.restarts).toHaveLength(1);
  });
});
