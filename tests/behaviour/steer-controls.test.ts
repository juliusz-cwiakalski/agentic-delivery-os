/**
 * TC-STEER-091..095 — the non-vacuity controls: a null receipt member, a silent
 * outcome, a mid-phase landing, an artifact-less completion, and a schema fork
 * are all detected, with a non-vacuity floor on every sweep.
 */
import { describe, expect, test } from "bun:test";
import {
  STEER_KINDS,
  type SteerCompletionRecord,
  type SteerMessageRecord,
  type SteerOutcome,
} from "../../packages/core/src/contracts/index";
import { validateSteerMessage } from "../../packages/core/src/domain/index";
import { dueNotes } from "../fixtures/steer/bounds";
import { CREATED, makeAppliedOutcome, makeCompletion, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { LAST_ENTRY_IN_PROGRESS, NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

const rowsOf = (
  data: Record<string, unknown> | undefined,
  key: string,
): readonly Record<string, unknown>[] =>
  Array.isArray(data?.[key]) ? (data[key] as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-091 the receipt completeness sweep has detection power", () => {
  test("every landed row in the fixture matrix carries all five non-null receipt members", async () => {
    let landedRows = 0;
    for (const count of [1, 2, 5, 21] as const) {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
      try {
        for (const message of dueNotes(count)) harness.seedMessage(message);
        const run = await harness.run(["read"]);
        for (const note of notesOf(run.data)) {
          if (note.lifecycle !== "landed") continue;
          landedRows += 1;
          const receipt = note.receipt as Record<string, unknown> | undefined;
          const readReceipt = receipt?.readReceipt as Record<string, unknown> | undefined;
          expect(receipt?.origin).not.toBeNull();
          expect(receipt?.origin).toBeDefined();
          expect(readReceipt?.at).toBeTruthy();
          expect(readReceipt?.boundary).toBeTruthy();
          expect(receipt?.ttl).toBeTruthy();
          expect(receipt?.expiresAt).toBeTruthy();
        }
        // The store's applied outcomes carry the same receipt invariant.
        for (const outcome of harness.read().outcomes) {
          if (outcome.outcome !== "applied") continue;
          expect(outcome.receipt.origin).toBeDefined();
          expect(outcome.receipt.readReceipt.at).toBeTruthy();
          expect(outcome.receipt.readReceipt.boundary).toBeTruthy();
          expect(outcome.receipt.ttl).toBeTruthy();
          expect(outcome.receipt.expiresAt).toBeTruthy();
        }
      } finally {
        harness.cleanup();
      }
    }
    expect(landedRows).toBeGreaterThan(0);
  });
});

describe("TC-STEER-092 no note can be queued and invisible", () => {
  test("the union of the three groups equals the message population, and empty is distinguishable from unreadable", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const orphan = makeMessage({ id: "msg-orphan", created: CREATED });
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      const completed = makeMessage({ id: "msg-completed", created: CREATED });
      const expired = makeMessage({ id: "msg-expired", created: "2026-11-10T12:00:00.000Z" });
      for (const message of [orphan, landed, completed, expired]) harness.seedMessage(message);
      harness.seedOutcome(makeAppliedOutcome(landed));
      harness.seedOutcome(makeAppliedOutcome(completed));
      harness.seedCompletion(makeCompletion(completed.id));
      harness.seedOutcome({
        schemaId: "delivery.steering.outcome.v1",
        id: expired.id,
        outcome: "expired",
        recordedAt: harness.now.iso,
        reason: "ttl-elapsed",
      });
      const list = await harness.run(["list"]);
      const ids = new Set<string>();
      for (const group of ["queued", "landed", "expired"] as const) {
        for (const row of rowsOf(list.data, group)) ids.add(String(row.id));
      }
      expect(ids).toEqual(new Set(["msg-orphan", "msg-landed", "msg-completed", "msg-expired"]));
      expect(rowsOf(list.data, "queued").map((row) => row.id)).toEqual(["msg-orphan"]);

      const read = await harness.run(["read"]);
      expect(notesOf(read.data).map((note) => note.id)).toEqual(["msg-orphan"]);
    } finally {
      harness.cleanup();
    }

    const empty = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const run = await empty.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.queued).toEqual([]);
    } finally {
      empty.cleanup();
    }
    const unreadable = createSteerHarness({ storeMode: "unreadable" });
    try {
      const run = await unreadable.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect((run.envelope?.error as Record<string, unknown> | undefined)?.code).toBe(
        "steer.queue-unavailable",
      );
    } finally {
      unreadable.cleanup();
    }
  });
});

describe("TC-STEER-093 landing during an open phase fails and no session op occurs", () => {
  test("three reads with an advancing clock never land a mid-phase note", async () => {
    const harness = createSteerHarness({ phase: LAST_ENTRY_IN_PROGRESS });
    try {
      const due = makeMessage({ id: "msg-due", created: CREATED });
      harness.seedMessage(due);
      for (const tick of [0, 3_600_000, 7_200_000]) {
        harness.now.ms += tick;
        harness.now.iso = new Date(harness.now.ms).toISOString();
        const run = await harness.run(["read"]);
        expect(run.data?.boundary).toEqual({ open: false, phase: "review_fix" });
        expect(harness.read().outcomes).toHaveLength(0);
        expect(notesOf(run.data)[0]?.pendingReason).toBe("phase-in-progress");
      }
      expect(harness.session.calls).toEqual([]);
    } finally {
      harness.cleanup();
    }
    // The derivation is from the records: the same note lands when no record exists.
    const open = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      open.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
      expect((await open.run(["read"])).data?.applied).toBe(true);
    } finally {
      open.cleanup();
    }
  });
});

describe("TC-STEER-094 artifact-less completions are impossible", () => {
  test("every stored completion carries an artifact and the referenced note carries an applied outcome", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      expect(
        (await harness.run(["complete", "msg-landed", "--ref", "doc/proof.md"])).exitCode,
      ).toBe(0);
      const completions: readonly SteerCompletionRecord[] = harness.read().completions;
      expect(completions.length).toBeGreaterThan(0);
      const applied = new Set(
        harness
          .read()
          .outcomes.filter((outcome: SteerOutcome) => outcome.outcome === "applied")
          .map((outcome) => outcome.id),
      );
      for (const completion of completions) {
        expect(completion.artifact.trim().length).toBeGreaterThan(0);
        expect(completion.completedAt.length).toBeGreaterThan(0);
        expect(applied.has(completion.id)).toBe(true);
      }
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-095 a schema fork is a red gate in both directions", () => {
  test("an owner-specific field and an owner-only vocabulary member are rejected", () => {
    const record: SteerMessageRecord = makeMessage();
    const forked = { ...record, ownerNoteId: "note-1" };
    const fieldVerdict = validateSteerMessage(forked);
    expect(fieldVerdict.ok).toBe(false);
    if (!fieldVerdict.ok) expect(fieldVerdict.field).toBe("ownerNoteId");
    const memberVerdict = validateSteerMessage({ ...record, kind: "steer" });
    expect(memberVerdict.ok).toBe(false);
    if (!memberVerdict.ok) expect(memberVerdict.field).toBe("kind");
    expect((STEER_KINDS as readonly string[]).includes("steer")).toBe(false);
    // The paired assertion stays independently load-bearing: a legal shared
    // member still validates.
    expect(validateSteerMessage({ ...record, kind: "notify" }).ok).toBe(true);
  });
});
