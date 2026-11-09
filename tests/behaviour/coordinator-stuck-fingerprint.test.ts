/**
 * TC-COORD-032 — a fingerprint advance without a session turn does not count as
 * consumed, and the fingerprint is state-sourced only (no tracker, CI, or
 * network input).
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  FINGERPRINT_COUPLES,
  NOW_MS,
  STUCK_WINDOW_MS,
  staleBaseline,
} from "../fixtures/coordinator/evidence";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";

describe("TC-COORD-032 the digest class needs both a fingerprint advance and a turn", () => {
  test("only the advanced-plus-positive-turn couple consumes the digest", () => {
    for (const couple of FINGERPRINT_COUPLES) {
      const verdict = evaluateStuck(
        staleBaseline({
          fingerprintAdvanced: couple.fingerprintAdvanced,
          newTurn: couple.newTurn,
          // No observed progress timestamp, so the corroborator cannot veto.
          progressObservedAtMs: null,
        }),
      );
      const digestClass =
        verdict.verdict === "progressing" ? "advanced" : verdict.classes["digest-consumed"];
      const expectedClass = couple.digestConsumed
        ? "advanced"
        : couple.newTurn === "unknown"
          ? "unknown"
          : "stale";
      expect(digestClass, couple.id).toBe(expectedClass);
      expect(verdict.verdict, couple.id).toBe(
        couple.digestConsumed ? "progressing" : "stuck",
      );
    }
  });

  test("an advanced fingerprint with no turn is stale, never consumed", () => {
    const verdict = evaluateStuck(
      staleBaseline({ fingerprintAdvanced: true, newTurn: "zero" }),
    );
    expect(verdict.verdict).toBe("stuck");
    if (verdict.verdict === "stuck") {
      expect(verdict.classes["digest-consumed"]).toBe("stale");
      expect(verdict.evidence).toContain("fingerprintAdvanced=true");
      expect(verdict.evidence).toContain("newTurn=zero");
    }
  });

  test("the evaluation reads no tracker, CI, network, or process input", () => {
    const recorder = createRecordingProcessPort({ progress: { tokenDelta: 5, traffic: 0 } });
    const verdict = evaluateStuck(
      staleBaseline({ fingerprintAdvanced: true, newTurn: "positive" }),
    );
    expect(verdict.verdict).toBe("progressing");
    // The pure evaluation has no seam through which a tracker/CI/network or
    // process read could occur: the fake recorded zero of every call.
    expect(recorder.calls.alive).toBe(0);
    expect(recorder.calls.signal).toBe(0);
    expect(recorder.calls.progress).toBe(0);
    expect(recorder.calls.spawn).toBe(0);
  });

  test("the fingerprint inputs are the state cursor and the open-question count only", () => {
    const facts = staleBaseline();
    const keys = Object.keys(facts);
    for (const forbidden of [
      "tracker",
      "readyToMerge",
      "mergeCount",
      "ci",
      "network",
      "questions",
      "cursor",
    ]) {
      expect(keys.some((key) => key.toLowerCase().includes(forbidden.toLowerCase()))).toBe(false);
    }
    // The digest class is derived only from the two declared couples.
    expect(facts.nowMs).toBe(NOW_MS);
    expect(facts.stuckWindowMs).toBe(STUCK_WINDOW_MS);
  });
});
