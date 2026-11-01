/**
 * Close association/classification cases (TC-QREADY-013/014/015).
 */
import type {
  DeliveryRequest,
  QueueReadyClose,
  QueueReadyCloseClass,
} from "../../../../packages/core/src/contracts/index";
import {
  deliveryRequestRead,
  type FactsOverrides,
  failedDeliveryRequestRead,
  makeDeliveryRequest,
  pipelineRunRead,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  unavailableBinding,
} from "../harness";

export type CloseCase = {
  readonly name: string;
  readonly facts: FactsOverrides;
  readonly association: QueueReadyClose["association"];
  readonly reason: QueueReadyClose["reason"];
  readonly associatedCount: number;
  readonly closeClass: QueueReadyCloseClass;
  readonly selected?: string;
};

const pr = (
  entityId: string,
  input: Partial<Parameters<typeof makeDeliveryRequest>[0]> = {},
): DeliveryRequest =>
  makeDeliveryRequest({ entityId, sourceRef: `feat/GH-176/slug-${entityId}`, ...input });

const pending = (): FactsOverrides => ({
  ci: pipelineRunRead([]),
});

export const closeCases: readonly CloseCase[] = [
  {
    name: "branch-associated",
    facts: { changes: deliveryRequestRead([pr("1")]) },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
  {
    name: "case-insensitive-segment",
    facts: { changes: deliveryRequestRead([pr("1", { sourceRef: "feat/gh-176/slug" })]) },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
  {
    name: "one-segment-ref",
    facts: { changes: deliveryRequestRead([pr("1", { sourceRef: "GH-176" })]) },
    association: "not-associated",
    reason: "pr-not-associated",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "two-segment-ref",
    facts: { changes: deliveryRequestRead([pr("1", { sourceRef: "feat/GH-176" })]) },
    association: "not-associated",
    reason: "pr-not-associated",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "substring-segment-rejected",
    facts: { changes: deliveryRequestRead([pr("1", { sourceRef: "feat/GH-176x/slug" })]) },
    association: "not-associated",
    reason: "pr-not-associated",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "target-ref-ignored",
    facts: {
      changes: deliveryRequestRead([
        pr("1", { sourceRef: "feat/other/slug", targetRef: "GH-176" }),
      ]),
    },
    association: "not-associated",
    reason: "pr-not-associated",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "below-limit-no-match",
    facts: { changes: deliveryRequestRead([]) },
    association: "not-associated",
    reason: "pr-not-associated",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "at-limit-no-match",
    facts: {
      changes: deliveryRequestRead(
        Array.from({ length: 100 }, (_, index) =>
          pr(String(index + 1), { sourceRef: `feat/other-${index}/slug` }),
        ),
        REVIEWS_UNAVAILABLE,
        100,
      ),
    },
    association: "unknown",
    reason: "pr-association-unknown",
    associatedCount: 0,
    closeClass: "unknown",
  },
  {
    name: "merged-only-below-limit",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "merged" })]),
    },
    association: "not-associated",
    reason: "pr-not-open",
    associatedCount: 0,
    closeClass: "new-start",
  },
  {
    name: "merged-only-not-ready",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "closed" })]),
      ...pending(),
    },
    association: "not-associated",
    reason: "pr-not-open",
    associatedCount: 0,
    closeClass: "not-ready",
  },
  {
    name: "at-limit-merged-only",
    facts: {
      changes: deliveryRequestRead(
        [
          pr("1", { reviewState: "merged" }),
          ...Array.from({ length: 99 }, (_, index) =>
            pr(String(index + 2), { sourceRef: `feat/other-${index}/slug` }),
          ),
        ],
        REVIEWS_UNAVAILABLE,
        100,
      ),
    },
    association: "unknown",
    reason: "pr-association-unknown",
    associatedCount: 0,
    closeClass: "unknown",
  },
  {
    name: "open-plus-merged-counts-open-only",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "merged" }), pr("2")]),
    },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "2",
  },
  {
    name: "review-pending-not-ready",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "draft" })]),
      ...pending(),
    },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
  {
    name: "merge-ready",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "approved" })], REVIEWS_AVAILABLE),
    },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "merge-ready",
    selected: "1",
  },
  {
    name: "approved-with-unavailable-review-is-pending",
    facts: {
      changes: deliveryRequestRead([pr("1", { reviewState: "approved" })], REVIEWS_UNAVAILABLE),
    },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
  {
    name: "changes-requested-is-pending",
    facts: {
      changes: deliveryRequestRead(
        [pr("1", { reviewState: "changes-requested" })],
        REVIEWS_AVAILABLE,
      ),
    },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
  {
    name: "binding-unavailable",
    facts: {
      repository: { binding: unavailableBinding(), head: { branch: "x", detached: false } },
    },
    association: "unknown",
    reason: "pr-association-unknown",
    associatedCount: 0,
    closeClass: "not-ready",
  },
  {
    name: "pr-read-failed",
    facts: { changes: failedDeliveryRequestRead("read-failed") },
    association: "unknown",
    reason: "pr-association-unknown",
    associatedCount: 0,
    closeClass: "unknown",
  },
  {
    name: "restored-control",
    facts: { changes: deliveryRequestRead([pr("1")]) },
    association: "associated",
    reason: "pr-associated",
    associatedCount: 1,
    closeClass: "review-pending",
    selected: "1",
  },
];
