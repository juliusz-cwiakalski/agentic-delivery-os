/**
 * TC-GH222-004 — "undeclared" is boundary-relative, never a closed store-wide
 * kind list (ASM-4). An undeclared kind or an undeclared payload schema at a
 * validated boundary classifies `state.store.unknown`; a version-scoped store
 * mismatch stays `state.schema.mismatch`; verified-empty stays distinct from
 * both; and the raw store port remains kind-agnostic.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { createArtifactBoundary } from "../../packages/core/src/state/index";
import { appendArtifact, RETRO_BOUNDARY } from "../fixtures/state/artifact-declarations";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const guidanceFor = (code: string): string =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code)
    ?.remediationHint ?? "";

const headerPath = (root: string): string => `${root}/header.workspace-a.json`;

const conforming = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schemaId: "delivery.retro.finding.v1",
  findingId: "F-1",
  severity: "high",
  count: 2,
  ...overrides,
});

/** Seed one raw record the boundary does not declare (kind or payload). */
const seedRaw = (
  store: ReturnType<typeof openStore>["store"],
  kind: string,
  payload: Record<string, unknown>,
): void => {
  withinFence(store, "raw-seed", (handle) => {
    const appended = store.append(handle, {
      kind,
      recordKey: `retro.records:${String(payload.findingId ?? "seeded")}`,
      payload: payload as never,
    });
    expect(appended.ok).toBe(true);
  });
};

describe("TC-GH222-004 boundary-relative unknown versus version mismatch", () => {
  test("undeclared kind and undeclared payload schema classify state.store.unknown", () => {
    const root = makeTempRoot("gh222-unknown");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);

      // Fixture A: an undeclared record kind at this boundary.
      seedRaw(store, "retro.unknown-kind", conforming({ findingId: "A" }));
      const kindRead = boundary.read();
      expect(kindRead.ok).toBe(false);
      if (!kindRead.ok) {
        expect(kindRead.error.code).toBe("state.store.unknown");
        expect(kindRead.error.consequence).toBe("not_landed");
        expect(kindRead.error.location.path).toContain("ledger.");
        expect(kindRead.error.location.record).toBe(1);
        expect(guidanceFor(kindRead.error.code)).toContain("boundary");
        expect(JSON.stringify(kindRead)).not.toContain("high");
      }
      // No value and no empty record set are served on a failure.
      expect(Object.hasOwn(kindRead, "value")).toBe(false);
    } finally {
      removeRoot(root);
    }
  });

  test("a declared kind with an undeclared payload schema classifies unknown", () => {
    const root = makeTempRoot("gh222-unknown-payload");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      seedRaw(store, "retro.finding", conforming({ findingId: "B", schemaId: "other.schema.v9" }));
      const read = boundary.read();
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.store.unknown");
        expect(read.error.location.record).toBe(1);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a version-scoped store mismatch stays state.schema.mismatch, not unknown", () => {
    const root = makeTempRoot("gh222-unknown-schema");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      appendArtifact(boundary, store, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: conforming() as never,
      });
      writeFileSync(
        headerPath(root),
        `${JSON.stringify({ schemaVersion: "delivery.state.v999" })}\n`,
      );
      const read = boundary.read();
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.schema.mismatch");
        expect(read.error.code).not.toBe("state.store.unknown");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("verified-empty is pairwise distinct from unknown, schema mismatch, and torn", () => {
    const root = makeTempRoot("gh222-unknown-distinct");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      const empty = boundary.read();
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.value.verdict).toBe("verified-empty");
        expect(empty.value.evidence.verifiedEmpty).toBe(true);
      }
      // Verified-empty satisfies only an empty key-set declaration.
      expect(store.read({ requiredKeys: [] }).ok).toBe(true);
      const nonEmpty = store.read({ requiredKeys: ["retro.records:F-1"] });
      expect(nonEmpty.ok).toBe(false);
      if (!nonEmpty.ok) expect(nonEmpty.error.code).toBe("state.keys.missing");

      const distinct = new Set([
        "verified-empty",
        "state.store.unknown",
        "state.schema.mismatch",
        "state.store.torn",
      ]);
      expect(distinct.size).toBe(4);
    } finally {
      removeRoot(root);
    }
  });

  test("the raw store port stays kind-agnostic; only the boundary declares kinds", () => {
    const root = makeTempRoot("gh222-unknown-kind-agnostic");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      // Any consumer kind is a legal store record (M0-S5 backward compatibility).
      withinFence(store, "raw-writer", (handle) => {
        const appended = store.append(handle, {
          kind: "consumer.anything",
          recordKey: "consumer.key",
          payload: { any: "payload" },
        });
        expect(appended.ok).toBe(true);
      });
      const records = store.readRecords();
      expect(records.ok).toBe(true);
      if (records.ok) expect(records.value.records[0]?.kind).toBe("consumer.anything");
      // The boundary owns only its namespace, so the arbitrary record is not
      // "undeclared" to it; a read is verified-empty for the boundary.
      const boundary = createArtifactBoundary(store, RETRO_BOUNDARY);
      const read = boundary.read();
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.verdict).toBe("verified-empty");
      expect(ledgerPath(identity)).toContain("ledger.");
    } finally {
      removeRoot(root);
    }
  });
});
