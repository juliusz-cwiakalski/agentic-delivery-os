/**
 * TC-VOCAB-005 type probe (GH-237) — the scheduling vocabularies are literal
 * unions, not widened strings, and the record-kind/schema constants are
 * literal-typed.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type {
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_ENTRY_SCHEMA,
  QUEUE_GRAPH_SCHEMA,
  QUEUE_LANE_STATES,
  QUEUE_LEASE_SCHEMA,
  QUEUE_PARK_SCHEMA,
  QUEUE_RANK_CLASSES,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RECORD_KIND,
  QUEUE_REMOVAL_RESULTS,
  QUEUE_REMOVAL_SCHEMA,
  QUEUE_WEIGHT_CLASSES,
  QueueGraphEntry,
  QueueLaneIdleReason,
  QueueLaneState,
  QueueLeaseOperation,
  QueueLeaseScope,
  QueueParkCause,
  QueueParkConditionType,
  QueueParkRecoveryState,
  QueueRankClass,
  QueueRemovalReason,
  QueueWeightClass,
  QueueWeightClassSource,
} from "../../packages/core/src/contracts/index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type RankUnion = Expect<
  Equal<QueueRankClass, "merge-ready" | "in-review" | "resume-parked" | "new-start">
>;
type WeightUnion = Expect<Equal<QueueWeightClass, "standard" | "heavy">>;
type WeightSourceUnion = Expect<
  Equal<QueueWeightClassSource, "declared" | "absent" | "plan-unreadable" | "plan-absent">
>;
type LeaseScopeUnion = Expect<Equal<QueueLeaseScope, "repo-exclusive" | "worktree">>;
type LeaseOperationUnion = Expect<
  Equal<QueueLeaseOperation, "acquired" | "renewed" | "released" | "taken-over">
>;
type ParkCauseUnion = Expect<
  Equal<
    QueueParkCause,
    "provider-window" | "provider-quota" | "preempted-for-close-item" | "peak-window" | "owner-hold"
  >
>;
type ParkConditionUnion = Expect<
  Equal<QueueParkConditionType, "provider-window" | "provider-quota" | "preemption">
>;
type RecoveryUnion = Expect<
  Equal<QueueParkRecoveryState, "parked" | "clear-observed" | "recovered" | "released">
>;
type LaneStateUnion = Expect<
  Equal<
    QueueLaneState,
    "delivering" | "idle-with-reason" | "parked" | "merge-ready" | "in-review" | "failed"
  >
>;
type IdleReasonIsClosed = Expect<Equal<QueueLaneIdleReason extends string ? true : false, true>>;

// The closed-set constants keep their literal element types.
type RankConstants = Expect<Equal<(typeof QUEUE_RANK_CLASSES)[number], QueueRankClass>>;
type WeightConstants = Expect<Equal<(typeof QUEUE_WEIGHT_CLASSES)[number], QueueWeightClass>>;
type LaneStateConstants = Expect<Equal<(typeof QUEUE_LANE_STATES)[number], QueueLaneState>>;

// Record kinds and payload schemas are literal-typed, not bare strings.
type EntryKindLiteral = Expect<Equal<typeof QUEUE_ENTRY_RECORD_KIND, "queue.entry">>;
type EntrySchemaLiteral = Expect<Equal<typeof QUEUE_ENTRY_SCHEMA, "delivery.queue.entry.v1">>;
type LeaseSchemaLiteral = Expect<Equal<typeof QUEUE_LEASE_SCHEMA, "delivery.queue.lease.v1">>;
type ParkSchemaLiteral = Expect<Equal<typeof QUEUE_PARK_SCHEMA, "delivery.queue.park.v1">>;
type GraphSchemaLiteral = Expect<Equal<typeof QUEUE_GRAPH_SCHEMA, "delivery.queue.graph.v1">>;
type RemovalKindLiteral = Expect<Equal<typeof QUEUE_REMOVAL_RECORD_KIND, "queue.removal">>;
type RemovalSchemaLiteral = Expect<Equal<typeof QUEUE_REMOVAL_SCHEMA, "delivery.queue.removal.v1">>;

// The GH-292 removal vocabularies stay closed literal unions.
type RemovalReasonUnion = Expect<
  Equal<QueueRemovalReason, "landed" | "abandoned" | "superseded" | "reconciled">
>;
type RemovalReasonConstants = Expect<
  Equal<(typeof QUEUE_REMOVAL_REASONS)[number], QueueRemovalReason>
>;
type RemovalResultConstants = Expect<Equal<(typeof QUEUE_REMOVAL_RESULTS)[number], "removed">>;

// The derived graph entry folds no repository root.
type GraphEntryHasNoRoot = Expect<
  Equal<"repositoryRoot" extends keyof QueueGraphEntry ? true : false, false>
>;

// Rejected literals: each directive is load-bearing only while the union stays closed.
// @ts-expect-error reason: `ephemeral` is outside the closed rank-class union.
const badRank: QueueRankClass = "ephemeral";
// @ts-expect-error reason: `heavyweight` is outside the closed weight-class union.
const badWeight: QueueWeightClass = "heavyweight";
// @ts-expect-error reason: `worktree-exclusive` is outside the closed lease-scope union.
const badScope: QueueLeaseScope = "worktree-exclusive";
// @ts-expect-error reason: `suspended` is outside the closed recovery-state union.
const badRecovery: QueueParkRecoveryState = "suspended";
// @ts-expect-error reason: `preempted-for-close-item` is a cause, never a condition type.
const badCondition: QueueParkConditionType = "preempted-for-close-item";
// @ts-expect-error reason: a widened string is not assignable to the closed idle-reason set.
const widened: QueueLaneIdleReason = globalThis as unknown as string;

export type Probes = [
  RankUnion,
  WeightUnion,
  WeightSourceUnion,
  LeaseScopeUnion,
  LeaseOperationUnion,
  ParkCauseUnion,
  ParkConditionUnion,
  RecoveryUnion,
  LaneStateUnion,
  IdleReasonIsClosed,
  RankConstants,
  WeightConstants,
  LaneStateConstants,
  EntryKindLiteral,
  EntrySchemaLiteral,
  LeaseSchemaLiteral,
  ParkSchemaLiteral,
  GraphSchemaLiteral,
  RemovalKindLiteral,
  RemovalSchemaLiteral,
  RemovalReasonUnion,
  RemovalReasonConstants,
  RemovalResultConstants,
  GraphEntryHasNoRoot,
  typeof badRank,
  typeof badWeight,
  typeof badScope,
  typeof badRecovery,
  typeof badCondition,
  typeof widened,
];
