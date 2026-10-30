/**
 * TC-PORT-004 compile-time probe — carrier selection excludes undeclared
 * carriers by typing and rejects a widened `string` union.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; `tests/types/tsconfig.json`
 * compiles it through the root `typecheck` script.
 */
import type {
  CarrierKind,
  CarrierSelectionInput,
} from "../../packages/core/src/contracts/adapter-capabilities";

const commentBlockOnly = ["invisible-comment-block"] as const;
type CommentBlockOnly = typeof commentBlockOnly;

const declared: CarrierSelectionInput<CommentBlockOnly> = {
  carrier: "invisible-comment-block",
};

// @ts-expect-error reason: an undeclared carrier literal is excluded by typing
const undeclared: CarrierSelectionInput<CommentBlockOnly> = { carrier: "compact-marker" };

// @ts-expect-error reason: a widened `string` union is not a declared carrier set
export type Widened = CarrierSelectionInput<string[]>;

const everyCarrier: readonly CarrierKind[] = [
  "invisible-comment-block",
  "provider-custom-field",
  "compact-marker",
];

export type Probes = [typeof declared, typeof undeclared, typeof everyCarrier];
