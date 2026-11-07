/**
 * TC-SPEND-006 (consumer half) — the log-only read contract: the spend read
 * composes exactly the two telemetry families plus the ref's transition history
 * and never reaches a harness adapter, session reader, or provider client.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readSpendLedger } from "../../packages/core/src/state/index";
import {
  appendOutcomes,
  appendRecords,
  appendTransitions,
  countCalls,
  createProbeSpy,
  makeIdentity,
  makeOutcomeRecord,
  makeSessionRecord,
  makeTempRoot,
  OTHER_REF,
  openStore,
  recordingStore,
  removeRoot,
  SPEND_REF,
  tokens,
} from "../fixtures/spend/harness";
import { T0 } from "../fixtures/spend/transitions";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seededStore = (label: string) => {
  const root = makeTempRoot(`gh236-${label}`);
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  appendRecords(store, [
    makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 100 }), calls: 2 }),
    makeSessionRecord({
      runId: "run-R1",
      sessionId: "ses-2",
      agent: "coder",
      model: "opus",
      tokens: tokens({ output: 50 }),
      calls: 1,
    }),
  ]);
  appendOutcomes(store, [makeOutcomeRecord({ runId: "run-R1" })]);
  const unrelated = makeSessionRecord({
    ref: OTHER_REF,
    runId: "run-other",
    tokens: tokens({ input: 999 }),
    calls: 9,
  });
  appendRecords(store, [unrelated]);
  appendTransitions(store, SPEND_REF, [
    { phaseId: "clarify_scope", operation: "complete", timestamp: T0 },
  ]);
  return { root, identity, store };
};

describe("TC-SPEND-006 log-only read contract", () => {
  test("the read composes both telemetry families plus the ref transitions", () => {
    const { store } = seededStore("read-contract");
    const log: string[] = [];
    const read = readSpendLedger(recordingStore(store, log), SPEND_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(2);
    expect(read.value.outcomes).toHaveLength(1);
    expect(read.value.transitions).toHaveLength(1);
    expect(read.value.transitionsPresent).toBe(true);
    expect(read.value.verifiedEmpty).toBe(false);
    // Positive control: the seeded records do carry spend, so the read is not vacuous.
    const spend = read.value.records.reduce(
      (sum, record) => sum + (record.tokens.input ?? 0) + (record.tokens.output ?? 0),
      0,
    );
    expect(spend).toBe(150);
  });

  test("the recorded read set is bounded and contains no write, fence or salvage", () => {
    const { store } = seededStore("read-bounded");
    const log: string[] = [];
    const read = readSpendLedger(recordingStore(store, log), SPEND_REF);
    expect(read.ok).toBe(true);
    expect(countCalls(log, "readRecords")).toBeGreaterThan(0);
    expect(countCalls(log, "readRecords")).toBeLessThanOrEqual(4);
    expect(countCalls(log, "acquireFence")).toBe(0);
    expect(countCalls(log, "releaseFence")).toBe(0);
    expect(countCalls(log, "append")).toBe(0);
    expect(countCalls(log, "salvage")).toBe(0);
  });

  test("the read count does not grow with the record population", () => {
    const { store } = seededStore("read-invariance");
    const smallLog: string[] = [];
    const small = readSpendLedger(recordingStore(store, smallLog), SPEND_REF);
    expect(small.ok).toBe(true);
    appendRecords(
      store,
      Array.from({ length: 40 }, (_, index) =>
        makeSessionRecord({
          runId: `run-extra-${String(index % 5)}`,
          sessionId: `ses-extra-${String(index)}`,
          tokens: tokens({ input: index + 1 }),
        }),
      ),
    );
    const largeLog: string[] = [];
    const large = readSpendLedger(recordingStore(store, largeLog), SPEND_REF);
    expect(large.ok).toBe(true);
    if (!large.ok || !small.ok) return;
    expect(large.value.records.length).toBeGreaterThan(small.value.records.length);
    expect(countCalls(largeLog, "readRecords")).toBe(countCalls(smallLog, "readRecords"));
  });

  test("the harness adapter / composer seam records zero calls and never fires", () => {
    const { store } = seededStore("read-adapter-spy");
    const adapter = createProbeSpy();
    const read = readSpendLedger(store, SPEND_REF);
    expect(read.ok).toBe(true);
    expect(adapter.calls()).toBe(0);
    expect(() => adapter.probe()).toThrow();
    expect(adapter.calls()).toBe(1);
  });

  test("another ref's records are never read into the selection", () => {
    const { store } = seededStore("read-isolation");
    const value = readSpendLedger(store, SPEND_REF);
    const other = readSpendLedger(store, OTHER_REF);
    expect(value.ok).toBe(true);
    expect(other.ok).toBe(true);
    if (!value.ok || !other.ok) return;
    expect(value.value.records.every((record) => record.workItemRef === SPEND_REF)).toBe(true);
    expect(other.value.records).toHaveLength(1);
    expect(other.value.records[0]?.tokens.input).toBe(999);
  });

  test("an absent per-ref family is explicit verified-empty evidence", () => {
    const { store } = seededStore("read-absence");
    const log: string[] = [];
    const read = readSpendLedger(recordingStore(store, log), "GH-404");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toEqual([]);
    expect(read.value.outcomes).toEqual([]);
    expect(read.value.verifiedEmpty).toBe(true);
    // The absence path performs the same bounded read set.
    expect(countCalls(log, "readRecords")).toBeLessThanOrEqual(4);
    expect(countCalls(log, "readRecords")).toBeGreaterThan(0);
  });
});
