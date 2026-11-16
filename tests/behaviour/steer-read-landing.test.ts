/**
 * TC-STEER-010/011/014 — the boundary-open read lands due notes in one batch in
 * the shared rank order with a complete receipt each and exactly one outcome
 * per note, on both open routes.
 */
import { describe, expect, test } from "bun:test";
import { dueNotes } from "../fixtures/steer/bounds";
import { CREATED, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness, FIXED_NOW_MS } from "../fixtures/steer/harness";
import {
  LAST_ENTRY_IN_PROGRESS,
  NO_PHASE_RECORD,
  reorder,
  THREE_COMPLETED,
} from "../fixtures/steer/phase-boundary";

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-010 a due note lands with a complete receipt", () => {
  test("the no-phase-record route lands one note with a non-null receipt", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const message = makeMessage({ id: "msg-landing", created: CREATED });
      harness.seedMessage(message);
      harness.now.ms = FIXED_NOW_MS + 3_600_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const run = await harness.run(["read"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.schemaVersion).toBe("delivery.steer.v1");
      expect(run.data?.boundary).toEqual({
        open: true,
        phase: null,
        phaseUnknownReason: "phase-unrecorded",
      });
      expect(run.data?.applied).toBe(true);
      const notes = notesOf(run.data);
      expect(notes).toHaveLength(1);
      const note = notes[0];
      expect(note?.lifecycle).toBe("landed");
      expect(note?.applied).toBe(true);
      const receipt = note?.receipt as Record<string, unknown> | undefined;
      expect(receipt?.origin).toEqual(message.origin);
      const readReceipt = receipt?.readReceipt;
      if (typeof readReceipt !== "object" || readReceipt === null) {
        throw new Error("the landed receipt carries no readReceipt");
      }
      const receiptView = readReceipt as Record<string, unknown>;
      expect(receiptView.at).toBe(harness.now.iso);
      expect(receiptView.boundary).toBe("phase-unrecorded");
      expect(receipt?.ttl).toBe(86_400_000);
      expect(receipt?.expiresAt).toBe("2026-11-17T12:00:00.000Z");
      const outcomes = harness.read().outcomes;
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]?.outcome).toBe("applied");
      expect(outcomes[0]?.id).toBe("msg-landing");
      expect(harness.read().messages).toEqual([message]);
      expect(harness.session.calls).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-011 the every-entry-completed route reports the latest completion", () => {
  test("the open route derives the latest completed phase and lands the due note", async () => {
    const harness = createSteerHarness({ phase: THREE_COMPLETED });
    try {
      harness.seedMessage(makeMessage({ id: "msg-route", created: CREATED }));
      const run = await harness.run(["read"]);
      expect(run.data?.boundary).toEqual({ open: true, phase: "quality_gates" });
      expect(run.data?.applied).toBe(true);
      expect(harness.read().outcomes).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("reordering the fold does not change the derived phase, and no due note is a clean no-op", async () => {
    const reordered = createSteerHarness({ phase: reorder(THREE_COMPLETED) });
    try {
      reordered.seedMessage(makeMessage({ id: "msg-route", created: CREATED }));
      const run = await reordered.run(["read"]);
      expect(run.data?.boundary).toEqual({ open: true, phase: "quality_gates" });
    } finally {
      reordered.cleanup();
    }
    const empty = createSteerHarness({ phase: THREE_COMPLETED });
    try {
      const run = await empty.run(["read"]);
      expect(run.data?.boundary).toEqual({ open: true, phase: "quality_gates" });
      expect(run.data?.applied).toBe(false);
      expect(notesOf(run.data)).toHaveLength(0);
      expect(empty.read().outcomes).toHaveLength(0);
    } finally {
      empty.cleanup();
    }
  });
});

describe("TC-STEER-014 due notes land in one batch in the shared rank order", () => {
  test("five notes land once, ranked, with one receipt and one outcome each", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const notes = dueNotes(5);
      for (const message of [...notes].reverse()) harness.seedMessage(message);
      const run = await harness.run(["read"]);
      expect(run.data?.applied).toBe(true);
      expect(run.data?.omitted).toBe(0);
      expect(run.data?.truncated).toBe(false);
      const listed = notesOf(run.data);
      expect(listed).toHaveLength(5);
      const expectedOrder = [...notes]
        .sort((left, right) => {
          const classes = { urgent: 1, high: 2, normal: 3, low: 4 } as const;
          const byClass = classes[left.priority] - classes[right.priority];
          if (byClass !== 0) return byClass;
          const byTime = Date.parse(left.created) - Date.parse(right.created);
          if (byTime !== 0) return byTime;
          return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        })
        .map((message) => message.id);
      expect(listed.map((note) => note.id)).toEqual(expectedOrder);
      for (const note of listed) {
        const receipt = note.receipt as Record<string, unknown> | undefined;
        expect(receipt?.readReceipt).toBeDefined();
        expect(receipt?.origin).toBeDefined();
      }
      const outcomes = harness.read().outcomes;
      expect(outcomes).toHaveLength(5);
      expect(new Set(outcomes.map((outcome) => outcome.id))).toEqual(new Set(expectedOrder));
      const again = await harness.run(["read"]);
      expect(again.data?.applied).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("a boundary-closed fold is the closed route, not a landing route", () => {
    expect(LAST_ENTRY_IN_PROGRESS.entries.some((entry) => entry.completed === null)).toBe(true);
  });
});
