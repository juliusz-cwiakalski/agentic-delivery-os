/**
 * TC-ECON-053 — every resume path consumes the exhaustion identically. Two
 * distinct production compositions (supervised-style and one-shot-style) run
 * against the same exhausted durable state; their normalized refusals are
 * identical and the terminal record stays the single truth.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { EconomicsResumeDecision } from "../../packages/core/src/contracts/index";
import { parseRefusalCorpus } from "../../packages/core/src/domain/index";
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
  runId: "run-parity",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const normalized = (decision: EconomicsResumeDecision): Record<string, unknown> => {
  if (decision.outcome !== "refuse") return { outcome: decision.outcome };
  const corpus = parseRefusalCorpus(decision.corpus);
  return {
    outcome: decision.outcome,
    code: decision.code,
    exitCode: decision.exitCode,
    reason: corpus.reason,
    restarts: corpus.restarts,
    historyRef: corpus.historyRef,
  };
};

const terminalRecords = (created: EconomicsRuntime): number => {
  const read = created.store.readRecords();
  if (!read.ok) return 0;
  return read.value.records.filter((record) => record.kind === "economics.budget-exhaustion")
    .length;
};

describe("TC-ECON-053 every resume path consumes the exhaustion identically", () => {
  test("both compositions refuse identically with zero spawns", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "parity" });
    runtimes.push(created);
    seedRestarts(created.store, 3);
    const supervised = created.supervised.attempt(input());
    const oneShot = created.oneShot.attempt(input());
    expect(normalized(supervised)).toEqual(normalized(oneShot));
    expect(normalized(supervised)).toEqual({
      outcome: "refuse",
      code: "dispatch.restart-budget-exceeded",
      exitCode: 1,
      reason: "dispatch.restart-budget-exceeded",
      restarts: "3",
      historyRef: "economics/GH-235",
    });
    expect(created.execution.counters.spawns).toBe(0);
    expect(created.execution.counters.restarts).toBe(0);
  });

  test("the terminal record remains the single terminal truth for the delivery", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "parity-terminal" });
    runtimes.push(created);
    seedRestarts(created.store, 3);
    created.supervised.attempt(input());
    expect(terminalRecords(created)).toBe(1);
    created.oneShot.attempt(input());
    created.supervised.attempt(input());
    expect(terminalRecords(created)).toBe(1);
    const read = created.read("GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.terminal?.reason).toBe("dispatch.restart-budget-exceeded");
    expect(read.terminal?.restarts).toBe(3);
  });

  test("the one-shot path reads state only and starts no daemon or supervisor", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "parity-oneshot" });
    runtimes.push(created);
    seedRestarts(created.store, 3);
    const decision = created.oneShot.attempt(input());
    expect(decision.outcome).toBe("refuse");
    expect(created.execution.counters.supervisions).toBe(0);
    expect(created.execution.counters.spawns).toBe(0);
  });

  test("the mutant one-shot that spawns after a local count check fails parity", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "parity-mutant" });
    runtimes.push(created);
    seedRestarts(created.store, 3);
    const mutantOneShot = (): { decision: EconomicsResumeDecision; spawned: boolean } => {
      const read = created.read("GH-235");
      const count = read.ok ? read.restarts.length : 0;
      if (count >= 3) {
        // The bypass: a local count check followed by an execution step.
        created.execution.spawn("mutant-bypass");
        return { decision: created.oneShot.attempt(input()), spawned: true };
      }
      return { decision: created.oneShot.attempt(input()), spawned: false };
    };
    const supervised = created.supervised.attempt(input());
    created.execution.counters.spawns = 0;
    const mutant = mutantOneShot();
    expect(mutant.spawned).toBe(true);
    expect(created.execution.counters.spawns).toBeGreaterThan(0);
    expect(normalized(mutant.decision)).toEqual(normalized(supervised));
    // The parity oracle rejects the mutant only on the spawn assertion.
    expect(created.execution.counters.spawns).not.toBe(0);
  });
});
