/**
 * TC-STEER-020/021/022 — measured aging on every surface, the shared rank with
 * contiguous 1..N ranks over the full set, and order derived at every read.
 */
import { describe, expect, test } from "bun:test";
import type { SteerMessageRecord } from "../../packages/core/src/contracts/index";
import { rankSteerMessages } from "../../packages/core/src/domain/index";
import { CREATED, makeAppliedOutcome, makeMessage, rankMatrix } from "../fixtures/steer/cases";
import { createSteerHarness, FIXED_NOW_MS } from "../fixtures/steer/harness";

const rows = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? (value as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-020 age is measured from the injected clock", () => {
  test("list and read derive age from the clock and the store never changes", async () => {
    const harness = createSteerHarness();
    try {
      harness.seedMessage(makeMessage({ id: "msg-aged", created: CREATED }));
      harness.now.ms = FIXED_NOW_MS + 90_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const before = harness.ledgerBytes();
      const list = await harness.run(["list"]);
      expect(list.exitCode).toBe(0);
      expect(rows(list.data?.queued)[0]?.age).toBe(90_000);
      expect(harness.ledgerBytes().equals(before)).toBe(true);

      harness.now.ms += 30_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const later = await harness.run(["list"]);
      expect(rows(later.data?.queued)[0]?.age).toBe(120_000);
      expect(harness.ledgerBytes().equals(before)).toBe(true);

      const read = await harness.run(["read"]);
      expect(read.exitCode).toBe(0);
      expect(rows(read.data?.notes)[0]?.age).toBe(120_000);
    } finally {
      harness.cleanup();
    }
  });

  test("age is a non-negative integer of milliseconds on the machine surface", async () => {
    const harness = createSteerHarness();
    try {
      harness.seedMessage(
        makeMessage({ id: "msg-future", created: new Date(FIXED_NOW_MS + 60_000).toISOString() }),
      );
      const list = await harness.run(["list"]);
      const age = rows(list.data?.queued)[0]?.age;
      expect(typeof age).toBe("number");
      expect(Number.isInteger(age)).toBe(true);
      expect(age).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-021 the shared rank and contiguous full-set ranks", () => {
  test("the emitted order and ranks match the independently computed key", () => {
    const matrix = rankMatrix();
    const expected = [...matrix].sort((left, right) => {
      const classes = { urgent: 1, high: 2, normal: 3, low: 4 } as const;
      const byClass = classes[left.priority] - classes[right.priority];
      if (byClass !== 0) return byClass;
      const byTime = Date.parse(left.created) - Date.parse(right.created);
      if (byTime !== 0) return byTime;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
    const ranked = rankSteerMessages(matrix);
    expect(ranked.map((entry) => entry.record.id)).toEqual(expected.map((entry) => entry.id));
    expect(ranked.map((entry) => entry.rank)).toEqual(
      Array.from({ length: matrix.length }, (_, index) => index + 1),
    );
  });

  test("the list view preserves the full-set rank order and the id tie-break", async () => {
    const matrix = rankMatrix();
    const forward = createSteerHarness();
    try {
      for (const message of matrix) forward.seedMessage(message);
      const list = await forward.run(["list"]);
      const visible = rows(list.data?.queued);
      expect(visible).toHaveLength(8);
      const expected = rankSteerMessages(matrix).map((entry) => entry.record.id);
      expect(visible.map((row) => row.id)).toEqual(expected.slice(0, 8));
      expect(visible.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(list.data?.omitted).toBe(matrix.length - 8);
      expect(list.data?.truncated).toBe(true);
      // The two identical-timestamp notes keep the id-ascending tie-break.
      const tied = rankSteerMessages(matrix)
        .map((entry) => entry.record.id)
        .filter((id) => id.startsWith("msg-tie-"));
      expect(tied).toEqual(["msg-tie-a", "msg-tie-b"]);
    } finally {
      forward.cleanup();
    }
  });

  test("reversing the store order does not change the emitted order", async () => {
    const matrix = rankMatrix();
    const forward = createSteerHarness();
    const reversed = createSteerHarness();
    try {
      for (const message of matrix) forward.seedMessage(message);
      for (const message of [...matrix].reverse()) reversed.seedMessage(message);
      const first = await forward.run(["list"]);
      const second = await reversed.run(["list"]);
      expect(rows(second.data?.queued).map((row) => row.id)).toEqual(
        rows(first.data?.queued).map((row) => row.id),
      );
      expect(second.data?.omitted).toBe(first.data?.omitted);
    } finally {
      forward.cleanup();
      reversed.cleanup();
    }
  });
});

describe("TC-STEER-022 order is derived at every read and never stored", () => {
  test("no record carries rank, age, or a stored lifecycle field", async () => {
    const harness = createSteerHarness();
    try {
      const seeded = [
        makeMessage({ id: "msg-a", created: CREATED }),
        makeMessage({ id: "msg-b", priority: "urgent", created: CREATED }),
      ];
      for (const message of seeded) harness.seedMessage(message);
      await harness.run(["list"]);
      for (const message of harness.read().messages) {
        const keys = Object.keys(message);
        expect(keys).not.toContain("rank");
        expect(keys).not.toContain("age");
        expect(keys).not.toContain("lifecycle");
      }
      const lines = harness
        .ledgerText()
        .split("\n")
        .filter((line) => line.length > 0);
      for (const line of lines) {
        const parsed = JSON.parse(line) as { readonly payload?: Record<string, unknown> };
        if (parsed.payload === undefined) continue;
        expect(Object.hasOwn(parsed.payload, "rank")).toBe(false);
        if (parsed.payload.schemaId === "delivery.steering.message.v1") {
          expect(Object.hasOwn(parsed.payload, "age")).toBe(false);
          expect(Object.hasOwn(parsed.payload, "lifecycle")).toBe(false);
        }
      }
    } finally {
      harness.cleanup();
    }
  });

  test("a landed note keeps the stable rank after a second read", async () => {
    const harness = createSteerHarness();
    try {
      const message = makeMessage({ id: "msg-landing", created: CREATED });
      harness.seedMessage(message);
      harness.seedOutcome(makeAppliedOutcome(message));
      const first = await harness.run(["list"]);
      const second = await harness.run(["list"]);
      expect(rows(first.data?.landed)[0]?.rank).toBe(rows(second.data?.landed)[0]?.rank);
      expect(harness.read().messages).toEqual([message]);
    } finally {
      harness.cleanup();
    }
  });
});

export type { SteerMessageRecord };
