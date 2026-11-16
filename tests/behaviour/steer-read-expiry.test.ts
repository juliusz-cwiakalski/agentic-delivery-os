/**
 * TC-STEER-012/017/018 — ttl elapsed at a boundary-open read is a classified
 * non-applied outcome recorded once, judged by the inclusive predicate on the
 * injected clock, with total payload facts over all four shapes.
 */
import { describe, expect, test } from "bun:test";
import { steerTtlElapsed } from "../../packages/core/src/domain/index";
import { CREATED, makeMessage, TTL_24H } from "../fixtures/steer/cases";
import { createSteerHarness, FIXED_NOW_MS } from "../fixtures/steer/harness";
import { LAST_ENTRY_IN_PROGRESS, NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const notesOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.notes) ? (data.notes as readonly Record<string, unknown>[]) : [];

const atOffset = (harness: ReturnType<typeof createSteerHarness>, deltaMs: number): void => {
  harness.now.ms = FIXED_NOW_MS + deltaMs;
  harness.now.iso = new Date(harness.now.ms).toISOString();
};

describe("TC-STEER-012 ttl elapsed records a classified non-applied outcome", () => {
  test("at the exact +0 boundary the note is expired with data.applied false", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      harness.seedMessage(makeMessage({ id: "msg-expired", created: CREATED }));
      atOffset(harness, TTL_24H);
      const run = await harness.run(["read"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.applied).toBe(false);
      expect(run.data?.expiry).toEqual({ reason: "ttl-elapsed" });
      const [note] = notesOf(run.data);
      expect(note?.applied).toBe(false);
      expect(note?.lifecycle).toBe("expired");
      expect(note?.receipt).toBeUndefined();
      expect(note?.expiry).toEqual({ reason: "ttl-elapsed", recordedAt: harness.now.iso });
      const outcomes = harness.read().outcomes;
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]?.outcome).toBe("expired");
      expect(harness.read().messages).toHaveLength(1);
      expect(harness.read().completions).toHaveLength(0);
      expect(harness.session.calls).toEqual([]);
      const again = await harness.run(["read"]);
      expect(again.data?.applied).toBe(false);
      expect(harness.read().outcomes).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("past the boundary (+1h) the classification is the same", async () => {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      harness.seedMessage(makeMessage({ id: "msg-late", created: CREATED }));
      atOffset(harness, TTL_24H + 3_600_000);
      const run = await harness.run(["read"]);
      expect(run.data?.expiry).toEqual({ reason: "ttl-elapsed" });
      expect(notesOf(run.data)[0]?.lifecycle).toBe("expired");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-017 the inclusive predicate governs the classification", () => {
  test("the -1ms / +0 / +1ms cells agree with the pure predicate", async () => {
    const boundary = Date.parse(CREATED) + TTL_24H;
    const cells = [-1, 0, 1] as const;
    for (const delta of cells) {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
      try {
        harness.seedMessage(makeMessage({ id: "msg-cell", created: CREATED }));
        harness.now.ms = boundary + delta;
        harness.now.iso = new Date(harness.now.ms).toISOString();
        const run = await harness.run(["read"]);
        const classifiedExpired = notesOf(run.data)[0]?.lifecycle === "expired";
        expect(classifiedExpired, String(delta)).toBe(
          steerTtlElapsed(boundary + delta, CREATED, TTL_24H),
        );
      } finally {
        harness.cleanup();
      }
    }
  });

  test("filing never judges ttl: a stale hand-seeded record still appends", async () => {
    const harness = createSteerHarness();
    try {
      harness.seedMessage(makeMessage({ id: "msg-stale", created: "2020-01-01T00:00:00.000Z" }));
      const run = await harness.run(["send", "another note"]);
      expect(run.exitCode).toBe(0);
      expect(harness.read().messages).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-018 the payload totals are total over four shapes", () => {
  test("empty, all-expired, mixed, and pending reads obey the presence rules", async () => {
    // Empty queue.
    const empty = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      const run = await empty.run(["read"]);
      expect(run.data?.applied).toBe(false);
      expect(notesOf(run.data)).toEqual([]);
      expect(Object.hasOwn(run.data ?? {}, "expiry")).toBe(false);
      expect(run.data?.boundary).toBeDefined();
    } finally {
      empty.cleanup();
    }

    // All expired.
    const expired = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      expired.seedMessage(makeMessage({ id: "msg-e", created: CREATED }));
      atOffset(expired, TTL_24H);
      const run = await expired.run(["read"]);
      expect(run.data?.applied).toBe(false);
      expect(run.data?.expiry).toEqual({ reason: "ttl-elapsed" });
      expect(notesOf(run.data)[0]?.applied).toBe(false);
    } finally {
      expired.cleanup();
    }

    // Mixed: one due, one elapsed.
    const mixed = createSteerHarness({ phase: NO_PHASE_RECORD });
    try {
      mixed.seedMessage(
        makeMessage({ id: "msg-old", created: "2026-11-15T11:00:00.000Z", ttl: 3_600_000 }),
      );
      mixed.seedMessage(makeMessage({ id: "msg-fresh", created: CREATED }));
      atOffset(mixed, 3_600_000);
      const run = await mixed.run(["read"]);
      expect(run.data?.applied).toBe(true);
      expect(run.data?.expiry).toEqual({ reason: "ttl-elapsed" });
      const notes = notesOf(run.data);
      expect(notes).toHaveLength(2);
      expect(notes.filter((note) => note.applied === true)).toHaveLength(1);
      expect(notes.filter((note) => note.applied === false)).toHaveLength(1);
    } finally {
      mixed.cleanup();
    }

    // Pending (closed boundary).
    const pending = createSteerHarness({ phase: LAST_ENTRY_IN_PROGRESS });
    try {
      pending.seedMessage(makeMessage({ id: "msg-pending", created: CREATED }));
      const run = await pending.run(["read"]);
      expect(run.data?.applied).toBe(false);
      expect(Object.hasOwn(run.data ?? {}, "expiry")).toBe(false);
      expect(notesOf(run.data)[0]?.pendingReason).toBe("phase-in-progress");
    } finally {
      pending.cleanup();
    }
  });
});
