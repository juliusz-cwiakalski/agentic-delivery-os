/**
 * TC-ECON-052 — a restart past budget fails loudly with history (SC-M1-15
 * economics half). The refusal precedes any execution step, carries the D-7
 * budget corpus, resolves to the full ordered durable history, and leaves the
 * single terminal exhaustion record; no fourth spawn or queue mutation occurs.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { parseRefusalCorpus } from "../../packages/core/src/domain/index";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const runtimes: EconomicsRuntime[] = [];
const runtime = (bound = 3): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound, label: "exhaustion" });
  runtimes.push(created);
  return created;
};
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const input = () => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

describe("TC-ECON-052 a restart past budget fails loudly with history", () => {
  test("the fourth attempt is refused before any spawn with the budget identity", () => {
    const created = runtime();
    seedRestarts(created.store, 3);
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("dispatch.restart-budget-exceeded");
    expect(decision.exitCode).toBe(1);
    expect(created.execution.counters.spawns).toBe(0);
    expect(created.execution.counters.kills).toBe(0);
    expect(created.execution.counters.queueMutations).toBe(0);
    expect(created.execution.counters.restarts).toBe(0);
  });

  test("the refusal corpus parses with stable keys and its reference resolves to the full history", () => {
    const created = runtime();
    seedRestarts(created.store, 3);
    const decision = created.supervised.attempt(input());
    if (decision.outcome !== "refuse") throw new Error("expected refusal");
    const corpus = parseRefusalCorpus(decision.corpus);
    expect(Object.keys(corpus)).toEqual(["reason", "restarts", "historyRef"]);
    expect(corpus.reason).toBe("dispatch.restart-budget-exceeded");
    expect(corpus.restarts).toBe("3");
    expect(corpus.historyRef).toBe("economics/GH-235");
    const resolved = created.read("GH-235");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
    expect(resolved.restarts).toHaveLength(3);
  });

  test("a terminal exhaustion record lands durably and reads back", () => {
    const created = runtime();
    seedRestarts(created.store, 3);
    created.supervised.attempt(input());
    const read = created.read("GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.terminal).toBeDefined();
    expect(read.terminal?.terminal).toBe(true);
    expect(read.terminal?.reason).toBe("dispatch.restart-budget-exceeded");
    expect(read.terminal?.restarts).toBe(3);
    expect(read.terminal?.historyRef).toBe("economics/GH-235");
  });

  test("no restart event is appended and the count stays 3", () => {
    const created = runtime();
    seedRestarts(created.store, 3);
    created.supervised.attempt(input());
    const read = created.read("GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts).toHaveLength(3);
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
  });

  test("the 2-of-3 control is admitted and appends ordinal 3", () => {
    const created = runtime();
    seedRestarts(created.store, 2);
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("admit-restart");
    if (decision.outcome !== "admit-restart") return;
    expect(decision.record.ordinal).toBe(3);
    const read = created.read("GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
    expect(read.terminal).toBeUndefined();
  });
});
