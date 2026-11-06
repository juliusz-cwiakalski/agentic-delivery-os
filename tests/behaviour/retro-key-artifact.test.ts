/**
 * TC-RETRO-010 / TC-RETRO-011 / TC-RETRO-013 — chaining-key lifecycle, key
 * separation, containment, and key-open failures reusing state identities.
 */
import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import {
  auditChainKeyArtifactName,
  AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA,
} from "../../packages/core/src/contracts/index";
import {
  appendEvidence,
  chmodKeyArtifact,
  corruptKeyArtifact,
  keyArtifactPath,
  makeRetroDir,
  readKeyArtifact,
  readKeyValue,
  readSidecarBytes,
  removeKeyArtifact,
  seedAuditKey,
  substituteKey,
} from "../fixtures/retro/harness";

describe("TC-RETRO-010 chaining-key lifecycle", () => {
  test("the first append creates one 0600 key artifact and later appends reuse it", () => {
    const fixture = makeRetroDir("key-lifecycle");
    expect(fixture.io.exists(keyArtifactPath(fixture))).toBe(false);
    appendEvidence(fixture);
    expect(fixture.io.exists(keyArtifactPath(fixture))).toBe(true);
    const first = readKeyValue(fixture);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect((statSync(keyArtifactPath(fixture)).mode & 0o777) >>> 0).toBe(0o600);
    appendEvidence(fixture);
    expect(readKeyValue(fixture)).toBe(first);
    expect(readKeyArtifact(fixture)).toContain('"schemaId":"delivery.retro.chain-key.v1"');
  });

  test("the retro key is a distinct path and distinct bytes from the audit key", () => {
    const fixture = makeRetroDir("key-separation");
    appendEvidence(fixture);
    const retroKey = readKeyValue(fixture);
    const auditKey = seedAuditKey(fixture);
    const auditPath = `${fixture.stateDirectory}/${auditChainKeyArtifactName(fixture.workspaceId)}`;
    expect(keyArtifactPath(fixture)).not.toBe(auditPath);
    expect(fixture.io.exists(auditPath)).toBe(true);
    expect(auditKey).not.toBe(retroKey);
    const auditText = fixture.io.readText(auditPath);
    expect(auditText).toContain(AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA);
    expect(auditText).not.toContain(retroKey);
  });
});

describe("TC-RETRO-011 key containment", () => {
  test("the key value never appears in the evidence bytes or the read surface", () => {
    const fixture = makeRetroDir("key-containment");
    appendEvidence(fixture);
    const key = readKeyValue(fixture);
    expect(key.length).toBe(64);
    expect(readSidecarBytes(fixture).toString("utf8")).not.toContain(key);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(JSON.stringify(read.value)).not.toContain(key);
    }
    expect(readKeyArtifact(fixture)).toContain(key);
  });
});

describe("TC-RETRO-013 key-open failures reuse the existing state identities", () => {
  test("a missing key on a non-first open is state.keys.missing", () => {
    const fixture = makeRetroDir("key-missing");
    appendEvidence(fixture);
    removeKeyArtifact(fixture);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.keys.missing");
    const append = fixture.sidecar.append({
      traceId: "ev-missing-key",
      level: "change",
      source: "pm-notes",
      windowStart: 1,
      windowEnd: 2,
      collectedAt: 3,
      payloadRefs: [],
      payloadSchemaId: "delivery.retro.evidence.v1",
    });
    expect(append.ok).toBe(false);
    if (!append.ok) expect(append.error.code).toBe("state.keys.missing");
  });

  test("corrupt or wrong-schema key content is state.store.torn", () => {
    const corrupt = makeRetroDir("key-corrupt");
    appendEvidence(corrupt);
    corruptKeyArtifact(corrupt);
    const read = corrupt.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.store.torn");

    const wrongSchema = makeRetroDir("key-wrong-schema");
    appendEvidence(wrongSchema);
    wrongSchema.io.writeText(
      keyArtifactPath(wrongSchema),
      `${JSON.stringify({ schemaId: "delivery.audit.chain-key.v1", key: "a".repeat(64) })}\n`,
    );
    wrongSchema.io.applyPermissions(keyArtifactPath(wrongSchema), "file");
    const wrong = wrongSchema.sidecar.read();
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("state.store.torn");
  });

  test("wrong permission bits are state.permission.denied with the delivered user-validation projection", () => {
    const fixture = makeRetroDir("key-permission");
    appendEvidence(fixture);
    chmodKeyArtifact(fixture, 0o644);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("state.permission.denied");
  });

  test("key substitution fails verification and rewriting the old key restores it", () => {
    const fixture = makeRetroDir("key-substitution");
    appendEvidence(fixture);
    appendEvidence(fixture);
    const clean = fixture.sidecar.verify();
    expect(clean.ok && clean.value.verified).toBe(true);
    const original = readKeyArtifact(fixture);
    substituteKey(fixture);
    const substituted = fixture.sidecar.verify();
    expect(substituted.ok).toBe(true);
    if (substituted.ok) {
      expect(substituted.value.verified).toBe(false);
      expect(substituted.value.affectedDomain).toBe("retro");
      expect(substituted.value.breaks.length).toBeGreaterThan(0);
    }
    fixture.io.writeText(keyArtifactPath(fixture), original);
    fixture.io.applyPermissions(keyArtifactPath(fixture), "file");
    const restored = fixture.sidecar.verify();
    expect(restored.ok && restored.value.verified).toBe(true);
  });
});
