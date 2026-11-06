/**
 * TC-GH223-041 — the `startedAt` window is inclusive `[from, to]`, an omitted
 * side is unbounded, and empty windows are verified-empty (never an error).
 */
import { describe, expect, test } from "bun:test";
import { readAuditLedger } from "../../packages/core/src/state/index";
import { makeAuditStore, removeRoot, seedAuditPairs } from "../fixtures/state/harness";

const startedAtOf = (read: ReturnType<typeof readAuditLedger>): readonly number[] | undefined =>
  read.ok ? read.value.records.map((record) => record.startedAt) : undefined;

describe("TC-GH223-041 inclusive startedAt window", () => {
  test("both boundary records are included and empty windows are verified-empty", () => {
    const fixture = makeAuditStore("time-window");
    try {
      seedAuditPairs(fixture.store, 4, (index) => ({
        startedAt: 1000 + index * 1000,
        command: "status",
      }));

      expect(
        startedAtOf(readAuditLedger(fixture.store, { limit: 10, from: 2000, to: 3000 })),
      ).toEqual([2000, 3000]);
      expect(
        startedAtOf(readAuditLedger(fixture.store, { limit: 10, from: 1001, to: 2999 })),
      ).toEqual([2000]);
      const emptyLow = readAuditLedger(fixture.store, { limit: 10, from: 0, to: 500 });
      expect(emptyLow.ok).toBe(true);
      if (emptyLow.ok) {
        expect(emptyLow.value.verifiedEmpty).toBe(true);
        expect(emptyLow.value.records).toEqual([]);
        expect(emptyLow.value.chain.verified).toBe(true);
      }
      const emptyHigh = readAuditLedger(fixture.store, { limit: 10, from: 4500, to: 5000 });
      expect(emptyHigh.ok && emptyHigh.value.verifiedEmpty).toBe(true);

      expect(startedAtOf(readAuditLedger(fixture.store, { limit: 10, from: 2500 }))).toEqual([
        3000, 4000,
      ]);
      expect(startedAtOf(readAuditLedger(fixture.store, { limit: 10, to: 2500 }))).toEqual([
        1000, 2000,
      ]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the window composes with scope and the bound, with in-band truncation", () => {
    const fixture = makeAuditStore("time-window-compose");
    try {
      seedAuditPairs(fixture.store, 5, (index) => ({
        startedAt: 1000 + index * 1000,
        command: "status",
        scope: index === 3 ? "workspace-b" : "workspace-a",
      }));
      const read = readAuditLedger(fixture.store, {
        limit: 2,
        from: 1500,
        to: 5500,
        scope: "workspace-a",
      });
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.records.map((record) => record.startedAt)).toEqual([2000, 3000]);
      expect(read.value.matched).toBe(3);
      expect(read.value.truncated).toBe(true);
      expect(read.value.records.every((record) => record.outcomeClass === "success")).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("reservations never appear as results", () => {
    const fixture = makeAuditStore("time-window-kinds");
    try {
      seedAuditPairs(fixture.store, 2, (index) => ({ startedAt: 1000 + index * 1000 }));
      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.records.map((record) => record.auditSeq)).toEqual([1, 2]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
