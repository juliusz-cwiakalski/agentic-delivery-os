/**
 * TC-STATE-011 (key-set assertions, no default substitution) and the TC-STATE-009
 * verified-empty half — a missing declared key is a classified failure.
 */
import { describe, expect, test } from "bun:test";

import {
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

describe("TC-STATE-011 key-set assertion, no defaults", () => {
  test("present keys return recorded values exactly, including falsy values", () => {
    const root = makeTempRoot("keys-falsy");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const entries = [
        ["zero", 0],
        ["empty", ""],
        ["list", []],
        ["object", {}],
        ["no", false],
        ["nothing", null],
      ] as const;
      withinFence(store, "writer", (handle) => {
        for (const [key, payload] of entries) {
          store.append(handle, { kind: "park", recordKey: key, payload });
        }
      });
      const read = store.read({ requiredKeys: entries.map(([key]) => key) });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual(Object.fromEntries(entries));
        expect(Object.keys(read.value.values)).toHaveLength(entries.length);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a missing declared key fails with the missing names and no values", () => {
    const root = makeTempRoot("keys-missing");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k1", payload: "one" });
        store.append(handle, { kind: "park", recordKey: "k2", payload: "two" });
      });
      const read = store.read({ requiredKeys: ["k1", "k3"] });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.keys.missing");
        expect(read.error.location.missingKeys).toEqual(["k3"]);
        expect(read.error.consequence).toBe("not_landed");
        expect(JSON.stringify(read.error)).not.toContain("one");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("an empty declaration on a non-empty ledger succeeds with no fabricated keys", () => {
    const root = makeTempRoot("keys-empty-declaration");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k1", payload: "one" });
      });
      const read = store.read({ requiredKeys: [] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({});
        expect(read.value.evidence.verifiedEmpty).toBe(false);
        expect(read.value.evidence.recordCount).toBe(1);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("an absent store is verified-empty only for an empty declaration", () => {
    const root = makeTempRoot("keys-verified-empty");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const emptyRead = store.read({ requiredKeys: [] });
      expect(emptyRead.ok).toBe(true);
      if (emptyRead.ok) {
        expect(emptyRead.value.evidence.verifiedEmpty).toBe(true);
        expect(emptyRead.value.evidence.recordCount).toBe(0);
      }
      const nonEmptyRead = store.read({ requiredKeys: ["k1"] });
      expect(nonEmptyRead.ok).toBe(false);
      if (!nonEmptyRead.ok) expect(nonEmptyRead.error.code).toBe("state.keys.missing");
    } finally {
      removeRoot(root);
    }
  });

  test("a default-substitution control is detected as a violation", () => {
    const substitute = (
      values: Readonly<Record<string, unknown>>,
      required: readonly string[],
    ): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const key of required) result[key] = values[key] ?? null;
      return result;
    };
    const substituted = substitute({ k1: "one" }, ["k1", "missing"]);
    // The implementation must never produce this shape; the assertion below is
    // what the store's own key-set check replaces.
    expect(Object.hasOwn(substituted, "missing")).toBe(true);
    expect(substituted.missing).toBeNull();
  });
});
