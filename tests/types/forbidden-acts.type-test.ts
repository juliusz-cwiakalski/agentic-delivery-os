/**
 * TC-SYNC-008 type probes — force, bypass, auto-merge, queue, rebase and the
 * milestone lifecycle acts are unrepresentable across the landing, mutation and
 * close-milestone vocabularies (GH-349, AC-F2-6, AC-F4-5, NFR-9).
 *
 * Not named `*.test.ts`; `tests/types/tsconfig.json` compiles it.
 */
import type {
  CloseoutMilestoneArguments,
  DeliveryRequestLandingStrategy,
  MergeDeliveryRequestInput,
  ProviderQualifiedIdentity,
  QueueMutationResult,
} from "../../packages/core/src/contracts/index";
import { QUEUE_MUTATION_RESULTS } from "../../packages/core/src/contracts/index";

const deliveryRequest: ProviderQualifiedIdentity = { systemName: "github", entityId: "504" };
const minimal: MergeDeliveryRequestInput = { deliveryRequest, strategy: "squash" };

// @ts-expect-error force is not a landing strategy
export const forcedStrategy: DeliveryRequestLandingStrategy = "force";

// @ts-expect-error bypass is not a landing strategy
export const bypassStrategy: DeliveryRequestLandingStrategy = "bypass";

// @ts-expect-error auto-merge is not a landing strategy
export const autoMergeStrategy: DeliveryRequestLandingStrategy = "auto-merge";

// @ts-expect-error a merge queue is not a landing strategy
export const queueStrategy: DeliveryRequestLandingStrategy = "queue";

// @ts-expect-error rebase is not a landing strategy
export const rebaseStrategy: DeliveryRequestLandingStrategy = "rebase";

// @ts-expect-error force is not a landing input member
export const forcedInput: MergeDeliveryRequestInput = { ...minimal, force: true };

// @ts-expect-error bypass is not a landing input member
export const bypassInput: MergeDeliveryRequestInput = { ...minimal, bypassProtection: true };

// @ts-expect-error auto-merge is not a landing input member
export const autoMergeInput: MergeDeliveryRequestInput = { ...minimal, autoMerge: true };

// @ts-expect-error a merge queue is not a landing input member
export const queueInput: MergeDeliveryRequestInput = { ...minimal, mergeQueue: true };

// @ts-expect-error rebase is not a landing input member
export const rebaseInput: MergeDeliveryRequestInput = { ...minimal, rebase: true };

// @ts-expect-error the close-milestone arguments admit only the milestone identity
export const milestoneCreate: CloseoutMilestoneArguments = { milestone: "4", create: true };

export const queueMutationResults: readonly QueueMutationResult[] = [...QUEUE_MUTATION_RESULTS];

type Expect<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

export type QueueMutationUnion = Expect<Equal<QueueMutationResult, "added" | "updated" | "noop">>;
export type QueueMutationSet = Expect<
  Equal<(typeof QUEUE_MUTATION_RESULTS)[number], QueueMutationResult>
>;
