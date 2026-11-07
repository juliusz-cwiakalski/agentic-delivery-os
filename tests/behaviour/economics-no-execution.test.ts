/**
 * TC-ECON-022 — lifecycle evaluation refuses or records; it never spawns, kills,
 * or steers. The runtime type declares no execution port, every fixture class
 * runs with an empty execution log, the economics modules import no session/host
 * port, and no fixture mutates a lane record.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EconomicsResumeStorePort } from "../../packages/core/src/contracts/index";
import { createSourcedWatchdogSignalSource } from "../../packages/core/src/domain/index";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";
import { runWatchdogCli, runnerSideEffectCalls } from "../fixtures/watchdog/harness";
import { createWatchdogRepository } from "../fixtures/watchdog/temp-git";

const ROOT = process.cwd();
const runtimes: EconomicsRuntime[] = [];
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const input = (overrides: { repayTokens?: number; observed?: number } = {}) => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence({
    ...(overrides.repayTokens === undefined
      ? {}
      : { repayTokens: { inputTokens: overrides.repayTokens, outputTokens: 0 } }),
    ...(overrides.observed === undefined
      ? {}
      : { observedUniqueProgressTokens: overrides.observed }),
  }),
});

const runtime = (options: Parameters<typeof createEconomicsRuntime>[0] = {}): EconomicsRuntime => {
  const created = createEconomicsRuntime({ label: "no-execution", ...options });
  runtimes.push(created);
  return created;
};

describe("TC-ECON-022 lifecycle evaluation never spawns, kills, or steers", () => {
  test("the resume store port declares no spawn, kill, steer, or restart-execution operation", () => {
    const port = runtime().port as unknown as Record<string, unknown>;
    expect(Object.keys(port).sort()).toEqual([
      "appendRestartEvent",
      "ensureExhaustionRecord",
      "readDeliveryRecords",
    ]);
    const contract = readFileSync(join(ROOT, "packages/core/src/contracts/economics.ts"), "utf8");
    const portBlock = contract.slice(
      contract.indexOf("export type EconomicsResumeStorePort"),
      contract.indexOf("export type EconomicsBudgetPolicyPort"),
    );
    expect(portBlock).not.toMatch(/\bspawn\b|\bkill\b|\bsteer\b/);
    expect(Object.keys(port) satisfies (keyof EconomicsResumeStorePort)[]).not.toContain("spawn");
  });

  test("every fixture class runs with zero spawn, kill, steer, restart, or supervision calls", () => {
    const attach = runtime({ capability: { modes: ["attach-continue"] } });
    attach.supervised.attempt(input());

    const economical = runtime({ bound: 3 });
    seedRestarts(economical.store, 1);
    economical.supervised.attempt(input({ repayTokens: 100, observed: 400 }));

    const uneconomical = runtime({ bound: 3 });
    seedRestarts(uneconomical.store, 1);
    uneconomical.supervised.attempt(input({ repayTokens: 900, observed: 100 }));

    const within = runtime({ bound: 5 });
    within.supervised.attempt(input({ repayTokens: 100, observed: 400 }));

    const past = runtime({ bound: 1 });
    seedRestarts(past.store, 1);
    past.supervised.attempt(input({ repayTokens: 100, observed: 400 }));

    for (const created of [attach, economical, uneconomical, within, past]) {
      expect(created.execution.calls).toEqual([]);
      expect(created.execution.counters.spawns).toBe(0);
      expect(created.execution.counters.kills).toBe(0);
      expect(created.execution.counters.steers).toBe(0);
      expect(created.execution.counters.restarts).toBe(0);
      expect(created.execution.counters.supervisions).toBe(0);
      expect(created.execution.counters.queueMutations).toBe(0);
    }
  });

  test("the liveness classes (prefill, stall, absent) record no runner-side effect", async () => {
    const repo = createWatchdogRepository();
    try {
      const run = async (facts: Parameters<typeof createSourcedWatchdogSignalSource>[0]) =>
        runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
          repo,
          signalSources: [createSourcedWatchdogSignalSource(facts)],
        });
      const prefill = await run(() => ({
        readings: [{ kind: "session-traffic", status: "sourced", value: 5, observedAt: "t" }],
        sourcedSignals: [{ kind: "token-delta", status: "sourced", value: 42, observedAt: "t" }],
      }));
      const stall = await run(() => ({
        readings: [{ kind: "session-traffic", status: "sourced", value: 0, observedAt: "t" }],
        sourcedSignals: [
          { kind: "heartbeat-age", status: "sourced", value: 400_000, observedAt: "t" },
          { kind: "token-delta", status: "sourced", value: 0, observedAt: "t" },
        ],
      }));
      const absent = await run(() => ({ readings: [], sourcedSignals: [] }));
      for (const outcome of [prefill, stall, absent]) {
        expect(runnerSideEffectCalls(outcome.runtimeCalls)).toEqual([]);
      }
      expect(prefill.exitCode).toBe(0);
      expect(stall.exitCode).toBe(1);
      expect(absent.exitCode).toBe(2);
    } finally {
      repo.remove();
    }
  }, 30_000);

  test("the domain, state, config, and CLI economics modules import no execution or host port", () => {
    for (const file of [
      "packages/core/src/domain/economics-budget.ts",
      "packages/core/src/domain/economics-resume.ts",
      "packages/core/src/domain/economics-view.ts",
      "packages/core/src/domain/economics-evidence.ts",
      "packages/core/src/state/economics.ts",
      "packages/core/src/config/catalog.ts",
      "packages/cli/src/commands/watchdog.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const specifier of text.match(/from "[^"]+"/g) ?? []) {
        expect(specifier, file).not.toContain("@delivery-os/adapters/session");
        expect(specifier, file).not.toContain("@delivery-os/adapters/host");
        expect(specifier, file).not.toContain("harness");
      }
    }
  });

  test("no fixture mutates a lane record's delivery state", () => {
    const created = runtime({ bound: 3 });
    created.supervised.attempt(input());
    const read = created.store.readRecords();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    for (const record of read.value.records) {
      expect(record.key.startsWith("economics/")).toBe(true);
      expect(JSON.stringify(record.payload)).not.toContain("deliveryState");
    }
  });

  test("the mutant that calls a spawn port on a refusal path fails the call-log assertion", () => {
    const created = runtime({ bound: 1 });
    seedRestarts(created.store, 1);
    created.supervised.attempt(input());
    const mutantSpawnOnRefusal = (): void => {
      created.execution.spawn("refusal-bypass");
    };
    mutantSpawnOnRefusal();
    expect(created.execution.counters.spawns).toBeGreaterThan(0);
    expect(created.execution.calls).toContain("spawns:refusal-bypass");
  });
});
