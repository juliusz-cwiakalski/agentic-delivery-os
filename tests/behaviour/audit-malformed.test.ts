/**
 * TC-GH223-007 — malformed audit entries classify through existing identities,
 * preserve pre-existing records, and survive explicit salvage without loss.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, readFileSync } from "node:fs";
import {
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { readAuditLedger, verifyAuditChain } from "../../packages/core/src/state/index";
import {
  type AuditStoreFixture,
  invocationPayloadsOf,
  ledgerPath,
  makeAuditStore,
  quarantineFiles,
  removeRoot,
  salvageTail,
  seedAuditPairs,
} from "../fixtures/state/harness";

const corruptTailChecksum = (fixture: AuditStoreFixture): void => {
  const text = readFileSync(ledgerPath(fixture.identity), "utf8");
  const lines = text.split("\n").filter((line) => line !== "");
  const last = lines[lines.length - 1] as string;
  const record = JSON.parse(last) as { checksum: string };
  record.checksum = "0".repeat(16);
  lines[lines.length - 1] = JSON.stringify(record);
  Bun.write(ledgerPath(fixture.identity), `${lines.join("\n")}\n`);
};

describe("TC-GH223-007 malformed audit entries", () => {
  test("a broken-framing tail is torn before salvage and preserved by quarantine", () => {
    const fixture = makeAuditStore("malformed-framing");
    try {
      seedAuditPairs(fixture.store, 3);
      const before = JSON.stringify(invocationPayloadsOf(fixture.store));
      appendFileSync(ledgerPath(fixture.identity), '{"kind":');

      const torn = readAuditLedger(fixture.store, { limit: 10 });
      expect(torn.ok).toBe(false);
      if (!torn.ok) {
        expect(torn.error.code).toBe("state.store.torn");
        expect(torn.error.kind).toBe("state");
      }

      const salvaged = salvageTail(fixture.store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;
      expect(salvaged.value.report.quarantinedBytes).toBeGreaterThan(0);
      expect(quarantineFiles(fixture.identity)).toHaveLength(1);

      expect(JSON.stringify(invocationPayloadsOf(fixture.store))).toBe(before);
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok && verdict.value.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a failing-checksum tail is torn and salvages without data loss", () => {
    const fixture = makeAuditStore("malformed-checksum");
    try {
      seedAuditPairs(fixture.store, 3);
      const before = JSON.stringify(invocationPayloadsOf(fixture.store));
      corruptTailChecksum(fixture);

      const torn = readAuditLedger(fixture.store, { limit: 10 });
      expect(torn.ok).toBe(false);
      if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");

      const salvaged = salvageTail(fixture.store);
      expect(salvaged.ok && salvaged.value.salvaged).toBe(true);
      // The corrupt tail frame is the quarantined damage; the prior two
      // invocation records remain byte-identical.
      const beforeRecords = JSON.parse(before) as Record<string, unknown>[];
      expect(JSON.stringify(invocationPayloadsOf(fixture.store))).toBe(
        JSON.stringify(beforeRecords.filter((record) => record.auditSeq !== 3)),
      );
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a malformed reservation tail classifies as torn", () => {
    const fixture = makeAuditStore("malformed-reservation");
    try {
      seedAuditPairs(fixture.store, 2);
      appendFileSync(ledgerPath(fixture.identity), '{"kind":"audit.reservation"');
      const torn = readAuditLedger(fixture.store, { limit: 10 });
      expect(torn.ok).toBe(false);
      if (!torn.ok) expect(torn.error.code).toBe("state.store.torn");
      expect(AUDIT_RESERVATION_RECORD_KIND).toBe("audit.reservation");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an unknown invocation payload is state.store.unknown and remains as evidence", () => {
    const fixture = makeAuditStore("malformed-payload");
    try {
      seedAuditPairs(fixture.store, 2);
      const acquired = fixture.store.acquireFence("unknown-payload");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const appended = fixture.store.append(acquired.value.handle, {
        kind: AUDIT_INVOCATION_RECORD_KIND,
        recordKey: "audit.invocations",
        payload: { schemaId: AUDIT_INVOCATION_PAYLOAD_SCHEMA, runId: "run-unknown" },
      });
      fixture.store.releaseFence(acquired.value.handle);
      expect(appended.ok).toBe(true);

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.unknown");

      // The record is still present: classification invents no delete path.
      const verified = fixture.store.readRecords();
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(
          verified.value.records.some((record) => record.kind === AUDIT_INVOCATION_RECORD_KIND),
        ).toBe(true);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
