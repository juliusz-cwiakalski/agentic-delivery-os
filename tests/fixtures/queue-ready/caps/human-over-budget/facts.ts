/**
 * Synthetic over-budget human render (R3.1, TC-QREADY-020).
 *
 * The payload is a legal, fully byte-capped eight-candidate view; only an
 * over-long injected brand pushes the rendered digest above 4 096 bytes, so the
 * renderer must drop trailing candidate lines in reverse rank order.
 */
import type {
  BrandIdentity,
  QueueReadyFacts,
} from "../../../../../packages/core/src/contracts/index";
import {
  baseFacts,
  deliveryRequestRead,
  makeDeliveryRequest,
  makeWorkItem,
  REVIEWS_AVAILABLE,
  SYNTHETIC_BRAND,
  workItemRead,
} from "../../harness";

export const humanOverBudgetRefs = [
  "GH-176",
  "GH-177",
  "GH-178",
  "GH-179",
  "GH-180",
  "GH-181",
  "GH-182",
  "GH-183",
] as const;

/** An injected brand long enough to exceed the human bound after every cap. */
export const HUMAN_OVER_BUDGET_BRAND: BrandIdentity = {
  ...SYNTHETIC_BRAND,
  binaryName: "x".repeat(3500),
};

export const humanOverBudgetFacts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...humanOverBudgetRefs],
    tracker: workItemRead(
      humanOverBudgetRefs.map((ref) =>
        makeWorkItem({ entityId: ref.replace(/^GH-/, ""), labels: ["priority:high"] }),
      ),
    ),
    changes: deliveryRequestRead(
      humanOverBudgetRefs.map((ref) =>
        makeDeliveryRequest({
          entityId: "201",
          sourceRef: `feat/${ref}/${"a".repeat(116)}`,
          reviewState: "approved",
        }),
      ),
      REVIEWS_AVAILABLE,
    ),
  });
