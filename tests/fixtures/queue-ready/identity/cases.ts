/**
 * Candidate and `blocked-by` target identity-resolution cases (TC-QREADY-036/037).
 */
import type {
  QueueReadyConditionState,
  QueueReadyReason,
} from "../../../../packages/core/src/contracts/index";
import { blockedBy, makeWorkItem, type WorkItem, workItemRead } from "../harness";
import { REF_64 } from "../refs/cases";

export type CandidateIdentityCase = {
  readonly name: string;
  readonly candidates: readonly string[];
  readonly items: readonly WorkItem[];
  readonly observed: readonly string[];
};

const item = (
  entityId: string,
  extra: Partial<Parameters<typeof makeWorkItem>[0]> = {},
): WorkItem => makeWorkItem({ entityId, labels: ["priority:high"], ...extra });

export const candidateIdentityCases: readonly CandidateIdentityCase[] = [
  {
    name: "exact-canonical",
    candidates: ["GH-176"],
    items: [item("GH-176")],
    observed: ["GH-176"],
  },
  {
    name: "exact-case-insensitive",
    candidates: ["GH-176"],
    items: [item("gh-176")],
    observed: ["GH-176"],
  },
  {
    name: "bare-number-bridge",
    candidates: ["GH-176"],
    items: [item("176")],
    observed: ["GH-176"],
  },
  { name: "wrong-number", candidates: ["GH-176"], items: [item("177")], observed: [] },
  {
    name: "ambiguous-suffix",
    candidates: ["GH-7", "PDEV-7"],
    items: [item("7")],
    observed: [],
  },
  {
    name: "leading-zero-mismatch-176",
    candidates: ["GH-176"],
    items: [item("0176")],
    observed: [],
  },
  {
    name: "leading-zero-mismatch-007",
    candidates: ["GH-007"],
    items: [item("7")],
    observed: [],
  },
  {
    name: "preserved-leading-zero",
    candidates: ["GH-007"],
    items: [item("007")],
    observed: ["GH-007"],
  },
  {
    name: "non-digit-issue",
    candidates: ["GH-176"],
    items: [item("issue-176")],
    observed: [],
  },
  {
    name: "non-digit-extra",
    candidates: ["GH-176"],
    items: [item("GH-176-extra")],
    observed: [],
  },
  {
    name: "exact-beats-ambiguity",
    candidates: ["GH-7", "PDEV-7"],
    items: [item("GH-7")],
    observed: ["GH-7"],
  },
  {
    name: "multi-candidate-independent",
    candidates: ["GH-176", "GH-999"],
    items: [item("176")],
    observed: ["GH-176"],
  },
  {
    name: "exact-64-char",
    candidates: [REF_64],
    items: [item(REF_64)],
    observed: [REF_64],
  },
  {
    name: "over-cap-identity-no-match",
    candidates: ["GH-176"],
    items: [item("9".repeat(200))],
    observed: [],
  },
];

export type TargetIdentityCase = {
  readonly name: string;
  readonly target: string;
  readonly observedItems: readonly WorkItem[];
  readonly state: QueueReadyConditionState;
  readonly reason: QueueReadyReason;
  readonly detail: string;
};

const candidateWith = (target: string): WorkItem => item("176", { relations: [blockedBy(target)] });

export const targetIdentityCases: readonly TargetIdentityCase[] = [
  {
    name: "exact-done",
    target: "179",
    observedItems: [item("179", { deliveryState: "done" })],
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
  {
    name: "exact-open",
    target: "180",
    observedItems: [item("180", { deliveryState: "in-progress" })],
    state: "unsatisfied",
    reason: "dependency-open",
    detail: "done:0; open:1; unknown:0",
  },
  {
    name: "canonical-observed-unrequested",
    target: "GH-179",
    observedItems: [item("GH-179", { deliveryState: "in-progress" })],
    state: "unsatisfied",
    reason: "dependency-open",
    detail: "done:0; open:1; unknown:0",
  },
  {
    name: "no-match",
    target: "999",
    observedItems: [],
    state: "unknown",
    reason: "dependency-unobserved",
    detail: "done:0; open:0; unknown:1",
  },
  {
    name: "ambiguous-observed-suffix",
    target: "7",
    observedItems: [item("GH-7"), item("PDEV-7")],
    state: "unknown",
    reason: "dependency-unobserved",
    detail: "done:0; open:0; unknown:1",
  },
  {
    name: "leading-zero-mismatch",
    target: "0179",
    observedItems: [item("179", { deliveryState: "done" })],
    state: "unknown",
    reason: "dependency-unobserved",
    detail: "done:0; open:0; unknown:1",
  },
  {
    name: "unique-bridge-to-observed-canonical",
    target: "179",
    observedItems: [item("GH-179", { deliveryState: "done" })],
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
  {
    name: "mixed-open-unobserved",
    target: "180",
    observedItems: [item("180", { deliveryState: "in-progress" })],
    state: "unsatisfied",
    reason: "dependency-open",
    detail: "done:0; open:1; unknown:0",
  },
  {
    name: "over-cap-target-resolves-before-projection",
    target: "9".repeat(200),
    observedItems: [item("9".repeat(200), { deliveryState: "done" })],
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
  {
    name: "exact-64-char-target",
    target: REF_64,
    observedItems: [item(REF_64, { deliveryState: "done" })],
    state: "satisfied",
    reason: "dependencies-done",
    detail: "done:1; open:0; unknown:0",
  },
];

export const candidateWithRelation = candidateWith;
export const workItemReadOf = workItemRead;
