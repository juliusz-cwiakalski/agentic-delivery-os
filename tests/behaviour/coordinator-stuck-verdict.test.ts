/**
 * TC-COORD-030 — a stuck verdict is the full two-phase artifact-evidence
 * conjunction with `stuckId = iterationId` and a ledger-sequence fold.
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorStuck,
  foldCoordinatorStuck,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { staleBaseline } from "../fixtures/coordinator/evidence";
import { COORDINATOR_ID, makeCoordinatorStore, stuckRecord } from "../fixtures/coordinator/states";

describe("TC-COORD-030 the two-phase stuck record shares one stuckId", () => {
  test("the verdict lands before the kill and the outcome after it", () => {
    const { store } = makeCoordinatorStore("stuck-verdict");
    const evaluation = evaluateStuck(staleBaseline());
    expect(evaluation.verdict).toBe("stuck");
    if (evaluation.verdict !== "stuck") return;
    const verdict = appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({
        verdict: "stuck",
        phase: "verdict",
        reason: evaluation.reason,
        evidence: evaluation.evidence,
        killOutcome: "not-attempted",
      }),
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.appended).toBe(true);
    const outcome = appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({
        verdict: "stuck",
        phase: "outcome",
        reason: evaluation.reason,
        evidence: evaluation.evidence,
        killOutcome: "terminated",
        recordedAt: "2026-11-09T00:02:00.000Z",
      }),
    );
    expect(outcome.ok).toBe(true);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.stuck).toHaveLength(2);
    expect(new Set(read.stuck.map((entry) => entry.stuckId))).toEqual(new Set(["iteration-1"]));
    expect(read.stuck.map((entry) => entry.phase)).toEqual(["verdict", "outcome"]);
    const folded = foldCoordinatorStuck(read.stuck)["iteration-1"];
    expect(folded?.phase).toBe("outcome");
    expect(folded?.killOutcome).toBe("terminated");
  });

  test("the fold is by ledger sequence, never by recordedAt", () => {
    const { store } = makeCoordinatorStore("stuck-sequence");
    // Identical recordedAt: only ledger order can decide the latest.
    appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({
        phase: "verdict",
        killOutcome: "not-attempted",
        recordedAt: "2026-11-09T00:00:00.000Z",
      }),
    );
    appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({
        phase: "outcome",
        killOutcome: "forced",
        recordedAt: "2026-11-09T00:00:00.000Z",
      }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    if (!read.ok) throw new Error("read failed");
    expect(foldCoordinatorStuck(read.stuck)["iteration-1"]?.killOutcome).toBe("forced");
  });

  test("a replayed phase appends nothing", () => {
    const { store } = makeCoordinatorStore("stuck-replay");
    const first = appendCoordinatorStuck(store, "writer", stuckRecord());
    const replay = appendCoordinatorStuck(store, "writer", stuckRecord());
    expect(first.ok && first.appended).toBe(true);
    expect(replay.ok && !replay.appended).toBe(true);
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    if (read.ok) expect(read.stuck).toHaveLength(1);
  });
});
