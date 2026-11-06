/**
 * TC-GH222-006 — write-boundary schema validation refuses nonconforming records
 * before anything lands: an undeclared kind, a schema-violating payload, and a
 * missing required field each classify `state.store.unknown` with `not_landed`,
 * leave the ledger digest unchanged, and fill in no default.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createArtifactBoundary } from "../../packages/core/src/state/index";
import { appendArtifact, RETRO_BOUNDARY } from "../fixtures/state/artifact-declarations";
import {
  ledgerBytes,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const conforming = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaId: "delivery.retro.finding.v1",
  findingId: "F-1",
  severity: "high",
  count: 2,
  ...overrides,
});

describe("TC-GH222-006 write-boundary schema validation", () => {
  test("nonconforming records are refused with not_landed and zero mutation", () => {
    const root = makeTempRoot("gh222-boundary-write");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      const seeded = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: conforming() as never,
      });
      expect(seeded.ok).toBe(true);
      const before = ledgerBytes(identity);
      const beforeText = ledgerText(identity);

      const attempts = [
        {
          label: "undeclared kind",
          request: {
            kind: "retro.undeclared",
            recordKey: "retro.records:F-2",
            payload: conforming({ findingId: "F-2" }) as never,
          },
        },
        {
          label: "schema-violating payload",
          request: {
            kind: "retro.finding",
            recordKey: "retro.records:F-2",
            payload: conforming({ findingId: "F-2", severity: "catastrophic" }) as never,
          },
        },
        {
          label: "missing required field",
          request: {
            kind: "retro.finding",
            recordKey: "retro.records:F-2",
            payload: { schemaId: "delivery.retro.finding.v1", findingId: "F-2", count: 1 } as never,
          },
        },
      ];

      for (const attempt of attempts) {
        const refused = appendArtifact(boundary, store, attempt.request);
        expect(refused.ok, attempt.label).toBe(false);
        if (!refused.ok) {
          expect(refused.error.code, attempt.label).toBe("state.store.unknown");
          expect(refused.error.consequence, attempt.label).toBe("not_landed");
        }
      }

      // Nothing landed: no partial frame, no sequence advance, no default fill.
      expect(ledgerBytes(identity).equals(before)).toBe(true);
      expect(ledgerText(identity)).toBe(beforeText);
      expect(ledgerText(identity)).not.toContain("F-2");
      expect(ledgerText(identity)).not.toContain("catastrophic");
      expect(ledgerText(identity)).not.toContain('"severity":null');

      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.artifacts).toHaveLength(1);
        expect(read.value.artifacts[0]?.payload).toEqual(conforming() as never);
        expect(read.value.evidence.recordCount).toBe(1);
      }
      expect(existsSync(ledgerPath(identity))).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("a missing required field is never filled with a default", () => {
    const root = makeTempRoot("gh222-boundary-no-default");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      const refused = appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-9",
        payload: { schemaId: "delivery.retro.finding.v1", findingId: "F-9", count: 1 } as never,
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("state.store.unknown");
      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.artifacts).toEqual([]);
        expect(read.value.verdict).toBe("verified-empty");
        expect(read.value.evidence.recordCount).toBe(0);
      }
    } finally {
      removeRoot(root);
    }
  });
});
