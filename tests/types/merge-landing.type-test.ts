/**
 * TC-F2-008 type probe — no internal rebase, no head mutation, and no
 * force/bypass/auto-merge/queue/retry variant is representable in the landing
 * path (AC-F2-6, API-2).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root
 * `pnpm typecheck` compiles it through `tests/types/tsconfig.json`.
 */
import type {
  DeliveryRequestLandingStrategy,
  MergeDeliveryRequestInput,
  ProviderQualifiedIdentity,
} from "../../packages/core/src/contracts/index";
import type {
  MergeLandResult,
  MergeTransactionPorts,
} from "../../packages/core/src/domain/merge-transaction";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

/** The strategy union is exactly one member: squash. */
type StrategyIsSquashOnly = Expect<Equal<DeliveryRequestLandingStrategy, "squash">>;

/** The transaction's landing port takes the canonical closed argument shape. */
type LandingPortTakesTheCanonicalInput = Expect<
  Equal<Parameters<MergeTransactionPorts["land"]>[0], MergeDeliveryRequestInput>
>;

/** The retained refresh capability has no port of its own: zero composed callers. */
type NoComposedRefresh = Expect<
  Equal<"refresh" extends keyof MergeTransactionPorts ? true : false, false>
>;

/** The landing outcome claims no local containment: containment is a separate read. */
type NoContainmentMember = Expect<
  Equal<"containedOnBase" extends keyof MergeLandResult ? true : false, false>
>;

const deliveryRequest: ProviderQualifiedIdentity = { systemName: "github", entityId: "349" };

export const minimal: MergeDeliveryRequestInput = { deliveryRequest, strategy: "squash" };
export const full: MergeDeliveryRequestInput = {
  ...minimal,
  commitTitle: "merge(GH-349): squash feat/GH-349/merge-closeout-queue-repair",
  commitMessage: "Landed by the delivery lifecycle merge primitive.",
  expectedHeadSha: "1111111111111111111111111111111111111111",
};

export const rejectedMergeCommit: MergeDeliveryRequestInput = {
  deliveryRequest,
  // @ts-expect-error a merge-commit strategy is not representable
  strategy: "merge",
};
// @ts-expect-error a rebase strategy is not representable
export const rejectedRebase: MergeDeliveryRequestInput = { deliveryRequest, strategy: "rebase" };
// @ts-expect-error force is not representable
export const rejectedForce: MergeDeliveryRequestInput = { ...minimal, force: true };
// @ts-expect-error branch-protection bypass is not representable
export const rejectedBypass: MergeDeliveryRequestInput = { ...minimal, bypassProtection: true };
// @ts-expect-error an auto-merge flag is not representable
export const rejectedAutoMerge: MergeDeliveryRequestInput = { ...minimal, autoMerge: true };
// @ts-expect-error a merge queue is not representable
export const rejectedQueue: MergeDeliveryRequestInput = { ...minimal, mergeQueue: true };
// @ts-expect-error a landing retry variant is not representable
export const rejectedRetry: MergeDeliveryRequestInput = { ...minimal, retry: true };

export type Probes = [
  StrategyIsSquashOnly,
  LandingPortTakesTheCanonicalInput,
  NoComposedRefresh,
  NoContainmentMember,
];
export const rejected = [
  rejectedMergeCommit,
  rejectedRebase,
  rejectedForce,
  rejectedBypass,
  rejectedAutoMerge,
  rejectedQueue,
  rejectedRetry,
];
