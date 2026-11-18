/**
 * TC-ECON-072 — the budget bound is configuration-driven, never a literal. The
 * bound is read at evaluation time from resolved lane settings; hardcoding 3
 * fails the budget-5 case and the structure scan.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, resolveLaneSettings } from "../../packages/core/src/index";
import { createOneShotResumeComposition } from "../../packages/core/src/domain/index";
import {
  createEconomicsResumeStorePort,
  createStateStore,
  readEconomicsRecords,
} from "../../packages/core/src/state/index";
import { createTestEdge, makeIdentity } from "../fixtures/state/harness";
import { laneSource } from "../fixtures/config/lane";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const ROOT = process.cwd();
const runtimes: EconomicsRuntime[] = [];
const extraRoots: string[] = [];
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
  for (const root of extraRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const input = () => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const boundFor = (restartBudget: number): number => {
  const resolved = resolveConfig({
    sources: [laneSource({ "liveness-interval": 30000, "restart-budget": restartBudget })],
  });
  if (!resolved.ok) throw new Error(`resolve failed: ${resolved.error.code}`);
  const lane = resolveLaneSettings(resolved.value.values, resolved.value.origins);
  if (!lane.ok) throw new Error(`lane failed: ${lane.error.code}`);
  return lane.value.restartBudget;
};

const runWithBound = (restartBudget: number, label: string): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: boundFor(restartBudget), label });
  runtimes.push(created);
  return created;
};

describe("TC-ECON-072 the budget bound is configuration-driven", () => {
  test("budget 0 refuses the first attempt with no event and no spawn", () => {
    const created = runWithBound(0, "budget-0");
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("dispatch.restart-budget-exceeded");
    expect(created.execution.counters.spawns).toBe(0);
    const read = created.read("GH-235");
    if (!read.ok) return;
    expect(read.restarts).toHaveLength(0);
  });

  test("budget 1 admits ordinal 1 and refuses the second attempt", () => {
    const created = runWithBound(1, "budget-1");
    const first = created.supervised.attempt(input());
    expect(first.outcome).toBe("admit-restart");
    if (first.outcome === "admit-restart") expect(first.record.ordinal).toBe(1);
    const second = created.supervised.attempt(input());
    expect(second.outcome).toBe("refuse");
  });

  test("budget 5 admits ordinals 1..5 and refuses the sixth attempt", () => {
    const created = runWithBound(5, "budget-5");
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
      const decision = created.supervised.attempt(input());
      expect(decision.outcome).toBe("admit-restart");
      if (decision.outcome === "admit-restart") expect(decision.record.ordinal).toBe(ordinal);
    }
    const sixth = created.supervised.attempt(input());
    expect(sixth.outcome).toBe("refuse");
    const view = created.view("GH-235");
    expect(view.restarts).toBe(5);
    expect(view.restartHistory.map((entry) => entry.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });

  test("the count and history reflect exactly the configured bound, never 3", () => {
    const three = runWithBound(3, "bound-3");
    for (let index = 0; index < 3; index += 1) three.supervised.attempt(input());
    expect(three.view("GH-235").restarts).toBe(3);

    const five = runWithBound(5, "bound-5");
    for (let index = 0; index < 5; index += 1) five.supervised.attempt(input());
    expect(five.view("GH-235").restarts).toBe(5);
  });

  test("the structure scan finds no bound literal in the gate module and one default in the defaults layer", () => {
    const gate = readFileSync(join(ROOT, "packages/core/src/domain/economics-budget.ts"), "utf8");
    expect(/\b3\b/.test(gate.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, ""))).toBe(false);
    const defaults = readFileSync(join(ROOT, "packages/core/src/config/defaults.ts"), "utf8");
    expect(defaults.match(/"restart-budget": 3/g)).toHaveLength(1);
  });

  test("the bound is read at evaluation time, so a changed resolved bound is observed", () => {
    const root = makeRoot("budget-evaluation-time");
    const store = createStateStore(makeIdentity(root), {
      driver: "jsonl",
      edge: createTestEdge(),
    });
    let bound = 3;
    const composition = createOneShotResumeComposition({
      store: createEconomicsResumeStorePort({ store, newFenceToken: () => `eval-${bound}` }),
      budget: { readRestartBudget: () => bound },
      capability: { modes: ["prompt-reentry"] },
      now: () => "2026-11-07T00:00:00Z",
      runId: "run-budget-config",
    });
    for (let index = 0; index < 3; index += 1) {
      expect(composition.attempt(input()).outcome).toBe("admit-restart");
    }
    expect(composition.attempt(input()).outcome).toBe("refuse");
    bound = 5;
    const decision = composition.attempt(input());
    expect(decision.outcome).toBe("admit-restart");
    if (decision.outcome === "admit-restart") expect(decision.record.ordinal).toBe(4);
    const read = readEconomicsRecords(store, "GH-235");
    if (read.ok) expect(read.restarts).toHaveLength(4);
  });

  test("the hardcoding-3 mutant fails the budget-5 case", () => {
    const created = runWithBound(5, "budget-5-mutant");
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("admit-restart");
    const mutantGate = (count: number): string => (count >= 3 ? "refuse" : "admit");
    for (let index = 0; index < 3; index += 1) created.supervised.attempt(input());
    const realFourth = created.supervised.attempt(input());
    expect(realFourth.outcome).toBe("admit-restart");
    expect(mutantGate(3)).toBe("refuse");
    expect(mutantGate(3)).not.toBe(realFourth.outcome);
  });
});

const makeRoot = (label: string): string => {
  const root = mkdtempSync(join(tmpdir(), `gh235-${label}-`));
  extraRoots.push(root);
  return root;
};
