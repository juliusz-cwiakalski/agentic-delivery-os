/**
 * GH-289 TC-ATTEMPT-009, TC-ATTEMPT-010, TC-ATTEMPT-037 — the read side's three
 * declared bounds: the machine `data` byte budget, the 5,000-record ledger
 * window with the ledger scope winning the single truncation object, and the
 * exactly-one verified store read with its latency at the ledger bound.
 *
 * The explicit-record store seam still runs every payload through the delivered
 * reader, so the fixture cannot satisfy itself with a hand-built line.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttemptHistory } from "../../packages/core/src/app/dispatch-attempts";
import {
  DISPATCH_MAX_MACHINE_BYTES,
  type DispatchAttemptRecord,
} from "../../packages/core/src/contracts/index";
import { selectAttemptsPage } from "../../packages/core/src/domain/dispatch-attempts";
import { ATTEMPTS_REF, ledgerOf, maximalEvidenceRefs } from "../fixtures/dispatch/attempt-records";
import {
  attemptLedgerRecord,
  createAttemptsHarness,
  storeWithRecords,
} from "../fixtures/dispatch/attempts-harness";
import { REPOSITORY, REPOSITORY_BETA } from "../fixtures/dispatch/ledger";

const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const recordsFor = (count: number, overrides: Partial<DispatchAttemptRecord> = {}) =>
  ledgerOf(count, overrides);

describe("TC-ATTEMPT-009 machine byte bound", () => {
  test("100 maximal records serialize to at most 65,536 bytes with a page declaration", () => {
    const records = recordsFor(100, { evidenceRefs: maximalEvidenceRefs() });
    const data = selectAttemptsPage({
      records,
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      refSource: "flag",
      limit: 100,
    });
    expect(utf8Bytes(JSON.stringify(data))).toBeLessThanOrEqual(DISPATCH_MAX_MACHINE_BYTES);
    expect(data.truncation).toEqual({
      scope: "page",
      bound: 65536,
      omittedRecords: 100 - data.attempts.length,
    });
    expect(data.truncation?.omittedRecords).toBeGreaterThan(0);
    expect(data.attempts.length).toBeGreaterThan(0);
    expect(data.hasMore).toBe(true);
  });

  test("a comfortably small page carries no truncation", () => {
    const data = selectAttemptsPage({
      records: recordsFor(3, { evidenceRefs: maximalEvidenceRefs() }),
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      refSource: "flag",
      limit: 20,
    });
    expect(data.truncation).toBeUndefined();
    expect(data.attempts).toHaveLength(3);
    expect(data.hasMore).toBe(false);
  });
});

const ledgerOfCount = (count: number): readonly DispatchAttemptRecord[] =>
  recordsFor(count, { evidenceRefs: ["evid:one"] });

describe("TC-ATTEMPT-010 ledger bound", () => {
  test("more than 5,000 records declare the ledger scope and keep the newest", () => {
    const records = ledgerOfCount(5001);
    const harness = createAttemptsHarness({
      label: "bounds-ledger",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          records.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      const result = harness.read({ ref: ATTEMPTS_REF });
      if (!result.ok) throw new Error(`read refused: ${result.error.code}`);
      expect(result.data.truncation).toEqual({
        scope: "ledger",
        bound: 5000,
        omittedRecords: 1,
      });
      expect(result.data.matched).toBeLessThanOrEqual(5000);
      expect(result.data.attempts[0]?.attemptId).toBe("A-05001");
      expect(result.data.attempts.map((row) => row.attemptId)).not.toContain("A-00001");
    } finally {
      harness.dispose();
    }
  });

  test("the ledger scope wins over the page byte budget", () => {
    const data = selectAttemptsPage({
      records: recordsFor(30, { evidenceRefs: maximalEvidenceRefs() }),
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      refSource: "flag",
      limit: 30,
      ledgerTruncation: { bound: 5000, omittedRecords: 7 },
      maxBytes: 600,
    });
    expect(data.truncation).toEqual({ scope: "ledger", bound: 5000, omittedRecords: 7 });
    expect(utf8Bytes(JSON.stringify(data))).toBeLessThanOrEqual(600);
    expect(data.hasMore).toBe(true);
  });

  test("a foreign record in the omitted tail is not counted", () => {
    const records = ledgerOfCount(5002);
    const foreignTail: DispatchAttemptRecord[] = [
      { ...(records[0] as DispatchAttemptRecord), repository: REPOSITORY_BETA },
      ...records.slice(1),
    ];
    const harness = createAttemptsHarness({
      label: "bounds-tail",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          foreignTail.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      const result = harness.read({ ref: ATTEMPTS_REF });
      if (!result.ok) throw new Error(`read refused: ${result.error.code}`);
      expect(result.data.excluded.foreignRepository).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("a foreign record inside the retained window is counted once", () => {
    const records = ledgerOfCount(5001);
    const withForeign: DispatchAttemptRecord[] = records.map((record, index) =>
      index === 4999 ? { ...record, repository: REPOSITORY_BETA } : record,
    );
    const harness = createAttemptsHarness({
      label: "bounds-foreign",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          withForeign.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      const result = harness.read({ ref: ATTEMPTS_REF });
      if (!result.ok) throw new Error(`read refused: ${result.error.code}`);
      expect(result.data.excluded.foreignRepository).toBe(1);
      expect(result.data.attempts.every((row) => row.repository === REPOSITORY)).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-037 one verified store read and latency at the bound", () => {
  test("exactly one readRecords per invocation and no additional read", () => {
    const records = ledgerOfCount(5000);
    const harness = createAttemptsHarness({
      label: "bounds-reads",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          records.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      // The fixed-view seam replaces `readRecords`, so count through deps instead:
      // one app call must issue exactly one reader call.
      let readerCalls = 0;
      const counted = {
        ...harness.store,
        readRecords: () => {
          readerCalls += 1;
          return harness.store.readRecords();
        },
      };
      const result = readDispatchAttemptHistory(
        {
          store: counted,
          resolveRepository: () => REPOSITORY,
          resolveActiveRef: () => null,
          contextPath: harness.contextPath,
        },
        { ref: ATTEMPTS_REF },
      );
      if (!result.ok) throw new Error(`read refused: ${result.error.code}`);
      expect(readerCalls).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("p95 stays within five seconds over the 5,000-record bound", () => {
    const records = ledgerOfCount(5000);
    const harness = createAttemptsHarness({
      label: "bounds-latency",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          records.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      const durations: number[] = [];
      for (let run = 0; run < 10; run += 1) {
        const started = performance.now();
        const result = harness.read({ ref: ATTEMPTS_REF });
        durations.push(performance.now() - started);
        if (!result.ok) throw new Error(`read refused: ${result.error.code}`);
      }
      durations.sort((left, right) => left - right);
      const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
      expect(p95).toBeLessThanOrEqual(5000);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-009/010/037 command-level re-run", () => {
  test("the machine page stays inside the byte budget through the command", async () => {
    const harness = createAttemptsHarness({
      label: "bounds-command-bytes",
      records: recordsFor(100, { evidenceRefs: maximalEvidenceRefs() }),
    });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "100",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      expect(utf8Bytes(JSON.stringify(result.data))).toBeLessThanOrEqual(
        DISPATCH_MAX_MACHINE_BYTES,
      );
      const data = result.data as { readonly truncation?: { readonly scope: string } };
      expect(data.truncation?.scope).toBe("page");
      expect(result.readCount).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("the ledger bound declares its scope through the command", async () => {
    const records = ledgerOfCount(5001);
    const harness = createAttemptsHarness({
      label: "bounds-command-ledger",
      records: [],
      wrap: (store) =>
        storeWithRecords(
          store,
          records.map((record, index) => attemptLedgerRecord(record, index + 1)),
        ),
    });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as {
        readonly truncation?: { readonly scope: string; readonly bound: number };
      };
      expect(data.truncation).toEqual({ scope: "ledger", bound: 5000, omittedRecords: 1 });
    } finally {
      harness.dispose();
    }
  });
});
