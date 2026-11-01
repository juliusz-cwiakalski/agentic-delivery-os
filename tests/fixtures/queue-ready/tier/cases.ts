/**
 * `tier-known` cases (TC-QREADY-007).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";

export type TierCase = {
  readonly name: string;
  readonly labels: readonly string[];
  readonly labelSignal?: "available" | "unavailable";
  readonly unobserved?: boolean;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
};

export const tierCases: readonly TierCase[] = [
  {
    name: "high",
    labels: ["priority:high"],
    state: "satisfied",
    reason: "tier-label",
    detail: "tier:priority-label; label:priority:high",
  },
  {
    name: "medium",
    labels: ["priority:medium"],
    state: "satisfied",
    reason: "tier-label",
    detail: "tier:priority-label; label:priority:medium",
  },
  {
    name: "low",
    labels: ["priority:low"],
    state: "satisfied",
    reason: "tier-label",
    detail: "tier:priority-label; label:priority:low",
  },
  {
    name: "mixed-case",
    labels: ["Priority:High"],
    state: "satisfied",
    reason: "tier-label",
    detail: "tier:priority-label; label:priority:high",
  },
  {
    name: "absent",
    labels: [],
    state: "unknown",
    reason: "tier-absent",
    detail: "tier:priority-label; none",
  },
  {
    name: "unrecognized",
    labels: ["priority:urgent", "bug"],
    state: "unknown",
    reason: "tier-absent",
    detail: "tier:priority-label; none",
  },
  {
    name: "conflict",
    labels: ["priority:high", "priority:low"],
    state: "unsatisfied",
    reason: "tier-conflict",
    detail: "tier:priority-label; labels:priority:high,priority:low",
  },
  {
    name: "duplicate-spelling",
    labels: ["priority:high", "Priority:High"],
    state: "satisfied",
    reason: "tier-label",
    detail: "tier:priority-label; label:priority:high",
  },
  {
    name: "unavailable",
    labels: ["priority:high"],
    labelSignal: "unavailable",
    state: "unknown",
    reason: "signal-unavailable",
  },
  {
    name: "unobserved",
    labels: [],
    unobserved: true,
    state: "unknown",
    reason: "work-item-unobserved",
  },
];
