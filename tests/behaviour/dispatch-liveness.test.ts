/**
 * TC-DISP-003 / TC-DISP-004 / TC-DISP-005 (phase-2 pure liveness) — a sourced
 * signal that advances keeps a lane progressing, all-absent readings stay
 * unknown with their reasons (never zero), and a stall requires two consecutive
 * sourced evaluations with no advance. Elapsed time alone never stalls.
 */
import { describe, expect, test } from "bun:test";
import {
  DISPATCH_LIVENESS_ABSENCE_REASONS,
  type DispatchLivenessReading,
  dispatchStallShortCircuit,
  dispatchStallUndecidable,
  evaluateDispatchLiveness,
} from "../../packages/core/src/domain/dispatch-liveness";

const CADENCE_MS = 30_000;

const sourced = (
  signal: DispatchLivenessReading["signal"],
  value: number,
): DispatchLivenessReading => ({ signal, status: "sourced", value });

const absent = (signal: DispatchLivenessReading["signal"]): DispatchLivenessReading => ({
  signal,
  status: "absent",
  reason: DISPATCH_LIVENESS_ABSENCE_REASONS[1] as "not-observed",
});

describe("TC-DISP-003 progress signals keep a session live", () => {
  const ALL_SIGNALS = ["token-delta", "session-traffic", "worktree-activity", "prefill"] as const;
  const withOnly = (
    target: (typeof ALL_SIGNALS)[number],
    value: number,
  ): DispatchLivenessReading[] =>
    ALL_SIGNALS.map((signal) => (signal === target ? sourced(signal, value) : absent(signal)));

  for (const signal of ALL_SIGNALS) {
    test(`an advancing ${signal} reports progressing and names the signal`, () => {
      const first = evaluateDispatchLiveness({
        readings: withOnly(signal, 1),
        cadenceMs: CADENCE_MS,
      });
      expect(first.verdict).toBe("unknown");
      const second = evaluateDispatchLiveness({
        readings: withOnly(signal, 2),
        previous: withOnly(signal, 1),
        cadenceMs: CADENCE_MS,
      });
      expect(second.verdict).toBe("progressing");
      expect(second.advancing).toContain(signal);
      expect(second.absent.map((entry) => entry.signal)).toEqual(
        ALL_SIGNALS.filter((candidate) => candidate !== signal),
      );
    });
  }

  test("two advancing signals and one absent report progressing with the absent reason", () => {
    const result = evaluateDispatchLiveness({
      readings: [sourced("token-delta", 3), sourced("prefill", 3), absent("worktree-activity")],
      previous: [sourced("token-delta", 1), sourced("prefill", 1), absent("worktree-activity")],
      cadenceMs: CADENCE_MS,
    });
    expect(result.verdict).toBe("progressing");
    expect(result.advancing).toEqual(["token-delta", "prefill"]);
    expect(result.absent[0]?.reason).toBe("not-observed");
    expect(result.absent.some((entry) => entry.reason.includes("0"))).toBe(false);
  });

  test("the cadence is supplied as data and echoed", () => {
    for (const cadenceMs of [5_000, CADENCE_MS, 120_000]) {
      const result = evaluateDispatchLiveness({
        readings: [sourced("token-delta", 1)],
        cadenceMs,
      });
      expect(result.cadenceMs).toBe(cadenceMs);
    }
  });
});

describe("TC-DISP-004 absent liveness readings stay unknown", () => {
  test("all-absent readings report unknown with their declared reasons", () => {
    const readings = [
      absent("token-delta"),
      absent("session-traffic"),
      absent("worktree-activity"),
    ];
    const result = evaluateDispatchLiveness({ readings, cadenceMs: CADENCE_MS });
    expect(result.verdict).toBe("unknown");
    expect(result.unknownReason).toBe("all-absent");
    expect(result.absent).toHaveLength(3);
    expect(result.absent.every((entry) => entry.reason === "not-observed")).toBe(true);
  });

  test("advancing only the clock never produces a stalled verdict", () => {
    const readings = [absent("token-delta"), absent("session-traffic")];
    const first = evaluateDispatchLiveness({ readings, cadenceMs: CADENCE_MS });
    const second = evaluateDispatchLiveness({
      readings,
      previous: readings,
      cadenceMs: CADENCE_MS,
    });
    expect(first.verdict).toBe("unknown");
    expect(second.verdict).toBe("unknown");
    expect(second.verdict).not.toBe("stalled");
  });
});

describe("TC-DISP-005 stall requires two sourced evaluations", () => {
  test("a single sourced evaluation never stalls", () => {
    const result = evaluateDispatchLiveness({
      readings: [sourced("token-delta", 5), sourced("session-traffic", 5)],
      cadenceMs: CADENCE_MS,
    });
    expect(result.verdict).not.toBe("stalled");
    expect(result.unknownReason).toBe("insufficient-observations");
  });

  test("two consecutive sourced evaluations with no advance may stall", () => {
    const readings = [sourced("token-delta", 5), sourced("session-traffic", 5)];
    const result = evaluateDispatchLiveness({
      readings,
      previous: readings,
      cadenceMs: CADENCE_MS,
    });
    expect(result.verdict).toBe("stalled");
  });

  test("an absent second evaluation is unknown, not stalled", () => {
    const current = [absent("token-delta"), absent("session-traffic")];
    const previous = [sourced("token-delta", 5), sourced("session-traffic", 5)];
    const result = evaluateDispatchLiveness({
      readings: current,
      previous,
      cadenceMs: CADENCE_MS,
    });
    expect(result.verdict).toBe("unknown");
    expect(result.unknownReason).toBe("all-absent");
  });
});

/* ------------------------------------------------------------------------- */
/* TC-TERM-002 (pure half) and DM-4 — the terminal pre-restart verdict set.    */
/* ------------------------------------------------------------------------- */

describe("GH-347 the terminal pre-restart verdict set is the only short-circuit", () => {
  test("a tracker-done work item short-circuits as merged", () => {
    expect(
      dispatchStallShortCircuit({
        tracker: { ok: true, value: { state: "done", blocking: false } },
        artifacts: {
          ok: true,
          value: {
            branchCommits: 0,
            pr: { state: "none", url: null, mergeReady: false },
            pmNotes: "absent",
          },
        },
      }),
    ).toBe("merged");
  });

  test("a blocking tracker short-circuits as blocked", () => {
    expect(
      dispatchStallShortCircuit({
        tracker: { ok: true, value: { state: "delivery-blocked", blocking: true } },
        artifacts: { ok: false, reason: "artifact" },
      }),
    ).toBe("blocked");
  });

  test("an open PR artifact short-circuits as pr-open", () => {
    expect(
      dispatchStallShortCircuit({
        tracker: { ok: false, reason: "tracker" },
        artifacts: {
          ok: true,
          value: {
            branchCommits: 2,
            pr: { state: "open", url: "https://example.test/1", mergeReady: true },
            pmNotes: "complete",
          },
        },
      }),
    ).toBe("pr-open");
  });

  test("a decisive artifact OUTSIDE the set does not short-circuit", () => {
    for (const pmNotes of ["complete", "incomplete", "absent"] as const) {
      expect(
        dispatchStallShortCircuit({
          tracker: { ok: true, value: { state: "in-progress", blocking: false } },
          artifacts: {
            ok: true,
            value: {
              branchCommits: pmNotes === "absent" ? 0 : 2,
              pr: { state: "none", url: null, mergeReady: false },
              pmNotes,
            },
          },
        }),
        pmNotes,
      ).toBeUndefined();
    }
  });

  test("undecidable truth is any unreadable required read with no decisive artifact", () => {
    // DELIVERED EXPECTATION UPDATE (GH-347 AC-F6-3; Appendix F(C)(10)/F(D)
    // "any required read unreadable and no decisive artifact"; review M3): the
    // delivered assertion treated a READABLE tracker beside an unreadable
    // artifact as decidable, so the stall restarted on truth it could not read.
    // The artifact read is required for the stall decision; only a decisive
    // artifact (Appendix F(C) arms 4-7) makes an unreadable tracker decidable.
    const unreadableTracker = { ok: false as const, reason: "tracker" as const };
    const unreadableArtifacts = { ok: false as const, reason: "artifact" as const };
    const readableTracker = {
      ok: true as const,
      value: { state: "in-progress" as const, blocking: false },
    };
    const noArtifact = {
      ok: true as const,
      value: {
        branchCommits: 0,
        pr: { state: "none" as const, url: null, mergeReady: false },
        pmNotes: "complete" as const,
      },
    };
    const commitsArtifact = {
      ok: true as const,
      value: {
        branchCommits: 2,
        pr: { state: "none" as const, url: null, mergeReady: false },
        pmNotes: "complete" as const,
      },
    };

    expect(
      dispatchStallUndecidable({ tracker: unreadableTracker, artifacts: unreadableArtifacts }),
    ).toBe(true);
    // A readable NON-TERMINAL tracker beside an unreadable artifact is terminal
    // state-unverified, never a restart.
    expect(
      dispatchStallUndecidable({ tracker: readableTracker, artifacts: unreadableArtifacts }),
    ).toBe(true);
    // An unreadable tracker with NO decisive artifact is undecidable.
    expect(dispatchStallUndecidable({ tracker: unreadableTracker, artifacts: noArtifact })).toBe(
      true,
    );
    // A decisive artifact keeps the truth decidable even with no tracker.
    expect(
      dispatchStallUndecidable({ tracker: unreadableTracker, artifacts: commitsArtifact }),
    ).toBe(false);
    // Readable truth with no decisive artifact is decidable.
    expect(dispatchStallUndecidable({ tracker: readableTracker, artifacts: noArtifact })).toBe(
      false,
    );
  });
});
