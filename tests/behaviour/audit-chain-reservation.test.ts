/**
 * TC-GH223-045 — an altered reservation record (recomputed unkeyed checksum)
 * is a chain break naming the reservation position, like an invocation edit.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { readAuditLedger, verifyAuditChain } from "../../packages/core/src/state/index";
import {
  makeAuditStore,
  mutateAuditRecord,
  readKeyArtifactValue,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";

describe("TC-GH223-045 altered reservation chain break", () => {
  test("a reservation payload edit breaks the chain at the reservation position", () => {
    const fixture = makeAuditStore("tamper-reservation");
    try {
      seedAuditPairs(fixture.store, 3);
      const clean = verifyAuditChain(fixture.store);
      expect(clean.ok && clean.value.verified).toBe(true);
      const reservations = reservationPayloadsOf(fixture.store);
      for (const reservation of reservations) {
        expect(Object.keys(reservation).sort()).toEqual([
          "auditSeq",
          "chainValue",
          "runId",
          "schemaId",
        ]);
        expect(typeof reservation.chainValue).toBe("string");
        expect((reservation.chainValue as string).length).toBeGreaterThan(0);
      }

      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.runId = "run-forged-reservation";
        },
      );

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.value.verified).toBe(false);
      expect(verdict.value.breaks.length).toBeGreaterThan(0);
      const atReservation = verdict.value.breaks.find((entry) => entry.auditSeq === 2);
      expect(atReservation).toBeDefined();
      expect(JSON.stringify(verdict.value)).not.toContain("run-forged-reservation");

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.records).toHaveLength(3);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an ordinal mismatch between the reservation and its invocation breaks the chain", () => {
    const fixture = makeAuditStore("ordinal-mismatch");
    try {
      seedAuditPairs(fixture.store, 3);
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.auditSeq = 7;
        },
      );
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.value.verified).toBe(false);
      expect(verdict.value.breaks.some((entry) => entry.auditSeq === 7)).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the clean control still verifies after the mutation cases", () => {
    const fixture = makeAuditStore("clean-control");
    try {
      seedAuditPairs(fixture.store, 3);
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.value.verified).toBe(true);
        expect(verdict.value.breaks).toEqual([]);
      }
      expect(auditKeyOf(fixture)).toHaveLength(64);
      expect(AUDIT_INVOCATION_RECORD_KIND).not.toBe(AUDIT_RESERVATION_RECORD_KIND);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

const auditKeyOf = (fixture: ReturnType<typeof makeAuditStore>): string =>
  readKeyArtifactValue(fixture.identity);
