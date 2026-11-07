/**
 * TC-GH223-047 — key-artifact open failures reuse existing state identities:
 * absent on a non-first open → state.keys.missing, corrupt → state.store.torn,
 * wrong bits → state.permission.denied. No new error-table row.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  readAuditChainKey,
  readAuditLedger,
  verifyAuditChain,
} from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  chmodKeyArtifact,
  corruptKeyArtifact,
  keyArtifactPath,
  makeAuditStore,
  removeKeyArtifact,
  removeRoot,
  seedAuditPairs,
} from "../fixtures/state/harness";

const posix = process.platform !== "win32";

describe("TC-GH223-047 key-artifact open failures", () => {
  test("absent on a non-first open refuses with state.keys.missing", () => {
    const fixture = makeAuditStore("key-missing");
    try {
      seedAuditPairs(fixture.store, 2);
      removeKeyArtifact(fixture.identity);
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);

      const key = readAuditChainKey(fixture.store);
      expect(key.ok).toBe(false);
      if (!key.ok) expect(key.error.code).toBe("state.keys.missing");

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.error.code).toBe("state.keys.missing");

      const before = fixture.store.readRecords();
      const appended = appendAuditFacts(fixture.store, { runId: "run-no-key" });
      expect(appended.ok).toBe(false);
      if (!appended.ok) expect(appended.error.code).toBe("state.keys.missing");
      const after = fixture.store.readRecords();
      expect(before.ok).toBe(true);
      expect(after.ok).toBe(true);
      if (before.ok && after.ok) {
        expect(after.value.records.length).toBe(before.value.records.length);
      }
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a corrupt artifact is in the state.store.torn family", () => {
    const fixture = makeAuditStore("key-corrupt");
    try {
      seedAuditPairs(fixture.store, 1);
      corruptKeyArtifact(fixture.identity);
      const key = readAuditChainKey(fixture.store);
      expect(key.ok).toBe(false);
      if (!key.ok) expect(key.error.code).toBe("state.store.torn");
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.error.code).toBe("state.store.torn");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test.skipIf(!posix)("wrong permission bits refuse with state.permission.denied", () => {
    const fixture = makeAuditStore("key-permissions");
    try {
      seedAuditPairs(fixture.store, 1);
      chmodKeyArtifact(fixture.identity, 0o644);
      const key = readAuditChainKey(fixture.store);
      expect(key.ok).toBe(false);
      if (!key.ok) expect(key.error.code).toBe("state.permission.denied");
      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.permission.denied");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("first-append creation is unchanged on an empty store", () => {
    const fixture = makeAuditStore("key-first");
    try {
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);
      const appended = appendAuditFacts(fixture.store, { runId: "run-first-key" });
      expect(appended.ok).toBe(true);
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(true);
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok && verdict.value.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
