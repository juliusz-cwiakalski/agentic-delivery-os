/**
 * TC-GH223-027 — terminal-tail repair and guided salvage remove trailing audit
 * frames wholesale; reported removals are not chain breaks, and the next pair
 * chains from the last surviving audit-domain record.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync } from "node:fs";
import {
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { verifyAuditChain } from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  auditRecordsOf,
  ledgerPath,
  ledgerText,
  makeAuditStore,
  mutateAuditRecord,
  quarantineFiles,
  removeRoot,
  salvageTail,
  seedAuditPairs,
} from "../fixtures/state/harness";

const appendTornTail = (path: string): void => appendFileSync(path, '{"broken":');

const allLinesParse = (text: string): boolean =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .every((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

describe("TC-GH223-027 repair and salvage continuity", () => {
  test("terminal-tail repair removes the torn tail and the chain continues", () => {
    const fixture = makeAuditStore("repair");
    try {
      seedAuditPairs(fixture.store, 2);
      appendTornTail(ledgerPath(fixture.identity));

      const repaired = fixture.store.repairTornTail();
      expect(repaired.ok).toBe(true);
      if (!repaired.ok) return;
      expect(repaired.value.repaired).toBe(true);
      expect(repaired.value.report.removedBytes).toBeGreaterThan(0);
      expect(allLinesParse(ledgerText(fixture.identity))).toBe(true);

      const afterRepair = verifyAuditChain(fixture.store);
      expect(afterRepair.ok && afterRepair.value.verified).toBe(true);
      expect(auditRecordsOf(fixture.store)).toHaveLength(4);

      appendAuditFacts(fixture.store, { runId: "run-after-repair", startedAt: 9000 });
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) return;
      expect(verdict.value.verified).toBe(true);
      const records = auditRecordsOf(fixture.store);
      expect(records[records.length - 1]?.kind).toBe(AUDIT_INVOCATION_RECORD_KIND);
      expect(records[records.length - 2]?.kind).toBe(AUDIT_RESERVATION_RECORD_KIND);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("guided salvage preserves the torn tail as evidence and is not a chain break", () => {
    const fixture = makeAuditStore("salvage");
    try {
      seedAuditPairs(fixture.store, 2);
      appendTornTail(ledgerPath(fixture.identity));
      const salvaged = salvageTail(fixture.store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok) return;
      expect(salvaged.value.salvaged).toBe(true);
      if (!salvaged.value.salvaged) return;
      expect(salvaged.value.report.quarantinedBytes).toBeGreaterThan(0);
      expect(quarantineFiles(fixture.identity)).toHaveLength(1);
      expect(allLinesParse(ledgerText(fixture.identity))).toBe(true);

      const afterSalvage = verifyAuditChain(fixture.store);
      expect(afterSalvage.ok && afterSalvage.value.verified).toBe(true);

      appendAuditFacts(fixture.store, { runId: "run-after-salvage", startedAt: 9000 });
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

  test("continuity does not suppress a genuine alteration control", () => {
    const fixture = makeAuditStore("salvage-control");
    try {
      seedAuditPairs(fixture.store, 2);
      appendTornTail(ledgerPath(fixture.identity));
      const salvaged = salvageTail(fixture.store);
      expect(salvaged.ok).toBe(true);
      appendAuditFacts(fixture.store, { runId: "run-control", startedAt: 9000 });
      // A genuine alteration still breaks after the salvage path.
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 1 },
        (payload) => {
          payload.command = "tampered";
        },
      );
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) expect(verdict.value.verified).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
