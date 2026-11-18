/**
 * TC-TELEMETRY-009 — per-phase timing summaries derive from the delivered
 * `phase.transition` history and the delivered economics restart records;
 * nothing is re-estimated where a delivered record exists (AC-F3-1, DM-2).
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  foldTelemetryStore,
  makeRestartRecord,
  removeRoot,
  T0,
  T1,
  T2,
  T3,
  T4,
  tokens,
  makeStepRecord,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seeded = () => {
  const seededCase = foldTelemetryStore(
    {
      steps: [
        makeStepRecord({ sessionId: "ses_t1", finishedAt: T1, tokens: tokens({ input: 10 }) }),
        makeStepRecord({ sessionId: "ses_t2", finishedAt: T2, tokens: tokens({ input: 20 }) }),
        makeStepRecord({ sessionId: "ses_t3", finishedAt: T3, tokens: tokens({ input: 30 }) }),
      ],
      transitions: [
        { phaseId: "clarify_scope", operation: "complete", timestamp: T0 },
        { phaseId: "specification", operation: "complete", timestamp: T1 },
        { phaseId: "test_planning", operation: "complete", timestamp: T2 },
      ],
      restarts: [
        // Stamped inside the first window (08:05) and the second (08:15): a
        // record exactly on a transition belongs to the phase it opened.
        makeRestartRecord({
          ordinal: 1,
          reason: "watchdog.liveness-stalled",
          recordedAt: "2026-11-12T08:05:00.000Z",
        }),
        makeRestartRecord({
          ordinal: 2,
          reason: "session-interrupted",
          recordedAt: "2026-11-12T08:15:00.000Z",
        }),
      ],
    },
    "timing",
  );
  roots.push(seededCase.root);
  return seededCase;
};

describe("TC-TELEMETRY-009 timing from delivered records", () => {
  test("each phase entry carries the hand-computed start, end, and duration", () => {
    const { fold } = seeded();
    expect(fold?.ok).toBe(true);
    if (fold === undefined || !fold.ok) return;
    const timing = fold.data.phaseTiming;
    expect(timing.map((entry) => entry.phase)).toEqual([
      "clarify_scope",
      "specification",
      "test_planning",
    ]);
    expect(timing[0]?.start).toBe(T0);
    expect(timing[0]?.end).toBe(T1);
    // T0 -> T1 is ten minutes.
    expect(timing[0]?.durationMs).toBe(600_000);
    expect(timing[1]?.start).toBe(T1);
    expect(timing[1]?.end).toBe(T2);
    expect(timing[1]?.durationMs).toBe(900_000);
    // The last transitioned phase has no closing record: no invented end.
    expect(timing[2]?.start).toBe(T2);
    expect(timing[2]?.end).toBeNull();
    expect(timing[2]?.durationMs).toBeNull();
  });

  test("stall and restart counts reflect the seeded economics records", () => {
    const { fold } = seeded();
    if (fold === undefined || !fold.ok) return;
    const first = fold.data.phaseTiming[0];
    expect(first?.stalls).toBe(1);
    expect(first?.restarts).toBe(1);
    const second = fold.data.phaseTiming[1];
    expect(second?.stalls).toBe(0);
    expect(second?.restarts).toBe(1);
    expect(fold.data.phaseTiming[2]?.restarts).toBe(0);
  });

  test("a store with no transition history declares no fabricated phase timing", () => {
    const noHistory = foldTelemetryStore(
      { steps: [makeStepRecord({ finishedAt: T4 })] },
      "timing-none",
    );
    roots.push(noHistory.root);
    if (noHistory.fold === undefined || !noHistory.fold.ok) return;
    expect(noHistory.fold.data.phaseTiming).toEqual([]);
    // The single v1 per-phase entry still names the `unknown` window.
    expect(noHistory.fold.data.perPhase[0]?.phase).toBe("unknown");
  });

  test("phase timing is deterministic across renders", () => {
    const first = seeded();
    if (first.fold === undefined || !first.fold.ok) return;
    const { fold } = seeded();
    if (fold === undefined || !fold.ok) return;
    expect(fold.data.phaseTiming).toEqual(first.fold.data.phaseTiming);
  });
});
