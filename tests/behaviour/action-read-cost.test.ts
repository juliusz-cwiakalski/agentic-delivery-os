/**
 * TC-ACTION-030 — read cost: one bounded registry read per invocation, a pure
 * projection, and no per-row re-reads; the bounded-work oracle is the CI gate
 * and the wall-clock median is a reference measurement only (NFR-6, GAP-3).
 */
import { describe, expect, test } from "bun:test";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { fileAction, listActions } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const countingStore = (store: StateStorePort): { store: StateStorePort; reads: () => number } => {
  let reads = 0;
  return {
    store: {
      ...store,
      readRecords: () => {
        reads += 1;
        return store.readRecords();
      },
    } as StateStorePort,
    reads: () => reads,
  };
};

describe("TC-ACTION-030 one bounded read per invocation", () => {
  test("listing a cap-sized registry performs exactly one read", () => {
    const fixture = makeActionStore("read-cost");
    try {
      for (let index = 0; index < 25; index += 1) {
        expect(
          fileAction(fixture.store, conformingDraft({ window: `window-${String(index % 10)}` }), {
            actionId: `action-${String(index)}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
      }
      const counted = countingStore(fixture.store);
      const listed = listActions(counted.store, FILING_MS);
      expect(listed.ok).toBe(true);
      expect(counted.reads()).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test("the projection is pure: no read path writes and the output is stable", () => {
    const fixture = makeActionStore("read-cost-pure");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { filedAt: FILING_MS }).ok).toBe(true);
      const before = fixture.store.readRecords();
      const first = listActions(fixture.store, FILING_MS);
      const second = listActions(fixture.store, FILING_MS);
      expect(first).toEqual(second);
      const after = fixture.store.readRecords();
      expect(
        after.ok && before.ok && after.value.records.length === before.value.records.length,
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test("the reference measurement is recorded, never asserted as a threshold", () => {
    const fixture = makeActionStore("read-cost-reference");
    try {
      for (let index = 0; index < 50; index += 1) {
        expect(
          fileAction(fixture.store, conformingDraft({ window: `window-${String(index % 20)}` }), {
            actionId: `action-${String(index)}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
      }
      const timings: number[] = [];
      for (let run = 0; run < 5; run += 1) {
        const started = performance.now();
        expect(listActions(fixture.store, FILING_MS).ok).toBe(true);
        timings.push(performance.now() - started);
      }
      const sorted = [...timings].sort((left, right) => left - right);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      // Reference measurement only: this is a note, not a passing threshold.
      expect(Number.isFinite(median)).toBe(true);
      expect(sorted.length).toBe(5);
    } finally {
      fixture.cleanup();
    }
  });
});
