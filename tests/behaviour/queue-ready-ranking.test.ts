/**
 * TC-QREADY-017 — deterministic ranking with class order, numeric-aware refs,
 * and caller/API order independence.
 */
import { describe, expect, test } from "bun:test";
import {
  QUEUE_READY_RANK_CLASS_ORDER,
  type QueueReadyPayload,
} from "../../packages/core/src/contracts/index";
import {
  deliveryRequestRead,
  evaluate,
  makeDeliveryRequest,
  makeWorkItem,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  workItemRead,
} from "../fixtures/queue-ready/harness";
import {
  classOrderAtLimitCandidates,
  classOrderAtLimitExpected,
  classOrderBelowLimit,
  classOrderBelowLimitExpected,
  largeSuffixCandidates,
  largeSuffixOrder,
  numericCandidates,
  numericOrder,
} from "../fixtures/queue-ready/ranking/cases";

const item = (entityId: string, labels: readonly string[] = ["priority:high"]) =>
  makeWorkItem({ entityId, labels });

const pr = (entityId: string, sourceRef: string, reviewState: "open" | "approved" = "open") =>
  makeDeliveryRequest({ entityId, sourceRef, reviewState });

const order = (payload: QueueReadyPayload) =>
  payload.candidates.map((candidate) => [candidate.workItemRef, candidate.closeClass]);

describe("TC-QREADY-017 ranking", () => {
  test("numeric-aware refs and canonical text ties", () => {
    const payload = evaluate({
      candidates: [...numericCandidates],
      tracker: workItemRead([...numericCandidates].map((ref) => item(ref.replace(/^.*-/, "")))),
    });
    expect(payload.candidates.map((candidate) => candidate.workItemRef)).toEqual([...numericOrder]);
    expect(payload.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(payload.candidates.every((candidate) => candidate.closeClass === "new-start")).toBe(
      true,
    );
  });

  test("large numeric suffixes rank numerically without Number precision loss", () => {
    const tracker = () =>
      workItemRead([...largeSuffixCandidates].map((ref) => item(ref.replace(/^.*-/, ""))));
    const payload = evaluate({ candidates: [...largeSuffixCandidates], tracker: tracker() });
    expect(payload.candidates.map((candidate) => candidate.workItemRef)).toEqual([
      ...largeSuffixOrder,
    ]);
    // The pinned order is strictly increasing under arbitrary-precision
    // comparison (the same semantics as the domain's compareNumericAware).
    for (let index = 1; index < largeSuffixOrder.length; index += 1) {
      const previous = largeSuffixOrder[index - 1];
      const current = largeSuffixOrder[index];
      if (previous === undefined || current === undefined) continue;
      expect(BigInt(previous.replace(/^.*-/, ""))).toBeLessThan(
        BigInt(current.replace(/^.*-/, "")),
      );
    }
    const reversed = evaluate({
      candidates: [...largeSuffixCandidates].reverse(),
      tracker: tracker(),
    });
    expect(reversed.candidates.map((candidate) => candidate.workItemRef)).toEqual([
      ...largeSuffixOrder,
    ]);
    expect([...numericOrder].slice(0, 2)).toEqual(["GH-007", "GH-7"]);
  });

  test("caller order never decides the result", () => {
    const forward = evaluate({
      candidates: [...numericCandidates],
      tracker: workItemRead([...numericCandidates].map((ref) => item(ref.replace(/^.*-/, "")))),
    });
    const reversed = evaluate({
      candidates: [...numericCandidates].reverse(),
      tracker: workItemRead([...numericCandidates].map((ref) => item(ref.replace(/^.*-/, "")))),
    });
    expect(reversed.candidates.map((candidate) => candidate.workItemRef)).toEqual(
      forward.candidates.map((candidate) => candidate.workItemRef),
    );
  });

  test("all four below-limit classes rank in the declared order", () => {
    const payload = evaluate({
      candidates: [...classOrderBelowLimit],
      tracker: workItemRead([item("175"), item("179"), item("170"), item("181", ["hand-back"])]),
      changes: deliveryRequestRead(
        [pr("1", "feat/GH-175/x", "approved"), pr("2", "feat/GH-179/x")],
        { ...REVIEWS_AVAILABLE, reviewThreads: "unavailable" },
      ),
    });
    expect(order(payload)).toEqual(classOrderBelowLimitExpected.map((entry) => [...entry]));
    expect(payload.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3, 4]);
  });

  test("at-limit review-pending ranks above unknown and not-ready", () => {
    const items = [
      pr("1", "feat/GH-179/x"),
      ...Array.from({ length: 99 }, (_, index) => pr(String(index + 2), `feat/other-${index}/x`)),
    ];
    const payload = evaluate({
      candidates: [...classOrderAtLimitCandidates],
      tracker: workItemRead([item("179"), item("170"), item("181", ["hand-back"])]),
      changes: deliveryRequestRead(items, REVIEWS_UNAVAILABLE, 100),
    });
    expect(order(payload)).toEqual(classOrderAtLimitExpected.map((entry) => [...entry]));
  });

  test("no close item ranks below a ready new start", () => {
    const payload = evaluate({
      candidates: ["GH-175", "GH-170"],
      tracker: workItemRead([item("175"), item("170")]),
      changes: deliveryRequestRead([pr("1", "feat/GH-175/x", "approved")], {
        ...REVIEWS_AVAILABLE,
        reviewThreads: "unavailable",
      }),
    });
    const mergeReady = payload.candidates.find((candidate) => candidate.workItemRef === "GH-175");
    const newStart = payload.candidates.find((candidate) => candidate.workItemRef === "GH-170");
    expect(mergeReady?.closeClass).toBe("merge-ready");
    expect(newStart?.closeClass).toBe("new-start");
    expect(mergeReady?.rank).toBeLessThan(newStart?.rank ?? 0);
  });

  test("the class-rank vocabulary is the declared order", () => {
    expect([...QUEUE_READY_RANK_CLASS_ORDER]).toEqual([
      "merge-ready",
      "review-pending",
      "new-start",
      "unknown",
      "not-ready",
    ]);
  });

  test("ranks are 1-based across eight candidates", () => {
    const refs = Array.from({ length: 8 }, (_, index) => `GH-${index + 1}`);
    const payload = evaluate({
      candidates: refs,
      tracker: workItemRead(refs.map((ref) => item(ref.replace(/^.*-/, "")))),
    });
    expect(payload.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("API order never changes the selected close item", () => {
    const items = [pr("2", "feat/GH-175/b"), pr("1", "feat/GH-175/a")];
    const forward = evaluate({
      candidates: ["GH-175"],
      tracker: workItemRead([item("175")]),
      changes: deliveryRequestRead(items, REVIEWS_UNAVAILABLE),
    });
    const reversed = evaluate({
      candidates: ["GH-175"],
      tracker: workItemRead([item("175")]),
      changes: deliveryRequestRead([...items].reverse(), REVIEWS_UNAVAILABLE),
    });
    expect(forward.candidates[0]?.close.pullRequest?.sourceRef).toBe(
      reversed.candidates[0]?.close.pullRequest?.sourceRef,
    );
  });
});
