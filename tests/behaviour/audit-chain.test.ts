/**
 * TC-GH223-023 (clean chain, alternation, interleaving), TC-GH223-024 (altered
 * invocation), and TC-GH223-033 (verdict shape) — the keyed chain over both
 * audit kinds.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_CHAIN_ANCHOR,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import {
  auditChainValue,
  readAuditLedger,
  verifyAuditChain,
} from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  auditPairsOf,
  auditRecordsOf,
  ledgerText,
  makeAuditStore,
  mutateAuditRecord,
  readKeyArtifactValue,
  removeRoot,
  seedAuditPairs,
} from "../fixtures/state/harness";

const chainLinks = (
  records: readonly Record<string, unknown>[],
  key: string,
): { readonly expected: string; readonly kind: string; readonly previous: string }[] => {
  let previous = AUDIT_CHAIN_ANCHOR;
  return records.map((record) => {
    const payload = record.payload as Record<string, unknown>;
    const content: Record<string, unknown> = { ...payload };
    delete content.chainValue;
    const expected = auditChainValue(key, previous, content as never);
    const link = { expected, kind: String(record.kind), previous };
    previous = String(payload.chainValue);
    return link;
  });
};

describe("TC-GH223-023 clean chain over both audit kinds", () => {
  test("five interleaved pairs verify continuously with alternating links", () => {
    const fixture = makeAuditStore("chain");
    try {
      seedAuditPairs(fixture.store, 2);
      const interleaved = fixture.store.acquireFence("interleave");
      expect(interleaved.ok).toBe(true);
      if (interleaved.ok) {
        fixture.store.append(interleaved.value.handle, {
          kind: "phase.transition",
          recordKey: "phase.transitions:GH-223",
          payload: { phase: "delivery" },
        });
        fixture.store.releaseFence(interleaved.value.handle);
      }
      seedAuditPairs(fixture.store, 3);

      const pairs = auditPairsOf(fixture.store);
      expect(pairs.map((pair) => pair.auditSeq)).toEqual([1, 2, 3, 4, 5]);

      const key = readKeyArtifactValue(fixture.identity);
      const records = auditRecordsOf(fixture.store);
      const links = chainLinks(records, key);
      for (const [index, link] of links.entries()) {
        const payload = records[index]?.payload as Record<string, unknown>;
        expect(payload.chainValue, `record ${index + 1}`).toBe(link.expected);
        if (index === 0) expect(link.previous).toBe(AUDIT_CHAIN_ANCHOR);
      }
      // A reservation chains from the preceding audit-domain record; an
      // invocation chains from its own reservation.
      for (let index = 0; index < records.length; index += 2) {
        const reservation = records[index];
        const invocation = records[index + 1];
        expect(reservation?.kind).toBe(AUDIT_RESERVATION_RECORD_KIND);
        expect(invocation?.kind).toBe(AUDIT_INVOCATION_RECORD_KIND);
        const reservationPayload = reservation?.payload as Record<string, unknown>;
        const invocationPayload = invocation?.payload as Record<string, unknown>;
        const invocationContent = { ...invocationPayload };
        delete invocationContent.chainValue;
        expect(
          auditChainValue(key, String(reservationPayload.chainValue), invocationContent as never),
        ).toBe(invocationPayload.chainValue);
      }

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.value.verified).toBe(true);
        expect(verdict.value.records).toBe(records.length);
        expect(verdict.value.breaks).toEqual([]);
        expect(verdict.value.orphans).toEqual([]);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a first reservation anchors on a store with pre-existing other kinds", () => {
    const fixture = makeAuditStore("anchor");
    try {
      const acquired = fixture.store.acquireFence("preexisting");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      fixture.store.append(acquired.value.handle, {
        kind: "closeout.operation",
        recordKey: "closeout.operations:GH-223",
        payload: { operation: "noop" },
      });
      fixture.store.releaseFence(acquired.value.handle);
      appendAuditFacts(fixture.store, { runId: "run-anchor" });
      const key = readKeyArtifactValue(fixture.identity);
      const reservation = auditRecordsOf(fixture.store).find(
        (record) => record.kind === AUDIT_RESERVATION_RECORD_KIND,
      );
      expect(reservation).toBeDefined();
      const payload = reservation?.payload as Record<string, unknown>;
      const content = { ...payload };
      delete content.chainValue;
      expect(auditChainValue(key, AUDIT_CHAIN_ANCHOR, content as never)).toBe(payload.chainValue);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a sixth pair chains from the fifth invocation, not from an interleaved kind", () => {
    const fixture = makeAuditStore("sixth");
    try {
      seedAuditPairs(fixture.store, 5);
      const interleaved = fixture.store.acquireFence("tail-other");
      expect(interleaved.ok).toBe(true);
      if (interleaved.ok) {
        fixture.store.append(interleaved.value.handle, {
          kind: "providers.park",
          recordKey: "providers.parks",
          payload: { state: "parked" },
        });
        fixture.store.releaseFence(interleaved.value.handle);
      }
      appendAuditFacts(fixture.store, { runId: "run-sixth", startedAt: 9000 });
      const records = auditRecordsOf(fixture.store);
      const key = readKeyArtifactValue(fixture.identity);
      const links = chainLinks(records, key);
      const sixthReservation = records[records.length - 2];
      const fifthInvocation = records[records.length - 3];
      const link = links[records.length - 2];
      const fifthPayload = (fifthInvocation?.payload ?? {}) as Record<string, unknown>;
      const sixthPayload = (sixthReservation?.payload ?? {}) as Record<string, unknown>;
      expect(link?.previous).toBe(fifthPayload.chainValue as string);
      expect(sixthPayload.auditSeq).toBe(6);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-024 altered invocation record is a chain break", () => {
  test("a recomputed-checksum payload edit is flagged with position and no payload bytes", () => {
    const fixture = makeAuditStore("tamper-invocation");
    try {
      seedAuditPairs(fixture.store, 3);
      const before = verifyAuditChain(fixture.store);
      expect(before.ok && before.value.verified).toBe(true);

      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.arguments = ["status", "--tampered"];
        },
      );

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.value.verified).toBe(false);
      expect(verdict.value.breaks).toHaveLength(1);
      const [breakEntry] = verdict.value.breaks;
      expect(breakEntry?.auditSeq).toBe(2);
      expect(breakEntry?.position).toBeGreaterThan(0);
      expect(Object.keys(breakEntry ?? {}).sort()).toEqual(["auditSeq", "position"]);
      expect(JSON.stringify(verdict.value)).not.toContain("--tampered");

      // Records before the break remain verified-readable.
      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.records.length).toBe(3);
        expect(read.value.records.some((record) => record.auditSeq === 2)).toBe(true);
      }
      expect(ledgerText(fixture.identity).length).toBeGreaterThan(0);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-033 chain verdict shape", () => {
  test("a break is a verdict with position, never an error-table code", () => {
    const fixture = makeAuditStore("verdict");
    try {
      seedAuditPairs(fixture.store, 1);
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 1 },
        (payload) => {
          payload.command = "tampered";
        },
      );
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(Object.keys(verdict.value).sort()).toEqual([
        "breaks",
        "orphans",
        "records",
        "storePath",
        "verified",
      ]);
      expect(verdict.value.breaks.length).toBeGreaterThan(0);
      expect(Object.hasOwn(verdict.value, "code")).toBe(false);
      expect(verdict.value.storePath.length).toBeGreaterThan(0);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
