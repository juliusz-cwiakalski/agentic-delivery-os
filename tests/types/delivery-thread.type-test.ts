/**
 * TC-THREAD-009 / TC-FLOOR-007 type probes (DM-8, AC-F5-4, NFR-8).
 *
 * `DeliveryThread` keeps its exact field set: the bounded discussion read is an
 * adapter-local evidence shape, never a widened thread contract, and no reply or
 * body field is representable.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type { DeliveryThread } from "../../packages/core/src/contracts/index";

export const thread: DeliveryThread = {
  threadId: "PRRT_2",
  resolved: false,
  commentCount: 3,
};

export const keys: (keyof DeliveryThread)[] = [
  "threadId",
  "resolved",
  "commentCount",
  "authorLogin",
  "authorKind",
  "authorAssociation",
];

type Exact<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

/** The field set is exact in both directions. */
export const exactFieldSet: Exact<
  keyof DeliveryThread,
  "threadId" | "resolved" | "commentCount" | "authorLogin" | "authorKind" | "authorAssociation"
> = true;

export const withAuthorFacts: DeliveryThread = {
  ...thread,
  authorLogin: "reviewer-placeholder",
  authorKind: "human",
  authorAssociation: "MEMBER",
};

// @ts-expect-error no comment body is part of the thread contract
export const withBody: DeliveryThread = { ...thread, body: "discussion text" };

// @ts-expect-error no reply list is part of the thread contract
export const withReplies: DeliveryThread = { ...thread, replies: [] };

// ---------------------------------------------------------------------------
// TC-FLOOR-007: the evidence work adds no field to the normalized views.
// ---------------------------------------------------------------------------

import type { DeliveryRequest, WorkItem } from "../../packages/core/src/contracts/index";

export const exactDeliveryRequest: Exact<
  keyof DeliveryRequest,
  | "identity"
  | "sourceRef"
  | "targetRef"
  | "reviewState"
  | "threads"
  | "headSha"
  | "sourceHeadSha"
  | "mergeableState"
  | "commitCount"
  | "changedFileCount"
> = true;

export const exactWorkItem: Exact<
  keyof WorkItem,
  | "identity"
  | "title"
  | "status"
  | "labels"
  | "assignee"
  | "relations"
  | "comments"
  | "milestone"
  | "updatedAt"
> = true;

// The evidence reads add no body to a delivery request.
export const requestWithBody: DeliveryRequest = {
  identity: { systemName: "github", entityId: "504" },
  sourceRef: "feat/GH-338/x",
  targetRef: "main-tools",
  reviewState: "open",
  threads: [],
  // @ts-expect-error no body is part of the delivery-request contract
  body: "evidence",
};

// The evidence reads add no excerpt to a work item.
export const workItemWithExcerpt: WorkItem = {
  identity: { systemName: "github", entityId: "601" },
  title: "Issue",
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels: [],
  relations: [],
  // @ts-expect-error no excerpt is part of the work-item contract
  excerpt: "evidence",
};
