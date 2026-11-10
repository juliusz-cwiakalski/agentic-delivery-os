/**
 * TC-COORD-034 — absent session signals map to `unknown`, never zero, and only
 * a stale artifact class can justify a kill; all-unknown is `unevaluable`.
 */
import { describe, expect, test } from "bun:test";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  EVIDENCE_MATRIX,
  factsForCell,
  NOW_MS,
  STUCK_WINDOW_MS,
  staleBaseline,
} from "../fixtures/coordinator/evidence";

describe("TC-COORD-034 absent session signals are unknown evidence", () => {
  test("an unknown progress source with a stale merge or answer is still stuck", () => {
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: "unknown", merge: "stale", answer: "unknown" }),
    );
    expect(verdict.verdict).toBe("stuck");
    if (verdict.verdict === "stuck") {
      expect(verdict.classes["digest-consumed"]).toBe("unknown");
      expect(verdict.classes.merge).toBe("stale");
      expect(verdict.evidence).toContain("newTurn=unknown");
      expect(verdict.evidence).not.toContain("newTurn=zero");
    }
  });

  test("all-unknown evidence is unevaluable with evidence-unevaluable", () => {
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: "unknown", merge: "unknown", answer: "unknown" }),
    );
    expect(verdict.verdict).toBe("unevaluable");
    if (verdict.verdict === "unevaluable") {
      expect(verdict.reason).toBe("evidence-unevaluable");
      expect(verdict.evidence.split(" ").length).toBeGreaterThan(0);
    }
  });

  test("the 3x3x3 matrix is total and deterministic", () => {
    expect(EVIDENCE_MATRIX).toHaveLength(27);
    for (const cell of EVIDENCE_MATRIX) {
      const first = evaluateStuck(factsForCell(cell));
      const second = evaluateStuck(factsForCell(cell));
      expect(first, `${cell.digest}/${cell.merge}/${cell.answer}`).toEqual(second);
      expect(first.verdict, `${cell.digest}/${cell.merge}/${cell.answer}`).toBe(cell.expected);
    }
  });

  test("an unknown class is disclosed but never fabricated as stale", () => {
    const verdict = evaluateStuck(
      staleBaseline({ newTurn: "unknown", merge: "unknown", answer: "stale" }),
    );
    expect(verdict.verdict).toBe("stuck");
    if (verdict.verdict === "stuck") {
      expect(verdict.classes.merge).toBe("unknown");
      expect(verdict.evidence).toContain("merge=unknown");
    }
  });

  test("absence of session signals alone never triggers a kill decision", () => {
    const beforeWindow = evaluateStuck(
      staleBaseline({
        nowMs: NOW_MS,
        expectedAtMs: NOW_MS - 1,
        newTurn: "unknown",
        merge: "unknown",
        answer: "unknown",
      }),
    );
    expect(beforeWindow.verdict).toBe("progressing");
    const windowBoundary = evaluateStuck(
      staleBaseline({
        expectedAtMs: NOW_MS - STUCK_WINDOW_MS + 1,
        newTurn: "unknown",
        merge: "unknown",
        answer: "unknown",
      }),
    );
    expect(windowBoundary.verdict).toBe("progressing");
  });
});
