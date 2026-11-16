/**
 * TC-STEER-013 — a boundary-closed read declines: every note reads pending with
 * the classified reason, nothing appends, the tree is unchanged, and the asks
 * survive the decline.
 */
import { describe, expect, test } from "bun:test";
import { asksWith, ownerAsk } from "../fixtures/steer/ask-matrix";
import { CREATED, makeMessage, TTL_24H } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { LAST_ENTRY_IN_PROGRESS } from "../fixtures/steer/phase-boundary";

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-013 the closed boundary takes precedence over expiry", () => {
  test("every note reads pending, nothing appends, and asks remain", async () => {
    const harness = createSteerHarness({
      phase: LAST_ENTRY_IN_PROGRESS,
      asks: asksWith({ facts: [ownerAsk({ id: "q-open" })] }),
    });
    try {
      harness.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
      harness.seedMessage(makeMessage({ id: "msg-near", created: CREATED, kind: "escalate" }));
      harness.seedMessage(
        makeMessage({ id: "msg-old", created: "2026-11-15T10:00:00.000Z", ttl: TTL_24H }),
      );
      const before = harness.ledgerBytes();
      const run = await harness.run(["read"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.boundary).toEqual({ open: false, phase: "review_fix" });
      expect(run.data?.applied).toBe(false);
      expect(Object.hasOwn(run.data ?? {}, "expiry")).toBe(false);
      const notes = notesOf(run.data);
      expect(notes).toHaveLength(3);
      for (const note of notes) {
        expect(note.applied).toBe(false);
        expect(note.lifecycle).toBe("queued");
        expect(note.pendingReason).toBe("phase-in-progress");
        expect(note.receipt).toBeUndefined();
        expect(note.expiry).toBeUndefined();
      }
      expect(harness.read().outcomes).toHaveLength(0);
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      const asks = run.data?.asks;
      if (!Array.isArray(asks)) throw new Error("the read answer carries no asks");
      expect(asks).toHaveLength(1);

      // A closed boundary still declines after every ttl has elapsed: nothing
      // is resolved off-boundary by patience.
      harness.now.ms += TTL_24H * 2;
      harness.now.iso = new Date(harness.now.ms).toISOString();
      const later = await harness.run(["read"]);
      expect(later.data?.boundary).toEqual({ open: false, phase: "review_fix" });
      expect(harness.read().outcomes).toHaveLength(0);
      expect(harness.ledgerBytes().equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});
