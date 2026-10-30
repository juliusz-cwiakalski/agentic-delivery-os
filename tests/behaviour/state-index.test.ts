/**
 * TC-STATE-007 — the SQLite index is a disposable projection: divergence is
 * detected, rebuilt from verified ledger truth, reported, or fails exactly
 * `state.write.failed` (AC-F3-1, TDR-0004 §4).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { classifyDomainKind } from "../../packages/cli/src/classify";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  type StateRuntimeEdge,
} from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const indexPath = (workspace: string, directory: string): string =>
  `${directory}/index.${encodeURIComponent(workspace)}.sqlite`;

const seed = (directory: string): void => {
  const identity = makeIdentity(directory);
  const { store } = openStore(identity, { driver: "sqlite" });
  withinFence(store, "writer", (handle) => {
    store.append(handle, { kind: "park", recordKey: "k1", payload: { n: 1 } });
  });
};

describe("TC-STATE-007 index divergence and rebuild", () => {
  test("a deleted index is rebuilt from the verified ledger and reported", () => {
    const root = makeTempRoot("index-delete");
    try {
      const identity = makeIdentity(root);
      seed(root);
      const before = ledgerText(identity);
      rmSync(indexPath(identity.workspaceId, root), { force: true });
      const { store } = openStore(identity, { driver: "sqlite" });
      const read = store.read({ requiredKeys: ["k1"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ k1: { n: 1 } });
        expect(read.value.evidence.rebuild).toMatchObject({ reason: "missing", records: 1 });
      }
      expect(ledgerText(identity)).toBe(before);
    } finally {
      removeRoot(root);
    }
  });

  test("a corrupted index is detected and rebuilt without touching the ledger", () => {
    const root = makeTempRoot("index-corrupt");
    try {
      const identity = makeIdentity(root);
      seed(root);
      const before = ledgerText(identity);
      writeFileSync(indexPath(identity.workspaceId, root), "not-a-database");
      const { store } = openStore(identity, { driver: "sqlite" });
      const read = store.read({ requiredKeys: ["k1"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ k1: { n: 1 } });
        expect(read.value.evidence.rebuild?.reason).toBe("corrupt");
      }
      expect(ledgerText(identity)).toBe(before);
    } finally {
      removeRoot(root);
    }
  });

  test("a divergent index is detected and rebuilt to ledger truth", () => {
    const root = makeTempRoot("index-divergent");
    try {
      const identity = makeIdentity(root);
      seed(root);
      // Append through the scan driver so the derived index deliberately lags.
      const scan = openStore(identity, { driver: "jsonl" }).store;
      withinFence(scan, "writer-2", (handle) => {
        scan.append(handle, { kind: "park", recordKey: "k2", payload: { n: 2 } });
      });
      const edge = createTestEdge();
      const staleRows = edge.indexRead(indexPath(identity.workspaceId, root)) ?? [];
      expect(staleRows.map((row) => row.key)).toEqual(["k1"]);

      const { store } = openStore(identity, { driver: "sqlite", edge });
      const read = store.read({ requiredKeys: ["k1", "k2"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ k1: { n: 1 }, k2: { n: 2 } });
        expect(read.value.evidence.rebuild?.reason).toBe("divergent");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a failed rebuild fails exactly state.write.failed and never serves a stale read", () => {
    const root = makeTempRoot("index-rebuild-fault");
    try {
      const identity = makeIdentity(root);
      seed(root);
      rmSync(indexPath(identity.workspaceId, root), { force: true });
      const before = ledgerText(identity);
      const { store } = openStore(identity, {
        driver: "sqlite",
        edge: createTestEdge({ faults: ["index-rebuild-write"] }),
      });
      const read = store.read({ requiredKeys: ["k1"] });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.write.failed");
        expect(read.error.consequence).toBe("not_landed");
        expect(JSON.stringify(read.error)).not.toContain("planted-payload-");
      }
      expect(classifyDomainKind("state", "state.write.failed")).toMatchObject({
        category: "transient",
        retryable: true,
        consequence: "not_landed",
        projectionClass: "platform-provider",
      });
      expect(ledgerText(identity)).toBe(before);
    } finally {
      removeRoot(root);
    }
  });

  test("the jsonl control returns the same values with no index at all", () => {
    const root = makeTempRoot("index-jsonl-control");
    try {
      const identity = makeIdentity(root);
      seed(root);
      const { store } = openStore(identity, { driver: "jsonl" });
      const read = store.read({ requiredKeys: ["k1"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ k1: { n: 1 } });
        expect(read.value.evidence.rebuild).toBeUndefined();
        expect(read.value.evidence.verification).not.toContain("index");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the recorded runtime matrix is asserted, never silently skipped", () => {
    const edge: StateRuntimeEdge = createNodeStateEdge();
    // TDR-0004 matrix: Bun 1.4.4 and Node >= 22.5 provide a built-in binding.
    // An unavailable binding must fail this assertion with the matrix reason,
    // not skip the indexed kind.
    if (!edge.indexAvailable()) {
      throw new Error(
        "sqlite binding unavailable on this runtime; the TDR-0004 matrix must be amended, not skipped",
      );
    }
    const root = makeTempRoot("index-matrix");
    try {
      const identity = createStateStore(
        { ...makeIdentity(root), schemaVersion: STATE_SCHEMA_VERSION },
        { driver: "sqlite", edge },
      );
      expect(identity.read({ requiredKeys: [] }).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the stale-index control proves a stale value would otherwise be returned", () => {
    const root = makeTempRoot("index-stale-control");
    try {
      const identity = makeIdentity(root);
      seed(root);
      const scan = openStore(identity, { driver: "jsonl" }).store;
      withinFence(scan, "writer-2", (handle) => {
        scan.append(handle, { kind: "park", recordKey: "k2", payload: { n: 2 } });
      });
      const edge = createTestEdge();
      const stale = edge.indexRead(indexPath(identity.workspaceId, root)) ?? [];
      const staleKeys = stale.map((row) => row.key);
      expect(staleKeys).not.toContain("k2");
      expect(ledgerPath(identity).endsWith(".jsonl")).toBe(true);
      expect(readFileSync(ledgerPath(identity), "utf8")).toContain("k2");
    } finally {
      removeRoot(root);
    }
  });
});
