/**
 * TC-STEER-024 and the phase-4 half of TC-STEER-082 — the list caps each group
 * at 8 rows with every omission counted; the machine counts and the human
 * marker agree.
 */
import { describe, expect, test } from "bun:test";
import { makeAppliedOutcome, makeExpiredOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";

const rows = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? (value as readonly Record<string, unknown>[]) : [];

const seedGroup = (
  harness: ReturnType<typeof createSteerHarness>,
  group: "queued" | "landed" | "expired",
  count: number,
): void => {
  for (let index = 0; index < count; index += 1) {
    const message = makeMessage({
      id: `msg-${group}-${String(index).padStart(2, "0")}`,
      created: new Date(Date.parse("2026-11-16T08:00:00.000Z") + index * 60_000).toISOString(),
    });
    harness.seedMessage(message);
    if (group === "landed") harness.seedOutcome(makeAppliedOutcome(message));
    if (group === "expired") harness.seedOutcome(makeExpiredOutcome(message));
  }
};

describe("TC-STEER-024 the list caps each group at eight with counted omissions", () => {
  test("the 8/8/8 at-cap twin renders without an omission", async () => {
    const harness = createSteerHarness();
    try {
      seedGroup(harness, "queued", 8);
      seedGroup(harness, "landed", 8);
      seedGroup(harness, "expired", 8);
      const run = await harness.run(["list"]);
      expect(rows(run.data?.queued)).toHaveLength(8);
      expect(rows(run.data?.landed)).toHaveLength(8);
      expect(rows(run.data?.expired)).toHaveLength(8);
      expect(run.data?.omitted).toBe(0);
      expect(run.data?.truncated).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("the 9/9/9 over-cap cell renders eight per group with three counted", async () => {
    const harness = createSteerHarness();
    try {
      seedGroup(harness, "queued", 9);
      seedGroup(harness, "landed", 9);
      seedGroup(harness, "expired", 9);
      const run = await harness.run(["list"]);
      expect(rows(run.data?.queued)).toHaveLength(8);
      expect(rows(run.data?.landed)).toHaveLength(8);
      expect(rows(run.data?.expired)).toHaveLength(8);
      expect(run.data?.omitted).toBe(3);
      expect(run.data?.truncated).toBe(true);
      const human = await harness.run(["list"], { json: false });
      expect(human.stdout).toContain("+3 more notes omitted");
      // Ranks are the full-set ranks; the ninth row of each group is dropped,
      // never renumbered.
      for (const group of ["queued", "landed", "expired"] as const) {
        const visible = rows(run.data?.[group]);
        const ranks = visible.map((row) => Number(row.rank));
        expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
        expect(new Set(ranks).size).toBe(8);
      }
    } finally {
      harness.cleanup();
    }
  });
});
