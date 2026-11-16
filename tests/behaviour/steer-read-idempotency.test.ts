/**
 * TC-STEER-015/016 — the read point is idempotent in effect, and a resolved note
 * is never re-resolved: at most one outcome per note, ever.
 */
import { describe, expect, test } from "bun:test";
import {
  CREATED,
  makeAppliedOutcome,
  makeExpiredOutcome,
  makeMessage,
  TTL_24H,
} from "../fixtures/steer/cases";
import { createSteerHarness, FIXED_NOW_MS } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-015 an immediate repeat read is inert and byte-stable", () => {
  test("land+expire then re-read appends nothing and reports an empty batch", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      harness.seedMessage(makeMessage({ id: "msg-due-1", created: CREATED }));
      harness.seedMessage(makeMessage({ id: "msg-due-2", created: CREATED, kind: "escalate" }));
      harness.seedMessage(makeMessage({ id: "msg-elapsed", created: "2026-11-14T12:00:00.000Z" }));
      harness.now.ms = FIXED_NOW_MS + 3_600_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const first = await harness.run(["read"]);
      expect(first.data?.applied).toBe(true);
      expect(first.data?.expiry).toEqual({ reason: "ttl-elapsed" });
      expect(harness.read().outcomes).toHaveLength(3);
      const after = harness.ledgerBytes();
      const count = harness.read().recordCount;

      const second = await harness.run(["read"]);
      expect(second.exitCode).toBe(0);
      expect(second.data?.applied).toBe(false);
      expect(notesOf(second.data)).toHaveLength(0);
      expect(Object.hasOwn(second.data ?? {}, "expiry")).toBe(false);
      expect(harness.ledgerBytes().equals(after)).toBe(true);
      expect(harness.read().recordCount).toBe(count);

      const third = await harness.run(["read"]);
      expect(third.stdout).toBe(second.stdout);
      expect(harness.ledgerBytes().equals(after)).toBe(true);

      // A clock advance with no new note changes nothing.
      harness.now.ms += 3_600_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const fourth = await harness.run(["read"]);
      expect(fourth.data?.applied).toBe(false);
      expect(harness.read().outcomes).toHaveLength(3);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-016 resolved notes are never re-resolved", () => {
  test("only the transitioning notes append; every note holds at most one outcome", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const landedA = makeMessage({ id: "msg-landed-a", created: CREATED });
      const landedB = makeMessage({ id: "msg-landed-b", created: CREATED });
      const expired = makeMessage({ id: "msg-expired", created: "2026-11-10T12:00:00.000Z" });
      const due = makeMessage({ id: "msg-due", created: CREATED });
      const elapsed = makeMessage({ id: "msg-elapsed", created: "2026-11-10T12:00:00.000Z" });
      for (const message of [landedA, landedB, expired, due, elapsed]) harness.seedMessage(message);
      harness.seedOutcome(makeAppliedOutcome(landedA));
      harness.seedOutcome(makeAppliedOutcome(landedB));
      harness.seedOutcome(makeExpiredOutcome(expired));
      harness.now.ms = FIXED_NOW_MS + 3_600_000;
      harness.now.iso = new Date(harness.now.ms).toISOString();

      const run = await harness.run(["read"]);
      expect(
        notesOf(run.data)
          .map((note) => note.id)
          .sort(),
      ).toEqual(["msg-due", "msg-elapsed"]);
      expect(harness.read().outcomes).toHaveLength(5);

      const counts = new Map<string, number>();
      for (const outcome of harness.read().outcomes) {
        counts.set(outcome.id, (counts.get(outcome.id) ?? 0) + 1);
      }
      for (const count of counts.values()) expect(count).toBe(1);

      const list = await harness.run(["list"]);
      const landedRows = list.data?.landed;
      const expiredRows = list.data?.expired;
      if (!Array.isArray(landedRows) || !Array.isArray(expiredRows)) {
        throw new Error("the list answer carries no lifecycle groups");
      }
      const landedIds = (landedRows as readonly Record<string, unknown>[]).map((row) => row.id);
      const expiredIds = (expiredRows as readonly Record<string, unknown>[]).map((row) => row.id);
      expect(landedIds.sort()).toEqual(["msg-due", "msg-landed-a", "msg-landed-b"]);
      expect(expiredIds.sort()).toEqual(["msg-elapsed", "msg-expired"]);

      const again = await harness.run(["read"]);
      expect(again.data?.applied).toBe(false);
      expect(harness.read().outcomes).toHaveLength(5);
    } finally {
      harness.cleanup();
    }
  });

  test("a hand-seeded inconsistency (outcome present, note due-shaped) resolves conservatively", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const inconsistent = makeMessage({ id: "msg-inconsistent", created: CREATED });
      harness.seedMessage(inconsistent);
      harness.seedOutcome(makeAppliedOutcome(inconsistent));
      const run = await harness.run(["read"]);
      expect(run.data?.applied).toBe(false);
      expect(notesOf(run.data)).toHaveLength(0);
      expect(harness.read().outcomes).toHaveLength(1);
      const list = await harness.run(["list"]);
      const landed = list.data?.landed;
      if (!Array.isArray(landed)) throw new Error("the list answer carries no landed group");
      expect((landed as readonly Record<string, unknown>[])[0]?.id).toBe("msg-inconsistent");
    } finally {
      harness.cleanup();
    }
  });
});
