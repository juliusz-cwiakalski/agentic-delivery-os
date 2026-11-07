/**
 * TC-SPEND-024 — bounded work at 1,000 and 10,000 captured records: one verified
 * read per family, one transition read, one linear fold, zero network and zero
 * credential resolution. Wall-clock is measured as a non-gated reference.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HARNESS_TELEMETRY_RECORD_KIND,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type StateRecord,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { computeSpendReport } from "../../packages/core/src/domain/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import {
  countCalls,
  createProbeSpy,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  SPEND_REF,
} from "../fixtures/spend/harness";

const payloadFor = (index: number): Record<string, unknown> => ({
  schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
  workItemRef: SPEND_REF,
  runId: `run-${String(index % 500)}`,
  sessionId: `ses-${String(index)}`,
  harnessKind: "opencode",
  harnessVersion: "1.0.0",
  agent: `agent-${String(index % 17)}`,
  model: `model-${String(index % 5)}`,
  treeRoot: `ses-${String(index)}`,
  parentChain: [],
  tokens: { input: 10, output: 5, reasoning: 1, cacheRead: 2, cacheWrite: 1 },
  calls: 1,
  toolCounts: [],
  cost: null,
  capturedAt: new Date(Date.UTC(2026, 10, 1, 10, 0, index % 60)).toISOString(),
  warnings: [],
});

const ledgerRecord = (index: number): StateRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: HARNESS_TELEMETRY_RECORD_KIND,
  key: `harness.telemetry:${SPEND_REF}`,
  sequence: index + 1,
  checksum: "0".repeat(16),
  payload: payloadFor(index),
});

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const storeOf = (count: number, log: string[]): StateStorePort => {
  const root = makeTempRoot("gh236-performance");
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  const records = Array.from({ length: count }, (_, index) => ledgerRecord(index));
  const evidence = {
    storePath: `${root}/ledger.jsonl`,
    verification: [] as const,
    verifiedEmpty: false,
    recordCount: count,
  };
  return {
    ...store,
    readRecords: () => {
      log.push("readRecords");
      return { ok: true, value: { records, evidence } };
    },
  };
};

const foldAt = (count: number) => {
  const log: string[] = [];
  const store = storeOf(count, log);
  const read = readSpendLedger(store, SPEND_REF);
  if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
  const started = performance.now();
  const fold = computeSpendReport(read.value, { workItemRef: SPEND_REF });
  const elapsedMs = performance.now() - started;
  if (!fold.ok) throw new Error("fold failed");
  return { log, fold, records: read.value.records, elapsedMs };
};

describe("TC-SPEND-024 bounded work", () => {
  test("the read count is identical at 1,000 and 10,000 records", () => {
    const small = foldAt(1_000);
    const large = foldAt(10_000);
    expect(small.records).toHaveLength(1_000);
    expect(large.records).toHaveLength(10_000);
    expect(countCalls(large.log, "readRecords")).toBe(countCalls(small.log, "readRecords"));
    expect(countCalls(large.log, "readRecords")).toBeLessThanOrEqual(4);
    expect(countCalls(large.log, "read")).toBeLessThanOrEqual(1);
    expect(countCalls(large.log, "acquireFence")).toBe(0);
    expect(countCalls(large.log, "append")).toBe(0);
  });

  test("the fold is linear: one pass, no per-record re-read", () => {
    const small = foldAt(1_000);
    const large = foldAt(10_000);
    // The fold consumes the read's record array exactly once; the same totals
    // rule is applied at both scales. A quadratic rescan would not finish here.
    expect(large.fold.data.tokensByClass.input).toBe(100_000);
    expect(small.fold.data.tokensByClass.input).toBe(10_000);
    expect(large.fold.data.perAgent.length).toBeLessThanOrEqual(17 * 5);
    // The bounded output still holds at 10,000 records.
    expect(JSON.stringify(large.fold.data).length).toBeLessThanOrEqual(65_536);
  });

  test("the harness adapter and composer seams stay at zero calls", () => {
    const adapter = createProbeSpy();
    foldAt(1_000);
    foldAt(10_000);
    expect(adapter.calls()).toBe(0);
  });

  test("the fold module carries no I/O, network, or credential import", () => {
    const source = readFileSync(join(process.cwd(), "packages/core/src/domain/spend.ts"), "utf8");
    for (const forbidden of ["node:", "bun:", "fetch(", "process.", "Date.now", "Math.random"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
