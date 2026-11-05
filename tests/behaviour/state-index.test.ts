/**
 * TC-STATE-007 — the SQLite index is a disposable projection: divergence is
 * detected, rebuilt from verified ledger truth, reported, or fails exactly
 * `state.write.failed` (AC-F3-1, TDR-0004 §4).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

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

  test("a payload-only index divergence is detected and rebuilt to ledger truth", () => {
    const root = makeTempRoot("index-payload-divergence");
    try {
      const identity = makeIdentity(root);
      seed(root);
      const before = ledgerText(identity);
      const edge = createTestEdge();
      const path = indexPath(identity.workspaceId, root);
      const rows = edge.indexRead(path);
      expect(rows).toBeDefined();
      if (rows === undefined) return;
      // Corrupt only the projected payload; the copied checksum, key, kind and
      // sequence still agree with the ledger, so a tuple check that omits the
      // payload would serve this forged value.
      edge.indexWrite(
        path,
        rows.map((row, index) =>
          index === 0 ? { ...row, payload: JSON.stringify("forged-index-value") } : row,
        ),
      );

      const { store } = openStore(identity, { driver: "sqlite", edge });
      const read = store.read({ requiredKeys: ["k1"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ k1: { n: 1 } });
        expect(read.value.evidence.rebuild?.reason).toBe("divergent");
      }
      expect(ledgerText(identity)).toBe(before);
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

/**
 * TC-GH222-012/013 — with only the ledger file, the index rebuilds from verified
 * ledger truth and converges with the `jsonl` verified scan: absent, corrupt, and
 * divergent (altered / deleted / phantom row) fixtures each report the rebuild
 * with the right reason, converge stably, and never mutate the ledger.
 */
describe("TC-GH222-012/013 rebuild from the ledger alone converges with the verified scan", () => {
  const seedIndexed = (
    root: string,
  ): {
    identity: ReturnType<typeof makeIdentity>;
    ledger: string;
    records: readonly { kind: string; key: string; payload: never }[];
  } => {
    const identity = makeIdentity(root);
    const { store } = openStore(identity, { driver: "sqlite" });
    withinFence(store, "w1", (handle) => {
      store.append(handle, { kind: "park", recordKey: "k1", payload: { n: 1 } });
      store.append(handle, { kind: "park", recordKey: "k2", payload: 0 });
    });
    const verified = store.readRecords();
    if (!verified.ok) throw new Error(verified.error.code);
    return {
      identity,
      ledger: readFileSync(ledgerPath(identity), "utf8"),
      records: verified.value.records as readonly {
        kind: string;
        key: string;
        payload: never;
      }[],
    };
  };

  const oracleOf = (
    records: readonly { kind: string; key: string; payload: never }[],
    sourceLedger: string,
  ): { values: Readonly<Record<string, unknown>>; count: number } => {
    const oracleRoot = makeTempRoot("gh222-index-oracle");
    try {
      const identity = makeIdentity(oracleRoot);
      const oracleStore = openStore(identity, { driver: "jsonl" }).store;
      withinFence(oracleStore, "oracle-writer", (handle) => {
        for (const record of records) {
          const appended = oracleStore.append(handle, {
            kind: record.kind,
            recordKey: record.key,
            payload: record.payload,
          });
          expect(appended.ok).toBe(true);
        }
      });
      // The oracle consumes a byte-identical ledger fixture.
      expect(readFileSync(ledgerPath(identity), "utf8")).toBe(sourceLedger);
      const oracle = oracleStore.readRecords();
      if (!oracle.ok) throw new Error(oracle.error.code);
      return {
        values: Object.fromEntries(oracle.value.records.map((row) => [row.key, row.payload])),
        count: oracle.value.records.length,
      };
    } finally {
      removeRoot(oracleRoot);
    }
  };

  const expectConverged = (
    identity: ReturnType<typeof makeIdentity>,
    oracle: { values: Readonly<Record<string, unknown>>; count: number },
    reason: "missing" | "corrupt" | "divergent",
  ): void => {
    const { store } = openStore(identity, { driver: "sqlite" });
    const read = store.read({ requiredKeys: ["k1", "k2"] });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.values).toEqual(oracle.values);
    expect(read.value.evidence.recordCount).toBe(oracle.count);
    expect(read.value.evidence.rebuild?.reason).toBe(reason);

    const again = openStore(identity, { driver: "sqlite" }).store.read({
      requiredKeys: ["k1", "k2"],
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.values).toEqual(oracle.values);
      expect(again.value.evidence.rebuild).toBeUndefined();
    }
  };

  test("absent and corrupt indexes rebuild and converge with the verified scan", () => {
    const root = makeTempRoot("gh222-index-alone");
    try {
      const { identity, ledger, records } = seedIndexed(root);
      const oracle = oracleOf(records, ledger);
      expect(oracle.count).toBe(2);

      rmSync(indexPath(identity.workspaceId, root), { force: true });
      expectConverged(identity, oracle, "missing");
      expect(readFileSync(ledgerPath(identity), "utf8")).toBe(ledger);

      writeFileSync(indexPath(identity.workspaceId, root), "not-a-database");
      expectConverged(identity, oracle, "corrupt");
      expect(readFileSync(ledgerPath(identity), "utf8")).toBe(ledger);
    } finally {
      removeRoot(root);
    }
  });

  test("altered, deleted, and phantom index rows each rebuild and converge", () => {
    const root = makeTempRoot("gh222-index-divergent");
    try {
      const { identity, ledger, records } = seedIndexed(root);
      const oracle = oracleOf(records, ledger);
      const path = indexPath(identity.workspaceId, root);
      const edge = createTestEdge();
      const rows = edge.indexRead(path);
      expect(rows).toBeDefined();
      if (rows === undefined) return;

      const fixtures: Array<[string, typeof rows]> = [
        ["altered", rows.map((row, index) => (index === 1 ? { ...row, key: "k-altered" } : row))],
        ["deleted", rows.slice(1)],
        [
          "phantom",
          [
            ...rows,
            {
              sequence: 99,
              key: "k-phantom",
              kind: "park",
              checksum: rows[0]?.checksum ?? "",
              payload: JSON.stringify("phantom"),
            },
          ],
        ],
      ];
      for (const [label, mutated] of fixtures) {
        edge.indexWrite(path, mutated);
        const read = openStore(identity, { driver: "sqlite", edge }).store.read({
          requiredKeys: ["k1", "k2"],
        });
        expect(read.ok, label).toBe(true);
        if (!read.ok) continue;
        expect(read.value.values, label).toEqual(oracle.values);
        expect(read.value.evidence.rebuild?.reason, label).toBe("divergent");
        expect(read.value.values.k2, label).toBe(0);
      }
      expect(readFileSync(ledgerPath(identity), "utf8")).toBe(ledger);
    } finally {
      removeRoot(root);
    }
  });
});
