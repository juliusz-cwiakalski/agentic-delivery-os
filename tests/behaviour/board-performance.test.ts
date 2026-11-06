/**
 * TC-SLA-027 — pure evaluation, ranking, and rendering complete within 50 ms
 * (warm-up + median of five); the measurement is live and records the
 * environment. Collector and state I/O are excluded.
 */
import { describe, expect, test } from "bun:test";
import {
  evaluateOwnerGateSla,
  renderBoardHuman,
  toBoardData,
} from "../../packages/core/src/domain/owner-gate-sla";
import {
  gateFact,
  HOUR_MS,
  ownerReviewGate,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const COLLECTORS = [{ collector: "tracker", outcome: "available" as const }];
const BUDGET_MS = 50;

const capSized = (): ReturnType<typeof ownerReviewGate>[] => [
  ownerReviewGate("GH-1801", HOUR_MS),
  ownerReviewGate("GH-1802", 26 * HOUR_MS),
  waiverGate("GH-1803", 72 * HOUR_MS),
  gateFact({ id: "GH-1804", absent: "missing" }),
  gateFact({ id: "GH-1805", activityAt: "not-a-date" }),
  ownerReviewGate("GH-1806", 100 * HOUR_MS, { waivedBy: "owner" }),
  ownerReviewGate("GH-1807", 73 * HOUR_MS),
  ownerReviewGate("GH-1808", 2 * HOUR_MS),
];

const overCap = (): ReturnType<typeof gateFact>[] =>
  Array.from({ length: 100 }, (_, index) =>
    gateFact({
      id: `GH-19${index.toString().padStart(3, "0")}:owner-review`,
      ref: `GH-19${index.toString().padStart(3, "0")}`,
      ageMs: (index + 1) * HOUR_MS,
    }),
  );

const measure = (
  gates: ReturnType<typeof gateFact>[],
): { readonly medianMs: number; readonly runs: readonly number[] } => {
  const evaluateOnce = (): number => {
    const started = performance.now();
    const evaluation = evaluateOwnerGateSla({
      audience: "owner",
      nowMs: Date.parse("2026-11-06T12:00:00Z"),
      nowIso: "2026-11-06T12:00:00Z",
      policy: shippedPolicy(),
      gates,
      decisions: [],
    });
    const data = toBoardData(evaluation, COLLECTORS);
    renderBoardHuman(data, SYNTHETIC_BRAND);
    return performance.now() - started;
  };
  evaluateOnce();
  const runs = Array.from({ length: 5 }, () => evaluateOnce()).sort((left, right) => left - right);
  return { medianMs: runs[2] ?? Number.POSITIVE_INFINITY, runs };
};

describe("TC-SLA-027 performance", () => {
  test("cap-sized pure evaluation/ranking/rendering median is within 50 ms", () => {
    const result = measure(capSized());
    console.log(
      `board-performance cap-sized median=${result.medianMs.toFixed(3)}ms ` +
        `runtime=${process.version} platform=${process.platform}/${process.arch}`,
    );
    expect(result.medianMs).toBeLessThanOrEqual(BUDGET_MS);
  });

  test("the 100-gate input is capped before rendering and remains within 50 ms", () => {
    const result = measure(overCap());
    console.log(`board-performance 100-gate median=${result.medianMs.toFixed(3)}ms`);
    expect(result.medianMs).toBeLessThanOrEqual(BUDGET_MS);
    const evaluation = evaluateOwnerGateSla({
      audience: "owner",
      nowMs: Date.parse("2026-11-06T12:00:00Z"),
      nowIso: "2026-11-06T12:00:00Z",
      policy: shippedPolicy(),
      gates: overCap(),
      decisions: [],
    });
    expect(evaluation.gates).toHaveLength(8);
    expect(evaluation.omitted).toBe(92);
  });

  test("the measurement is live: a deliberately expensive control is measurably slower", () => {
    const noop = (): number => {
      const started = performance.now();
      return performance.now() - started;
    };
    const busy = (): number => {
      const started = performance.now();
      const values = Array.from({ length: 25_000 }, (_, index) => (index * 7919) % 25_000);
      values.sort((left, right) => left - right);
      return performance.now() - started;
    };
    noop();
    busy();
    const noopRuns = Array.from({ length: 5 }, noop).sort((left, right) => left - right);
    const busyRuns = Array.from({ length: 5 }, busy).sort((left, right) => left - right);
    expect(busyRuns[2] ?? 0).toBeGreaterThan(noopRuns[2] ?? 0);
  });
});
