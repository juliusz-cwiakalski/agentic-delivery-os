/**
 * TC-LAND-001 / TC-LAND-008 / TC-PARITY-010 type probes (DM-1, AC-F3-1, AC-F3-5).
 *
 * The ninth closed operation's argument shape is squash-only, carries crafted
 * commit metadata and an optional head guard, and cannot represent force,
 * bypass, auto-merge, a merge queue, rebase, or a merge-commit strategy. The
 * landing identity in the outcome is optional because absence means unknown.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type {
  AdapterOperation,
  DeliveryRequestLandingStrategy,
  MergeDeliveryRequestInput,
  MergeDeliveryRequestOutcome,
  ProviderQualifiedIdentity,
} from "../../packages/core/src/contracts/index";

const deliveryRequest: ProviderQualifiedIdentity = { systemName: "github", entityId: "504" };

export const minimal: MergeDeliveryRequestInput = { deliveryRequest, strategy: "squash" };
export const full: MergeDeliveryRequestInput = {
  ...minimal,
  commitTitle: "feat: crafted",
  commitMessage: "crafted body",
  expectedHeadSha: "1111111111111111111111111111111111111111",
};
export const strategy: DeliveryRequestLandingStrategy = "squash";
export const outcomeWithIdentity: MergeDeliveryRequestOutcome = {
  merged: true,
  mergeCommitSha: "4444444444444444444444444444444444444444",
};
export const outcomeWithoutIdentity: MergeDeliveryRequestOutcome = { merged: true };

// @ts-expect-error a merge-commit strategy is not representable
export const rejectedStrategy: MergeDeliveryRequestInput = { deliveryRequest, strategy: "merge" };

// @ts-expect-error force is not representable
export const rejectedForce: MergeDeliveryRequestInput = { ...minimal, force: true };

// @ts-expect-error branch-protection bypass is not representable
export const rejectedBypass: MergeDeliveryRequestInput = { ...minimal, bypassProtection: true };

// @ts-expect-error an auto-merge flag is not representable
export const rejectedAutoMerge: MergeDeliveryRequestInput = { ...minimal, autoMerge: true };

// @ts-expect-error a merge queue is not representable
export const rejectedQueue: MergeDeliveryRequestInput = { ...minimal, mergeQueue: true };

// @ts-expect-error the strategy is required
export const rejectedMissingStrategy: MergeDeliveryRequestInput = { deliveryRequest };

export const operationLabel = (operation: AdapterOperation): string => {
  switch (operation) {
    case "read-work-item":
      return "read-work-item";
    case "write-work-item":
      return "write-work-item";
    case "transition-work-item":
      return "transition-work-item";
    case "read-delivery-request":
      return "read-delivery-request";
    case "write-delivery-request":
      return "write-delivery-request";
    case "read-pipeline-run":
      return "read-pipeline-run";
    case "write-comment":
      return "write-comment";
    case "resolve-delivery-thread":
      return "resolve-delivery-thread";
    case "merge-delivery-request":
      return "merge-delivery-request";
    case "close-milestone":
      return "close-milestone";
    default: {
      const unhandled: never = operation;
      return unhandled;
    }
  }
};

/** A consumer that forgot the tenth operation must fail loudly at compile time. */
const nonExhaustive = (operation: AdapterOperation): string => {
  switch (operation) {
    case "read-work-item":
      return "read";
    default: {
      // @ts-expect-error the closed set grew: omitting close-milestone is a type error
      const unhandled: never = operation;
      return String(unhandled);
    }
  }
};

export const notExhaustive = nonExhaustive;
