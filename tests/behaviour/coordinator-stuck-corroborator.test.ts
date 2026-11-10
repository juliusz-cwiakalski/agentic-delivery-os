/**
 * TC-COORD-033 — positive sourced progress within `progress-bound` vetoes a
 * stuck verdict, so a large working session is never killed.
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  PROGRESS_BOUND_MS,
  PROGRESS_WINDOWS,
  staleBaseline,
} from "../fixtures/coordinator/evidence";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";

describe("TC-COORD-033 the progress corroborator vetoes a stuck verdict", () => {
  test("positive progress inside the bound vetoes; past the bound it does not", () => {
    for (const window of PROGRESS_WINDOWS) {
      const verdict = evaluateStuck(
        staleBaseline({
          newTurn: "positive",
          progressObservedAtMs: staleBaseline().nowMs - window.ageMs,
          // All artifact classes stay stale: the corroborator is the only veto.
          fingerprintAdvanced: false,
          merge: "stale",
          answer: "stale",
        }),
      );
      expect(verdict.verdict, window.id).toBe(window.vetoes ? "progressing" : "stuck");
    }
  });

  test("zero and unknown progress never veto a stale artifact set", () => {
    for (const newTurn of ["zero", "unknown"] as const) {
      const verdict = evaluateStuck(
        staleBaseline({ newTurn, progressObservedAtMs: staleBaseline().nowMs }),
      );
      expect(verdict.verdict, newTurn).toBe(newTurn === "unknown" ? "stuck" : "stuck");
    }
  });

  test("no kill is attempted by the evaluation (kill counter stays zero)", () => {
    const recorder = createRecordingProcessPort({
      declared: { alive: false, killWithGrace: false, startTimeIdentity: false },
      progress: { tokenDelta: 900, traffic: 12 },
    });
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: "positive", progressObservedAtMs: staleBaseline().nowMs - 1 }),
    );
    expect(verdict.verdict).toBe("progressing");
    expect(recorder.signals).toHaveLength(0);
    expect(recorder.calls.signal).toBe(0);
  });

  test("a positive turn with no observed timestamp cannot veto", () => {
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: "positive", progressObservedAtMs: null }),
    );
    expect(verdict.verdict).toBe("stuck");
  });

  test("the bound is configuration data, never a literal in the rule", () => {
    const tight = evaluateStuck(
      staleBaseline({
        newTurn: "positive",
        progressObservedAtMs: staleBaseline().nowMs - 10,
        progressBoundMs: 5,
      }),
    );
    expect(tight.verdict).toBe("stuck");
    const wide = evaluateStuck(
      staleBaseline({
        newTurn: "positive",
        progressObservedAtMs: staleBaseline().nowMs - PROGRESS_BOUND_MS,
        progressBoundMs: PROGRESS_BOUND_MS * 2,
      }),
    );
    expect(wide.verdict).toBe("progressing");
  });
});
