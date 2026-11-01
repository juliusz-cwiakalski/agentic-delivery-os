/**
 * `deps-satisfied` cases (TC-QREADY-005).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import {
  blockedBy,
  type FactsOverrides,
  failedWorkItemRead,
  GITHUB_SLICE_AVAILABILITY,
  makeWorkItem,
  workItemRead,
} from "../harness";

export type DepsCase = {
  readonly name: string;
  readonly facts: FactsOverrides;
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
};

const item = (entityId: string, extra: Partial<Parameters<typeof makeWorkItem>[0]> = {}) =>
  makeWorkItem({ entityId, labels: ["priority:high"], ...extra });

export const depsCases: readonly DepsCase[] = [
  {
    name: "zero-targets",
    facts: { tracker: workItemRead([item("176")]) },
    state: "satisfied",
    reason: "no-blocked-dependencies",
  },
  {
    name: "all-done",
    facts: {
      tracker: workItemRead([
        item("176", { relations: [blockedBy("179")] }),
        item("179", { deliveryState: "done" }),
      ]),
    },
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
  {
    name: "all-canceled",
    facts: {
      tracker: workItemRead([
        item("176", { relations: [blockedBy("179")] }),
        item("179", { deliveryState: "canceled" }),
      ]),
    },
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
  {
    name: "observed-open",
    facts: {
      tracker: workItemRead([
        item("176", { relations: [blockedBy("179")] }),
        item("179", { deliveryState: "in-progress" }),
      ]),
    },
    state: "unsatisfied",
    reason: "dependency-open",
    detail: "done:0; open:1; unknown:0",
  },
  {
    name: "mixed-open-unobserved",
    facts: {
      tracker: workItemRead([
        item("176", { relations: [blockedBy("179"), blockedBy("999")] }),
        item("179", { deliveryState: "in-progress" }),
      ]),
    },
    state: "unsatisfied",
    reason: "dependency-open",
    detail: "done:0; open:1; unknown:1",
  },
  {
    name: "one-unobserved",
    facts: {
      tracker: workItemRead([item("176", { relations: [blockedBy("999")] })]),
    },
    state: "unknown",
    reason: "dependency-unobserved",
    detail: "done:0; open:0; unknown:1",
  },
  {
    name: "all-unobserved",
    facts: {
      tracker: workItemRead([item("176", { relations: [blockedBy("999"), blockedBy("998")] })]),
    },
    state: "unknown",
    reason: "dependency-unobserved",
    detail: "done:0; open:0; unknown:2",
  },
  {
    name: "relations-unavailable",
    facts: {
      tracker: workItemRead([item("176")], GITHUB_SLICE_AVAILABILITY),
    },
    state: "unknown",
    reason: "signal-unavailable",
  },
  {
    name: "candidate-unobserved-before-signal",
    facts: {
      tracker: workItemRead([item("177")], GITHUB_SLICE_AVAILABILITY),
    },
    state: "unknown",
    reason: "work-item-unobserved",
  },
  {
    name: "tracker-read-failed",
    facts: { tracker: failedWorkItemRead("read-failed") },
    state: "unknown",
    reason: "work-item-unobserved",
  },
  {
    name: "restored-control",
    facts: {
      tracker: workItemRead([
        item("176", { relations: [blockedBy("179")] }),
        item("179", { deliveryState: "done" }),
      ]),
    },
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
];
