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
