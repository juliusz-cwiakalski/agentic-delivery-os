/**
 * `repo-free` cases (TC-QREADY-006).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import {
  activeChange,
  localContext,
  malformedLocalContext,
  missingLocalContext,
  type StatusLocalContextRead,
} from "../harness";

export type RepoCase = {
  readonly name: string;
  readonly localContext: StatusLocalContextRead;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
};

export const repoCases: readonly RepoCase[] = [
  {
    name: "no-active-change",
    localContext: localContext(),
    state: "satisfied",
    reason: "no-active-change",
    detail: "repo:local-context",
  },
  {
    name: "candidate-is-active-case-insensitive",
    localContext: localContext({ activeChange: activeChange({ workItemRef: "gh-176" }) }),
    state: "satisfied",
    reason: "candidate-is-active",
    detail: "repo:local-context; candidate-is-active",
  },
  {
    name: "other-active-change",
    localContext: localContext({ activeChange: activeChange({ workItemRef: "GH-179" }) }),
    state: "unsatisfied",
    reason: "other-active-change",
    detail: "repo:local-context; active-change:GH-179",
  },
  {
    name: "context-missing",
    localContext: missingLocalContext(),
    state: "unknown",
    reason: "local-context-missing",
  },
  {
    name: "context-malformed",
    localContext: malformedLocalContext(),
    state: "unknown",
    reason: "local-context-malformed",
  },
];
