/**
 * The canonical golden payload (TC-QREADY-029).
 *
 * Produced by `evaluateQueueReady` from a reachable canonical fact set, not a
 * hand-built candidate array. The byte golden carries `merge-ready`,
 * `review-pending`, `new-start`, and `not-ready` plus one clamped provider ref
 * (`value-clamped`); `unknown` close association is read-scoped, so it lives in
 * a second evaluator-produced fact set whose pulls read fails.
 */
import type {
  QueueReadyFacts,
  QueueReadyPayload,
} from "../../../../packages/core/src/contracts/index";
import { evaluateQueueReady } from "../../../../packages/core/src/domain/queue-ready";
import {
  baseFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  makeDeliveryRequest,
  makeWorkItem,
  REVIEWS_AVAILABLE,
  workItemRead,
} from "../harness";

export const canonicalRefs = ["GH-175", "GH-179", "GH-170", "GH-181"] as const;

/** 142 characters: over `QUEUE_READY_MAX_REF_CHARS`, so the projection clamps it. */
const clampedSourceRef = `feat/GH-175/${"a".repeat(130)}`;

export const canonicalFacts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...canonicalRefs],
    tracker: workItemRead([
      makeWorkItem({ entityId: "175", labels: ["priority:high"] }),
      makeWorkItem({ entityId: "179", labels: ["priority:high"] }),
      makeWorkItem({ entityId: "170", labels: ["priority:high"] }),
      // No tier label: observed but not ready (tier-known unknown).
      makeWorkItem({ entityId: "181", labels: [] }),
    ]),
    changes: deliveryRequestRead(
      [
        makeDeliveryRequest({
          entityId: "1234567890123456789012345678901234567890",
          sourceRef: clampedSourceRef,
          reviewState: "approved",
        }),
        makeDeliveryRequest({
          entityId: "209",
          sourceRef: "feat/GH-179/pending",
          reviewState: "open",
        }),
      ],
      REVIEWS_AVAILABLE,
    ),
  });

export const canonicalPayload = (): QueueReadyPayload => evaluateQueueReady(canonicalFacts());

export const canonicalUnknownCloseRefs = ["GH-175", "GH-179"] as const;

/**
 * Every candidate is observed with all six conditions satisfied and `ready`
 * true; the failed pulls read makes each close association `unknown` and forces
 * `pr-association-unknown` into reason group 6.
 */
export const canonicalUnknownCloseFacts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...canonicalUnknownCloseRefs],
    tracker: workItemRead([
      makeWorkItem({ entityId: "175", labels: ["priority:high"] }),
      makeWorkItem({ entityId: "179", labels: ["priority:high"] }),
    ]),
    changes: failedDeliveryRequestRead("read-failed"),
  });

export const canonicalUnknownClosePayload = (): QueueReadyPayload =>
  evaluateQueueReady(canonicalUnknownCloseFacts());
