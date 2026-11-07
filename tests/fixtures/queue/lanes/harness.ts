/**
 * Shared lane-fold builders for the GH-237 behaviour and golden suites.
 */
import { foldLanes, type QueueLaneEconomics } from "../../../../packages/core/src/domain/queue-lanes";
import { computeQueueSchedule } from "../../../../packages/core/src/domain/queue-precedence";
import {
  activeLease,
  makeFacts,
  type EntrySpec,
  type FactsOverrides,
  REPO_A,
  REPO_B,
} from "../schedule/harness";

export const DELIVERING = "GH-320";
export const QUOTA_PARKED = "GH-321";
export const FAILED = "GH-322";
export const HEAVY = "GH-323";

export type LaneCaseOverrides = FactsOverrides & {
  readonly economics?: Readonly<Record<string, QueueLaneEconomics>>;
  readonly degraded?: readonly ("daemon-unreachable")[];
};

export const laneSpecs = (): readonly EntrySpec[] => [
  { ref: DELIVERING, repository: REPO_A, priority: 1 },
  {
    ref: QUOTA_PARKED,
    repository: REPO_B,
    priority: 2,
    park: { state: "active", cause: "provider-quota", recheckMs: 300_000 },
  },
  { ref: FAILED, repository: "github.com/owner/repo-gamma", priority: 3 },
  { ref: HEAVY, repository: "github.com/owner/repo-delta", priority: 4 },
];

export const laneEconomics = (): Readonly<Record<string, QueueLaneEconomics>> => ({
  [DELIVERING]: { restarts: 1, amplification: 2 },
  [QUOTA_PARKED]: { restarts: null, amplification: null, amplificationWarning: "economics-underivable" },
  [FAILED]: { restarts: 4, amplification: 6, failedPastBudget: true },
});

export const laneFacts = (overrides: LaneCaseOverrides = {}) => {
  const { economics, degraded, ...factOverrides } = overrides;
  const facts = makeFacts(laneSpecs(), {
    ...factOverrides,
    leases: factOverrides.leases ?? [
      activeLease({ repository: REPO_A, holder: "holder-a", ref: DELIVERING }),
    ],
  });
  return {
    facts,
    economics: economics ?? laneEconomics(),
    degraded: degraded ?? (["daemon-unreachable"] as const),
  };
};

export const laneData = (overrides: LaneCaseOverrides = {}) => {
  const input = laneFacts(overrides);
  const schedule = computeQueueSchedule(input.facts, { next: 20 });
  return foldLanes({ schedule, economics: input.economics, degraded: input.degraded });
};
