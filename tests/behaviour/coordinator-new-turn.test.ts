/**
 * TC-COORD-029 — the adapter maps `token-delta` / `session-traffic` to a new
 * turn and the progress-bound veto; absent maps to `unknown`.
 */
import { describe, expect, test } from "bun:test";
import { mapCoordinatorNewTurn } from "../../packages/adapters/src/harness/index";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import type { HarnessLivenessReport } from "../../packages/core/src/contracts/index";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";
import { PROGRESS_BOUND_MS, staleBaseline } from "../fixtures/coordinator/evidence";

const reportFor = (
  tokenDelta: number | null,
  traffic: number | null,
): HarnessLivenessReport =>
  createRecordingProcessPort({ progress: { tokenDelta, traffic } }).livenessReport();

describe("TC-COORD-029 the adapter maps sourced readings to a new turn", () => {
  test("a positive token-delta or a positive traffic reading is positive", () => {
    expect(mapCoordinatorNewTurn(reportFor(5, 0)).newTurn).toBe("positive");
    expect(mapCoordinatorNewTurn(reportFor(0, 3)).newTurn).toBe("positive");
    expect(mapCoordinatorNewTurn(reportFor(null, 9)).newTurn).toBe("positive");
  });

  test("a sourced zero is zero, never unknown", () => {
    expect(mapCoordinatorNewTurn(reportFor(0, 0)).newTurn).toBe("zero");
    expect(mapCoordinatorNewTurn(reportFor(0, null)).newTurn).toBe("zero");
    expect(mapCoordinatorNewTurn(reportFor(null, 0)).newTurn).toBe("zero");
  });

  test("an absent or unsupported reading is unknown, never zero", () => {
    expect(mapCoordinatorNewTurn(reportFor(null, null)).newTurn).toBe("unknown");
  });

  test("the projected turn feeds the progress-bound veto", () => {
    const turn = mapCoordinatorNewTurn(reportFor(7, 0));
    expect(turn.newTurn).toBe("positive");
    expect(turn.observedAt).not.toBeNull();
    const verdict = evaluateStuck(
      staleBaseline({
        newTurn: turn.newTurn,
        progressObservedAtMs: staleBaseline().nowMs - 10,
        progressBoundMs: PROGRESS_BOUND_MS,
      }),
    );
    expect(verdict.verdict).toBe("progressing");
  });

  test("an unknown reading never becomes a failure identity", () => {
    const turn = mapCoordinatorNewTurn(reportFor(null, null));
    expect(turn.newTurn).toBe("unknown");
    expect(turn.observedAt).toBeNull();
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: turn.newTurn, merge: "stale", answer: "stale" }),
    );
    expect(verdict.verdict).toBe("stuck");
    if (verdict.verdict === "stuck") {
      expect(verdict.classes["digest-consumed"]).toBe("unknown");
    }
  });
});
