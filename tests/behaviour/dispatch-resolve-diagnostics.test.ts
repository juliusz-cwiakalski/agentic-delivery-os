/**
 * GH-279 resolve diagnostics (TC-RESOLVE-002..008): a local store fault keeps
 * its own `kind: "state"` identity, an absent id is a distinguishable not-found
 * mapped to `input.value.rejected`, and the note is clamped before the record is
 * built. Resolution stays local and idempotent.
 */
import { describe, expect, test } from "bun:test";
import { classifyThrown } from "../../packages/cli/src/classify";
import { resolveDispatchDivergenceEvidence } from "../../packages/core/src/app/dispatch-gate";
import {
  appendDispatchDivergence,
  DISPATCH_DIVERGENCE_NOT_FOUND,
  readDispatchDivergences,
  resolveDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import { DISPATCH_DIVERGENCE_RECORD_KIND } from "../../packages/core/src/contracts/index";
import type {
  DispatchDivergenceRecord,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";

type LedgerRecord = {
  readonly schemaVersion: string;
  readonly kind: string;
  readonly key: string;
  readonly sequence: number;
  readonly checksum: string;
  readonly payload: unknown;
};

const ledgerRecord = (record: DispatchDivergenceRecord): LedgerRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: DISPATCH_DIVERGENCE_RECORD_KIND,
  key: `dispatch.divergence.${record.divergenceId}`,
  sequence: 1,
  checksum: "0".repeat(16),
  payload: record,
});

const evidence = (recordCount: number) => ({
  storePath: "/tmp/state",
  verification: ["framing", "terminal", "sequence", "checksum", "index", "permissions"],
  verifiedEmpty: recordCount === 0,
  recordCount,
});

const storeWith = (input: {
  readonly records?: readonly LedgerRecord[];
  readonly readCode?: string;
  readonly appendCode?: string;
}): StateStorePort =>
  ({
    readRecords: () =>
      input.readCode === undefined
        ? {
            ok: true as const,
            value: { records: input.records ?? [], evidence: evidence(input.records?.length ?? 0) },
          }
        : { ok: false as const, error: { code: input.readCode, location: { path: "/tmp/state" } } },
    acquireFence: () => ({
      ok: true as const,
      value: { handle: "fence-handle" },
    }),
    append: () =>
      input.appendCode === undefined
        ? { ok: false as const, error: { code: "state.write.failed", location: { path: "/tmp/state" } } }
        : { ok: false as const, error: { code: input.appendCode, location: { path: "/tmp/state" } } },
    releaseFence: () => ({ ok: true as const, value: undefined }),
  }) as unknown as StateStorePort;

const resolve = (store: StateStorePort, note = "resolved") =>
  resolveDispatchDivergenceEvidence({
    store,
    fenceToken: "fence",
    divergenceId: "DIV-1",
    note,
    principal: "coder@local",
    nowIso: "2026-11-08T10:00:00.000Z",
  });

describe("TC-RESOLVE-002 state.lock.busy surfaces under kind state", () => {
  test("the row's own category, retryability, consequence, remediation, and exit", () => {
    const result = resolve(storeWith({ readCode: "state.lock.busy" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "state", code: "state.lock.busy" });
    const classified = classifyThrown(result.error);
    expect(classified.code).toBe("state.lock.busy");
    expect(classified.category).toBe("transient");
    expect(classified.retryable).toBe(true);
    expect(classified.projectionClass).toBe("platform-provider");
    expect(classified.remediationHint.toLowerCase()).toContain("fence");
  });
});

describe("TC-RESOLVE-003 state.store.torn and state.write.failed keep their identities", () => {
  test("a torn read and a failed append each surface themselves", () => {
    const torn = resolve(storeWith({ readCode: "state.store.torn" }));
    expect(torn.ok).toBe(false);
    if (!torn.ok) expect(torn.error).toEqual({ kind: "state", code: "state.store.torn" });

    const record = makeDivergence({ divergenceId: "DIV-1" });
    const writeFailed = resolve(
      storeWith({ records: [ledgerRecord(record)], appendCode: "state.write.failed" }),
    );
    expect(writeFailed.ok).toBe(false);
    if (!writeFailed.ok) {
      expect(writeFailed.error).toEqual({ kind: "state", code: "state.write.failed" });
      expect(classifyThrown(writeFailed.error).projectionClass).toBe("platform-provider");
    }
  });
});

describe("TC-RESOLVE-004 a 300-character note clamps to 240 and lands", () => {
  test("the stored note is bounded and no write failure is produced", () => {
    const state = createDispatchState("gh279-resolve-clamp");
    try {
      appendDispatchDivergence(state.store, state.fenceToken, makeDivergence({ divergenceId: "DIV-1" }));
      const longNote = "x".repeat(300);
      const result = resolveDispatchDivergenceEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        divergenceId: "DIV-1",
        note: longNote,
        principal: "coder@local",
        nowIso: "2026-11-08T10:00:00.000Z",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(String(result.data.note).length).toBeLessThanOrEqual(240);
      const read = readDispatchDivergences(state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const latest = read.records.at(-1);
      expect(latest?.state).toBe("resolved");
      expect((latest?.note ?? "").length).toBeLessThanOrEqual(240);
    } finally {
      state.dispose();
    }
  });
});

describe("TC-RESOLVE-005 an absent divergence id is a distinguishable not-found", () => {
  test("the app sentinel maps to input.value.rejected and appends nothing", () => {
    const state = createDispatchState("gh279-resolve-absent");
    try {
      const result = resolveDispatchDivergenceEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        divergenceId: "DIV-ABSENT",
        note: "note",
        principal: "coder@local",
        nowIso: "2026-11-08T10:00:00.000Z",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toEqual({ kind: "input", code: "input.value.rejected" });
      const ledger = resolveDispatchDivergence(state.store, state.fenceToken, {
        divergenceId: "DIV-ABSENT",
        note: "note",
        principal: "coder@local",
        recordedAt: "2026-11-08T10:00:00.000Z",
      });
      expect(ledger.ok).toBe(false);
      if (!ledger.ok) expect(ledger.code).toBe(DISPATCH_DIVERGENCE_NOT_FOUND);
      const read = readDispatchDivergences(state.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.records).toEqual([]);
    } finally {
      state.dispose();
    }
  });
});

describe("TC-RESOLVE-006 not-found is not state.keys.missing", () => {
  test("a genuine key-set failure keeps its own identity", () => {
    const absent = resolve(storeWith({ records: [] }));
    const genuine = resolve(storeWith({ readCode: "state.keys.missing" }));
    expect(absent.ok).toBe(false);
    expect(genuine.ok).toBe(false);
    if (!absent.ok && !genuine.ok) {
      expect(absent.error).toEqual({ kind: "input", code: "input.value.rejected" });
      expect(genuine.error).toEqual({ kind: "state", code: "state.keys.missing" });
      expect(absent.error.code).not.toBe("state.keys.missing");
    }
  });
});

describe("TC-RESOLVE-007 a state code under the dispatch kind falls to fallback.internal", () => {
  test("the matched pair keeps its identity; the mismatched pair does not", () => {
    expect(classifyThrown({ kind: "dispatch", code: "state.lock.busy" }).code).toBe(
      "fallback.internal",
    );
    expect(classifyThrown({ kind: "state", code: "state.lock.busy" }).code).toBe("state.lock.busy");
  });
});

describe("TC-RESOLVE-008 resolution replay is a noop and the open record is byte-identical", () => {
  test("the second resolve reports the existing record and rewrites nothing", () => {
    const state = createDispatchState("gh279-resolve-replay");
    try {
      appendDispatchDivergence(state.store, state.fenceToken, makeDivergence({ divergenceId: "DIV-1" }));
      const before = readDispatchDivergences(state.store);
      expect(before.ok).toBe(true);
      if (!before.ok) return;
      const original = JSON.stringify(before.records[0]);
      const first = resolveDispatchDivergenceEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        divergenceId: "DIV-1",
        note: "first",
        principal: "coder@local",
        nowIso: "2026-11-08T10:00:00.000Z",
      });
      expect(first.ok).toBe(true);
      const second = resolveDispatchDivergenceEvidence({
        store: state.store,
        fenceToken: state.fenceToken,
        divergenceId: "DIV-1",
        note: "second",
        principal: "coder@local",
        nowIso: "2026-11-09T10:00:00.000Z",
      });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.resolved).toBe(false);
      const after = readDispatchDivergences(state.store);
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(JSON.stringify(after.records[0])).toBe(original);
      expect(after.records.filter((record) => record.state === "resolved")).toHaveLength(1);
    } finally {
      state.dispose();
    }
  });

  test("the repository fixture is the delivered identity", () => {
    expect(REPOSITORY).toBe("github.com/owner/repo");
  });
});
