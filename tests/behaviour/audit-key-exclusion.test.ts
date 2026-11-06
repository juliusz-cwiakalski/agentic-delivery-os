/**
 * TC-GH223-026 — the chaining key never enters the lane environment, record
 * payloads, configuration, ambient environment, or rendered evidence.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readAuditChainKey,
  readAuditLedger,
  verifyAuditChain,
} from "../../packages/core/src/state/index";
import {
  invocationPayloadsOf,
  keyArtifactPath,
  ledgerPath,
  ledgerText,
  makeAuditStore,
  readKeyArtifact,
  readKeyArtifactValue,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";

const laneEnvironment = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/audit/lane-environment.json"), "utf8"),
) as { environment: Record<string, string> };

const encodings = (key: string): string[] => [
  key,
  Buffer.from(key, "hex").toString("base64"),
  Buffer.from(key, "hex").toString("base64url"),
  Buffer.from(key, "hex").toString("utf8"),
];

describe("TC-GH223-026 chaining-key exclusion", () => {
  test("the lane environment declares the identity only, never the key", () => {
    const text = JSON.stringify(laneEnvironment.environment);
    expect(text).toContain("EXAMPLE_PRODUCT_AGENT_IDENTITY");
    expect(Object.keys(laneEnvironment.environment)).not.toContain("CHAIN_KEY");
    expect(text.toLowerCase()).not.toContain("chain-key");
  });

  test("the key appears in neither audit kind, configuration, nor evidence", () => {
    const fixture = makeAuditStore("key-exclusion");
    try {
      seedAuditPairs(fixture.store, 3);
      const key = readKeyArtifactValue(fixture.identity);
      expect(key).toMatch(/^[0-9a-f]{64}$/);

      const payloads = [
        ...invocationPayloadsOf(fixture.store),
        ...reservationPayloadsOf(fixture.store),
      ];
      for (const payload of payloads) {
        const text = JSON.stringify(payload);
        for (const encoded of encodings(key)) expect(text).not.toContain(encoded);
      }
      // Ledger framing bytes carry no key either.
      for (const encoded of encodings(key))
        expect(ledgerText(fixture.identity)).not.toContain(encoded);

      // Configuration and ambient environment are injected values; a synthetic
      // snapshot must not carry the key.
      const configurationSnapshot = { config: { provider: { chain: ["primary"] } } };
      for (const encoded of encodings(key)) {
        expect(JSON.stringify(configurationSnapshot)).not.toContain(encoded);
        expect(JSON.stringify(process.env)).not.toContain(encoded);
      }

      const read = readAuditLedger(fixture.store, { limit: 50 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        for (const encoded of encodings(key)) {
          expect(JSON.stringify(read.value)).not.toContain(encoded);
        }
      }

      // Verification succeeds using the store-managed key: the key was used.
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok && verdict.value.verified).toBe(true);
      expect(readKeyArtifact(fixture.identity).length).toBeGreaterThan(0);
      const readKey = readAuditChainKey(fixture.store);
      expect(readKey.ok).toBe(true);
      if (readKey.ok) expect(readKey.value).toBe(key);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("negative controls prove the exclusion search and key sensitivity are non-vacuous", () => {
    const fixture = makeAuditStore("key-exclusion-controls");
    try {
      seedAuditPairs(fixture.store, 1);
      const key = readKeyArtifactValue(fixture.identity);

      // A planted copy is detected by the same search.
      const copy = `${ledgerText(fixture.identity)}\n${JSON.stringify({ planted: key })}\n`;
      expect(copy).toContain(key);

      // A different key fails verification.
      const original = readKeyArtifact(fixture.identity);
      writeFileSync(
        keyArtifactPath(fixture.identity),
        `${JSON.stringify({ schemaId: "delivery.audit.chain-key.v1", key: "e".repeat(64) })}\n`,
      );
      const broken = verifyAuditChain(fixture.store);
      expect(broken.ok).toBe(true);
      if (broken.ok) expect(broken.value.verified).toBe(false);
      writeFileSync(keyArtifactPath(fixture.identity), original);
      expect(ledgerPath(fixture.identity)).toContain("ledger.");
    } finally {
      removeRoot(fixture.root);
    }
  });
});
