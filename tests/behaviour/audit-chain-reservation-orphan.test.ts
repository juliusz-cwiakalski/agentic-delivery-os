/**
 * TC-GH223-049 — an ORPHANED reservation (its invocation absent) edited with a
 * recomputed checksum is still a chain break: its own `chainValue` is the
 * keyed evidence.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_RESERVATION_RECORD_KIND,
  type AuditReadOutcome,
} from "../../packages/core/src/contracts/index";
import {
  readAuditChainKey,
  readAuditLedger,
  verifyAuditChain,
} from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  armAppendFailure,
  makeAuditStore,
  mutateAuditRecord,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";

const orphanOutcome = (store: Parameters<typeof readAuditLedger>[0]): AuditReadOutcome => {
  const read = readAuditLedger(store, { limit: 10 });
  if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
  return read.value;
};

describe("TC-GH223-049 altered orphan reservation", () => {
  test("the orphan reservation carries chainValue and its mutation breaks the chain", () => {
    const fixture = makeAuditStore("orphan-tamper");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 2);
      try {
        const degraded = appendAuditFacts(fixture.store, {
          runId: "run-orphan-2",
          startedAt: 2000,
        });
        expect(degraded.ok).toBe(false);
      } finally {
        armed.restore();
      }

      const reservations = reservationPayloadsOf(fixture.store);
      expect(reservations).toHaveLength(2);
      const orphan = reservations.find((payload) => payload.auditSeq === 2);
      expect(orphan).toBeDefined();
      expect(typeof orphan?.chainValue).toBe("string");
      expect(String(orphan?.chainValue ?? "").length).toBeGreaterThan(0);
      expect(Object.hasOwn(orphan ?? {}, "auditSeq")).toBe(true);
      expect(Object.hasOwn(orphan ?? {}, "runId")).toBe(true);

      const clean = verifyAuditChain(fixture.store);
      expect(clean.ok && clean.value.verified).toBe(true);
      expect(orphanOutcome(fixture.store).chain.orphans.map((entry) => entry.auditSeq)).toEqual([
        2,
      ]);

      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.runId = "run-orphan-forged";
        },
      );

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.value.verified).toBe(false);
      expect(verdict.value.breaks.some((entry) => entry.auditSeq === 2)).toBe(true);
      // The finding names the gap identity; it never carries payload or
      // checksum bytes.
      expect(JSON.stringify(verdict.value)).not.toContain("chainValue");
      expect(JSON.stringify(verdict.value)).not.toContain("schemaId");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the clean control keeps the original orphan finding and a readable key", () => {
    const fixture = makeAuditStore("orphan-clean");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 2);
      try {
        appendAuditFacts(fixture.store, { runId: "run-orphan-clean", startedAt: 2000 });
      } finally {
        armed.restore();
      }
      const key = readAuditChainKey(fixture.store);
      expect(key.ok).toBe(true);
      if (!key.ok) return;
      expect(key.value).toMatch(/^[0-9a-f]{64}$/);
      const read = orphanOutcome(fixture.store);
      expect(read.chain.orphans).toHaveLength(1);
      expect(read.chain.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
