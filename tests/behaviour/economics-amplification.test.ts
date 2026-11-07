/**
 * TC-ECON-061 — resume amplification is computed from records, monotonic in
 * re-pay, flagged by its declared name above the healthy baseline, and never
 * invented for a delivery with zero restarts.
 */
import { describe, expect, test } from "bun:test";
import {
  RESUME_AMPLIFICATION_BASELINE,
  RESUME_AMPLIFICATION_LOOP_FLAG,
} from "../../packages/core/src/contracts/index";
import { deriveEconomicsView } from "../../packages/core/src/domain/index";
import { AMPLIFICATION_FIXTURES } from "../fixtures/economics/cases";

describe("TC-ECON-061 resume amplification is computed and flagged by name", () => {
  test("zero re-pay reads the declared healthy baseline and no loop flag", () => {
    const view = deriveEconomicsView({ records: [...AMPLIFICATION_FIXTURES.zeroRepay] });
    expect(view.restarts).toBe(1);
    expect(view.resumeAmplification).toBe(0);
    expect(view.resumeAmplification).not.toBeNull();
    expect(view.resumeAmplification ?? 0).toBeLessThanOrEqual(RESUME_AMPLIFICATION_BASELINE);
    expect(view.amplificationFlag).toBeNull();
    expect(view.warnings).toEqual([]);
  });

  test("one re-pay raises the ratio and three ascending deltas raise it monotonically", () => {
    const one = deriveEconomicsView({ records: [...AMPLIFICATION_FIXTURES.oneRepay] });
    const three = deriveEconomicsView({ records: [...AMPLIFICATION_FIXTURES.threeAscending] });
    expect(one.resumeAmplification).toBe(0.25);
    expect(three.resumeAmplification).toBe(1.5);
    const pairs = [...AMPLIFICATION_FIXTURES.threeAscending].map((record) => ({
      ordinal: record.ordinal,
      repay: (record.repayTokens?.inputTokens ?? 0) + (record.repayTokens?.outputTokens ?? 0),
    }));
    for (let index = 1; index < pairs.length; index += 1) {
      expect((pairs[index]?.repay ?? 0) > (pairs[index - 1]?.repay ?? 0)).toBe(true);
    }
    const single = AMPLIFICATION_FIXTURES.threeAscending.slice(0, 1);
    const two = AMPLIFICATION_FIXTURES.threeAscending.slice(0, 2);
    const oneRatio = deriveEconomicsView({ records: [...single] }).resumeAmplification ?? 0;
    const twoRatio = deriveEconomicsView({ records: [...two] }).resumeAmplification ?? 0;
    expect(twoRatio).toBeGreaterThan(oneRatio);
    expect(three.resumeAmplification ?? 0).toBeGreaterThan(twoRatio);
  });

  test("the loop fixture is flagged by the declared name with a ratio above baseline", () => {
    const view = deriveEconomicsView({ records: [...AMPLIFICATION_FIXTURES.loop] });
    expect(view.amplificationFlag).toBe(RESUME_AMPLIFICATION_LOOP_FLAG);
    expect(view.resumeAmplification ?? 0).toBeGreaterThan(RESUME_AMPLIFICATION_BASELINE);
    expect(view.restarts).toBe(3);
  });

  test("zero restart records carry no flag and no invented ratio", () => {
    const view = deriveEconomicsView({ records: [] });
    expect(view.restarts).toBe(0);
    expect(view.resumeAmplification).toBeNull();
    expect(view.amplificationFlag).toBeNull();
    expect(view.warnings).toEqual([]);
    expect(view.restartHistory).toEqual([]);
  });

  test("the history is ordered by ordinal with reason, re-pay, session identity, and time", () => {
    const view = deriveEconomicsView({
      records: [
        ...AMPLIFICATION_FIXTURES.threeAscending.slice(2),
        ...AMPLIFICATION_FIXTURES.threeAscending.slice(0, 2),
      ],
    });
    expect(view.restartHistory.map((entry) => entry.ordinal)).toEqual([1, 2, 3]);
    expect(view.restartHistory[0]).toMatchObject({
      reason: "session-interrupted",
      sessionId: "ses_fixture_1",
      repayTokens: { inputTokens: 100, outputTokens: 0 },
    });
    expect(view.restartHistory[0]?.recordedAt).toBe("2026-11-07T00:00:01Z");
  });

  test("figures are token counts only — no prompt text or transcript", () => {
    const view = deriveEconomicsView({
      records: [
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-235",
          runId: "run-fixture",
          sessionId: "ses_fixture_CANARY_PROMPT",
          ordinal: 1,
          reason: "session-interrupted",
          repayTokens: { inputTokens: 10, outputTokens: 5 },
          observedUniqueProgressTokens: 10,
          recordedAt: "2026-11-07T00:00:01Z",
        },
      ],
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("PROMPT-CANARY");
    expect(serialized).not.toContain("transcript");
    expect(view.resumeAmplification).toBe(1.5);
  });
});
