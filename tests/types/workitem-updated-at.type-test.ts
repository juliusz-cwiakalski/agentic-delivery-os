/**
 * TC-CONTRACT-001 type probe — `WorkItem.updatedAt` is optional, readonly, and
 * string-typed (ADR-0004).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 * A `@ts-expect-error` assertion fails the build if the line ever compiles.
 */
import type { WorkItem } from "../../packages/core/src/contracts/ports";

const base: WorkItem = {
  identity: { systemName: "tracker.example", entityId: "1" },
  title: "A work item",
  status: { nativeStatus: "Open", deliveryState: "ready" },
  labels: [],
  relations: [],
};

/** Absence is the default: an item without activity data is valid. */
export const withoutUpdatedAt: WorkItem = base;

/** A provider-native ISO-8601 UTC string is copied verbatim. */
export const withUpdatedAt: WorkItem = {
  ...base,
  updatedAt: "2026-10-20T10:00:00.000+0000",
};

// @ts-expect-error reason: updatedAt must be a string, never a number
export const numericUpdatedAt: WorkItem = { ...base, updatedAt: 1_760_000_000 };

// @ts-expect-error reason: a provider-native timestamp object is not the contract type
export const objectUpdatedAt: WorkItem = { ...base, updatedAt: new Date() };

// @ts-expect-error reason: an explicit `undefined` is not absence under exactOptionalPropertyTypes
export const explicitUndefinedUpdatedAt: WorkItem = { ...base, updatedAt: undefined };

/** The field is readonly: consumers may not rewrite provider-resolved activity. */
export const reassignUpdatedAt = (item: WorkItem): void => {
  // @ts-expect-error reason: updatedAt is a readonly contract field
  item.updatedAt = "2026-10-21T00:00:00.000Z";
};

export type Probes = [
  typeof withoutUpdatedAt,
  typeof withUpdatedAt,
  typeof numericUpdatedAt,
  typeof objectUpdatedAt,
  typeof explicitUndefinedUpdatedAt,
  typeof reassignUpdatedAt,
];
