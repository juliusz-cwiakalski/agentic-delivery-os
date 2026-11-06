/**
 * TC-GH223-048 — a reservation that is the last valid frame survives salvage as
 * the DEC-8 skipped-ordinal finding; the next pair chains from it.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync } from "node:fs";
import { readAuditLedger, verifyAuditChain } from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  armAppendFailure,
  ledgerPath,
  makeAuditStore,
  removeRoot,
  reservationPayloadsOf,
  salvageTail,
  seedAuditPairs,
} from "../fixtures/state/harness";

describe("TC-GH223-048 surviving-tail reservation", () => {
  test("salvage keeps the last-valid-frame reservation and reports it in-band", () => {
    const fixture = makeAuditStore("salvage-reservation");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 2);
      try {
        appendAuditFacts(fixture.store, { runId: "run-reservation-only", startedAt: 2000 });
      } finally {
        armed.restore();
      }
      // A torn invocation tail beyond the surviving reservation.
      appendFileSync(ledgerPath(fixture.identity), '{"broken":');

      const before = readAuditLedger(fixture.store, { limit: 10 });
      expect(before.ok).toBe(false);
      if (!before.ok) expect(before.error.code).toBe("state.store.torn");

      const salvaged = salvageTail(fixture.store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;
      expect(salvaged.value.report.quarantinedBytes).toBeGreaterThan(0);

      const reservations = reservationPayloadsOf(fixture.store);
      expect(reservations.map((reservation) => reservation.auditSeq)).toEqual([1, 2]);

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.chain.orphans).toHaveLength(1);
      expect(read.value.chain.orphans[0]).toMatchObject({
        auditSeq: 2,
        runId: "run-reservation-only",
      });
      expect(read.value.chain.verified).toBe(true);

      const appended = appendAuditFacts(fixture.store, {
        runId: "run-after-surviving-reservation",
        startedAt: 9000,
      });
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
      expect(appended.value.auditSeq).toBe(3);

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.value.verified).toBe(true);
        expect(verdict.value.breaks).toEqual([]);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
