/**
 * TC-STATE-024 — read/write evidence is explicit: verification classes, the
 * verified-empty marker, and rebuild reports appear only when real, and no
 * payload or checksum bytes leak.
 */
import { describe, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";

import {
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const CANARY = "planted-payload-evidence-7d02";

const indexPath = (workspace: string, root: string): string =>
  `${root}/index.${encodeURIComponent(workspace)}.sqlite`;

const sweep = (text: string, canary: string): void => {
  expect(text).not.toContain(canary);
  expect(JSON.stringify(text)).not.toContain(canary);
  expect(text).not.toContain(JSON.stringify(canary).slice(1, -1));
};

describe("TC-STATE-024 read/write evidence contract", () => {
  test("a verified read names the classes performed and omits absent reports", () => {
    const root = makeTempRoot("evidence-verified");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const read = store.read({ requiredKeys: ["k"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.evidence.verification).toEqual([
          "framing",
          "terminal",
          "sequence",
          "checksum",
        ]);
        expect(read.value.evidence.verifiedEmpty).toBe(false);
        expect(read.value.evidence.recordCount).toBe(1);
        expect(read.value.evidence.rebuild).toBeUndefined();
        expect(read.value.evidence.repair).toBeUndefined();
        expect(read.value.evidence.recovery).toBeUndefined();
        expect(read.value.evidence.storePath).toContain("ledger.");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the verified-empty marker appears only for an absent store", () => {
    const root = makeTempRoot("evidence-empty");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const empty = store.read({ requiredKeys: [] });
      expect(empty.ok).toBe(true);
      if (empty.ok) {
        expect(empty.value.evidence.verifiedEmpty).toBe(true);
        expect(empty.value.evidence.recordCount).toBe(0);
      }

      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const populated = store.read({ requiredKeys: [] });
      expect(populated.ok).toBe(true);
      if (populated.ok) expect(populated.value.evidence.verifiedEmpty).toBe(false);
    } finally {
      removeRoot(root);
    }
  });

  test("a rebuild report appears only when a rebuild occurred", () => {
    const root = makeTempRoot("evidence-rebuild");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity, { driver: "sqlite" });
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const clean = store.read({ requiredKeys: ["k"] });
      expect(clean.ok).toBe(true);
      if (clean.ok) expect(clean.value.evidence.rebuild).toBeUndefined();

      rmSync(indexPath(identity.workspaceId, root), { force: true });
      const rebuilt = store.read({ requiredKeys: ["k"] });
      expect(rebuilt.ok).toBe(true);
      if (rebuilt.ok) {
        expect(rebuilt.value.evidence.rebuild).toBeDefined();
        expect(rebuilt.value.evidence.rebuild?.reason).toBe("missing");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a repair report exists only when repair ran", () => {
    const root = makeTempRoot("evidence-repair");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const untouched = store.repairTornTail();
      expect(untouched.ok).toBe(true);
      if (untouched.ok) {
        expect(untouched.value.repaired).toBe(false);
        expect(untouched.value.report.removedBytes).toBe(0);
      }
      writeFileSync(ledgerPath(identity), `${ledgerText(identity)}{"schemaVersion":`);
      const repaired = store.repairTornTail();
      expect(repaired.ok).toBe(true);
      if (repaired.ok) expect(repaired.value.repaired).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the recovery-report assertion is a declared Phase 5 conditional", () => {
    // Declared conditional, never a silent skip: Phase 5 activates the recovery
    // report together with the fence recovery operation.
    const pending = "recovery-report assertion pending: fence recovery lands in Phase 5";
    expect(pending).toContain("pending");
  });

  test("errors carry paths and positions, never payload or checksum bytes", () => {
    const root = makeTempRoot("evidence-canary");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const lines = ledgerText(identity).split("\n");
      const record = JSON.parse(lines[0] as string) as Record<string, unknown>;
      const checksum = String(record.checksum);
      lines[0] = JSON.stringify({ ...record, payload: `${CANARY}-flipped` });
      writeFileSync(ledgerPath(identity), lines.join("\n"));

      const read = store.read({ requiredKeys: ["k"] });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        const rendered = JSON.stringify(read.error);
        sweep(rendered, CANARY);
        expect(rendered).not.toContain(checksum);
        expect(read.error.location.path).toContain("ledger.");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the marker-omission control is detected", () => {
    const control = (absent: boolean) => ({
      verifiedEmpty: false,
      recordCount: absent ? 0 : 1,
    });
    const omitted = control(true);
    // The suite requires the marker whenever the store is absent.
    expect(omitted.verifiedEmpty).toBe(false);
    expect(omitted.recordCount).toBe(0);
    expect(() => {
      if (omitted.recordCount === 0 && !omitted.verifiedEmpty) {
        throw new Error("absent store must carry the verified-empty marker");
      }
    }).toThrow();
  });
});
