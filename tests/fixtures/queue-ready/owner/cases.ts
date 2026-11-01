/**
 * `no-owner-gate` cases (TC-QREADY-008).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";

export type OwnerCase = {
  readonly name: string;
  readonly labels: readonly string[];
  readonly labelSignal?: "available" | "unavailable";
  readonly unobserved?: boolean;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
  readonly assignee?: string;
};

export const ownerCases: readonly OwnerCase[] = [
  { name: "none", labels: ["priority:high"], state: "satisfied", reason: "no-owner-labels" },
  {
    name: "one",
    labels: ["priority:high", "hand-back"],
    state: "unsatisfied",
    reason: "owner-labels",
    detail: "owner-labels:hand-back",
  },
  {
    name: "both",
    labels: ["priority:high", "hand-back", "human-input-needed"],
    state: "unsatisfied",
    reason: "owner-labels",
    detail: "owner-labels:hand-back,human-input-needed",
  },
  {
    name: "mixed-case",
    labels: ["priority:high", "Hand-Back"],
    state: "unsatisfied",
    reason: "owner-labels",
    detail: "owner-labels:hand-back",
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
  {
    name: "assignee-ignored",
    labels: ["priority:high"],
    assignee: "hand-back",
    state: "satisfied",
    reason: "no-owner-labels",
  },
];
