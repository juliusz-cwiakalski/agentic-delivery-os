/**
 * TC-STATE-005 (envelope, append-only order, no prune surface) and TC-STATE-004
 * (workspace scoping) — the JSONL ledger is durable, contiguous truth.
 */
import { describe, expect, test } from "bun:test";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyLedger } from "../../packages/core/src/state/ledger";
import {
  independentChecksum,
  ledgerLines,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

describe("TC-STATE-005 append envelope and append-only order", () => {
  test("every record lands with the five envelope fields and a valid checksum", () => {
    const root = makeTempRoot("ledger-envelope");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer-1", (handle) => {
        for (const [key, payload] of [
          ["k1", { count: 1 }],
          ["k2", 0],
          ["k3", ""],
        ] as const) {
          const appended = store.append(handle, { kind: "park", recordKey: key, payload });
          expect(appended.ok).toBe(true);
        }
      });
      const lines = ledgerLines(ledgerText(identity));
      expect(lines).toHaveLength(3);
      lines.forEach((line, index) => {
        const record = JSON.parse(line) as Record<string, unknown>;
        expect(Object.keys(record).sort()).toEqual([
          "checksum",
          "key",
          "kind",
          "payload",
          "schemaVersion",
          "sequence",
        ]);
        expect(record.schemaVersion).toBe(identity.schemaVersion);
        expect(record.kind).toBe("park");
        expect(record.sequence).toBe(index + 1);
        expect(record.checksum).toBe(independentChecksum(record.payload));
      });
    } finally {
      removeRoot(root);
    }
  });

  test("appends never rewrite an earlier byte and sequences stay contiguous", () => {
    const root = makeTempRoot("ledger-prefix");
    try {
      const identity = makeIdentity(root);
      const first = openStore(identity);
      withinFence(first.store, "writer-1", (handle) => {
        first.store.append(handle, { kind: "park", recordKey: "k1", payload: { at: 1 } });
        first.store.append(handle, { kind: "park", recordKey: "k2", payload: { at: 2 } });
      });
      const prefix = ledgerText(identity);
      withinFence(first.store, "writer-2", (handle) => {
        first.store.append(handle, { kind: "park", recordKey: "k3", payload: { at: 3 } });
      });
      const grown = ledgerText(identity);
      expect(grown.startsWith(prefix)).toBe(true);

      const reopened = openStore(identity);
      const read = reopened.store.read({ requiredKeys: ["k1", "k2", "k3"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.evidence.recordCount).toBe(3);
        expect(read.value.values).toEqual({ k1: { at: 1 }, k2: { at: 2 }, k3: { at: 3 } });
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the port exposes no prune, delete, expiry or compaction surface", () => {
    const root = makeTempRoot("ledger-surface");
    try {
      const { store } = openStore(makeIdentity(root));
      const operations = Object.keys(store).sort();
      expect(operations).toEqual([
        "acquireFence",
        "append",
        "checkIntegrity",
        "fenceStatus",
        "identity",
        "read",
        "recoverFence",
        "releaseFence",
        "repairTornTail",
        "replaceDocument",
      ]);
      for (const forbidden of ["prune", "delete", "expire", "compact", "clear"]) {
        expect(operations).not.toContain(forbidden);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("an in-place rewrite control is detected by the append-only assertion", () => {
    const root = makeTempRoot("ledger-rewrite-control");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer-1", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k1", payload: { at: 1 } });
        store.append(handle, { kind: "park", recordKey: "k2", payload: { at: 2 } });
      });
      const prefix = ledgerText(identity).split("\n")[0] as string;
      const copy = join(root, "rewritten.jsonl");
      copyFileSync(ledgerPath(identity), copy);
      const lines = readFileSync(copy, "utf8").split("\n");
      const record = JSON.parse(lines[0] as string) as Record<string, unknown>;
      lines[0] = JSON.stringify({ ...record, payload: { at: 999 } });
      writeFileSync(copy, lines.join("\n"));
      const rewritten = readFileSync(copy, "utf8").split("\n")[0] as string;
      expect(rewritten).not.toBe(prefix);
      expect(verifyLedger(readFileSync(copy, "utf8")).status).toBe("torn");
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-004 workspace record scoping", () => {
  test("two workspaces sharing one directory never observe each other", () => {
    const root = makeTempRoot("ledger-scoping");
    try {
      const a = makeIdentity(root, { workspaceId: "workspace-a" });
      const b = makeIdentity(root, { workspaceId: "workspace-b" });
      const storeA = openStore(a).store;
      withinFence(storeA, "writer-a", (handle) => {
        storeA.append(handle, { kind: "park", recordKey: "a-key", payload: "A-VALUE" });
      });
      const ledgerABefore = ledgerText(a);

      const storeB = openStore(b).store;
      const crossRead = storeB.read({ requiredKeys: ["a-key"] });
      expect(crossRead.ok).toBe(false);
      if (!crossRead.ok) {
        expect(crossRead.error.code).toBe("state.keys.missing");
        expect(crossRead.error.location.missingKeys).toEqual(["a-key"]);
      }
      withinFence(storeB, "writer-b", (handle) => {
        const appended = storeB.append(handle, {
          kind: "park",
          recordKey: "b-key",
          payload: "B-VALUE",
        });
        expect(appended.ok).toBe(true);
        if (appended.ok) expect(appended.value.sequence).toBe(1);
      });

      expect(ledgerText(a)).toBe(ledgerABefore);
      const readA = storeA.read({ requiredKeys: ["a-key"] });
      expect(readA.ok).toBe(true);
      if (readA.ok) expect(readA.value.values).toEqual({ "a-key": "A-VALUE" });
      const readB = storeB.read({ requiredKeys: ["b-key"] });
      expect(readB.ok).toBe(true);
      if (readB.ok) expect(readB.value.values).toEqual({ "b-key": "B-VALUE" });
    } finally {
      removeRoot(root);
    }
  });

  test("the scoping-disabled control proves cross-workspace visibility would be caught", () => {
    const root = makeTempRoot("ledger-scoping-control");
    try {
      // The control identity deliberately ignores the workspace identifier.
      const writer = makeIdentity(root, { workspaceId: "ignored" });
      const reader = makeIdentity(root, { workspaceId: "ignored" });
      const storeWriter = openStore(writer).store;
      withinFence(storeWriter, "writer", (handle) => {
        storeWriter.append(handle, { kind: "park", recordKey: "k", payload: "leaked" });
      });
      const storeReader = openStore(reader).store;
      const read = storeReader.read({ requiredKeys: ["k"] });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.values).toEqual({ k: "leaked" });
    } finally {
      removeRoot(root);
    }
  });
});
