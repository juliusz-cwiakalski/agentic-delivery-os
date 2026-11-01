/** Merged delivery-request lookup fixtures (deterministic selection). */
import type { DeliveryRequest } from "../../../packages/core/src/contracts/index";
import { BRANCH_NAME, MERGED_HEAD_SHA, SYSTEM_NAME } from "./harness";

const request = (entityId: string, headSha?: string): DeliveryRequest => ({
  identity: { systemName: SYSTEM_NAME, entityId },
  sourceRef: BRANCH_NAME,
  targetRef: "main-tools",
  reviewState: "merged",
  threads: [],
  ...(headSha === undefined ? {} : { headSha }),
});

export const MERGED_REQUESTS: readonly DeliveryRequest[] = [
  request("42", MERGED_HEAD_SHA),
  request("504", MERGED_HEAD_SHA),
  request("77", MERGED_HEAD_SHA),
];

export const SELECTED_MERGED_ENTITY = "504";
