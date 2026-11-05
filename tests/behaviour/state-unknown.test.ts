/**
 * TC-GH222-004 — "undeclared" is boundary-relative, never a closed store-wide
 * kind list (ASM-4). An undeclared kind or an undeclared payload schema at a
 * validated boundary classifies `state.store.unknown`; a version-scoped store
 * mismatch stays `state.schema.mismatch`; verified-empty stays distinct from
 * both; and the raw store port remains kind-agnostic.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  type StateStoreIdentity,
} from "../../packages/core/src/contracts/index";
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

const headerPath = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/header.${encodeURIComponent(identity.workspaceId)}.json`;

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
        headerPath(identity),
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
      // Each entry below is produced by a real operation, never a literal list.
      const outcomes: string[] = [];

      // Verified-empty: a boundary read over an absent store.
      const emptyIdentity = makeIdentity(root, { workspaceId: "empty" });
      const emptyStore = openStore(emptyIdentity).store;
      const emptyBoundary = createArtifactBoundary(emptyStore, RETRO_BOUNDARY);
      const empty = emptyBoundary.read();
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.value.verdict).toBe("verified-empty");
        expect(empty.value.evidence.verifiedEmpty).toBe(true);
        outcomes.push(`verified:${empty.value.verdict}`);
      }
      // Verified-empty satisfies only an empty key-set declaration.
      expect(emptyStore.read({ requiredKeys: [] }).ok).toBe(true);
      const nonEmpty = emptyStore.read({ requiredKeys: ["retro.records:F-1"] });
      expect(nonEmpty.ok).toBe(false);
      if (!nonEmpty.ok) expect(nonEmpty.error.code).toBe("state.keys.missing");

      // Unknown: an undeclared record kind at the boundary.
      const unknownIdentity = makeIdentity(root, { workspaceId: "unknown" });
      const unknownStore = openStore(unknownIdentity).store;
      const unknownBoundary = createArtifactBoundary(unknownStore, RETRO_BOUNDARY);
      seedRaw(unknownStore, "retro.unknown-kind", conforming({ findingId: "U" }));
      const unknown = unknownBoundary.read();
      expect(unknown.ok).toBe(false);
      if (!unknown.ok) outcomes.push(`failed:${unknown.error.code}`);

      // Schema mismatch: a version-scoped store mismatch.
      const schemaIdentity = makeIdentity(root, { workspaceId: "schema" });
      const schemaStore = openStore(schemaIdentity).store;
      const schemaBoundary = createArtifactBoundary(schemaStore, RETRO_BOUNDARY);
      writeFileSync(
        headerPath(schemaIdentity),
        `${JSON.stringify({ schemaVersion: "delivery.state.v999" })}\n`,
      );
      const schema = schemaBoundary.read();
      expect(schema.ok).toBe(false);
      if (!schema.ok) outcomes.push(`failed:${schema.error.code}`);

      // Torn: a verified integrity break over a declared record.
      const tornIdentity = makeIdentity(root, { workspaceId: "torn" });
      const tornStore = openStore(tornIdentity).store;
      const tornBoundary = createArtifactBoundary(tornStore, RETRO_BOUNDARY);
      appendArtifact(tornBoundary, tornStore, {
        kind: "retro.finding",
        recordKey: "retro.records:F-1",
        payload: conforming() as never,
      });
      const tornLedger = readFileSync(ledgerPath(tornIdentity), "utf8").slice(0, -1);
      writeFileSync(ledgerPath(tornIdentity), tornLedger);
      const torn = tornBoundary.read();
      expect(torn.ok).toBe(false);
      if (!torn.ok) outcomes.push(`failed:${torn.error.code}`);

      expect(outcomes).toEqual([
        "verified:verified-empty",
        "failed:state.store.unknown",
        "failed:state.schema.mismatch",
        "failed:state.store.torn",
      ]);
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
