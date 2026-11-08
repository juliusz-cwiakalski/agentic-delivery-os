/**
 * GH-273 — domain invariant preservation.
 *
 * The queue application layer already refuses a one-sided add request and
 * already fails the read closed on a one-sided stored record; this change adds
 * the first explicit negative coverage for both, without touching the domain
 * (spec F-5, DEC-6; test plan TC-BIND-011/TC-BIND-012). These tests pass
 * pre-fix by design; their adequacy is proven by the predicate mutations in
 * TC-BIND-018 P4, not by a producer revert.
 */
import { describe, expect, test } from "bun:test";
import {
  declareQueueEntry,
  queueEntryRecordKey,
  readQueueEntries,
} from "../../packages/core/src/app/queue";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import {
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_ENTRY_SCHEMA,
} from "../../packages/core/src/contracts/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { makeAuditStore } from "../fixtures/state/harness";

const NOW_ISO = "2026-11-08T10:00:00.000Z";
const KEY = "github.com/owner/repo";
const ROOT = "/work/checkout";
const INVARIANT = "repository key and recorded root must be present together";

const recordCount = (store: StateStorePort): number => {
  const read = readQueueEntries(store);
  if (!read.ok) throw new Error(`queue read failed: ${read.code}`);
  return read.records.length;
};

describe("TC-BIND-011 the domain refuses one-sided add requests", () => {
  test("TC-BIND-011 key-only and root-only adds are refused with the invariant summary", () => {
    const fixture = makeAuditStore("gh273-invariant-write");
    const keyOnly = declareQueueEntry(fixture.store, {
      ref: "GH-273",
      repository: KEY,
      recordedAt: NOW_ISO,
      fenceToken: "key-only-fence",
    });
    expect(keyOnly.ok, "a key-only request is refused").toBe(false);
    if (!keyOnly.ok) {
      expect(keyOnly.kind, "key-only: failure kind").toBe("input");
      expect(keyOnly.code, "key-only: refusal code").toBe("input.value.rejected");
      expect("detail" in keyOnly ? keyOnly.detail : undefined, "key-only: summary").toBe(INVARIANT);
    }
    expect(recordCount(fixture.store), "key-only appends nothing").toBe(0);

    const rootOnly = declareQueueEntry(fixture.store, {
      ref: "GH-274",
      repositoryRoot: ROOT,
      recordedAt: NOW_ISO,
      fenceToken: "root-only-fence",
    });
    expect(rootOnly.ok, "a root-only request is refused").toBe(false);
    if (!rootOnly.ok) {
      expect(rootOnly.kind, "root-only: failure kind").toBe("input");
      expect(rootOnly.code, "root-only: refusal code").toBe("input.value.rejected");
      expect("detail" in rootOnly ? rootOnly.detail : undefined, "root-only: summary").toBe(
        INVARIANT,
      );
    }
    expect(recordCount(fixture.store), "root-only appends nothing").toBe(0);

    const control = declareQueueEntry(fixture.store, {
      ref: "GH-275",
      repository: KEY,
      repositoryRoot: ROOT,
      recordedAt: NOW_ISO,
      fenceToken: "pair-fence",
    });
    expect(control.ok, "a complete pair is accepted").toBe(true);
    const read = readQueueEntries(fixture.store);
    expect(read.ok, "the control ledger is readable").toBe(true);
    if (!read.ok) return;
    expect(read.records, "the control appends one record").toHaveLength(1);
    expect(read.records[0]?.repository, "the control key").toBe(KEY);
    expect(read.records[0]?.repositoryRoot, "the control root").toBe(ROOT);
  });
});

/** A one-sided raw queue entry payload appended through the real store. */
const appendOneSided = (store: StateStorePort, shape: "key-only" | "root-only"): void => {
  const acquired = store.acquireFence(`gh273-torn-${shape}`);
  if (!acquired.ok) throw new Error(`fence failed: ${acquired.error.code}`);
  try {
    const appended = store.append(acquired.value.handle, {
      kind: QUEUE_ENTRY_RECORD_KIND,
      recordKey: queueEntryRecordKey("GH-273"),
      payload: {
        schema: QUEUE_ENTRY_SCHEMA,
        ref: "GH-273",
        ...(shape === "key-only" ? { repository: KEY } : { repositoryRoot: ROOT }),
        priority: 100,
        recordedAt: NOW_ISO,
      },
    });
    if (!appended.ok) throw new Error(`raw append failed: ${appended.error.code}`);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

describe("TC-BIND-012 a one-sided stored record fails closed as a torn store", () => {
  for (const shape of ["key-only", "root-only"] as const) {
    test(`TC-BIND-012 ${shape} record reads as state.store.torn and never becomes an entry`, async () => {
      const fixture = makeAuditStore(`gh273-torn-${shape}`);
      appendOneSided(fixture.store, shape);

      const before = fixture.store.readRecords();
      expect(before.ok, "the raw ledger is readable").toBe(true);
      const beforeCount = before.ok ? before.value.records.length : -1;

      const read = readQueueEntries(fixture.store);
      expect(read.ok, `${shape}: the queue read fails closed`).toBe(false);
      if (!read.ok) {
        expect(read.reason, `${shape}: read reason`).toBe("torn");
        expect(read.code, `${shape}: read identity`).toBe("state.store.torn");
      }

      const after = fixture.store.readRecords();
      expect(after.ok, "the raw ledger stays readable").toBe(true);
      if (after.ok) {
        expect(after.value.records.length, "the failed read changes no record").toBe(beforeCount);
        const raw = after.value.records.find((record) => record.kind === QUEUE_ENTRY_RECORD_KIND);
        expect(raw, "the raw record stays in the ledger").toBeDefined();
        const payload = raw?.payload as Record<string, unknown> | undefined;
        expect(payload?.ref, "the raw record is the one-sided payload").toBe("GH-273");
        expect(
          (payload?.repository === undefined) !== (payload?.repositoryRoot === undefined),
          "the raw record is still one-sided",
        ).toBe(true);
      }

      // The same shape through the queue edge projects exit 2 with no data.
      const harness = createQueueEdgeHarness(`gh273-torn-${shape}`, {
        overrides: { store: fixture.store },
      });
      const listed = await harness.run(["queue", "list", "--json"]);
      expect(listed.exitCode, `${shape}: queue list exits 2`).toBe(2);
      const envelope = JSON.parse(listed.stdout) as {
        data?: unknown;
        error?: { code?: string };
      };
      expect(envelope.error?.code, `${shape}: list identity`).toBe("state.store.torn");
      expect(envelope.data, `${shape}: no entry is fabricated`).toBeUndefined();
    });
  }
});
