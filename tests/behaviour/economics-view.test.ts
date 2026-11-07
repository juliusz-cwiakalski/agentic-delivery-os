/**
 * TC-ECON-060 — per-delivery economics derives from durable records alone. Four
 * fixtures (zero, one, three, three plus terminal) derive from fresh store
 * handles; the view carries the declared field names, two fresh handles derive
 * byte-identically, and derivation is read-only with no harness query.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createStateStore, readEconomicsRecords } from "../../packages/core/src/state/index";
import { createTestEdge, makeIdentity } from "../fixtures/state/harness";
import { deriveEconomicsView } from "../../packages/core/src/domain/index";
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

const runtime = (label: string): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: 3, label });
  runtimes.push(created);
  return created;
};

const deriveFromFreshHandle = (root: string) => {
  const store = createStateStore(makeIdentity(root), { driver: "jsonl", edge: createTestEdge() });
  const read = readEconomicsRecords(store, "GH-235");
  if (!read.ok) throw new Error(`read failed: ${read.code}`);
  const view = deriveEconomicsView({
    records: read.restarts,
    ...(read.terminal === undefined ? {} : { terminal: read.terminal }),
  });
  return { view, serialized: JSON.stringify(view), records: read.restarts };
};

describe("TC-ECON-060 per-delivery economics derives from durable records alone", () => {
  test("zero restarts derive an empty view with no ratio and no flag", () => {
    const created = runtime("view-zero");
    const { view } = deriveFromFreshHandle(created.root);
    expect(view.restarts).toBe(0);
    expect(view.restartHistory).toEqual([]);
    expect(view.resumeAmplification).toBeNull();
    expect(view.amplificationFlag).toBeNull();
    expect(view.warnings).toEqual([]);
  });

  test("one and three restarts derive the count and the ordered history", () => {
    const one = runtime("view-one");
    seedRestarts(one.store, 1);
    const oneView = deriveFromFreshHandle(one.root).view;
    expect(oneView.restarts).toBe(1);
    expect(oneView.restartHistory[0]).toMatchObject({
      ordinal: 1,
      reason: "session-interrupted",
      sessionId: "ses_fixture_1",
    });

    const three = runtime("view-three");
    seedRestarts(three.store, 3);
    const threeView = deriveFromFreshHandle(three.root).view;
    expect(threeView.restarts).toBe(3);
    expect(threeView.restartHistory.map((entry) => entry.ordinal)).toEqual([1, 2, 3]);
    expect(threeView.restartHistory.map((entry) => entry.sessionId)).toEqual([
      "ses_fixture_1",
      "ses_fixture_2",
      "ses_fixture_3",
    ]);
    expect(threeView.resumeAmplification).toBe(0.75);
  });

  test("the terminal record is reflected without a second read path", () => {
    const created = runtime("view-terminal");
    seedRestarts(created.store, 3);
    created.supervised.attempt({
      workItemRef: "GH-235",
      runId: "run-view",
      reason: "session-interrupted",
      evidence: runtimeEvidence(),
    });
    const { view } = deriveFromFreshHandle(created.root);
    expect(view.restarts).toBe(3);
    expect(view.terminal).toBeDefined();
    expect(view.terminal?.terminal).toBe(true);
    expect(view.terminal?.reason).toBe("dispatch.restart-budget-exceeded");
  });

  test("the view field names are the declared dispatch-envelope names", () => {
    const created = runtime("view-fields");
    seedRestarts(created.store, 1);
    const { view } = deriveFromFreshHandle(created.root);
    expect(Object.keys(view).sort()).toEqual(
      ["amplificationFlag", "restartHistory", "restarts", "resumeAmplification", "warnings"].sort(),
    );
    for (const field of ["restarts", "resumeAmplification"] as const) {
      expect(field in view).toBe(true);
    }
  });

  test("two fresh handles derive byte-identically and no harness query occurs", () => {
    const created = runtime("view-replay");
    seedRestarts(created.store, 3);
    const first = deriveFromFreshHandle(created.root);
    const second = deriveFromFreshHandle(created.root);
    expect(first.serialized).toBe(second.serialized);
    expect(created.execution.counters.harnessQueries).toBe(0);
  });

  test("derivation is read-only: no append, no mutation, no lane write", () => {
    const created = runtime("view-readonly");
    seedRestarts(created.store, 2);
    const before = created.store.readRecords();
    deriveFromFreshHandle(created.root);
    deriveFromFreshHandle(created.root);
    const after = created.store.readRecords();
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.value.records.length).toBe(before.value.records.length);
    expect(created.execution.counters.stateAppends).toBe(0);
  });
});
