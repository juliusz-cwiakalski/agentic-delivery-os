/**
 * TC-QREADY-013 / TC-QREADY-014 / TC-QREADY-015 / TC-QREADY-016 — close
 * association, classification, unknown sources, deterministic selection, and
 * associatedCount.
 */
import { describe, expect, test } from "bun:test";
import type { DeliveryRequest } from "../../packages/core/src/contracts/index";
import { closeCases } from "../fixtures/queue-ready/close/cases";
import {
  deliveryRequestRead,
  evaluate,
  makeDeliveryRequest,
  REVIEWS_AVAILABLE,
} from "../fixtures/queue-ready/harness";

const closeOf = (facts: Parameters<typeof evaluate>[0]) => {
  const candidate = evaluate(facts).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  return candidate;
};

const pr = (
  entityId: string,
  input: Partial<Parameters<typeof makeDeliveryRequest>[0]> = {},
): DeliveryRequest =>
  makeDeliveryRequest({ entityId, sourceRef: `feat/GH-176/slug-${entityId}`, ...input });

describe("TC-QREADY-013/014/015 close association and classification", () => {
  test("each case matches association, reason, count, class, and selection", () => {
    for (const testCase of closeCases) {
      const candidate = closeOf(testCase.facts);
      expect(candidate.close.association, testCase.name).toBe(testCase.association);
      expect(candidate.close.reason, testCase.name).toBe(testCase.reason);
      expect(candidate.close.associatedCount, testCase.name).toBe(testCase.associatedCount);
      expect(candidate.closeClass, testCase.name).toBe(testCase.closeClass);
      expect(candidate.close.pullRequest?.entityId, testCase.name).toBe(testCase.selected);
    }
  });

  test("command-level association never emits pr-not-open", () => {
    for (const testCase of closeCases) {
      if (
        testCase.name === "merged-only-below-limit" ||
        testCase.name === "merged-only-not-ready"
      ) {
        continue;
      }
      expect(closeOf(testCase.facts).close.reason, testCase.name).not.toBe("pr-not-open");
    }
  });

  test("an at-limit page sets the payload marker but not the candidate flag", () => {
    const candidate = closeOf(
      closeCases.find((entry) => entry.name === "at-limit-no-match")?.facts ?? {},
    );
    const payload = evaluate(
      closeCases.find((entry) => entry.name === "at-limit-no-match")?.facts ?? {},
    );
    expect(payload.reasons).toContain("source-truncated");
    expect(payload.truncated).toBe(true);
    expect(candidate.truncated).toBe(false);
  });

  test("a merged/closed object is never selected or counted", () => {
    const candidate = closeOf(
      closeCases.find((entry) => entry.name === "open-plus-merged-counts-open-only")?.facts ?? {},
    );
    expect(candidate.close.associatedCount).toBe(1);
    expect(candidate.close.pullRequest?.entityId).toBe("2");
  });

  test("unknown association is never new-start", () => {
    for (const name of ["binding-unavailable", "pr-read-failed", "at-limit-no-match"]) {
      const candidate = closeOf(closeCases.find((entry) => entry.name === name)?.facts ?? {});
      expect(candidate.closeClass, name).not.toBe("new-start");
    }
  });
});

describe("TC-QREADY-016 deterministic same-class selection", () => {
  const selected = (
    items: readonly DeliveryRequest[],
    availability = REVIEWS_AVAILABLE,
  ): string | undefined =>
    evaluate({ changes: deliveryRequestRead(items, availability) }).candidates[0]?.close.pullRequest
      ?.entityId;

  test("the merge-ready set is preferred when non-empty", () => {
    const selectedId = selected([
      pr("9", { reviewState: "open" }),
      pr("10", { reviewState: "approved" }),
    ]);
    expect(selectedId).toBe("10");
  });

  test("entityId ascending is numeric-aware and API order never decides", () => {
    expect(selected([pr("10"), pr("9")])).toBe("9");
    expect(selected([pr("9"), pr("10")])).toBe("9");
  });

  test("sourceRef ascending breaks a numeric entityId tie", () => {
    const selectedId = selected([
      pr("7", { sourceRef: "feat/GH-176/b" }),
      pr("7", { sourceRef: "feat/GH-176/a" }),
    ]);
    expect(selectedId).toBe("7");
    const chosen = evaluate({
      changes: deliveryRequestRead([
        pr("7", { sourceRef: "feat/GH-176/b" }),
        pr("7", { sourceRef: "feat/GH-176/a" }),
      ]),
    }).candidates[0]?.close.pullRequest;
    expect(chosen?.sourceRef).toBe("feat/GH-176/a");
  });

  test("targetRef ascending breaks a sourceRef tie", () => {
    const chosen = evaluate({
      changes: deliveryRequestRead(
        [
          pr("7", { sourceRef: "feat/GH-176/a", targetRef: "target-b" }),
          pr("007", { sourceRef: "feat/GH-176/a", targetRef: "target-a" }),
        ],
        REVIEWS_AVAILABLE,
      ),
    }).candidates[0]?.close.pullRequest;
    expect(chosen?.targetRef).toBe("target-a");
  });

  test("the lexically smaller raw entityId breaks a full tie", () => {
    const chosen = evaluate({
      changes: deliveryRequestRead(
        [
          pr("7", { sourceRef: "feat/GH-176/a", targetRef: "main-tools" }),
          pr("007", { sourceRef: "feat/GH-176/a", targetRef: "main-tools" }),
        ],
        REVIEWS_AVAILABLE,
      ),
    }).candidates[0]?.close.pullRequest;
    expect(chosen?.entityId).toBe("007");
  });

  test("associatedCount counts open matches exactly", () => {
    const candidate = closeOf({
      changes: deliveryRequestRead([pr("1"), pr("2"), pr("3"), pr("4", { reviewState: "merged" })]),
    });
    expect(candidate.close.associatedCount).toBe(3);
  });
});
