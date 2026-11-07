/**
 * TC-ECON-062 — missing economics figures degrade to null with a warning naming
 * the field and ordinal; never a fabricated zero or an estimate.
 */
import { describe, expect, test } from "bun:test";
import type { EconomicsRestartRecord } from "../../packages/core/src/contracts/index";
import { deriveEconomicsView } from "../../packages/core/src/domain/index";
import { DEGRADED_FIXTURES } from "../fixtures/economics/cases";

const asRecords = (records: readonly EconomicsRestartRecord[]): readonly EconomicsRestartRecord[] =>
  records;

describe("TC-ECON-062 missing figures degrade to null with a warning", () => {
  test("an absent re-pay delta yields null with a warning naming the field and ordinal", () => {
    const view = deriveEconomicsView({ records: asRecords(DEGRADED_FIXTURES.absentRepay) });
    expect(view.restarts).toBe(1);
    expect(view.resumeAmplification).toBeNull();
    expect(view.amplificationFlag).toBeNull();
    expect(view.warnings).toContainEqual({
      kind: "missing-repay-tokens",
      field: "repayTokens",
      ordinal: 1,
    });
    expect(view.restartHistory[0]?.repayTokens).toBeUndefined();
  });

  test("an absent unique-progress figure yields null with a warning, not a zero", () => {
    const view = deriveEconomicsView({
      records: asRecords(DEGRADED_FIXTURES.absentUniqueProgress),
    });
    expect(view.resumeAmplification).toBeNull();
    expect(view.warnings).toContainEqual({
      kind: "missing-unique-progress",
      field: "uniqueProgressTokens",
      ordinal: 1,
    });
    expect(JSON.stringify(view)).not.toContain('"resumeAmplification":0');
  });

  test("both figures absent still derives the rest of the view correctly", () => {
    const view = deriveEconomicsView({ records: asRecords(DEGRADED_FIXTURES.absentBoth) });
    expect(view.restarts).toBe(1);
    expect(view.restartHistory).toHaveLength(1);
    expect(view.resumeAmplification).toBeNull();
    expect(view.warnings.map((warning) => warning.kind).sort()).toEqual([
      "missing-repay-tokens",
      "missing-unique-progress",
    ]);
  });

  test("a complete fixture produces no warnings", () => {
    const view = deriveEconomicsView({
      records: [
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-235",
          runId: "run-fixture",
          sessionId: "ses_fixture_1",
          ordinal: 1,
          reason: "session-interrupted",
          repayTokens: { inputTokens: 100, outputTokens: 0 },
          observedUniqueProgressTokens: 400,
          recordedAt: "2026-11-07T00:00:01Z",
        },
      ],
    });
    expect(view.warnings).toEqual([]);
    expect(view.resumeAmplification).toBe(0.25);
  });

  test("the fabricated-zero mutant fails naming the field", () => {
    // Mutant: substitute 0 for a missing re-pay delta, then apply the real null rule.
    const mutantView = deriveEconomicsView({
      records: asRecords(DEGRADED_FIXTURES.absentRepay).map((record) => ({
        ...record,
        repayTokens: { inputTokens: 0, outputTokens: 0 },
      })),
    });
    const realView = deriveEconomicsView({ records: asRecords(DEGRADED_FIXTURES.absentRepay) });
    expect(realView.warnings.some((warning) => warning.field === "repayTokens")).toBe(true);
    expect(mutantView.warnings).toEqual([]);
    expect(mutantView.resumeAmplification).not.toBe(realView.resumeAmplification);
  });
});
