/**
 * TC-CONTRACT-001 type probe — `WorkItem.comments` is optional and readonly
 * (ADR-0006): absent means the comment set is unknown; present-empty means the
 * provider asserted there are no comments.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type { WorkItem } from "../../packages/core/src/contracts/ports";

const base: WorkItem = {
  identity: { systemName: "tracker.example", entityId: "1" },
  title: "A work item",
  status: { nativeStatus: "Open", deliveryState: "ready" },
  labels: [],
  relations: [],
};

/** Absence means the comment set is unknown, never an empty set. */
export const withoutComments: WorkItem = base;

/** A present empty array is the provider-asserted "no comments" claim. */
export const withEmptyComments: WorkItem = { ...base, comments: [] };

/** A present set carries normalized comments only. */
export const withComments: WorkItem = {
  ...base,
  comments: [{ commentId: "c-1", authorAccount: "acct-0001", body: "A comment" }],
};

// @ts-expect-error reason: comments must be an array, not a scalar
export const scalarComments: WorkItem = { ...base, comments: "none" };

// @ts-expect-error reason: a provider-native comment payload is not the contract type
export const providerNativeComments: WorkItem = { ...base, comments: { comments: [] } };

/** The field is readonly: the provider-asserted set cannot be rewritten in place. */
export const mutateComments = (item: WorkItem): void => {
  // @ts-expect-error reason: comments is a readonly contract field
  item.comments = [];
};

export type Probes = [
  typeof withoutComments,
  typeof withEmptyComments,
  typeof withComments,
  typeof scalarComments,
  typeof providerNativeComments,
  typeof mutateComments,
];
