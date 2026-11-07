/**
 * TC-BLK-038 — performance: the pure validation, guard, ranking, and rendering
 * path stays within the declared 50 ms median on the reference environment.
 *
 * Measurement method: warm-up, then the median of 50 iterations; pure functions
 * only (no CLI, state I/O, network, or wall-clock reads); environment recorded
 * in the test output (OQ-T10). The bound is not silently relaxed.
 */
import { describe, expect, test } from "bun:test";
import {
  BLOCKER_CONTENT_LIMITS,
  buildBlockerListData,
  evaluateBlockerGuard,
  rankBlockerQuestions,
  renderBlockersHuman,
  validateBlockerPublish,
} from "../../packages/core/src/domain/blockers";
import { capSizedQuestions } from "../fixtures/blockers/bounds";
import { REGISTERED_SECRET, secrets } from "../fixtures/blockers/credentials";
import { FIXED_MS } from "../fixtures/blockers/records";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ITERATIONS = 50;
const BOUND_MS = 50;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
};

const measure = (body: () => void): number => {
  for (let index = 0; index < 5; index += 1) body();
  const times: number[] = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const started = performance.now();
    body();
    times.push(performance.now() - started);
  }
  return median(times);
};

describe("TC-BLK-038 pure-path performance", () => {
  test("the full pure path stays under 50 ms median", () => {
    const questions = capSizedQuestions(8);
    const value = measure(() => {
      const validated = validateBlockerPublish(
        {
          type: "decision-needed",
          audience: "coordinator",
          lane: "L5",
          question: "q".repeat(BLOCKER_CONTENT_LIMITS.maxQuestionChars),
          options: ["a", "b", "c", "d"],
        },
        BLOCKER_CONTENT_LIMITS,
      );
      if (!validated.ok) throw new Error(validated.code);
      evaluateBlockerGuard({
        type: "decision-needed",
        question: validated.value.question,
        options: validated.value.options,
        lane: validated.value.lane,
        secrets: secrets(),
      });
      const data = buildBlockerListData(questions, [], FIXED_MS);
      renderBlockersHuman(data, SYNTHETIC_BRAND);
    });
    console.log(
      `blockers pure path median=${value.toFixed(3)}ms iterations=${ITERATIONS} bun=${Bun.version} platform=${process.platform} arch=${process.arch}`,
    );
    expect(value).toBeLessThanOrEqual(BOUND_MS);
  });

  test("the guard measures within the bound for refusal and clean pass", () => {
    const refusal = measure(() =>
      evaluateBlockerGuard({
        question: `token ${REGISTERED_SECRET}`,
        lane: "L2",
        secrets: secrets(),
      }),
    );
    const clean = measure(() =>
      evaluateBlockerGuard({
        question: "clean question",
        options: ["a", "b", "c", "d"],
        lane: "L2",
        secrets: secrets(),
      }),
    );
    console.log(
      `blockers guard median refusal=${refusal.toFixed(3)}ms clean=${clean.toFixed(3)}ms`,
    );
    expect(refusal).toBeLessThanOrEqual(BOUND_MS);
    expect(clean).toBeLessThanOrEqual(BOUND_MS);
  });

  test("ranking and rendering stay within the bound for cap-sized and over-cap sets", () => {
    const capSized = capSizedQuestions(8);
    const overCap = capSizedQuestions(20);
    const capTime = measure(() => {
      const data = buildBlockerListData(capSized, [], FIXED_MS);
      renderBlockersHuman(data, SYNTHETIC_BRAND);
    });
    const overTime = measure(() => {
      rankBlockerQuestions(overCap, [], FIXED_MS);
    });
    console.log(
      `blockers ranking median cap=${capTime.toFixed(3)}ms over=${overTime.toFixed(3)}ms`,
    );
    expect(capTime).toBeLessThanOrEqual(BOUND_MS);
    expect(overTime).toBeLessThanOrEqual(BOUND_MS);
  });

  test("the measurement instrument is live: a busy loop measures at least 10 ms", () => {
    const started = performance.now();
    while (performance.now() - started < 10) {
      // deliberate busy wait
    }
    expect(performance.now() - started).toBeGreaterThanOrEqual(10);
  });
});
