/**
 * TC-ECON-055 — the budget gate is fail-closed on unevaluable state. Torn,
 * unreadable, unknown-kind, and contradictory-ordinal states each refuse with a
 * delivered identity; count 0 is never fabricated and `fallback.internal` is
 * never produced.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type {
  EconomicsResumeStorePort,
  EconomicsRestartRecord,
} from "../../packages/core/src/contracts/index";
import {
  createOneShotResumeComposition,
  evaluateRestartBudget,
} from "../../packages/core/src/domain/index";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const runtimes: EconomicsRuntime[] = [];
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const input = () => ({
  workItemRef: "GH-235",
  runId: "run-failclosed",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const rawRestartPayload = (ordinal: number, overrides: Record<string, unknown> = {}) => ({
  schemaId: "delivery.economics.restart.v1",
  workItemRef: "GH-235",
  runId: "run-raw",
  sessionId: `ses_fixture_${ordinal}`,
  ordinal,
  reason: "session-interrupted",
  repayTokens: { inputTokens: 100, outputTokens: 0 },
  observedUniqueProgressTokens: 400,
  recordedAt: "2026-11-07T00:00:01Z",
  ...overrides,
});

const rawAppend = (
  created: EconomicsRuntime,
  kind: string,
  payload: Record<string, unknown>,
  fence = "raw-fence",
): void => {
  const acquired = created.store.acquireFence(fence);
  if (!acquired.ok) throw new Error(`fence failed: ${acquired.error.code}`);
  try {
    const appended = created.store.append(acquired.value.handle, {
      kind,
      recordKey: "economics/GH-235",
      payload: payload as never,
    });
    if (!appended.ok) throw new Error(`append failed: ${appended.error.code}`);
  } finally {
    created.store.releaseFence(acquired.value.handle);
  }
};

const stubPort = (read: ReturnType<EconomicsResumeStorePort["readDeliveryRecords"]>): EconomicsResumeStorePort => ({
  readDeliveryRecords: () => read,
  appendRestartEvent: () => {
    throw new Error("must not append");
  },
  ensureExhaustionRecord: () => {
    throw new Error("must not append");
  },
});

const compositionFor = (port: EconomicsResumeStorePort) =>
  createOneShotResumeComposition({
    store: port,
    budget: { readRestartBudget: () => 3 },
    capability: { modes: ["prompt-reentry"] },
    now: () => "2026-11-07T00:00:00Z",
    runId: "run-failclosed",
  });

describe("TC-ECON-055 the budget gate is fail-closed on unevaluable state", () => {
  test("a torn restart record refuses with state.store.torn and never admits", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "failclosed-torn" });
    runtimes.push(created);
    rawAppend(created, "economics.restart", rawRestartPayload(1, { schemaId: "torn" }));
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("unevaluable");
    if (decision.outcome !== "unevaluable") return;
    expect(decision.code).toBe("state.store.torn");
    expect(decision.corpus).toContain("reason=state.store.torn");
    expect(decision.corpus).not.toContain("fallback");
    expect(created.read("GH-235").ok).toBe(false);
  });

  test("an unknown record kind among the delivery's records refuses with state.store.unknown", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "failclosed-unknown" });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    rawAppend(created, "economics.unknown", rawRestartPayload(2));
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("unevaluable");
    if (decision.outcome !== "unevaluable") return;
    expect(decision.code).toBe("state.store.unknown");
  });

  test("a contradictory ordinal gap or duplicate refuses with state.store.torn", () => {
    const gap = createEconomicsRuntime({ bound: 3, label: "failclosed-gap" });
    runtimes.push(gap);
    rawAppend(gap, "economics.restart", rawRestartPayload(1));
    rawAppend(gap, "economics.restart", rawRestartPayload(3), "raw-fence-2");
    const gapDecision = gap.supervised.attempt(input());
    expect(gapDecision.outcome).toBe("unevaluable");
    if (gapDecision.outcome === "unevaluable") expect(gapDecision.code).toBe("state.store.torn");

    const duplicate = createEconomicsRuntime({ bound: 3, label: "failclosed-duplicate" });
    runtimes.push(duplicate);
    rawAppend(duplicate, "economics.restart", rawRestartPayload(1, { runId: "run-a" }));
    rawAppend(duplicate, "economics.restart", rawRestartPayload(1, { runId: "run-b" }), "raw-fence-2");
    const duplicateDecision = duplicate.supervised.attempt(input());
    expect(duplicateDecision.outcome).toBe("unevaluable");
    if (duplicateDecision.outcome === "unevaluable") {
      expect(duplicateDecision.code).toBe("state.store.torn");
    }
  });

  test("an unreadable store refuses and never fabricates count 0", () => {
    const decision = compositionFor(
      stubPort({ ok: false, code: "state.store.torn", location: { path: "/synthetic/ledger" } }),
    ).attempt(input());
    expect(decision.outcome).toBe("unevaluable");
    if (decision.outcome !== "unevaluable") return;
    expect(decision.code).toBe("state.store.torn");
    expect(decision.exitCode).toBe(2);
    expect(decision.corpus).toContain("reason=state.store.torn");
  });

  test("the gate never returns fallback.internal and refuses rather than admitting", () => {
    const gate = evaluateRestartBudget({
      workItemRef: "GH-235",
      bound: 3,
      records: [] as readonly EconomicsRestartRecord[],
      unreadable: "state.permission.denied",
    });
    expect(gate.outcome).toBe("unevaluable");
    if (gate.outcome !== "unevaluable") return;
    expect(gate.code).toBe("state.permission.denied");
    expect(gate.exitCode).toBe(1);
  });

  test("the treats-unreadable-as-empty mutant fails: it admits where the gate refuses", () => {
    const failOpen = evaluateRestartBudget({
      workItemRef: "GH-235",
      bound: 3,
      records: [],
    });
    const real = evaluateRestartBudget({
      workItemRef: "GH-235",
      bound: 3,
      records: [],
      unreadable: "state.store.torn",
    });
    expect(failOpen.outcome).toBe("admit");
    expect(real.outcome).toBe("unevaluable");
    expect(failOpen.outcome).not.toBe(real.outcome);
  });
});
