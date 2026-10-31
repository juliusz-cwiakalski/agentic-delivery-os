/**
 * TC-PHASE-001 (row 2) and TC-PHASE-002 (row 5) — the redundant matrix cells.
 *
 * Every no-op asserts the three-way contract together: exit 0, zero additional
 * ledger records, and an unchanged document (no entry created). The closing
 * controls prove an append-on-no-op or an append-without-entry is detectable.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appendPhaseTransition } from "../../packages/core/src/state/index";
import {
  PHASE_REF,
  type PhaseHarness,
  type PhaseRun,
  withoutPhase,
  withPhaseHarness,
} from "./phase-support";
import { documentOf, parsePmNotes, phasesOf } from "./pm-notes-lint-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");

const dataOf = (run: PhaseRun): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const evidenceOf = (run: PhaseRun): Record<string, unknown> => {
  const evidence = dataOf(run).evidence;
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    throw new Error("expected evidence");
  }
  return evidence as Record<string, unknown>;
};

const phasesRecord = (text: string): Record<string, unknown> =>
  phasesOf(documentOf(parsePmNotes(text, "target")));

const complete = (harness: PhaseHarness, phase: string) =>
  harness.run(["complete", PHASE_REF, phase]);

const reopen = (harness: PhaseHarness, phase: string, reason: string) =>
  harness.run(["reopen", PHASE_REF, phase, reason]);

const assertNoOpDelta = (before: number, after: number): void => {
  if (after !== before) throw new Error(`append-on-no-op: ${before} -> ${after}`);
};

describe("TC-PHASE-001 row 2: complete on a completed phase is a no-op", () => {
  test("exit 0, zero ledger delta, unchanged bytes, and completedAt evidence", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const first = await complete(harness, "delivery");
        expect(first.exitCode).toBe(0);
        const completedAt = dataOf(first).timestamp;
        const beforeBytes = harness.targetText();
        const beforeLines = harness.rawLedgerLines().length;
        const beforeTransitions = harness.transitionPayloads().length;

        const second = await complete(harness, "delivery");
        expect(second.exitCode).toBe(0);
        const data = dataOf(second);
        expect(data.outcome).toBe("no-op");
        expect(evidenceOf(second)).toMatchObject({
          outcome: "no-op",
          basis: "already-completed",
          completedAt,
        });
        expect(harness.targetText()).toBe(beforeBytes);
        expect(harness.rawLedgerLines().length).toBe(beforeLines);
        expect(harness.transitionPayloads().length).toBe(beforeTransitions);
        expect(phasesRecord(harness.targetText()).delivery).toMatchObject({
          completed: completedAt,
        });
        expect(harness.store.fenceStatus().held).toBe(false);
      },
      "row2",
    );
  });
});

describe("TC-PHASE-002 row 5: reopen on an open or absent phase is a no-op", () => {
  test("a present open phase stays unchanged with the reason only in evidence", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const beforeBytes = harness.targetText();
        const beforePhases = phasesRecord(beforeBytes);
        const reason = "reopen attempted before completion";
        const run = await reopen(harness, "system_spec_update", reason);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.outcome).toBe("no-op");
        expect(evidenceOf(run)).toMatchObject({
          outcome: "no-op",
          basis: "not-completed",
          phase: "system_spec_update",
          reason,
        });
        expect(harness.targetText()).toBe(beforeBytes);
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(phasesRecord(harness.targetText())).toEqual(beforePhases);
        expect(harness.store.fenceStatus().held).toBe(false);
      },
      "row5-open",
    );
  });

  test("an absent phase is not created and no record is appended", async () => {
    await withPhaseHarness(
      withoutPhase(FULL, "review_fix"),
      async (harness) => {
        const beforeBytes = harness.targetText();
        expect(Object.hasOwn(phasesRecord(beforeBytes), "review_fix")).toBe(false);
        const run = await reopen(harness, "review_fix", "no such phase entry");
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).outcome).toBe("no-op");
        expect(evidenceOf(run)).toMatchObject({
          outcome: "no-op",
          basis: "not-completed",
          phase: "review_fix",
        });
        expect(harness.targetText()).toBe(beforeBytes);
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(Object.hasOwn(phasesRecord(harness.targetText()), "review_fix")).toBe(false);
      },
      "row5-absent",
    );
  });
});

describe("non-vacuity controls", () => {
  test("an append-on-no-op would be caught by the three-way delta assertion", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        await complete(harness, "delivery");
        const before = harness.transitionPayloads().length;
        const noOp = await complete(harness, "delivery");
        expect(noOp.exitCode).toBe(0);
        const after = harness.transitionPayloads().length;
        expect(() => assertNoOpDelta(before, after)).not.toThrow();
        expect(() => assertNoOpDelta(before, after + 1)).toThrow("append-on-no-op");
      },
      "control-no-op",
    );
  });

  test("an append without entry creation is observable (row 9 control)", async () => {
    await withPhaseHarness(
      withoutPhase(FULL, "review_fix"),
      async (harness) => {
        const appended = appendPhaseTransition(harness.store, {
          changeRef: PHASE_REF,
          phaseId: "review_fix",
          operation: "complete",
          timestamp: "2026-10-31T13:00:00Z",
          fenceToken: "control-without-entry",
        });
        expect(appended.ok).toBe(true);
        expect(harness.transitionPayloads()).toHaveLength(1);
        expect(Object.hasOwn(phasesRecord(harness.targetText()), "review_fix")).toBe(false);
      },
      "control-entry",
    );
  });
});
