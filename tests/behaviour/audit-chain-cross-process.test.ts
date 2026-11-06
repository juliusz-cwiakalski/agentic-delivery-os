/**
 * TC-GH223-038 — cross-process (fresh store/edge instances over the same temp
 * root) chain verification has zero false chain-break flags and reuses the key.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { verifyAuditChain } from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  keyArtifactPath,
  makeAuditStore,
  readKeyArtifact,
  readKeyArtifactValue,
  removeRoot,
  reopenStore,
  seedAuditPairs,
} from "../fixtures/state/harness";

describe("TC-GH223-038 cross-process continuity", () => {
  test("records written by one store instance verify from later instances", () => {
    const fixture = makeAuditStore("cross-process");
    try {
      seedAuditPairs(fixture.store, 3);
      const key = readKeyArtifactValue(fixture.identity);
      const afterA = fixture.store.readRecords();
      expect(afterA.ok).toBe(true);

      const instanceB = reopenStore(fixture.identity);
      const verdictB = verifyAuditChain(instanceB.store);
      expect(verdictB.ok).toBe(true);
      if (verdictB.ok) {
        expect(verdictB.value.verified).toBe(true);
        expect(verdictB.value.breaks).toEqual([]);
      }

      const appended = appendAuditFacts(instanceB.store, {
        runId: "run-cross-fourth",
        startedAt: 4000,
      });
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
      expect(appended.value.auditSeq).toBe(4);

      const instanceC = reopenStore(fixture.identity);
      const verdictC = verifyAuditChain(instanceC.store);
      expect(verdictC.ok).toBe(true);
      if (verdictC.ok) {
        expect(verdictC.value.verified).toBe(true);
        expect(verdictC.value.records).toBe(8);
      }
      expect(readKeyArtifactValue(fixture.identity)).toBe(key);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a different key fails verification while the unmodified store still passes", () => {
    const fixture = makeAuditStore("cross-process-control");
    try {
      seedAuditPairs(fixture.store, 2);
      const original = readKeyArtifact(fixture.identity);
      writeFileSync(
        keyArtifactPath(fixture.identity),
        `${JSON.stringify({ schemaId: "delivery.audit.chain-key.v1", key: "d".repeat(64) })}\n`,
      );
      const broken = verifyAuditChain(fixture.store);
      expect(broken.ok).toBe(true);
      if (broken.ok) expect(broken.value.verified).toBe(false);
      writeFileSync(keyArtifactPath(fixture.identity), original);
      const restored = verifyAuditChain(fixture.store);
      expect(restored.ok && restored.value.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
