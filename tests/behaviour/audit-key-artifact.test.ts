/**
 * TC-GH223-037 — `chain-key.<workspace>.json` is created once, persisted 0600,
 * verified on open, reused across store instances, and never exported.
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
  invocationPayloadsOf,
  keyArtifactMode,
  keyArtifactPath,
  makeAuditStore,
  readKeyArtifact,
  readKeyArtifactValue,
  removeRoot,
  reopenStore,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";

const posix = process.platform !== "win32";

describe("TC-GH223-037 durable chaining-key artifact", () => {
  test("the artifact is created once on the first audit append", () => {
    const fixture = makeAuditStore("key-artifact");
    try {
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);
      appendAuditFacts(fixture.store, { runId: "run-key-1" });
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(true);
      const content = readKeyArtifact(fixture.identity);
      expect(content.length).toBeGreaterThan(0);
      const key = readKeyArtifactValue(fixture.identity);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      if (posix) expect(keyArtifactMode(fixture.identity)).toBe(0o600);

      const before = readKeyArtifact(fixture.identity);
      appendAuditFacts(fixture.store, { runId: "run-key-2" });
      expect(readKeyArtifact(fixture.identity)).toBe(before);

      const read = readAuditChainKey(fixture.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value).toBe(key);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a later store instance reuses the same key and verifies continuously", () => {
    const fixture = makeAuditStore("key-reopen");
    try {
      seedAuditPairs(fixture.store, 2);
      const key = readKeyArtifactValue(fixture.identity);
      const reopened = reopenStore(fixture.identity);
      const verdict = verifyAuditChain(reopened.store);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) {
        expect(verdict.value.verified).toBe(true);
        expect(verdict.value.breaks).toEqual([]);
      }
      expect(readKeyArtifactValue(fixture.identity)).toBe(key);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a bare open does not create the artifact; the first append does", () => {
    const fixture = makeAuditStore("key-bare-open");
    try {
      const reopened = reopenStore(fixture.identity);
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);
      const read = readAuditLedger(reopened.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.verifiedEmpty).toBe(true);
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(false);
      appendAuditFacts(fixture.store, { runId: "run-key-first" });
      expect(existsSync(keyArtifactPath(fixture.identity))).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the key never enters either record kind's payload", () => {
    const fixture = makeAuditStore("key-exclusion-records");
    try {
      seedAuditPairs(fixture.store, 2);
      const key = readKeyArtifactValue(fixture.identity);
      const payloads = [
        ...invocationPayloadsOf(fixture.store),
        ...reservationPayloadsOf(fixture.store),
      ];
      for (const payload of payloads) {
        const text = JSON.stringify(payload);
        expect(text).not.toContain(key);
        expect(text).not.toContain(Buffer.from(key, "hex").toString("base64"));
        expect(text).not.toContain(Buffer.from(key, "hex").toString("base64url"));
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a different key artifact fails verification (key sensitivity)", () => {
    const fixture = makeAuditStore("key-sensitivity");
    try {
      seedAuditPairs(fixture.store, 1);
      const original = readKeyArtifact(fixture.identity);
      const replacement = JSON.stringify({
        schemaId: "delivery.audit.chain-key.v1",
        key: "f".repeat(64),
      });
      Bun.write(keyArtifactPath(fixture.identity), `${replacement}\n`);
      const broken = verifyAuditChain(fixture.store);
      expect(broken.ok).toBe(true);
      if (broken.ok) expect(broken.value.verified).toBe(false);
      Bun.write(keyArtifactPath(fixture.identity), original);
      const restored = verifyAuditChain(fixture.store);
      expect(restored.ok && restored.value.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
