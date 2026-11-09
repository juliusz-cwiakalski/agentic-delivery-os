/**
 * TC-COORD-039 — the stuck record's closed `reason` distinguishes
 * `stuck-artifact-evidence` from `evidence-unevaluable`, and an unevaluable
 * verdict persists exactly one verdict record and no outcome.
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorStuck,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { staleBaseline } from "../fixtures/coordinator/evidence";
import { COORDINATOR_ID, makeCoordinatorStore, stuckRecord } from "../fixtures/coordinator/states";

describe("TC-COORD-039 the stuck reason is closed and distinct", () => {
  test("stuck carries stuck-artifact-evidence; unevaluable carries evidence-unevaluable", () => {
    const stuckVerdict = evaluateStuck(staleBaseline());
    expect(stuckVerdict.verdict).toBe("stuck");
    if (stuckVerdict.verdict === "stuck") {
      expect(stuckVerdict.reason).toBe("stuck-artifact-evidence");
    }
    const unevaluable = evaluateStuck(
      staleBaseline({ merge: "unknown", answer: "unknown", newTurn: "unknown" }),
    );
    expect(unevaluable.verdict).toBe("unevaluable");
    if (unevaluable.verdict === "unevaluable") {
      expect(unevaluable.reason).toBe("evidence-unevaluable");
    }
  });

  test("an unevaluable verdict persists exactly one verdict and no outcome", () => {
    const { store } = makeCoordinatorStore("stuck-reason");
    const evaluation = evaluateStuck(
      staleBaseline({ merge: "unknown", answer: "unknown", newTurn: "unknown" }),
    );
    if (evaluation.verdict !== "unevaluable") throw new Error("expected unevaluable");
    appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({
        verdict: "unevaluable",
        phase: "verdict",
        reason: evaluation.reason,
        evidence: evaluation.evidence,
        killOutcome: "not-attempted",
      }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.stuck).toHaveLength(1);
    expect(read.stuck[0]?.phase).toBe("verdict");
    expect(read.stuck.some((entry) => entry.phase === "outcome")).toBe(false);
  });

  test("the reader rejects an invalid verdict/reason couple", () => {
    const { store } = makeCoordinatorStore("stuck-reason-invalid");
    appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({ verdict: "stuck", reason: "evidence-unevaluable" as "stuck-artifact-evidence" }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });

  test("a verdict phase can never carry an attempted kill outcome", () => {
    const { store } = makeCoordinatorStore("stuck-reason-phase");
    appendCoordinatorStuck(
      store,
      "writer",
      stuckRecord({ phase: "verdict", killOutcome: "terminated" }),
    );
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });

  test("the restart reason is a distinct field from the stuck reason", () => {
    const record = stuckRecord();
    expect(record.reason).toBe("stuck-artifact-evidence");
    expect(Object.hasOwn(record, "restartReason")).toBe(false);
    expect(record.killFailureReason).toBeNull();
  });
});
