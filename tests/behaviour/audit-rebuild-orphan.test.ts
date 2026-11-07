/**
 * TC-GH223-046 — the reservation-orphan finding is folded from verified ledger
 * truth, so derived-document deletion/corruption and reopen preserve it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { readAuditLedger } from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  armAppendFailure,
  ledgerDigest,
  makeAuditStore,
  removeRoot,
  reopenStore,
  seedAuditPairs,
} from "../fixtures/state/harness";

const indexPath = (stateDirectory: string, workspaceId: string): string =>
  `${stateDirectory}/index.${encodeURIComponent(workspaceId)}.sqlite`;

const orphanSeq = (read: ReturnType<typeof readAuditLedger>): readonly number[] | undefined =>
  read.ok ? read.value.chain.orphans.map((finding) => finding.auditSeq) : undefined;

describe("TC-GH223-046 rebuild preserves the orphan finding", () => {
  test("index deletion, corruption, and reopen keep the same finding", () => {
    const fixture = makeAuditStore("rebuild-orphan");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 2);
      try {
        appendAuditFacts(fixture.store, { runId: "run-orphan-rebuild", startedAt: 2000 });
      } finally {
        armed.restore();
      }

      expect(orphanSeq(readAuditLedger(fixture.store, { limit: 10 }))).toEqual([2]);

      const index = indexPath(fixture.identity.stateDirectory, fixture.identity.workspaceId);
      const documents = `${fixture.identity.stateDirectory}/documents.${encodeURIComponent(fixture.identity.workspaceId)}`;
      if (existsSync(index)) rmSync(index, { force: true });
      if (existsSync(documents)) rmSync(documents, { recursive: true, force: true });
      expect(orphanSeq(readAuditLedger(fixture.store, { limit: 10 }))).toEqual([2]);

      writeFileSync(index, "not a sqlite database", { mode: 0o600 });
      const digest = ledgerDigest(fixture.identity);
      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.chain.orphans.map((finding) => finding.auditSeq)).toEqual([2]);
        expect(read.value.chain.orphans[0]?.runId).toBe("run-orphan-rebuild");
      }
      expect(ledgerDigest(fixture.identity)).toBe(digest);
      expect(fixture.store.fenceStatus().held).toBe(false);

      const reopened = reopenStore(fixture.identity);
      const afterReopen = readAuditLedger(reopened.store, { limit: 10 });
      expect(afterReopen.ok).toBe(true);
      if (afterReopen.ok) {
        expect(afterReopen.value.chain.orphans.map((finding) => finding.auditSeq)).toEqual([2]);
        expect(afterReopen.value.chain.orphans[0]?.runId).toBe("run-orphan-rebuild");
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
