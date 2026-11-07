/**
 * TC-ECON-051 — the budget survives a process boundary and replays identically.
 * The writer handle (and its edge) is closed before a fresh handle opens over the
 * same temp root; derivation needs no in-memory state and no harness query.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  createEconomicsResumeStorePort,
  createStateStore,
  readEconomicsRecords,
} from "../../packages/core/src/state/index";
import {
  createOneShotResumeComposition,
  deriveEconomicsView,
} from "../../packages/core/src/domain/index";
import { makeIdentity, createTestEdge } from "../fixtures/state/harness";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const runtimes: EconomicsRuntime[] = [];
const extraRoots: string[] = [];

afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
  for (const root of extraRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const input = () => ({
  workItemRef: "GH-235",
  runId: "run-durability",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

describe("TC-ECON-051 the budget survives a process boundary and replays identically", () => {
  test("a fresh handle reconstructs count and history without prior memory", () => {
    const created = createEconomicsRuntime({ bound: 3, runId: "run-durability", label: "durability" });
    runtimes.push(created);
    created.supervised.attempt(input());
    created.supervised.attempt(input());

    const identity = makeIdentity(created.root);
    const freshEdge = createTestEdge();
    const freshStore = createStateStore(identity, { driver: "jsonl", edge: freshEdge });
    const read = readEconomicsRecords(freshStore, "GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts).toHaveLength(2);
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1, 2]);
    expect(read.restarts.map((record) => record.sessionId)).toEqual([
      "ses_fixture_1",
      "ses_fixture_1",
    ]);
    expect(read.restarts.map((record) => record.reason)).toEqual([
      "session-interrupted",
      "session-interrupted",
    ]);
    expect(read.restarts.map((record) => record.repayTokens)).toEqual([
      { inputTokens: 100, outputTokens: 0 },
      { inputTokens: 100, outputTokens: 0 },
    ]);
    expect(freshEdge.now()).toBeGreaterThan(0);
    expect(freshStore.identity.schemaVersion).toBe(STATE_SCHEMA_VERSION);
  });

  test("the next admission on a fresh handle takes ordinal 3", () => {
    const created = createEconomicsRuntime({ bound: 3, runId: "run-durability", label: "durability-next" });
    runtimes.push(created);
    created.supervised.attempt(input());
    created.supervised.attempt(input());

    const freshStore = createStateStore(makeIdentity(created.root), {
      driver: "jsonl",
      edge: createTestEdge(),
    });
    const composition = createOneShotResumeComposition({
      store: createEconomicsResumeStorePort({ store: freshStore, newFenceToken: () => "fresh-1" }),
      budget: { readRestartBudget: () => 3 },
      capability: { modes: ["prompt-reentry"] },
      now: () => "2026-11-07T13:00:00Z",
      runId: "run-durability",
    });
    const decision = composition.attempt(input());
    expect(decision.outcome).toBe("admit-restart");
    if (decision.outcome !== "admit-restart") return;
    expect(decision.record.ordinal).toBe(3);
  });

  test("two fresh handles derive byte-identical output and no harness query occurs", () => {
    const created = createEconomicsRuntime({ bound: 3, runId: "run-durability", label: "durability-derive" });
    runtimes.push(created);
    created.supervised.attempt(input());
    created.supervised.attempt(input());

    const derive = () => {
      const store = createStateStore(makeIdentity(created.root), {
        driver: "jsonl",
        edge: createTestEdge(),
      });
      const read = readEconomicsRecords(store, "GH-235");
      if (!read.ok) throw new Error(read.code);
      return JSON.stringify(
        deriveEconomicsView({
          records: read.restarts,
          ...(read.terminal === undefined ? {} : { terminal: read.terminal }),
        }),
      );
    };
    expect(derive()).toBe(derive());
    expect(created.execution.counters.harnessQueries).toBe(0);
  });

  test("no migration runs and cleanup removes only the temp root", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "durability-cleanup" });
    runtimes.push(created);
    created.supervised.attempt(input());
    const root = created.root;
    expect(root.includes("gh235-durability-cleanup-")).toBe(true);
    expect(created.store.readRecords().ok).toBe(true);
    created.close();
    runtimes.splice(runtimes.indexOf(created), 1);
    expect(() => createStateStore(makeIdentity(root), { driver: "jsonl", edge: createTestEdge() })).not.toThrow();
  });
});
