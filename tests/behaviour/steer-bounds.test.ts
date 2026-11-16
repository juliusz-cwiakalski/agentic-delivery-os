/**
 * TC-STEER-024 and the phase-4 half of TC-STEER-082 — the list caps each group
 * at 8 rows with every omission counted; the machine counts and the human
 * marker agree.
 */
import { describe, expect, test } from "bun:test";
import { dueNotes } from "../fixtures/steer/bounds";
import { makeAppliedOutcome, makeExpiredOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

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

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

const seedDue = (
  harness: ReturnType<typeof createSteerHarness>,
  count: number,
): readonly string[] => {
  const notes = dueNotes(count);
  for (const message of notes) harness.seedMessage(message);
  return notes.map((message) => message.id);
};

describe("TC-STEER-083 a batch above the display cap is fully applied while partially listed", () => {
  for (const count of [1, 20] as const) {
    test(`${String(count)} due notes land and list fully with no omission`, async () => {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
      try {
        const ids = seedDue(harness, count);
        const run = await harness.run(["read"]);
        expect(run.data?.applied).toBe(true);
        expect(notesOf(run.data)).toHaveLength(count);
        expect(run.data?.omitted).toBe(0);
        expect(run.data?.truncated).toBe(false);
        expect(harness.read().outcomes).toHaveLength(count);
        expect(new Set(harness.read().outcomes.map((outcome) => outcome.id))).toEqual(new Set(ids));
      } finally {
        harness.cleanup();
      }
    });
  }

  for (const count of [21, 25] as const) {
    test(`${String(count)} due notes land fully while the payload lists 20`, async () => {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
      try {
        const ids = seedDue(harness, count);
        const run = await harness.run(["read"]);
        expect(run.data?.applied).toBe(true);
        const listed = notesOf(run.data);
        expect(listed).toHaveLength(20);
        expect(run.data?.omitted).toBe(count - 20);
        expect(run.data?.truncated).toBe(true);

        // The landing write is uncapped: one applied outcome per due note, each
        // carrying a complete receipt, including the unlisted notes.
        const outcomes = harness.read().outcomes;
        expect(outcomes).toHaveLength(count);
        for (const outcome of outcomes) {
          expect(outcome.outcome).toBe("applied");
          if (outcome.outcome !== "applied") continue;
          expect(outcome.receipt.origin).toBeDefined();
          expect(outcome.receipt.readReceipt.at.length).toBeGreaterThan(0);
          expect(outcome.receipt.readReceipt.boundary.length).toBeGreaterThan(0);
          expect(outcome.receipt.ttl).toBe(86_400_000);
          expect(outcome.receipt.expiresAt.length).toBeGreaterThan(0);
        }

        // Listed rows are the top N by rank; the union of listed and omitted is
        // exactly the due population, and nothing remains queued.
        const listedIds = new Set(listed.map((note) => note.id));
        const listedRanks = listed.map((note) => Number(note.rank));
        expect(listedRanks).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
        expect(listedIds.size + Number(run.data?.omitted)).toBe(count);
        const list = await harness.run(["list"]);
        const queued = list.data?.queued;
        if (!Array.isArray(queued)) throw new Error("the list answer carries no queued group");
        expect(queued).toHaveLength(0);

        const again = await harness.run(["read"]);
        expect(again.data?.applied).toBe(false);
        expect(notesOf(again.data)).toHaveLength(0);
        expect(again.data?.omitted).toBe(0);
        expect(again.data?.truncated).toBe(false);
        expect(harness.read().outcomes).toHaveLength(count);
      } finally {
        harness.cleanup();
      }
    });
  }
});
